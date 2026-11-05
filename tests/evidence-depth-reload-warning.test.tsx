// @vitest-environment jsdom
/**
 * Regression for Heal `s11-extended-reload-false-corruption-warning-1`.
 *
 * Reloading Supporting Documents with Extended depth restores every source
 * from a store larger than Standard's 256 KB read ceiling. The mount-time
 * restore used Standard's ceiling before the saved depth was read, reported
 * the payload as oversized, and left "could not be read and was not restored"
 * on screen even after the Extended restore listed all of the evidence.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import {
  MAX_EXCERPT_QUOTE_CHARS,
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";
import {
  EXTENDED_LIMITS,
  STANDARD_LIMITS,
} from "@/lib/evidence/limits";
import { serializeStoredEvidence } from "@/lib/evidence/storage";
import { evidenceDepthStorageKey } from "@/lib/secondary-workflow/local-state";

const SOURCE_COUNT = 60;
const EXCERPTS_PER_SOURCE = 4;
const QUOTE = "q".repeat(MAX_EXCERPT_QUOTE_CHARS);

const analyses = (): EvidenceAnalysis[] =>
  Array.from({ length: SOURCE_COUNT }, (_, sourceIndex) => {
    const sourceName = `extended-source-${String(sourceIndex + 1).padStart(3, "0")}.txt`;
    return {
      version: 1,
      sourceName,
      sourceId: `staged-extended-${sourceIndex + 1}`,
      excerpts: Array.from({ length: EXCERPTS_PER_SOURCE }, (_, excerptIndex) => ({
        sourceName,
        locator: `page ${excerptIndex + 1}`,
        quote: QUOTE,
        category: "treatment",
        strength: "supporting",
        clinicianAuthored: false,
        matchedTerms: [],
      })),
      nexusRelevantCount: 0,
      supportingCount: EXCERPTS_PER_SOURCE,
    };
  });

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("an Extended reload above the Standard ceiling", () => {
  it("restores every source without a false corruption warning", async () => {
    const payload = serializeStoredEvidence(analyses(), EXTENDED_LIMITS);
    expect(new TextEncoder().encode(payload).byteLength).toBeGreaterThan(
      STANDARD_LIMITS.storedBytes,
    );
    window.sessionStorage.setItem(evidenceAnalysisStorageKey, payload);
    window.sessionStorage.setItem(evidenceDepthStorageKey, "extended");

    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    await waitFor(() =>
      expect(container.querySelectorAll("article")).toHaveLength(SOURCE_COUNT),
    );
    expect(
      (screen.getByLabelText("Active depth") as HTMLSelectElement).value,
    ).toBe("extended");
    expect(
      screen.queryByText(/could not be read and was not restored/),
    ).toBeNull();
  });
});
