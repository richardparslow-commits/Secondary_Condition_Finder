import { beforeEach, describe, expect, it } from "vitest";

import {
  sealSessionPayload,
} from "@/lib/workflow-session-crypto";
import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  MAX_WORKFLOW_COOKIE_VALUE_BYTES,
  openWorkflowState,
  parseStoredSecondaryWorkflowState,
  sealWorkflowState,
  workflowSessionToQueryParams,
} from "@/lib/secondary-workflow/session";
import {
  approximateSealedCookieBytes,
  decodeWorkflowState,
  encodeWorkflowState,
  resetWorkflowCatalogEncodingCache,
  workflowCatalogFingerprint,
  WorkflowCookieEncodingError,
} from "@/lib/secondary-workflow/cookie-encoding";

/**
 * Contract tests for the compact workflow-cookie transport and the
 * cookie-budget failure UX:
 *
 *  - Catalog-referenced IDs ride as catalog indices with a versioned catalog
 *    fingerprint (fail closed on mismatch), while free-text context rides
 *    verbatim. The rest of the app keeps the string-ID state shape.
 *  - The dominant cost (repeated 20-30 char condition IDs) shrinks enough
 *    that a dozens-of-conditions state fits MAX_WORKFLOW_COOKIE_VALUE_BYTES.
 *  - Budget overflow throws WorkflowCookieBudgetError before jar.set, and the
 *    secondary server actions translate it into the context-too-large
 *    validation redirect instead of a generic failure.
 */

const SECRET = "cookie-budget-probe-secret-0123456789abcdef"; // 42 chars

function bigState() {
  // 60 real catalog conditions with ratings and timelines — the "veteran
  // selects dozens of conditions" scenario that overflowed the legacy
  // string-ID encoding. IDs resolve against the loaded catalog at runtime so
  // this fixture stays honest if the catalog evolves.
  const unique = loadConditionCatalog()
    .map((condition) => condition.id)
    .sort()
    .slice(0, 60);
  const ratings: Record<string, number | null> = {};
  const timeline: Record<string, { onsetYear?: number; diagnosisYear?: number }> = {};
  for (const id of unique) {
    ratings[id] = 30;
    timeline[id] = { onsetYear: 2010, diagnosisYear: 2015 };
  }
  return parseStoredSecondaryWorkflowState({
    diagnosedConditionIds: unique,
    serviceConnectedConditionIds: unique,
    ratingsByConditionId: ratings,
    conditionTimeline: timeline,
    documentsShared: true,
    medications: ["metformin", "sertraline"],
  });
}

describe("compact cookie transport", () => {
  beforeEach(() => {
    resetWorkflowCatalogEncodingCache();
  });

  it("round-trips a dozens-of-conditions state exactly", () => {
    const state = bigState();
    const sealed = sealWorkflowState(state, SECRET);
    const opened = openWorkflowState(sealed, SECRET);

    expect(opened).not.toBeNull();
    expect(opened).toEqual(state);
  });

  it("maps the decoded state into the same Step 5 query params as the legacy shape", () => {
    const state = bigState();
    const opened = openWorkflowState(sealWorkflowState(state, SECRET), SECRET)!;
    const params = workflowSessionToQueryParams(opened);

    expect(params.diagnosed).toEqual(state.diagnosedConditionIds);
    expect(params.serviceConnected).toEqual(state.serviceConnectedConditionIds);
    const first = state.diagnosedConditionIds![0];
    expect(params[`rating-${first}`]).toBe("30");
    expect(params.documentsShared).toBe("yes");
  });

  it("keeps a dozens-of-conditions state under the cookie budget where the legacy encoding overflowed", () => {
    const state = bigState();

    const compactBytes = sealWorkflowState(state, SECRET).length;
    const legacyBytes = Buffer.byteLength(
      sealSessionPayload(state, SECRET, { maxAgeSeconds: 1800 }),
      "utf8",
    );

    expect(compactBytes).toBeLessThan(legacyBytes);
    expect(compactBytes).toBeLessThanOrEqual(MAX_WORKFLOW_COOKIE_VALUE_BYTES);
    expect(legacyBytes).toBeGreaterThan(MAX_WORKFLOW_COOKIE_VALUE_BYTES);
  });

  it("still encodes to a modest payload with the free-text context near its own limits", () => {
    const state = parseStoredSecondaryWorkflowState({
      diagnosedConditionIds: ["ptsd"],
      documentsShared: true,
      medications: Array.from({ length: 8 }, (_, index) => `medication ${index} ${"x".repeat(120)}`),
      treatments: Array.from({ length: 8 }, (_, index) => `treatment ${index} ${"x".repeat(120)}`),
    });
    const bytes = sealWorkflowState(state, SECRET).length;
    expect(bytes).toBeGreaterThan(1000);
    expect(bytes).toBeLessThanOrEqual(MAX_WORKFLOW_COOKIE_VALUE_BYTES);
  });

  it("fails closed on a fingerprint mismatch or an out-of-range catalog index", () => {
    const state = parseStoredSecondaryWorkflowState({
      diagnosedConditionIds: ["ptsd"],
      serviceConnectedAnswerDraft: { ptsd: "yes" },
    });
    const encoded = encodeWorkflowState(state);

    expect(decodeWorkflowState({ ...encoded, fp: "tampered-fp-0000" })).toBeNull();
    expect(decodeWorkflowState({ ...encoded, dx: [99999] })).toBeNull();
    expect(decodeWorkflowState({ ...encoded, v: 99 })).toBeNull();
    expect(decodeWorkflowState(encoded)).toEqual(
      expect.objectContaining({ diagnosedConditionIds: ["ptsd"] }),
    );
  });

  it("binds the fingerprint to the current catalog revision", () => {
    const before = workflowCatalogFingerprint();
    expect(before).toMatch(/^[A-Za-z0-9_-]{10,20}$/);
    resetWorkflowCatalogEncodingCache();
    expect(workflowCatalogFingerprint()).toBe(before);
  });

  it("refuses to encode catalog-unknown condition ids", () => {
    expect(() =>
      encodeWorkflowState({ diagnosedConditionIds: ["not-in-the-catalog"] }),
    ).toThrow(WorkflowCookieEncodingError);
  });

  it("still reads legacy string-ID cookies written before the encoding existed", () => {
    const legacyState = parseStoredSecondaryWorkflowState({
      diagnosedConditionIds: ["ptsd", "sleep-apnea"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 70, "sleep-apnea": null },
      conditionTimeline: { ptsd: { onsetYear: 2004 } },
      documentsShared: false,
    });
    const legacySealed = sealSessionPayload(legacyState, SECRET, { maxAgeSeconds: 1800 });

    expect(openWorkflowState(legacySealed, SECRET)).toEqual(legacyState);
  });

  it("throws the typed budget error for a state that cannot fit and reports its size", () => {
    // Free-text context is the one payload component no transport encoding can
    // shrink; 20 entries x 160 chars x 3 fields exceeds the budget by design,
    // which is exactly the case the context-too-large error path serves.
    const state = parseStoredSecondaryWorkflowState({
      diagnosedConditionIds: ["ptsd"],
      medications: Array.from({ length: 20 }, () => "x".repeat(160)),
      treatments: Array.from({ length: 20 }, () => "y".repeat(160)),
      history: Array.from({ length: 20 }, () => "z".repeat(160)),
    });

    expect(approximateSealedCookieBytes(state)).toBeGreaterThan(MAX_WORKFLOW_COOKIE_VALUE_BYTES);
    let thrown: unknown;
    try {
      sealWorkflowState(state, SECRET);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).name).toBe("WorkflowCookieBudgetError");
  });
});
