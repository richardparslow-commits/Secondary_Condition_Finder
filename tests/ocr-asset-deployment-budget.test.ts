import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { OCR_MODEL_PATH, OCR_MODEL_SHA256 } from "@/lib/evidence/ocr-model";

/**
 * The Sites upload budget is 32 MiB for the whole deployment (Worker modules
 * plus every asset). Two OCR assets once blew it: the 10.4 MiB English
 * traineddata copied into `public/`, and the standalone 3.3 MiB
 * `tesseract-core-simd.wasm` that the single-file core never requests. Both
 * made publishing fail, so the placement of these bytes is a deployment
 * contract, not an implementation detail.
 *
 * The last case is the other half of "OCR works on the preview": assets are
 * served by the assets binding before the Next.js worker runs, so
 * `next.config.ts` `headers()` never reaches them. Without the isolation
 * headers below, Chrome refuses the OCR worker script inside the
 * Cross-Origin Isolated page (`net::ERR_BLOCKED_BY_RESPONSE`) and OCR dies
 * before tesseract starts — verified against the deployed preview.
 */

const read = (relative: string): string => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("OCR assets stay inside the Sites upload budget", () => {
  it("keeps the traineddata out of public/ and serves it from the install bundle", () => {
    expect(fs.existsSync(path.join(process.cwd(), "public", "tesseract", "eng.traineddata.gz"))).toBe(
      false,
    );
    const bundled = path.join(process.cwd(), ".data-bundle", "ocr", "eng.traineddata.gz");
    expect(fs.existsSync(bundled)).toBe(true);
    expect(createHash("sha256").update(fs.readFileSync(bundled)).digest("hex")).toBe(
      OCR_MODEL_SHA256,
    );
    // The browser-facing URL is unchanged; only the bytes' home moved.
    expect(OCR_MODEL_PATH).toBe("/tesseract/eng.traineddata.gz");
  });

  it("provisions the single-file WASM core only", () => {
    const generator = read("scripts/copy-pdf-worker.mjs");
    expect(generator).toContain('"tesseract-core-simd.wasm.js"');
    // The sibling `.wasm` binary is embedded in the single-file core's glue as
    // a data URI; copying it spent 3.3 MiB of budget on bytes no browser asks
    // for.
    expect(generator).not.toMatch(/copyIfExists\([^)]*"tesseract-core-simd\.wasm"/);
    expect(
      fs.existsSync(path.join(process.cwd(), "public", "tesseract", "tesseract-core-simd.wasm")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(process.cwd(), "public", "tesseract", "tesseract-core-simd.wasm.js")),
    ).toBe(true);
  });

  it("gives the static worker scripts the isolation policy the page runs under", () => {
    const headers = read("public/_headers");
    const rules = headers.replace(/\r\n/g, "\n");

    // The framework cache rule the Sites build normally writes must survive:
    // this file replaces the generated one.
    expect(rules).toContain("/_next/static/*");
    expect(rules).toContain("Cache-Control: public,max-age=31536000,immutable");

    for (const scope of ["/tesseract/*", "/pdf.worker.min.mjs"]) {
      // A rule may carry a leading comment block; the scope is the first
      // non-comment line, not necessarily the first line of the block.
      const block = rules.split(/\n\n/).find((rule) => {
        const firstContentLine = rule
          .trimStart()
          .split("\n")
          .find((line) => !line.trimStart().startsWith("#"));
        return firstContentLine?.trimEnd() === scope;
      });
      expect(block, scope).toBeDefined();
      expect(block, scope).toContain("Cross-Origin-Embedder-Policy: require-corp");
      expect(block, scope).toContain("Cross-Origin-Resource-Policy: same-origin");
    }
  });
});
