// @vitest-environment jsdom
/**
 * Regression suite for Heal defect 19 (2026-11-03 run): "An 11th analyzed
 * document silently removes the oldest from the review".
 *
 * `commitAnalysis` applied the retention window inside `mergeEvidenceAnalysis`
 * and only then asked the serializer for a dropped count. The serializer starts
 * from the already-trimmed array, so it can only report byte-budget evictions;
 * the cap eviction that removes the oldest source on the eleventh analysis has
 * no notice at all. Heal expects the same kind of notice the storage-full path
 * already raises.
 *
 * The fix moves the count next to the eviction (`mergeEvidenceAnalysisWithInfo`)
 * and reports both evictions in one message. The cases below pin the merge
 * accounting and then drive the real analyzer through eleven pasted analyses.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import type { EvidenceAnalysis } from "@/lib/evidence/extract";
import { STANDARD_LIMITS } from "@/lib/evidence/limits";
import { mergeEvidenceAnalysisWithInfo } from "@/lib/evidence/retention";

function makeAnalysis(sourceName: string): EvidenceAnalysis {
  return {
    version: 1,
    sourceName,
    excerpts: [
      {
        sourceName,
        locator: "page 1",
        quote: "diabetes mellitus aggravated by service",
        category: "aggravation",
        strength: "supporting",
        clinicianAuthored: false,
        matchedTerms: [],
      },
    ],
    nexusRelevantCount: 0,
    supportingCount: 1,
  };
}

describe("mergeEvidenceAnalysisWithInfo reports the retention window", () => {
  it("counts the source an eleventh analysis pushes out", () => {
    const existing = Array.from({ length: 10 }, (_unused, index) =>
      makeAnalysis(`source-${String(index + 1).padStart(2, "0")}`),
    );

    const merged = mergeEvidenceAnalysisWithInfo(
      existing,
      makeAnalysis("source-11"),
      STANDARD_LIMITS.storedSources,
    );

    expect(merged.dropped).toBe(1);
    expect(merged.analyses).toHaveLength(10);
    expect(merged.analyses[0]!.sourceName).toBe("source-02");
    expect(merged.analyses.at(-1)!.sourceName).toBe("source-11");
  });

  it("does not count re-analysis of the same document as a drop", () => {
    const existing = [
      makeAnalysis("source-01"),
      makeAnalysis("source-02"),
    ];

    const merged = mergeEvidenceAnalysisWithInfo(
      existing,
      makeAnalysis("source-02"),
      STANDARD_LIMITS.storedSources,
    );

    expect(merged.dropped).toBe(0);
    expect(merged.analyses.map((analysis) => analysis.sourceName)).toEqual([
      "source-01",
      "source-02",
    ]);
  });
});

async function analyzePastedSource(name: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(/Source name/), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText(/Paste exact extracted text/), {
    target: { value: `Record for ${name} describing the condition.` },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze pasted text locally" }));
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("the eleventh analyzed source is never dropped silently", () => {
  it("posts the retention notice and keeps the newest ten sources", async () => {
    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    for (let index = 1; index <= 11; index += 1) {
      await analyzePastedSource(`source-${String(index).padStart(2, "0")}`);
    }
    await act(async () => {});

    const notice = await screen.findByText(
      /Retention limit reached \(10 analyzed sources in Standard depth\): 1 older analyzed source\(s\) were dropped\./,
    );
    expect(notice.textContent).toContain("switch to Extended depth");

    expect(container.querySelectorAll("article")).toHaveLength(10);
    expect(screen.queryByText("source-01")).toBeNull();
    expect(screen.getByText("source-11")).toBeTruthy();
    expect(screen.getByText("source-02")).toBeTruthy();
  });

  it("does not post a notice while the window still has room", async () => {
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    await analyzePastedSource("source-01");
    await analyzePastedSource("source-02");
    await act(async () => {});

    expect(screen.queryByText(/Retention limit reached/)).toBeNull();
    expect(screen.queryByText(/Storage limit reached/)).toBeNull();
  });
});

vi.setConfig({ testTimeout: 10_000 });
