import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/ocr-model/route";
import {
  OCR_MODEL_CACHE_CONTROL,
  OCR_MODEL_DEFAULT_URL,
  OCR_MODEL_SHA256,
  isPinnedOcrModel,
  resolveOcrModelUrl,
  sha256Hex,
} from "@/lib/evidence/ocr-model";

/**
 * The traineddata is the one binary the server serves at runtime. These tests
 * pin the three properties that keep it out of the upload budget without
 * weakening the browser contract: one exact source (or an https mirror), one
 * exact digest, and the canonical `application/gzip` response tesseract
 * expects at `/tesseract/eng.traineddata.gz`.
 */

const BUNDLED = path.join(".data-bundle", "ocr", "eng.traineddata.gz");

describe("OCR model source", () => {
  it("defaults to the exact package file pinned by package.json", () => {
    expect(resolveOcrModelUrl({})).toBe(OCR_MODEL_DEFAULT_URL);
    expect(OCR_MODEL_DEFAULT_URL).toBe(
      "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0/eng.traineddata.gz",
    );
  });

  it("accepts only an absolute https mirror and ignores a malformed override", () => {
    expect(resolveOcrModelUrl({ OCR_MODEL_URL: "https://mirror.example/eng.traineddata.gz" })).toBe(
      "https://mirror.example/eng.traineddata.gz",
    );
    expect(resolveOcrModelUrl({ OCR_MODEL_URL: "http://mirror.example/eng.traineddata.gz" })).toBe(
      OCR_MODEL_DEFAULT_URL,
    );
    expect(resolveOcrModelUrl({ OCR_MODEL_URL: "not a url" })).toBe(OCR_MODEL_DEFAULT_URL);
    expect(resolveOcrModelUrl({ OCR_MODEL_URL: "   " })).toBe(OCR_MODEL_DEFAULT_URL);
  });

  it("refuses arbitrary bytes and hashes exactly", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await isPinnedOcrModel(bytes)).toBe(false);
  });
});

describe("OCR model route — bundled copy", () => {
  it("serves the installed pinned file as gzip, without a content encoding", async () => {
    expect(fs.existsSync(BUNDLED)).toBe(true);
    expect(createHash("sha256").update(fs.readFileSync(BUNDLED)).digest("hex")).toBe(
      OCR_MODEL_SHA256,
    );

    const response = await GET();
    expect(response.status).toBe(200);
    // The file is gzip; the HTTP response must not claim to be content-encoded,
    // or the browser would decompress it before tesseract's own `gzip: true`.
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/gzip");
    expect(response.headers.get("cache-control")).toBe(OCR_MODEL_CACHE_CONTROL);
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBe(fs.statSync(BUNDLED).size);
    expect(await isPinnedOcrModel(bytes)).toBe(true);
  });
});
