import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Resource-cleanup contract for Dd214LocalAnalyzer.tsx (browser-local DD-214
 * parser). This is the third browser-local PDF/OCR surface, alongside
 * document-extract.ts (behavioral contract, tests/evidence-pdf-page-cleanup)
 * and LocalEvidenceAnalyzer.tsx (structural contract,
 * tests/local-ocr-cleanup-contract). Same guarantees, pinned structurally per
 * the repo's client-component convention (no jsdom harness):
 *
 * 1. Text-layer path: page.cleanup() runs in a per-page finally even when
 *    getTextContent() throws.
 * 2. OCR path: page.cleanup() runs in a per-page finally even when viewport,
 *    render, or recognize throw. getPage() sits before the guarded block, so
 *    a failed page acquisition aborts via the enclosing finally chain
 *    (worker.terminate + task.destroy) with nothing acquired to leak.
 * 3. Both Tesseract workers and the pdf.js loading task each sit in their own
 *    finally, so teardown happens on every path including mid-OCR throws.
 */
const analyzer = fs.readFileSync(
  path.join(process.cwd(), "src/components/presumptive/Dd214LocalAnalyzer.tsx"),
  "utf8",
);

describe("DD-214 local analyzer resource-cleanup contract", () => {
  it("cleans up pages in the text-layer loop with a per-page finally", () => {
    const textLoop = analyzer.indexOf("await page.getTextContent()");
    expect(textLoop).toBeGreaterThan(-1);
    const finallyIndex = analyzer.indexOf("} finally {", textLoop);
    const cleanupIndex = analyzer.indexOf("page.cleanup();", finallyIndex);
    expect(finallyIndex).toBeGreaterThan(textLoop);
    expect(cleanupIndex).toBeGreaterThan(finallyIndex);
  });

  it("cleans up pages in the OCR loop with a per-page finally after render/recognize", () => {
    const ocrLoop = analyzer.indexOf("await worker.recognize(canvas)");
    expect(ocrLoop).toBeGreaterThan(-1);
    const finallyIndex = analyzer.indexOf("} finally {", ocrLoop);
    const cleanupIndex = analyzer.indexOf("page.cleanup();", finallyIndex);
    expect(finallyIndex).toBeGreaterThan(ocrLoop);
    expect(cleanupIndex).toBeGreaterThan(finallyIndex);
    expect(cleanupIndex).toBeLessThan(ocrLoop + 600);
  });

  it("acquires each OCR page before the guarded block so failed acquisitions leak nothing", () => {
    // getPage before try: if acquisition throws, the enclosing finally chain
    // (worker terminate + task destroy) runs; there is no page to clean up.
    const ocrLoop = analyzer.indexOf("const page = await doc.getPage(p);");
    const guarded = analyzer.indexOf("try {", ocrLoop);
    expect(ocrLoop).toBeGreaterThan(-1);
    expect(guarded).toBeGreaterThan(ocrLoop);
  });

  it("terminates both OCR workers inside finally blocks", () => {
    const first = analyzer.indexOf("await worker.terminate();");
    const second = analyzer.indexOf("await worker.terminate();", first + 1);
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(analyzer.slice(first - 80, first)).toContain("} finally {");
    expect(analyzer.slice(second - 80, second)).toContain("} finally {");
  });

  it("destroys the pdf.js loading task inside a finally block", () => {
    const destroyIndex = analyzer.indexOf("await task.destroy();");
    expect(destroyIndex).toBeGreaterThan(-1);
    expect(analyzer.slice(destroyIndex - 80, destroyIndex)).toContain("} finally {");
  });
});
