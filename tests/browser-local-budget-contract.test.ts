import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  browserWorkflowContextStorageKey,
  readBrowserWorkflowContext,
  writeBrowserWorkflowContext,
} from "@/lib/secondary-workflow/browser-context";
import {
  applyDocumentsStep,
  persistStepContext,
  persistStepResult,
} from "@/lib/secondary-workflow/client-steps";
import {
  MAX_CONTEXT_ITEM_LENGTH,
  MAX_CONTEXT_ITEMS,
} from "@/lib/secondary-workflow/state";

/**
 * PRIV-01 stage 2 successor of the cookie-budget action contract.
 *
 * The sealed 3.8 KB cookie and its `WorkflowCookieBudgetError` are gone; the
 * browser-local record schema now carries the same bounds. The contract is the
 * same shape: an over-bounds write must fail BEFORE touching the last good
 * record, the user must be held on their step with the same actionable
 * `context-too-large` / `invalid-context` guidance, and the flow must never
 * advance after a failed persistence.
 */

const catalog = loadConditionCatalog();

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    raw: data,
  };
}

function formWith(entries: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const entry of Array.isArray(value) ? value : [value]) form.append(key, entry);
  }
  return form;
}

describe("browser-local budget contract (context-too-large)", () => {
  it("fails an out-of-bounds write before touching the previous record", () => {
    const storage = fakeStorage();
    writeBrowserWorkflowContext(storage, { medications: ["lisinopril"] });
    const before = storage.getItem(browserWorkflowContextStorageKey);

    const tooMany = Array.from({ length: MAX_CONTEXT_ITEMS + 1 }, (_, i) => `med-${i}`);
    expect(() => writeBrowserWorkflowContext(storage, { medications: tooMany })).toThrow();
    expect(() =>
      writeBrowserWorkflowContext(storage, {
        history: ["x".repeat(MAX_CONTEXT_ITEM_LENGTH + 1)],
      }),
    ).toThrow();

    expect(storage.getItem(browserWorkflowContextStorageKey)).toBe(before);
    expect(readBrowserWorkflowContext(storage)?.medications).toEqual(["lisinopril"]);
  });

  it("holds the user on the documents step with invalid-context on oversized entries", () => {
    const context = {
      diagnosedConditionIds: ["ptsd"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 70 },
    };
    const tooMany = Array.from({ length: MAX_CONTEXT_ITEMS + 1 }, (_, i) => `med-${i}`).join("\n");
    const result = applyDocumentsStep(
      { version: 1, ...context },
      formWith({ documentsShared: "yes", medications: tooMany }),
      catalog,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-context");
      expect(result.next).toBeUndefined();
    }
  });

  it("never advances after a failed persistence — it reports context-too-large", () => {
    const storage = fakeStorage();
    const persist = (input: Parameters<typeof writeBrowserWorkflowContext>[1]) =>
      writeBrowserWorkflowContext(
        { ...storage, setItem: () => { throw new Error("quota"); } },
        input,
      );

    const outcome = persistStepResult(persist, {
      context: { diagnosedConditionIds: ["ptsd"] },
      next: "/secondary/service-connected",
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe("context-too-large");
    expect("next" in outcome).toBe(false);

    const draft = persistStepContext(persist, { diagnosedConditionIds: ["ptsd"] });
    expect(draft.ok).toBe(false);
  });

  it("removes every PHI-bearing Server Action and keeps step submissions client-local", () => {
    const stepSources = [
      "DiagnosedStep",
      "ServiceConnectedStep",
      "RatingsStep",
      "UploadStep",
      "SuggestionsStep",
      "EvidenceStep",
    ].map((name) =>
      fs.readFileSync(path.join(process.cwd(), `src/components/secondary/steps/${name}.tsx`), "utf8"),
    );

    expect(fs.existsSync(path.join(process.cwd(), "src/lib/actions/secondary.ts"))).toBe(false);
    for (const source of stepSources) {
      expect(source).not.toContain("@/lib/actions/secondary");
      expect(source).not.toContain("writeSecondaryWorkflowSession");
      expect(source).not.toContain("readSecondaryWorkflowSession");
      expect(source).not.toContain("action={");
    }
  });
});
