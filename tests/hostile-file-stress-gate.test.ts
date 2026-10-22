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

  it("records an identified-build evidence file with the limits it does not claim", () => {
    expect(script).toContain('path.join(process.cwd(), ".next", "BUILD_ID")');
    expect(script).toContain("rev-parse");
    expect(script).toContain("buildId,");
    expect(script).toContain("const EVIDENCE_FILE = path.join(EVIDENCE_DIR, \"evidence.json\")");
    expect(script).toContain("no real WASM out-of-memory was induced");
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
