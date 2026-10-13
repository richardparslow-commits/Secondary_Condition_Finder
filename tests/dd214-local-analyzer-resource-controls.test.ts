import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A06 resource/integrity contract for Dd214LocalAnalyzer.tsx (alternate DD-214
 * parser). The audit found this surface did not share the main evidence
 * pipeline's controls: fixed scale-2 OCR renders with no pixel-area cap,
 * no canvas release, no worker-health probe, no per-page text/OCR decisions,
 * silent page-cap truncation, unbounded text retention, no cancellation, and
 * a raw-text preview labeled "redacted" while redaction covers only common
 * SSN layouts. The component has no jsdom harness (repo convention:
 * source-structure contracts for client components), so these assertions pin
 * the load-bearing structure:
 *
 * 1. OCR renders through the shared pixel-area cap
 *    (`computeOcrRenderMetrics`), never a fixed scale-2 viewport.
 * 2. Each rendered canvas is released promptly (`releaseCanvas`).
 * 3. A recognition failure probes worker health (`probeWorkerHealth`) so a
 *    dead WASM worker stops the loop instead of retrying every page.
 * 4. The loop yields to the browser between pages (`yieldToBrowser`).
 * 5. Per-page text/OCR decisions: text pages stay as-is; only pages without
 *    extractable text pay for OCR, and the fallback says which pages.
 * 6. Page-cap and text-budget truncation warn instead of staying silent.
 * 7. Page-level notices merge into the extraction warnings.
 * 8. Every extraction entry runs under a cancelable generation fence
 *    invalidated on unmount; stale runs abandon before state writes and only
 *    the current generation resets busy state (same contract as the A07
 *    fence in LocalEvidenceAnalyzer).
 * 9. The raw-text preview is labeled by its actual redaction scope.
 *
 * The 2026-10-13 A06 closure added the direct-image and elapsed-work half of
 * the contract:
 *
 * 10. A direct image is bounded **before** decode through `planImageDecode`
 *     (declared dimensions, never the raw file, handed to OCR as a bounded
 *     canvas), and a refusal is explained instead of silently failing.
 * 11. Each run is armed with `startOcrJobDeadline`, whose expiry terminates
 *     the live worker/task so an awaited `recognize()` that never settles
 *     cannot pin the tab; Cancel and unmount use the same teardown path.
 * 12. Retained text is assembled in page order under the review budget via
 *     `assemblePageOrderedText`, replacing append-per-pass collection.
 *
 * Behaviour for 10–12 is mounted in
 * tests/dd214-image-decode-bounds-mounted.test.tsx; these assertions pin the
 * wiring so the component cannot quietly drop it.
 */
const analyzer = fs.readFileSync(
  path.join(process.cwd(), "src/components/presumptive/Dd214LocalAnalyzer.tsx"),
  "utf8",
);

describe("DD-214 analyzer resource/integrity controls (A06)", () => {
  it("renders OCR through the shared pixel-area cap, not a fixed scale-2 viewport", () => {
    expect(analyzer).toContain("computeOcrRenderMetrics(");
    expect(analyzer).not.toContain("getViewport({ scale: 2 })");
  });

  it("releases each rendered canvas promptly instead of waiting for GC", () => {
    expect(analyzer).toContain("releaseCanvas(canvas)");
  });

  it("probes worker health after a recognition failure instead of retrying blindly", () => {
    expect(analyzer).toContain("probeWorkerHealth({");
  });

  it("yields to the browser between OCR pages", () => {
    expect(analyzer).toContain("await yieldToBrowser();");
  });

  it("makes per-page text/OCR decisions and says which pages were OCR'd", () => {
    expect(analyzer).toContain("textlessPages");
    expect(analyzer).toContain(
      "had no extractable text; those pages were read with browser-local OCR.",
    );
  });

  it("warns when the page cap or the text budget truncates the review", () => {
    expect(analyzer).toContain("pages will be reviewed.");
    expect(analyzer).toContain("characters will be reviewed.");
    expect(analyzer).toContain("limits.textChars");
  });

  it("merges page-level notices into the extraction warnings", () => {
    expect(analyzer).toContain("pageWarnings");
    expect(analyzer).toContain("warnings: [...pageWarnings, ...ex.fields.warnings]");
  });

  it("fences extraction with a cancelable generation invalidated on unmount", () => {
    expect(analyzer).toContain("extractionGenerationRef");
    expect(analyzer).toContain("cancelRequestedRef");
    expect(analyzer).toContain("Cancel extraction");
    expect(analyzer).toContain("if (abandoned()) return;");
    // Busy state resets only for the current generation.
    expect(analyzer).toContain("if (isCurrentGeneration()");
  });

  it("keeps the factory-only worker contract (no local blob-capable worker)", () => {
    expect(analyzer).toContain("createLocalOcrWorker");
    expect(analyzer).not.toMatch(/createWorker\s*\(/);
    expect(analyzer).not.toContain("workerBlobURL");
  });

  it("labels the raw-text preview by its actual redaction scope", () => {
    expect(analyzer).toContain("Show extracted text (common SSN layouts redacted)");
    expect(analyzer).not.toContain("Show redacted extracted text");
  });

  it("bounds a direct image before decode and refuses with an explanation", () => {
    expect(analyzer).toContain("planImageDecode(imageBytes)");
    expect(analyzer).toContain("if (!plan.accepted || !plan.metrics || !plan.dimensions)");
    expect(analyzer).toContain("imageRefusalMessage(plan.reason, plan.dimensions)");
    // The bounded canvas is what reaches OCR in the normal path.
    expect(analyzer).toContain("worker.recognize(canvas)");
    expect(analyzer).toContain("ctx.drawImage(source, 0, 0, canvas.width, canvas.height)");
    // The decoded bitmap is released, not left to GC.
    expect(analyzer).toContain("source.close()");
  });

  it("arms an elapsed-work budget that terminates the live worker on expiry", () => {
    expect(analyzer).toContain("startOcrJobDeadline(OCR_JOB_DEADLINE_MS");
    expect(analyzer).toContain("terminateActiveRun()");
    expect(analyzer).toContain("deadline.clear();");
    // Cancel and unmount go through the same teardown, so "cancelled" cannot
    // mean three slightly different things.
    expect(analyzer).toContain("requestCancel");
    expect(analyzer).toContain("deadlineRef.current?.clear();");
    expect(analyzer).toContain("await worker.terminate()");
    expect(analyzer).toContain("await task.destroy()");
  });

  it("assembles retained text in page order under the review budget", () => {
    expect(analyzer).toContain("assemblePageOrderedText(pageTexts, limits.textChars)");
    expect(analyzer).toContain("pageTexts[page - 1] = text");
    // The old append-per-pass collection is gone.
    expect(analyzer).not.toMatch(/pageSegments?\.push\(/);
    expect(analyzer).not.toMatch(/rawText \+=/);
  });
});
