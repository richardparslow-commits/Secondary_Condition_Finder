// @vitest-environment jsdom
/**
 * Regression for Heal `s12-same-document-added-twice-1`.
 *
 * Selecting the same file again staged a second row, so analysis produced a
 * duplicate source. Deduplicate by the document's tab-scoped fingerprint while
 * keeping two same-named documents from different folders distinct.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";

function stage(files: File[]): void {
  fireEvent.change(screen.getByLabelText("Select evidence files"), {
    target: { files },
  });
}

function selectedCount(): number {
  return screen.queryAllByRole("listitem").filter((item) =>
    item.textContent?.includes("not yet analyzed"),
  ).length;
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("local evidence file staging", () => {
  it("does not stage the same document twice", () => {
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    const first = new File(["same record"], "record.txt", {
      type: "text/plain",
      lastModified: 1_700_000_000_000,
    });
    const selectedAgain = new File(["same record"], "record.txt", {
      type: "text/plain",
      lastModified: 1_700_000_000_000,
    });

    stage([first]);
    expect(selectedCount()).toBe(1);
    stage([selectedAgain]);

    expect(selectedCount()).toBe(1);
    expect(screen.getByText(/already selected/i)).toBeTruthy();
  });

  it("keeps two same-named documents when their metadata differs", () => {
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    stage([
      new File(["first record"], "letter.txt", {
        type: "text/plain",
        lastModified: 1_700_000_000_000,
      }),
      new File(["second record"], "letter.txt", {
        type: "text/plain",
        lastModified: 1_700_000_100_000,
      }),
    ]);

    expect(selectedCount()).toBe(2);
  });
});
