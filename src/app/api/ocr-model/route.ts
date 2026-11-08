import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  OCR_MODEL_HEADERS,
  isPinnedOcrModel,
  resolveOcrModelUrl,
} from "@/lib/evidence/ocr-model";

/**
 * Same-origin English traineddata for browser-local OCR.
 *
 * Reached through the `/tesseract/eng.traineddata.gz` rewrite. The model is not
 * in `public/` because it alone would consume a third of the Sites upload
 * budget; see `src/lib/evidence/ocr-model.ts` for the sourcing and integrity
 * contract. Nothing here is user-specific: identical bytes are served to every
 * caller and the response is immutable.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Postinstall copy of the pinned package file (Node hosts only). */
const BUNDLED_MODEL = path.join(process.cwd(), ".data-bundle", "ocr", "eng.traineddata.gz");

/** Whole-exchange deadline for the fallback download (headers and body). */
const MODEL_FETCH_TIMEOUT_MS = 15_000;

/** The pinned gzip is ~10.4 MiB; anything larger cannot be the model. */
const MAX_MODEL_BYTES = 16 * 1024 * 1024;

function modelResponse(bytes: Uint8Array): Response {
  // Copy into a plain ArrayBuffer-backed view: the incoming bytes may be
  // Buffer-backed, which BodyInit does not accept on every runtime.
  const body = new Uint8Array(bytes.length);
  body.set(bytes);
  return new Response(body, { headers: OCR_MODEL_HEADERS });
}

function unavailableResponse(): Response {
  return new Response("OCR language data is unavailable.", {
    status: 502,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function readBundledModel(): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(BUNDLED_MODEL));
  } catch {
    // Workers has no filesystem; a Node host without the postinstall copy
    // (standalone output, some CI images) falls through to the pinned source.
    return null;
  }
}

/**
 * Fetch the pinned model and verify its digest.
 *
 * NOT cached in the Workers Cache API: the deployed Sites Worker is not
 * permitted to use the default cache (`This Worker is not permitted to access
 * the default cache` — observed on the preview, where it turned every OCR load
 * into a 500). Verified bytes are memoized per isolate instead (see
 * `loadModel`); browsers keep them for a year through the immutable response
 * header, so a warm edge is only ever paying for the first load of an isolate.
 */
async function fetchPinnedModel(): Promise<Uint8Array | null> {
  const url = resolveOcrModelUrl();

  // The deadline covers the whole exchange, not just the response headers:
  // a stalled body would otherwise keep the isolate-wide memo pending forever
  // and every OCR caller in this isolate waiting on it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      // The pinned artifact is a gzip FILE. Accepting a transfer encoding
      // would hand us bytes that no longer match the digest.
      headers: { "accept-encoding": "identity" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      // An error body is never read; release it so the connection is not held.
      if (response.body) await response.body.cancel().catch(() => undefined);
      return null;
    }

    // Reject an oversized artifact before buffering it. The digest check can
    // only authenticate bytes after they have been consumed, so the cap has to
    // come first for both the declared and the actual streamed size.
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_MODEL_BYTES) {
      await response.body.cancel().catch(() => undefined);
      return null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let complete = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          complete = true;
          break;
        }
        total += value.byteLength;
        if (total > MAX_MODEL_BYTES) return null;
        chunks.push(value);
      }
    } finally {
      if (!complete) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return (await isPinnedOcrModel(bytes)) ? bytes : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadModel(): Promise<Uint8Array | null> {
  const bundled = await readBundledModel();
  if (bundled && (await isPinnedOcrModel(bundled))) return bundled;
  return fetchPinnedModel();
}

/**
 * Per-isolate memo of the verified bytes.
 *
 * A failure is deliberately not memoized: a transient upstream error must not
 * pin OCR off until the isolate is recycled.
 */
let modelLoad: Promise<Uint8Array | null> | null = null;

export async function GET(): Promise<Response> {
  try {
    const pending = (modelLoad ??= loadModel().then((bytes) => {
      if (!bytes) modelLoad = null;
      return bytes;
    }));
    const bytes = await pending;
    return bytes ? modelResponse(bytes) : unavailableResponse();
  } catch {
    // Fail closed with a clear 502 instead of an opaque framework 500. A fixed
    // string only: the error may carry an upstream URL or response text, and
    // this module is a reviewed direct-console sink (see
    // tests/logging-sink-inventory.test.ts).
    console.error("OCR language model load failed");
    modelLoad = null;
    return unavailableResponse();
  }
}
