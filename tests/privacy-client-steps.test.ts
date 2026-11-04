import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  applyDiagnosedStep,
  applyDocumentsStep,
  applyRatingsStep,
  applyServiceConnectedStep,
} from "@/lib/secondary-workflow/client-steps";
import { MAX_CONTEXT_ITEMS } from "@/lib/secondary-workflow/state";
import type { BrowserWorkflowContext } from "@/lib/secondary-workflow/browser-context";

/**
 * PRIV-01 stage 2 behavior contract for the browser-side step logic.
 *
 * These functions are the client-side replacements for the retired PHI-bearing
 * Server Actions. The migration must change WHERE state lives — not what the
 * wizard accepts, rejects, preserves as a draft, or resets downstream.
 */

const catalog = loadConditionCatalog();
const PTSD = "ptsd";
const TINNITUS = "tinnitus";

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  }
  return data;
}

function context(input: Omit<BrowserWorkflowContext, "version">): BrowserWorkflowContext {
  return { version: 1, ...input };
}

describe("browser-side step logic (PRIV-01 stage 2)", () => {
  it("Step 1 requires at least one diagnosed selection and resets downstream steps", () => {
    const empty = applyDiagnosedStep(null, form({}), catalog);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("select-diagnosed");

    const unknownOnly = applyDiagnosedStep(null, form({ diagnosed: "not-a-condition" }), catalog);
    expect(unknownOnly.ok).toBe(false);

    const previous = context({
      diagnosedConditionIds: [PTSD],
      serviceConnectedConditionIds: [PTSD],
      ratingsByConditionId: { [PTSD]: 70 },
      documentsShared: true,
    });
    const result = applyDiagnosedStep(previous, form({ diagnosed: TINNITUS }), catalog);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The whole record is replaced, matching the legacy cookie write: going
      // back to Step 1 invalidates downstream selections.
      expect(result.context).toEqual({ diagnosedConditionIds: [TINNITUS] });
      expect(result.next).toBe("/secondary/service-connected");
    }
  });

  it("Step 2 preserves partial answers as a draft and holds the user on the step", () => {
    const current = context({
      diagnosedConditionIds: [PTSD, TINNITUS],
      serviceConnectedConditionIds: [],
    });

    const partial = applyServiceConnectedStep(
      current,
      form({ [`serviceConnected-${PTSD}`]: "yes" }),
      catalog,
    );
    expect(partial.ok).toBe(false);
    if (!partial.ok) {
      expect(partial.code).toBe("answer-service-connected");
      expect(partial.context).toEqual({
        diagnosedConditionIds: [PTSD, TINNITUS],
        serviceConnectedAnswerDraft: { [PTSD]: "yes" },
      });
      // The owning step comes back with the failure so the caller can carry the
      // error code in the URL, the static error-URL contract e2e/validation-errors.mjs
      // asserts for every step.
      expect(partial.next).toBe("/secondary/service-connected");
    }

    const allNo = applyServiceConnectedStep(
      current,
      form({
        [`serviceConnected-${PTSD}`]: "no",
        [`serviceConnected-${TINNITUS}`]: "no",
      }),
      catalog,
    );
    expect(allNo.ok).toBe(false);
    if (!allNo.ok) {
      expect(allNo.code).toBe("no-service-connected");
      expect(allNo.context).toEqual({
        diagnosedConditionIds: [PTSD, TINNITUS],
        serviceConnectedConditionIds: [],
        ratingsByConditionId: {},
        permanentAndTotalConditionIds: [],
        serviceConnectedAnswerDraft: { [PTSD]: "no", [TINNITUS]: "no" },
      });
    }

    const yes = applyServiceConnectedStep(
      current,
      form({
        [`serviceConnected-${PTSD}`]: "yes",
        [`serviceConnected-${TINNITUS}`]: "no",
      }),
      catalog,
    );
    expect(yes.ok).toBe(true);
    if (yes.ok) {
      expect(yes.context).toEqual({
        diagnosedConditionIds: [PTSD, TINNITUS],
        serviceConnectedConditionIds: [PTSD],
        ratingsByConditionId: {},
        permanentAndTotalConditionIds: [],
      });
      expect(yes.next).toBe("/secondary/ratings");
    }
  });

  it("Step 2 ignores overposted keys for conditions outside the diagnosed set", () => {
    const current = context({ diagnosedConditionIds: [PTSD] });
    const result = applyServiceConnectedStep(
      current,
      form({
        [`serviceConnected-${PTSD}`]: "yes",
        "serviceConnected-copd": "yes",
        diagnosed: "copd",
      }),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.serviceConnectedConditionIds).toEqual([PTSD]);
  });

  it("Step 3 requires a rating for every service-connected condition and bounds values", () => {
    const current = context({
      diagnosedConditionIds: [PTSD, TINNITUS],
      serviceConnectedConditionIds: [PTSD, TINNITUS],
    });

    const missing = applyRatingsStep(current, form({ [`rating-${PTSD}`]: "70" }), catalog);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("select-rating");

    const invalid = applyRatingsStep(
      current,
      form({ [`rating-${PTSD}`]: "70", [`rating-${TINNITUS}`]: "101" }),
      catalog,
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe("invalid-rating");

    const result = applyRatingsStep(
      current,
      form({ [`rating-${PTSD}`]: "70", [`rating-${TINNITUS}`]: "decline" }),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.ratingsByConditionId).toEqual({ [PTSD]: 70, [TINNITUS]: null });
      expect(result.context.permanentAndTotalConditionIds).toEqual([]);
      expect(result.next).toBe("/secondary/upload");
    }
  });

  it("Step 3 preserves a 100% P&T designation instead of collapsing it to 100", () => {
    const current = context({
      diagnosedConditionIds: [PTSD],
      serviceConnectedConditionIds: [PTSD],
    });
    const result = applyRatingsStep(
      current,
      form({ [`rating-${PTSD}`]: "100-pt" }),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.ratingsByConditionId).toEqual({ [PTSD]: 100 });
      expect(result.context.permanentAndTotalConditionIds).toEqual([PTSD]);
    }
  });

  it("Step 3 sends a user with no service-connected selection back to Step 2", () => {
    const current = context({
      diagnosedConditionIds: [PTSD],
      serviceConnectedConditionIds: [],
    });
    const result = applyRatingsStep(current, form({}), catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("no-service-connected");
      expect(result.next).toBe("/secondary/service-connected");
    }
  });

  it("Step 4 enforces the shared context bounds before parsing", () => {
    const current = context({
      diagnosedConditionIds: [PTSD],
      serviceConnectedConditionIds: [PTSD],
      ratingsByConditionId: { [PTSD]: 70 },
    });

    const noChoice = applyDocumentsStep(current, form({}), catalog);
    expect(noChoice.ok).toBe(false);
    if (!noChoice.ok) expect(noChoice.code).toBe("select-documents");

    const oversized = applyDocumentsStep(
      current,
      form({
        documentsShared: "yes",
        medications: Array.from({ length: MAX_CONTEXT_ITEMS + 1 }, (_, i) => `m-${i}`).join("\n"),
      }),
      catalog,
    );
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.code).toBe("invalid-context");

    const badYear = applyDocumentsStep(
      current,
      form({ documentsShared: "yes", [`onsetYear-${PTSD}`]: "1800" }),
      catalog,
    );
    expect(badYear.ok).toBe(false);
    if (!badYear.ok) expect(badYear.code).toBe("invalid-context");
  });

  it("Step 4 persists bounded context and symptom prompts, then advances to Step 5", () => {
    const current = context({
      diagnosedConditionIds: [PTSD, TINNITUS],
      serviceConnectedConditionIds: [PTSD],
      ratingsByConditionId: { [PTSD]: 70 },
      documentsShared: false,
    });

    const result = applyDocumentsStep(
      current,
      form({
        documentsShared: "yes",
        medications: "SSRI\nNSAID\nSSRI",
        treatments: "physical therapy",
        history: "smoking",
        symptomIds: ["recurrent-headache", "not-a-symptom"],
        [`onsetYear-${PTSD}`]: "2015",
        [`diagnosisYear-${PTSD}`]: "2016",
      }),
      catalog,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.documentsShared).toBe(true);
      expect(result.context.medications).toEqual(["SSRI", "NSAID"]);
      expect(result.context.treatments).toEqual(["physical therapy"]);
      expect(result.context.history).toEqual(["smoking"]);
      expect(result.context.symptomIds).toEqual(["recurrent-headache"]);
      expect(result.context.conditionTimeline).toEqual({
        [PTSD]: { onsetYear: 2015, diagnosisYear: 2016 },
      });
      expect(result.next).toBe("/secondary/suggestions");
    }
  });

  it("Step 4 timeline writes are limited to diagnosed conditions in this review", () => {
    const current = context({
      diagnosedConditionIds: [PTSD],
      serviceConnectedConditionIds: [PTSD],
      ratingsByConditionId: { [PTSD]: 70 },
    });
    const result = applyDocumentsStep(
      current,
      form({
        documentsShared: "no",
        [`onsetYear-${TINNITUS}`]: "2001",
      }),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.conditionTimeline ?? {}).toEqual({});
    }
  });
});
