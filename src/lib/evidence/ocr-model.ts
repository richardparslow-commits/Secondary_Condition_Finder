import "server-only";

/**
 * English traineddata for the browser-local OCR pipeline.
 *
 * The model is deliberately NOT a public asset. It is 10.4 MiB, and the Sites
 * uploader budgets a whole deployment (modules + assets + private cache) at
 * 32 MiB; the app's Worker already uses most of that. Copying the model into
 * `public/` therefore made every publish fail. The browser still requests the
 * same same-origin path, `/tesseract/eng.traineddata.gz`, which the proxy
 * rewrite in `next.config.ts` sends to `/api/ocr-model`:
 *
 *   - on Node (tests, `next dev`, Docker, Azure) the route serves the pinned
 *     package copy that postinstall writes to `.data-bundle/ocr/`;
 *   - on Cloudflare Workers (no filesystem) the route downloads the exact
 *     package bytes from the pinned CDN URL, verifies the SHA-256 below, and
 *     memoizes the verified bytes for the life of the isolate. The pages
 *     Runtime's Cache API is not usable from a Sites Worker ("This Worker is
 *     not permitted to access the default cache"), so the immutable response
 *     header — not a cache put — is what keeps repeat loads cheap.
 *
 * The request carries no user data in either case, and the bytes are public
 * MIT-licensed language data — the browser still talks only to this origin, so
 * `connect-src 'self'` and Cross-Origin Isolation are unchanged.
 *
 * `OCR_MODEL_URL` may point at a self-hosted mirror (https only). The digest
 * still has to match, so a mirror cannot substitute different language data.
 */

/** Same-origin path tesseract.js requests (`langPath: "/tesseract"`, `gzip: true`). */
export const OCR_MODEL_PATH = "/tesseract/eng.traineddata.gz";

/** Pin: package name and version match `package.json`'s dependency exactly. */
export const OCR_MODEL_DEFAULT_URL =
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0/eng.traineddata.gz";

/** SHA-256 of `@tesseract.js-data/eng@1.0.0/4.0.0/eng.traineddata.gz` (gzip bytes). */
export const OCR_MODEL_SHA256 =
  "ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468";

/** Responses are immutable per digest; the browser may keep the model for a year. */
export const OCR_MODEL_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const OCR_MODEL_HEADERS: Readonly<Record<string, string>> = {
  // The FILE is gzip; the response itself is not content-encoded. tesseract.js
  // decompresses it (`gzip: true`), so setting `Content-Encoding` here would
  // make the browser decompress first and tesseract fail on the plain bytes.
  "Content-Type": "application/gzip",
  "Cache-Control": OCR_MODEL_CACHE_CONTROL,
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * Source URL for the model.
 *
 * An override must be an absolute https URL: the route runs on Workers, where
 * `global_fetch_strictly_public` refuses private/internal destinations, and a
 * plain-http mirror would downgrade the one server-side fetch this app makes.
 * A malformed override is ignored in favour of the pinned default rather than
 * turning OCR into a silent 502 on a typo.
 */
export function resolveOcrModelUrl(
  // Narrow on purpose: the only variable this reads is OCR_MODEL_URL, and the
  // narrow shape lets tests pass a plain object instead of faking ProcessEnv.
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.OCR_MODEL_URL?.trim();
  if (!override) return OCR_MODEL_DEFAULT_URL;
  try {
    const url = new URL(override);
    return url.protocol === "https:" ? url.toString() : OCR_MODEL_DEFAULT_URL;
  } catch {
    return OCR_MODEL_DEFAULT_URL;
  }
}

/** Lower-case hex SHA-256 of the provided bytes (WebCrypto — workerd and Node). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // WebCrypto's BufferSource excludes SharedArrayBuffer-backed views, so hash a
  // plain ArrayBuffer copy — callers may hand us a Node Buffer or a pooled view.
  const view = new Uint8Array(bytes.length);
  view.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", view);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * True only for the pinned language data.
 *
 * This is the supply-chain boundary for the one binary the server fetches at
 * runtime: an upstream change, a cache-poisoned mirror, or a truncated
 * response must fail closed instead of handing tesseract a different model.
 */
export async function isPinnedOcrModel(bytes: Uint8Array): Promise<boolean> {
  return (await sha256Hex(bytes)) === OCR_MODEL_SHA256;
}
