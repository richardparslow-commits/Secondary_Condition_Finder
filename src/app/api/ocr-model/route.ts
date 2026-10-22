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

  let response: Response;
  try {
    response = await fetch(url, {
      // The pinned artifact is a gzip FILE. Accepting a transfer encoding
      // would hand us bytes that no longer match the digest.
      headers: { "accept-encoding": "identity" },
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const bytes = new Uint8Array(await response.arrayBuffer());
  return (await isPinnedOcrModel(bytes)) ? bytes : null;
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
