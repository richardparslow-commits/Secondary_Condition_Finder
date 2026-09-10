import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  clearSecondaryWorkflowLocalState,
  evidenceGapReviewStorageKey,
  pathwayRecordChecklistStorageKey,
  secondaryWorkflowLocalStorageKeys,
} from "../src/lib/secondary-workflow/local-state";
import { evidenceAnalysisStorageKey } from "../src/lib/evidence/extract";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("secondary workflow completion privacy lifecycle", () => {
  it("clears exactly the three browser-local secondary workflow stores", () => {
    const removed: string[] = [];
    const storage = {
      removeItem(key: string) {
        removed.push(key);
      },
    };

    clearSecondaryWorkflowLocalState(storage);

    expect(secondaryWorkflowLocalStorageKeys).toEqual([
      evidenceAnalysisStorageKey,
      evidenceGapReviewStorageKey,
      pathwayRecordChecklistStorageKey,
    ]);
    expect(removed).toEqual([
      evidenceAnalysisStorageKey,
      evidenceGapReviewStorageKey,
      pathwayRecordChecklistStorageKey,
    ]);
  });

  it("uses server actions to clear the encrypted cookie before completion redirects", () => {
    const actions = readRepoFile("src/lib/actions/secondary.ts");

    expect(actions).toContain("clearSecondaryWorkflowSession");
    expect(actions).toMatch(/finishSecondaryWorkflow[\s\S]*await clearSecondaryWorkflowSession\(\);[\s\S]*redirect\("\/secondary"\)/);
    expect(actions).toMatch(/restartSecondaryWorkflow[\s\S]*await clearSecondaryWorkflowSession\(\);[\s\S]*redirect\("\/secondary\/diagnosed"\)/);
  });

  it("clears browser-local state before both user-reachable completion submissions", () => {
    const controls = readRepoFile("src/components/secondary/SecondaryWorkflowCompletionActions.tsx");
    const evidencePage = readRepoFile("src/app/secondary/evidence/page.tsx");

    expect(controls).toContain("clearSecondaryWorkflowLocalState(window.sessionStorage)");
    expect(controls).toContain("action={finishSecondaryWorkflow}");
    expect(controls).toContain("action={restartSecondaryWorkflow}");
    expect(controls).toContain("onSubmit={clearBrowserLocalWorkflowState}");
    expect(evidencePage).toContain("<SecondaryWorkflowCompletionActions />");
    expect(evidencePage).toContain("<SecondaryWorkflowRestartButton label=\"Clear saved review state and start over\" />");
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
