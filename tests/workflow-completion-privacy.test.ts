import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  clearSecondaryWorkflowLocalState,
  evidenceDepthStorageKey,
  evidenceGapReviewStorageKey,
  pathwayRecordChecklistStorageKey,
  secondaryWorkflowLocalStorageKeys,
  vaGovRecordWalkthroughStorageKey,
} from "../src/lib/secondary-workflow/local-state";
import { browserWorkflowContextStorageKey } from "../src/lib/secondary-workflow/browser-context";
import { evidenceAnalysisStorageKey } from "../src/lib/evidence/extract";
import { OCR_CHECKPOINT_STORAGE_KEY } from "../src/lib/evidence/ocr-session";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/**
 * PRIV-01 stage 2: completion no longer clears a server cookie (there is no
 * cookie in the workflow path); it clears every browser-local workflow key and
 * navigates only after cleanup is confirmed.
 */
describe("secondary workflow completion privacy lifecycle", () => {
  it("clears all seven registered browser-local workflow stores", () => {
    const removed: string[] = [];
    const storage = {
      removeItem(key: string) {
        removed.push(key);
      },
    };

    clearSecondaryWorkflowLocalState(storage);

    expect(secondaryWorkflowLocalStorageKeys).toEqual([
      browserWorkflowContextStorageKey,
      evidenceAnalysisStorageKey,
      evidenceGapReviewStorageKey,
      pathwayRecordChecklistStorageKey,
      vaGovRecordWalkthroughStorageKey,
      OCR_CHECKPOINT_STORAGE_KEY,
      evidenceDepthStorageKey,
    ]);
    expect(removed).toEqual([
      browserWorkflowContextStorageKey,
      evidenceAnalysisStorageKey,
      evidenceGapReviewStorageKey,
      pathwayRecordChecklistStorageKey,
      vaGovRecordWalkthroughStorageKey,
      OCR_CHECKPOINT_STORAGE_KEY,
      evidenceDepthStorageKey,
    ]);
  });

  it("clears browser-local state before either completion navigation", () => {
    const controls = readRepoFile("src/components/secondary/SecondaryWorkflowCompletionActions.tsx");

    expect(controls).toContain("clearSecondaryWorkflowLocalState(window.sessionStorage)");
    expect(controls).toContain('clearAndLeave("/secondary")');
    expect(controls).toContain('clearAndLeave("/secondary/diagnosed")');
    // A failed cleanup must not navigate: the error is surfaced instead.
    expect(controls).toContain("setError(");
    expect(controls).toContain("cleanup could not be confirmed");
  });

  it("surfaces the same completion controls on Step 6", () => {
    const evidenceStep = readRepoFile("src/components/secondary/steps/EvidenceStep.tsx");

    expect(evidenceStep).toContain("<SecondaryWorkflowCompletionActions />");
    expect(evidenceStep).toContain(
      '<SecondaryWorkflowRestartButton label="Clear saved review state and start over" />',
    );
  });

  it("keeps the retired server completion actions deleted", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/actions/secondary.ts"))).toBe(false);
  });

  it("does not add clearing-time network or telemetry channels", () => {
    const controls = readRepoFile("src/components/secondary/SecondaryWorkflowCompletionActions.tsx");
    const localState = readRepoFile("src/lib/secondary-workflow/local-state.ts");

    for (const source of [controls, localState]) {
      expect(source).not.toContain("fetch(");
      expect(source).not.toContain("sendBeacon");
      expect(source).not.toContain("ApplicationInsights");
      expect(source).not.toContain("localStorage");
    }
  });
});
