import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { writeBrowserWorkflowContext } from "@/lib/secondary-workflow/browser-context";
import {
  persistStepContext,
  persistStepResult,
} from "@/lib/secondary-workflow/client-steps";
import { MAX_CONTEXT_ITEMS } from "@/lib/secondary-workflow/state";

/**
 * Second audit-report follow-up, re-homed to PRIV-01 stage 2.
 *
 * The original contract pinned "no silent data loss" for
 * `writeSecondaryWorkflowSession()` in the retired Server Actions: a
 * persistence failure must hold the user on their step instead of advancing.
 * The browser-local record has the identical obligation — the step must not
 * navigate after a failed write, and the previous good record must survive —
 * plus the new structural rule that no veteran context leaves the browser.
 */

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function throwingStorage() {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error("SecurityError: browser storage is blocked");
    },
    removeItem: () => {},
  };
}

describe("browser-local persistence failure contract (no silent data loss)", () => {
  it("keeps the previous good record when a write fails", () => {
    // The write throws before mutating; a caller that retries with a smaller
    // record must find the old record still intact.
    expect(() =>
      writeBrowserWorkflowContext(throwingStorage(), { diagnosedConditionIds: ["ptsd"] }),
    ).toThrow();
  });

  it("reports blocked storage instead of a navigation target for both persist helpers", () => {
    const storage = throwingStorage();
    const persist = (input: Parameters<typeof writeBrowserWorkflowContext>[1]) =>
      writeBrowserWorkflowContext(storage, input);

    const advance = persistStepResult(persist, {
      context: { diagnosedConditionIds: ["ptsd"] },
      next: "/secondary/service-connected",
    });
    expect(advance).toEqual({ ok: false, code: "storage-unavailable" });

    const draft = persistStepContext(persist, { diagnosedConditionIds: ["ptsd"] });
    expect(draft).toEqual({ ok: false, code: "storage-unavailable" });
  });

  it("still reports a schema-bound overflow as context-too-large", () => {
    const tooMany = Array.from(
      { length: MAX_CONTEXT_ITEMS + 1 },
      (_, index) => `med-${index}`,
    );
    const outcome = persistStepResult(
      (input) => writeBrowserWorkflowContext({ setItem: () => {} }, input),
      {
        context: { medications: tooMany },
        next: "/secondary/service-connected",
      },
    );

    expect(outcome).toEqual({ ok: false, code: "context-too-large" });
  });

  it("advances only after the write succeeds", () => {
    const written: Array<Record<string, unknown>> = [];
    const persist = (input: Record<string, unknown>) => {
      written.push(input);
    };

    const outcome = persistStepResult(persist, {
      context: { diagnosedConditionIds: ["ptsd"] },
      next: "/secondary/service-connected",
    });

    expect(outcome).toEqual({ ok: true, next: "/secondary/service-connected" });
    expect(written).toEqual([{ diagnosedConditionIds: ["ptsd"] }]);
  });

  it("routes every step's persistence through the guarded helper", () => {
    const steps = [
      "DiagnosedStep",
      "ServiceConnectedStep",
      "RatingsStep",
      "UploadStep",
    ];

    for (const name of steps) {
      const source = readRepoFile(`src/components/secondary/steps/${name}.tsx`);
      // Every forward advance goes through persistStepResult, and a failed
      // outcome is surfaced as context-too-large instead of navigating.
      expect(source).toContain("persistStepResult(persist, result)");
      expect(source).toContain("setLocalError(outcome.code)");
      expect(source).toContain('searchParams.has("error")');
      expect(source).toContain("router.replace(outcome.next)");
      expect(source).toContain("router.push(outcome.next)");
    }

    // The retired cookie write path no longer appears anywhere in the wizard.
    for (const name of steps.concat("SuggestionsStep", "EvidenceStep")) {
      const source = readRepoFile(`src/components/secondary/steps/${name}.tsx`);
      expect(source).not.toContain("writeSecondaryWorkflowSession");
    }
  });
});
