import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Resource-cleanup contract for runLocalOcr() in LocalEvidenceAnalyzer.tsx.
 *
 * OCR is the most expensive browser-local operation in the app; a failure
 * between getPage() and recognize() must never leak the PDF page object, the
 * loaded PDF document, or the Tesseract worker. The component has no jsdom
 * harness (repo convention: source-structure contracts for client
 * components), so these assertions pin the load-bearing structure that
 * guarantees cleanup on every path:
 *
 * 1. The page handle is initialized to `null` before the guarded block so the
 *    finally can tell "page never acquired" from "page acquired".
 * 2. page.cleanup() runs in a per-page finally, best-effort (own try/catch so
 *    a cleanup failure cannot mask the original error).
 * 3. Render and recognition failures use `continue` — i.e. they exit through
 *    the per-page finally where cleanup runs, instead of aborting the loop.
 * 4. worker.terminate() and loadingTask.destroy() each sit in their own
 *    finally, so worker + document teardown happens even when anything above
 *    throws.
 */
const analyzer = fs.readFileSync(
  path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx"),
  "utf8",
);

describe("local OCR resource-cleanup contract", () => {
  it("initializes the page handle to null before the guarded page block", () => {
    expect(analyzer).toContain(
      "let page: Awaited<ReturnType<typeof pdfDocument.getPage>> | null = null;",
    );
  });

  it("cleans up the page in a per-page finally that follows the per-page catch", () => {
    const catchIndex = analyzer.indexOf("} catch (pageError) {");
    const finallyIndex = analyzer.indexOf("} finally {", catchIndex);
    const cleanupIndex = analyzer.indexOf("page.cleanup();", finallyIndex);

    expect(catchIndex).toBeGreaterThan(-1);
    expect(finallyIndex).toBeGreaterThan(catchIndex);
    expect(cleanupIndex).toBeGreaterThan(finallyIndex);

    // Best-effort: a cleanup failure must not mask the original page error.
    const cleanupBody = analyzer.slice(cleanupIndex, cleanupIndex + 120);
    expect(cleanupBody).toMatch(/catch/);
  });

  it("exits render and recognition failures through the finally via continue", () => {
    expect(analyzer).toContain("render failed (");
    expect(analyzer).toContain("OCR recognition failed (");
    // At minimum: render failure, recognition failure, and empty-text skip.
    const continueCount = analyzer.match(/continue;/g)?.length ?? 0;
    expect(continueCount).toBeGreaterThanOrEqual(3);
  });

  it("tears down the PDF loading task and the OCR worker in finally blocks", () => {
    const destroyIndex = analyzer.indexOf("await loadingTask.destroy();");
    const terminateIndex = analyzer.indexOf("await worker.terminate();");
    expect(destroyIndex).toBeGreaterThan(-1);
    expect(terminateIndex).toBeGreaterThan(destroyIndex);
    // Nesting: loadingTask's finally is inner (per document), the worker's
    // finally encloses it (per OCR session) — so teardown runs outside-in.
    expect(analyzer.slice(destroyIndex - 80, destroyIndex)).toContain("} finally {");
    expect(analyzer.slice(terminateIndex - 80, terminateIndex)).toContain("} finally {");
  });
});
