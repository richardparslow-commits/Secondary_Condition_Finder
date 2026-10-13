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
 * 4. Teardown is once-only (audit A06 prompt-teardown follow-through): cancel,
 *    the elapsed-work deadline, and unmount terminate the live worker through
 *    `terminateActiveRun()`, which clears the ref, so the run's own finally
 *    must not terminate/destroy the same handle a second time — a second
 *    terminate can reject inside a finally and mask the outcome it was
 *    cleaning up after. Behaviourally pinned by
 *    tests/dd214-image-decode-bounds-mounted.test.tsx, which asserts exactly
 *    one terminate call on the hung-worker and cancel paths.
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

  it("owns worker teardown in one guarded helper, called from every finally", () => {
    // The helper is the only place a worker is terminated, and it skips a
    // handle that cancel/deadline/unmount already terminated.
    expect(analyzer.match(/await worker\.terminate\(\);/g) ?? []).toHaveLength(1);
    const helper = analyzer.indexOf("const finishWorker = async");
    expect(helper).toBeGreaterThan(-1);
    expect(analyzer.slice(helper, helper + 260)).toContain("if (workerRef.current !== worker) return;");
    // Both OCR branches and the direct-image branch finish through it.
    expect(analyzer.match(/await finishWorker\(worker\);/g) ?? []).toHaveLength(3);
    for (const match of analyzer.matchAll(/await finishWorker\(worker\);/g)) {
      expect(analyzer.slice(Math.max(0, match.index - 400), match.index)).toContain("} finally {");
    }
    // No stale release-only path is left behind.
    expect(analyzer).not.toContain("releaseWorker");
  });

  it("destroys the pdf.js loading task inside a finally block, once", () => {
    const destroyIndex = analyzer.indexOf("await task.destroy();");
    expect(destroyIndex).toBeGreaterThan(-1);
    // Conditional on the ref still holding this task, so a cancel that already
    // destroyed it does not destroy it again — still inside a finally.
    const window = analyzer.slice(Math.max(0, destroyIndex - 140), destroyIndex);
    expect(window).toContain("if (pdfTaskRef.current === task) {");
    expect(analyzer.slice(Math.max(0, destroyIndex - 400), destroyIndex)).toContain("} finally {");
    expect(analyzer.match(/await task\.destroy\(\);/g) ?? []).toHaveLength(1);
  });
});
