import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const spec = readFileSync(resolve(process.cwd(), "scripts/smoke-worker.mjs"), "utf8");
const docs = readFileSync(resolve(process.cwd(), "docs/deployment-readiness.md"), "utf8");

/**
 * `--sites` is the only check that serves the Worker built from the Sites
 * OpenNext config, and the only one that verifies the OCR model end to end.
 * These pins keep the mode from silently falling back to the minimal smoke
 * config or weakening the digest/rewrite assertions to a status check.
 */
describe("Worker smoke check --sites mode", () => {
  it("builds with the generated Sites OpenNext config and its bindings", () => {
    expect(spec).toContain('argument === "--sites"');
    expect(spec).toContain('"freebuff.open-next.config.ts"');
    expect(spec).toContain("--openNextConfigPath");
    expect(spec).toContain("Sites config, runs next build");
    expect(spec).toContain("NEXT_INC_CACHE_R2_BUCKET");
    expect(spec).toContain("NEXT_CACHE_DO_QUEUE");
    expect(spec).toContain("NEXT_TAG_CACHE_DO_SHARDED");
    expect(spec).toContain('binding: "DB"');
    // A reused tree was not necessarily built with the Sites bindings.
    expect(spec).toContain("--sites cannot be combined with --skip-build");
  });

  it("verifies the OCR rewrite against the route and the pinned source", () => {
    expect(spec).toContain('const OCR_MODEL_PATH = "/tesseract/eng.traineddata.gz"');
    expect(spec).toContain('const OCR_MODEL_ROUTE = "/api/ocr-model"');
    expect(spec).toContain("readPinnedOcrDigest");
    expect(spec).toContain("OCR_MODEL_SHA256");
    expect(spec).toContain("sha256Hex(rewritten.bodyBuffer)");
    expect(spec).toContain("sha256Hex(direct.bodyBuffer)");
    // The rewrite must be declared in next.config.ts, not inferred from a 200.
    expect(spec).toContain("no longer declares /tesseract/eng.traineddata.gz -> /api/ocr-model");
    // A public copy would answer before the rewrite; forbid it explicitly.
    expect(spec).toContain('"public", "tesseract", "eng.traineddata.gz"');
    expect(spec).toContain("a static copy could answer");
  });

  it("asserts the response contract tesseract.js depends on", () => {
    expect(spec).toContain('"content-type": "application/gzip"');
    expect(spec).toContain('"cache-control": "public, max-age=31536000, immutable"');
    expect(spec).toContain('"x-content-type-options": "nosniff"');
    expect(spec).toContain('"cross-origin-resource-policy": "same-origin"');
    expect(spec).toContain("response is content-encoded");
  });

  it("runs the OCR check only in sites mode and reports its failure", () => {
    const branch = spec.indexOf("if (options.sites) {\n      const ocrFailures");
    const failure = spec.indexOf("if (failures.length > 0)");
    expect(branch).toBeGreaterThan(-1);
    expect(failure).toBeGreaterThan(branch);
    expect(spec).toContain("✗ GET ${OCR_MODEL_PATH} (rewrite + digest)");
    expect(spec).toContain("OCR rewrite and digest verified");
  });

  it("is documented as the Sites build and OCR check", () => {
    expect(docs).toContain("npm run smoke:worker -- --sites");
    expect(docs).toContain("freebuff.open-next.config.ts");
    expect(docs).toContain("OCR_MODEL_SHA256");
  });
});
