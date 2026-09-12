import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractPdfEvidence } from "@/lib/evidence/document-extract";
import { STANDARD_LIMITS } from "@/lib/evidence/limits";

/**
 * Fifth audit-report follow-up: the size-limit throw path.
 *
 * assertExtractedTextSize() runs INSIDE the per-page try block (after
 * getTextContent, before the segment is kept). When it throws — the PDF
 * exceeds the textChars budget mid-extraction — the per-page finally must
 * still run page.cleanup() for the page being processed, and the outer
 * finally must destroy the loading task. The report claimed this ordering
 * was fragile; these tests pin it as guaranteed: cleanup of the in-flight
 * page happens BEFORE the size error propagates, and all earlier pages
 * were cleaned in their own iterations.
 *
 * The extraction module imports pdfjs-dist dynamically inside the function;
 * vi.mock intercepts that dynamic import in the vitest node environment.
 */
const pdfjsMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  getPage: vi.fn(),
  getTextContent: vi.fn(),
  cleanup: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: pdfjsMocks.getDocument,
}));

function makePdfFile(): File {
  return new File(["%PDF-1.4 fixture"], "oversized-records.pdf", {
    type: "application/pdf",
  });
}

describe("extractPdfEvidence size-limit cleanup contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfjsMocks.getDocument.mockImplementation(() => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: pdfjsMocks.getPage,
      }),
      destroy: pdfjsMocks.destroy,
    }));
    pdfjsMocks.getPage.mockResolvedValue({
      getTextContent: pdfjsMocks.getTextContent,
      cleanup: pdfjsMocks.cleanup,
    });
    pdfjsMocks.cleanup.mockResolvedValue(undefined);
    pdfjsMocks.destroy.mockResolvedValue(undefined);
  });

  it("cleans up the in-flight page and destroys the task when the size limit throws mid-loop", async () => {
    const oversize = "x".repeat(STANDARD_LIMITS.textChars + 1);
    pdfjsMocks.getTextContent.mockResolvedValue({
      items: [{ str: oversize, hasEOL: true }],
    });

    await expect(extractPdfEvidence(makePdfFile(), STANDARD_LIMITS)).rejects.toThrow(
      /limit/i,
    );

    // The per-page finally released the in-flight page BEFORE the size error
    // surfaced, and the outer finally tore down the document.
    expect(pdfjsMocks.cleanup).toHaveBeenCalledTimes(1);
    expect(pdfjsMocks.cleanup).toHaveBeenCalledBefore(pdfjsMocks.destroy);
    expect(pdfjsMocks.destroy).toHaveBeenCalledTimes(1);
  });

  it("cleans up pages processed before the size error, not just the failing one", async () => {
    const halfBudget = "x".repeat(Math.floor(STANDARD_LIMITS.textChars / 2));
    pdfjsMocks.getTextContent
      .mockResolvedValueOnce({ items: [{ str: halfBudget, hasEOL: true }] })
      .mockResolvedValueOnce({ items: [{ str: halfBudget, hasEOL: true }] })
      .mockResolvedValueOnce({ items: [{ str: halfBudget, hasEOL: true }] });
    pdfjsMocks.getDocument.mockImplementation(() => ({
      promise: Promise.resolve({
        numPages: 3,
        getPage: pdfjsMocks.getPage,
      }),
      destroy: pdfjsMocks.destroy,
    }));

    await expect(extractPdfEvidence(makePdfFile(), STANDARD_LIMITS)).rejects.toThrow(
      /limit/i,
    );

    // Pages 1 and 2 exceeded the budget together on page 3's check; all three
    // iterations ran their per-page finally (pages 1-2 on the success path,
    // page 3 on the throw path) before the error propagated.
    expect(pdfjsMocks.cleanup).toHaveBeenCalledTimes(3);
    expect(pdfjsMocks.destroy).toHaveBeenCalledTimes(1);
  });

  it("keeps earlier segments and warnings out of the thrown error path (fail-fast contract)", async () => {
    // The size error must propagate — no partial result is returned when the
    // budget is exceeded, matching the extraction module's fail-fast posture.
    pdfjsMocks.getTextContent.mockResolvedValue({
      items: [{ str: "x".repeat(STANDARD_LIMITS.textChars + 1), hasEOL: true }],
    });

    const outcome = await extractPdfEvidence(makePdfFile(), STANDARD_LIMITS).then(
      () => "resolved",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    expect(outcome).toMatch(/limit/i);
  });
});
