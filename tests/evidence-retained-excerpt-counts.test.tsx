// @vitest-environment jsdom
/**
 * Regression for Heal defect `s8-excerpt-count-exceeds-retained-1`.
 *
 * Evidence analysis counts every classified sentence, but Standard storage
 * keeps only five excerpts per source. The stored counts used to keep the
 * untrimmed total, so the summary said nine supporting excerpts were retained
 * while five were listed. The same mismatch survived a reload because the read
 * path preserved the inflated counts.
 *
 * These cases pin the write boundary, the legacy-read boundary, and the
 * visible Evidence excerpt summary after a real paste-and-analyze.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import type { EvidenceAnalysis, EvidenceExcerpt } from "@/lib/evidence/extract";
import { STANDARD_LIMITS } from "@/lib/evidence/limits";
import {
  parseStoredEvidence,
  serializeStoredEvidenceWithInfo,
} from "@/lib/evidence/storage";

function supportingExcerpt(index: number): EvidenceExcerpt {
  return {
    sourceName: "count-eight",
    locator: `line ${index + 1}`,
    quote: `supporting statement ${index + 1} about the diagnosed condition`,
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: false,
    matchedTerms: [],
  };
}

function legacyAnalysis(): EvidenceAnalysis {
  const excerpts = Array.from({ length: 9 }, (_unused, index) =>
    supportingExcerpt(index),
  );
  return {
    version: 1,
    sourceName: "count-eight",
    excerpts,
    nexusRelevantCount: 0,
    supportingCount: excerpts.length,
  };
}

const PASTED_TEXT = [
  "Diagnosis: diabetes mellitus type 2",
  "In my medical opinion, obstructive sleep apnea is at least as likely as not caused by the diabetes mellitus.",
  "In my medical opinion, peripheral neuropathy is at least as likely as not caused by the diabetes mellitus.",
  "In my medical opinion, chronic kidney disease is at least as likely as not caused by the diabetes mellitus.",
  "In my medical opinion, diabetic retinopathy is at least as likely as not caused by the diabetes mellitus.",
  "In my medical opinion, gastroparesis is at least as likely as not caused by the diabetes mellitus.",
  "In my medical opinion, hypertension is at least as likely as not caused by the diabetes mellitus.",
  "In my medical opinion, erectile dysfunction is at least as likely as not caused by the diabetes mellitus.",
  "In my medical opinion, major depressive disorder is at least as likely as not caused by the diabetes mellitus.",
].join("\n");

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("retained excerpt counts match the excerpts kept", () => {
  it("recomputes counts when Standard trims a record to five excerpts", () => {
    const result = serializeStoredEvidenceWithInfo(
      [legacyAnalysis()],
      STANDARD_LIMITS,
    );
    const stored = JSON.parse(result.serialized) as EvidenceAnalysis[];

    expect(stored[0]?.excerpts).toHaveLength(
      STANDARD_LIMITS.storedExcerptsPerSource,
    );
    expect(stored[0]?.supportingCount).toBe(
      STANDARD_LIMITS.storedExcerptsPerSource,
    );
    expect(stored[0]?.nexusRelevantCount).toBe(0);
  });

  it("normalizes an already-stored legacy record on read", () => {
    const loaded = parseStoredEvidence(
      JSON.stringify([legacyAnalysis()]),
      STANDARD_LIMITS,
    );

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.supportingCount).toBe(
      STANDARD_LIMITS.storedExcerptsPerSource,
    );
    expect(loaded[0]?.nexusRelevantCount).toBe(0);
  });

  it("shows the retained totals and lists the same five excerpts", async () => {
    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    fireEvent.change(screen.getByLabelText(/Source name/), {
      target: { value: "count-eight" },
    });
    fireEvent.change(screen.getByLabelText(/Paste exact extracted text/), {
      target: { value: PASTED_TEXT },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze pasted text locally" }),
    );

    expect(
      await screen.findByText(
        /0 nexus-relevant excerpt\(s\); 5 supporting excerpt\(s\) retained for this browser tab\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText("0 nexus-relevant; 5 supporting")).toBeTruthy();
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.querySelectorAll("article li")).toHaveLength(5);
  });
});
