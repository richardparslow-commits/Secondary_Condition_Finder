// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s5-failed-pdf-marked-analyzed-1`: a PDF
 * whose extraction throws, or yields no extractable text, was marked
 * "analyzed" because runAllAnalysis treated any attempted (non-skipped) file
 * as a committed one. That removed it from the analyze queue and disabled the
 * retry path even though no analysis had been stored.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";

const h = vi.hoisted(() => ({ outcome: "reject" as "reject" | "empty" }));

vi.mock("@/lib/evidence/document-extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence/document-extract")>();
  return {
    ...actual,
    extractLocalEvidenceDocument: async () => {
      if (h.outcome === "reject") throw new Error("malformed PDF");
      return {
        kind: "pdf" as const,
        sourceName: "scanned.pdf",
        segments: [],
        warnings: ["No extractable PDF text was found."],
      };
    },
  };
});

function pdfFile(): File {
  return new File(["%PDF-1.4 fixture"], "scanned.pdf", { type: "application/pdf" });
}

async function stageAndAnalyze(): Promise<void> {
  fireEvent.change(screen.getByLabelText("Select evidence files"), {
    target: { files: [pdfFile()] },
  });
  await screen.findByText("scanned.pdf");
  fireEvent.click(screen.getByRole("button", { name: "Analyze 1 document" }));
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  h.outcome = "reject";
});

describe("failed PDF extraction is not reported as analyzed", () => {
  it("keeps a throwing PDF unanalyzed and retryable", async () => {
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageAndAnalyze();

    await screen.findByText(/could not be analyzed locally/i);
    expect(screen.getByText(/not yet analyzed/)).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Analyze 1 document" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
  });

  it("keeps a PDF with no extractable text unanalyzed", async () => {
    h.outcome = "empty";
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageAndAnalyze();

    await screen.findByText(/No extractable PDF text was found/i);
    expect(screen.getByText(/not yet analyzed/)).toBeTruthy();
  });
});
