// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s9-long-locator-drops-analysis-1`.
 *
 * `commitAnalysis` writes the new record, then re-parses the store through the
 * read guard. A source name over 512 characters or a combined locator over 256
 * made the guard reject the whole record. The input now bounds both fields, so
 * the analysis reaches the review and the Step 6 store instead of disappearing.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import { evidenceAnalysisStorageKey } from "@/lib/evidence/extract";
import {
  MAX_STORED_LOCATOR_CHARS,
  MAX_STORED_SOURCE_NAME_CHARS,
} from "@/lib/evidence/storage";

const CONDITION_TERMS = ["peripheral neuropathy", "diabetes mellitus"];
const PASTED_TEXT =
  "Progress note by Dr. Jane Smith MD. The peripheral neuropathy is at least as likely as not caused by the diabetes mellitus.";

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("long pasted metadata does not drop the analysis", () => {
  it("bounds the source name and locator and keeps the record in the review", async () => {
    const { container } = render(
      <LocalEvidenceAnalyzer conditionTerms={CONDITION_TERMS} />,
    );

    // Let the mount-time restore finish before creating the record, so its
    // empty snapshot cannot land after the commit and clear the review.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const locator = screen.getByLabelText(/Additional locator context/i) as HTMLInputElement;
    fireEvent.change(locator, { target: { value: "L".repeat(300) } });

    const sourceName = screen.getByLabelText(/Source name/) as HTMLInputElement;
    fireEvent.change(sourceName, { target: { value: "n".repeat(600) } });

    fireEvent.change(screen.getByLabelText(/Paste exact extracted text/i), {
      target: { value: PASTED_TEXT },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze pasted text locally" }),
    );

    await screen.findByText(/Pasted text was analyzed locally/i);

    await waitFor(() => {
      expect(container.querySelectorAll("article")).toHaveLength(1);
    });
    const heading = container.querySelector("article h4");
    expect(heading?.textContent).toHaveLength(MAX_STORED_SOURCE_NAME_CHARS);

    const raw = window.sessionStorage.getItem(evidenceAnalysisStorageKey);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "[]") as Array<{
      sourceName: string;
      excerpts: Array<{ locator: string }>;
    }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]?.sourceName).toHaveLength(MAX_STORED_SOURCE_NAME_CHARS);
    expect(stored[0]?.excerpts.length).toBeGreaterThan(0);
    for (const excerpt of stored[0]?.excerpts ?? []) {
      expect(excerpt.locator.length).toBeLessThanOrEqual(MAX_STORED_LOCATOR_CHARS);
    }
  });
});
