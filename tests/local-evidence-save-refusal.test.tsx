// @vitest-environment jsdom
/**
 * Regression for Heal `s10-refused-save-shown-retained-1`.
 *
 * A quota-failed evidence write used to leave the new source listed as retained
 * with no notice. The review may keep the in-memory analysis, but it has to say
 * that the save failed so the Step 6 checklist is not trusted to match.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";
import { EXTENDED_LIMITS } from "@/lib/evidence/limits";
import { serializeStoredEvidence } from "@/lib/evidence/storage";
import { evidenceDepthStorageKey } from "@/lib/secondary-workflow/local-state";

const originalSetItem = Storage.prototype.setItem;
let failEvidenceWrites = false;
let setItemSpy: ReturnType<typeof vi.spyOn>;

function pasteSource(name: string): void {
  fireEvent.change(screen.getByLabelText(/Source name/), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText(/Paste exact extracted text/), {
    target: { value: `Record for ${name} describing the condition.` },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze pasted text locally" }));
}

function storedSourceNames(): string[] {
  const stored = JSON.parse(
    window.sessionStorage.getItem(evidenceAnalysisStorageKey) ?? "[]",
  ) as EvidenceAnalysis[];
  return stored.map((analysis) => analysis.sourceName);
}

const extendedAnalyses = (count: number): EvidenceAnalysis[] =>
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
  failEvidenceWrites = false;
  setItemSpy = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation((key: string, value: string) => {
      if (failEvidenceWrites && key === evidenceAnalysisStorageKey) {
        throw new Error("QuotaExceededError");
      }
      originalSetItem.call(window.sessionStorage, key, value);
    });
});

afterEach(() => {
  cleanup();
  setItemSpy.mockRestore();
  window.sessionStorage.clear();
});

describe("evidence that storage refuses to save", () => {
  it("keeps the in-memory review but warns that the pasted source was not saved", async () => {
    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    pasteSource("save-ok");
    await screen.findByText(/Pasted text was analyzed locally/i);
    await waitFor(() => expect(storedSourceNames()).toEqual(["save-ok"]));

    failEvidenceWrites = true;
    pasteSource("save-refused");

    expect(
      await screen.findByText(/could not be kept in this browser tab/i),
    ).toBeTruthy();
    expect(container.querySelectorAll("article")).toHaveLength(2);
    // The unsaved source is visible in this review but absent from the store
    // Step 6 reads.
    expect(storedSourceNames()).toEqual(["save-ok"]);
  });

  it("warns when a Standard-depth downgrade cannot save the retained set", async () => {
    window.sessionStorage.setItem(
      evidenceAnalysisStorageKey,
      serializeStoredEvidence(extendedAnalyses(12), EXTENDED_LIMITS),
    );
    window.sessionStorage.setItem(evidenceDepthStorageKey, "extended");

    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(12));

    failEvidenceWrites = true;
    fireEvent.change(screen.getByLabelText("Active depth"), {
      target: { value: "standard" },
    });

    expect(
      await screen.findByText(/could not be kept in this browser tab/i),
    ).toBeTruthy();
    expect(container.querySelectorAll("article")).toHaveLength(10);
  });
});
