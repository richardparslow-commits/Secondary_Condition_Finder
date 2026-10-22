import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const script = fs.readFileSync(
  path.join(process.cwd(), "e2e", "hostile-file-stress.mjs"),
  "utf8",
);

/**
 * REL-05's closing evidence is a real-browser hostile-file run, not another
 * jsdom assertion. These pins keep the harness honest about what that evidence
 * is: the fixture dimensions actually exceed the committed decode bounds, the
 * refusal assertions require **zero** workers (so "refused before decode" is
 * not inferred from a message alone), the malformed-PDF case requires teardown,
 * the memory bound is measured rather than asserted, and the hung-worker case
 * requires Cancel to leave no live worker behind — the defect the first run of
 * this harness found.
 */
describe("REL-05 hostile-file browser stress harness", () => {
  it("builds bombs that exceed the decode bounds in both directions", () => {
    // 60000 × 120 is over the 20,000-px dimension cap...
    expect(script).toContain("pngWithDeclaredSize(60_000, 120)");
    // ...and 10000 × 10000 is over the 40 MP pixel cap at legal dimensions.
    expect(script).toContain("pngWithDeclaredSize(10_000, 10_000)");
    expect(script).toContain('"60000×120"');
    expect(script).toContain('"10000×10000"');
    // The bomb carries a header and no image data: it can only be refused by
    // reading the declared size, which is the property under test.
    const bombBuilder = script.slice(
      script.indexOf("function pngWithDeclaredSize"),
      script.indexOf("/** A small, genuinely decodable PNG"),
    );
    expect(bombBuilder).toContain('pngChunk("IEND", Buffer.alloc(0))');
    expect(bombBuilder).not.toContain("IDAT");
  });

  it("requires the sized refusal and proves no worker was created", () => {
    expect(script).toContain('"too large to analyze safely"');
    expect(script).toContain("state.created.length === 0 && state.live === 0");
    expect(script).toContain("refused uploads never reach an OCR worker");
    // Worker accounting is injected before any app script, so a worker cannot
    // be created before the audit starts observing.
    expect(script).toContain("addInitScript");
    expect(script).toContain("__hostileWorkerAudit");
    expect(script).toContain("class AuditedWorker extends NativeWorker");
  });

  it("requires the rejected PDF load to tear its pdf.js worker down", () => {
    expect(script).toContain('"this is not a PDF at all');
    expect(script).toContain("no unhandled page errors during the hostile run");
    expect(script).toContain("pdf.js worker=");
    expect(script).toContain("window.__hostileWorkerAudit.live === 0");
    // The worker must have existed before it can be said to have been torn down.
    expect(script).toContain("Boolean(pdfWorkerUrl) && pdfState.live === 0");
  });

  it("measures heap growth across repeated bombs instead of assuming it", () => {
    expect(script).toContain("const MEMORY_ITERATIONS = 8");
    expect(script).toContain("const MEMORY_GROWTH_LIMIT_BYTES = 24 * 1024 * 1024");
    expect(script).toContain('Performance.getMetrics');
    expect(script).toContain("JSHeapUsedSize");
    expect(script).toContain("growth <= MEMORY_GROWTH_LIMIT_BYTES");
  });

  it("stalls a real worker and requires Cancel to end it", () => {
    expect(script).toContain('stallPattern = "tesseract|worker-guard"');
    expect(script).toContain('audit.stalledMessages += 1');
    expect(script).toContain("Cancel terminates a hung OCR worker");
    expect(script).toContain("cancelSettled && cancelState.live === 0");
    expect(script).toContain("Cancel returns the surface to an idle, reusable state");
    // A frozen tab is a failure mode, so responsiveness is asserted while the
    // worker is stalled rather than after it is torn down.
    expect(script).toContain("the tab still answers while the OCR worker is stalled");
  });

  it("induces real WASM pressure with a scan rendered at the canvas cap", () => {
    // The page geometry is the point: 2048 pt × the base render scale of 2 is
    // 4096 px per side, which is exactly OCR_MAX_CANVAS_AREA_PX (16,777,216).
    // Smaller leaves pressure unmeasured; larger would be downscaled by the cap.
    expect(script).toContain("const SCAN_PAGE_PT = 2048");
    expect(script).toContain("const SCAN_PAGES = 2");
    expect(script).toContain("const SCAN_TIMEOUT_MS = 4 * 60 * 1000");
    expect(script).toContain("renderedPx: SCAN_PAGE_PT * 2");
    // The scan must be a real, parseable PDF with a full-page raster and no text
    // layer, so pdf.js decodes it and the OCR path runs on every page.
    expect(script).toContain("function scannedPdf");
    expect(script).toContain('/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode');
    expect(script).toContain('startxref\\n${xrefOffset}');
    expect(script).toContain("scannedPdf()");
    expect(script).toContain("scanPageRaster");
  });

  it("measures process RSS, not only the JS heap, and fails when it cannot", () => {
    expect(script).toContain("const WASM_RSS_FLOOR_BYTES = 64 * 1024 * 1024");
    expect(script).toContain("const RSS_SAMPLE_INTERVAL_MS = 250");
    expect(script).toContain("execFileSync(\"ps\", [\"-A\", \"-o\", \"pid=,ppid=,rss=,command=\"]");
    expect(script).toContain("function browserRssBytes");
    expect(script).toContain("function withRssSamples");
    // Only the browser the harness launched counts — not the operator's own.
    expect(script).toContain("BROWSER_COMMAND_PATTERN");
    expect(script).toContain("const seen = new Set([process.pid])");
    // Peak, not before/after, because OCR frees buffers between pages.
    expect(script).toContain("if (peak === null || sample > peak) peak = sample");
    expect(script).toContain("const peakRss = sampledPeak");
    // The peak is taken from every sample for the whole run, while the evidence
    // history is capped: a 4-minute scan is ~960 samples at 250 ms, so a cap
    // that also stopped observing would end after ~100 s and miss the
    // high-memory phase on a slow host. The retained list keeps the peak too.
    expect(script).toContain("sampleCount += 1");
    expect(script).toContain("samples[samples.length - 1] = sample");
    expect(script).toContain("rssSampleCount: sampleCount");
    // The defect this pins: the peak used to be updated only inside the cap
    // check, so it silently stopped moving when the history filled up.
    const peakUpdate = script.indexOf("if (peak === null || sample > peak) peak = sample");
    const retentionCap = script.indexOf("samples.length < RSS_SAMPLE_LIMIT");
    expect(peakUpdate).toBeGreaterThan(-1);
    expect(peakUpdate).toBeLessThan(retentionCap);
    // Unmeasurable must not read as "no pressure".
    expect(script).toContain("if (process.platform === \"win32\") return null");
    expect(script).toContain("return browserProcesses === 0 ? null : total");
    expect(script).toContain("the WASM-pressure claim stays unmeasured");
    expect(script).toContain(
      "real OCR of the scanned pages moves process RSS, not just the JS heap",
    );
    expect(script).toContain("rssDelta >= WASM_RSS_FLOOR_BYTES");
    expect(script).toContain("a large scanned PDF is admitted and its OCR pass finishes");
  });

  it("records an identified-build evidence file with the limits it does not claim", () => {
    expect(script).toContain('path.join(process.cwd(), ".next", "BUILD_ID")');
    expect(script).toContain("rev-parse");
    expect(script).toContain("buildId,");
    expect(script).toContain("const EVIDENCE_FILE = path.join(EVIDENCE_DIR, \"evidence.json\")");
    // Pressure is claimed, an induced OOM is not — and the evidence says so.
    expect(script).toContain("no out-of-memory is forced");
    expect(script).toContain("processRss");
    expect(script).toContain("wasmPressureInduced");
    expect(script).toContain("notClaimed");
    // It must not become a green light: a failed check exits non-zero and names
    // the finding in the error.
    expect(script).toContain("process.exitCode = 1");
    expect(script).toContain("hostile-file check(s) failed");
  });

  it("is exposed as the repository stress command", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["stress:hostile"]).toBe("node e2e/hostile-file-stress.mjs");
  });
});
