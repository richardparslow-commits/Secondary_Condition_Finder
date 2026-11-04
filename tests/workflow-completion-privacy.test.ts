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
    // The hook's module snapshot must be invalidated too, or a client-side
    // navigation re-reads the pre-restart context (Heal restart defect).
    expect(controls).toContain("resetBrowserWorkflowContextSnapshot()");
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

  it("links the published privacy intake from the completion controls", () => {
    // Everything these controls clear is browser-local, so a visitor who wants
    // the data the *application* holds deleted has no control here that can do
    // it. Finishing a review is exactly when that question is asked, so the
    // published intake is linked from the completion surface rather than left
    // to the policy (R-01 / B-02). The wording has to keep the two apart:
    // reading "Finish Review" as "everything about me is deleted" is the
    // overclaim the link exists to prevent.
    //
    // The pointer itself is now shared with the presumptive track's clearing
    // control (`PrivacyDeletionCue`), so the destination and the distinction are
    // stated once and held by `tests/privacy-deletion-pointer.test.tsx` too. This
    // suite pins the half that belongs to this surface: it renders the shared cue
    // and supplies its own sentence about what *it* clears.
    const controls = readRepoFile("src/components/secondary/SecondaryWorkflowCompletionActions.tsx");

    expect(controls).toContain('from "@/components/privacy/PrivacyDeletionCue"');
    expect(controls).toMatch(/<PrivacyDeletionCue/);
    expect(
      controls,
      "the completion surface must describe what *it* clears",
    ).toContain('clearedStatement="Finishing or restarting clears what this browser holds."');

    // The destination is not retyped here, and no second channel is hand-rolled
    // beside the shared one.
    expect(
      controls,
      "the intake path must stay single-sourced from the shared pointer",
    ).not.toContain('href="/privacy/request"');
    expect(controls).not.toContain("mailto:");

    // The shared component keeps the two sides of the distinction apart.
    const cue = readRepoFile("src/components/privacy/PrivacyDeletionCue.tsx");
    expect(cue, "the cue must locate the case it is about").toMatch(/this browser/);
    expect(cue, "and the other side of the boundary").toMatch(/application/);
    expect(cue).toContain('href="/privacy"');
    expect(cue).not.toContain("mailto:");
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
