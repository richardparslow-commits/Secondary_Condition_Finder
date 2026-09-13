import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractPdfEvidence } from "@/lib/evidence/document-extract";
import { STANDARD_LIMITS } from "@/lib/evidence/limits";

/**
 * Behavioral regression contract for resource cleanup in browser-local PDF
 * extraction (see document-extract.ts extractPdfEvidence):
 *
 * 1. page.cleanup() MUST run even when page.getTextContent() throws — the
 *    per-page finally guarantees per-page resources are freed before the
 *    error propagates.
 * 2. loadingTask.destroy() MUST run even when document.getPage() throws —
 *    the outer finally guarantees the document/worker is torn down.
 * 3. cleanup() runs on the success path too (once per page).
 *
 * The extraction module imports pdfjs-dist dynamically inside the function;
 * vi.mock intercepts that dynamic import in the vitest node environment, so
 * no real PDF parsing (or worker) is involved.
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
  return new File(["%PDF-1.4 fixture"], "clinical-records.pdf", {
    type: "application/pdf",
  });
}

describe("extractPdfEvidence resource cleanup contract", () => {
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

  it("runs page.cleanup() when getTextContent() throws, then destroys the loading task", async () => {
    pdfjsMocks.getTextContent.mockRejectedValue(new Error("malformed page content"));

    await expect(extractPdfEvidence(makePdfFile(), STANDARD_LIMITS)).rejects.toThrow(
      "malformed page content",
    );

    // Per-page finally ran despite the extraction failure…
    expect(pdfjsMocks.cleanup).toHaveBeenCalledTimes(1);
    // …and the outer finally destroyed the document before the error surfaced.
    expect(pdfjsMocks.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the loading task when page acquisition itself throws", async () => {
    pdfjsMocks.getPage.mockRejectedValue(new Error("page render failure"));

    await expect(extractPdfEvidence(makePdfFile(), STANDARD_LIMITS)).rejects.toThrow(
      "page render failure",
    );

    // No page was acquired, so no page cleanup was possible…
    expect(pdfjsMocks.cleanup).not.toHaveBeenCalled();
    // …but the document was still torn down.
    expect(pdfjsMocks.destroy).toHaveBeenCalledTimes(1);
  });

  it("runs page.cleanup() on the success path and preserves page provenance", async () => {
    pdfjsMocks.getTextContent.mockResolvedValue({
      items: [{ str: "Sleep disturbance noted; refer for polysomnography", hasEOL: true }],
    });

    const result = await extractPdfEvidence(makePdfFile(), STANDARD_LIMITS);

    expect(result.kind).toBe("pdf");
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.locatorPrefix).toBe("page 1");
    expect(result.segments[0]?.text).toContain("polysomnography");
    expect(result.warnings).toEqual([]);
    expect(pdfjsMocks.cleanup).toHaveBeenCalledTimes(1);
    expect(pdfjsMocks.destroy).toHaveBeenCalledTimes(1);
  });
});
