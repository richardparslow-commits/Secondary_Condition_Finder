// @vitest-environment jsdom
/**
 * Regression suite for Heal `s4-depth-downgrade-steps-disagree-1`.
 *
 * After analyzing 12 sources under Extended and switching back to Standard,
 * Step 4 restored the store with Standard's 10-source window while Step 6, a
 * depth-less reader using the widest read ceiling, still showed all 12. A
 * Standard downgrade now re-serializes the store into Standard's window, so
 * every surface reads the same retained sources.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";
import { EXTENDED_LIMITS } from "@/lib/evidence/limits";
import { serializeStoredEvidence } from "@/lib/evidence/storage";
import { evidenceDepthStorageKey } from "@/lib/secondary-workflow/local-state";

const analyses = (count: number): EvidenceAnalysis[] =>
  Array.from({ length: count }, (_, index) => {
    const sourceName = `source-${String(index + 1).padStart(2, "0")}`;
    return {
      version: 1,
      sourceName,
      sourceId: `staged-${index + 1}`,
      excerpts: [
        {
          sourceName,
          locator: "page 1",
          quote: `Record for ${sourceName} describing the condition.`,
          category: "treatment",
          strength: "supporting",
          clinicianAuthored: false,
          matchedTerms: [],
        },
      ],
      nexusRelevantCount: 0,
      supportingCount: 1,
    };
  });

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(
    evidenceAnalysisStorageKey,
    serializeStoredEvidence(analyses(12), EXTENDED_LIMITS),
  );
  window.sessionStorage.setItem(evidenceDepthStorageKey, "extended");
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("a depth downgrade reconciles the store with Step 6", () => {
  it("keeps the 10 newest sources after switching to Standard and says what was removed", async () => {
    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(12));

    fireEvent.change(screen.getByLabelText("Active depth"), {
      target: { value: "standard" },
    });

    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(10));
    expect(screen.queryByText(/source-01/)).toBeNull();
    expect(screen.getAllByText(/source-03/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 older analyzed source\(s\) were removed/)).toBeTruthy();

    const stored = JSON.parse(
      window.sessionStorage.getItem(evidenceAnalysisStorageKey) ?? "[]",
    ) as EvidenceAnalysis[];
    expect(stored.map((analysis) => analysis.sourceName)).toEqual([
      "source-03",
      "source-04",
      "source-05",
      "source-06",
      "source-07",
      "source-08",
      "source-09",
      "source-10",
      "source-11",
      "source-12",
    ]);
  });
});
