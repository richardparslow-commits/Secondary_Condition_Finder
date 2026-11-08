/**
 * Browser-local OCR memory-safety primitives.
 *
 * **Browser-only** — must never be imported from app pages, Server Actions,
 * or API routes. This module is part of the evidence-parser boundary
 * (see docs/evidence-parser-boundary.md). It holds the pure/persistence
 * pieces of the OCR pipeline so the component keeps only orchestration:
 *
 * - Canvas sizing under a hard pixel-area cap (mobile Safari/Chrome crash
 *   long before desktop when a scale-2 render of a large scanned page
 *   exceeds the canvas memory ceiling).
 * - Chunked page bursts: OCR runs in bounded chunks separated by browser
 *   yields so compositor, input, and GC can run between bursts.
 * - Resume-from-checkpoint: recognized pages are persisted to tab-scoped
 *   sessionStorage at chunk boundaries so a crashed/interrupted multi-page
 *   job resumes where it stopped instead of re-recognizing from page 1.
 * - Worker-health probing: after a recognition failure, a probe decides
 *   whether the failure was page-specific or the WASM worker died (OOM) —
 *   in which case the loop must stop instead of retrying every page.
 * - Trusted-Types-compatible worker spawning: the canonical factory loads the
 *   worker script as a direct same-origin URL (`workerBlobURL: false`)
 *   because production's `require-trusted-types-for 'script'` default policy
 *   refuses the blob wrapper Tesseract uses by default.
 *
 * The checkpoint contains extracted document text and lives in
 * sessionStorage only — the same tab-local privacy envelope as the retained
 * evidence store (no bytes or text ever reach the server).
 */

/** Requested render scale before the area cap is applied. */
export const OCR_BASE_RENDER_SCALE = 2;

/**
 * Hard canvas pixel-area cap: 16,777,216 px² (4096 × 4096). A scale-2 render
 * of a legal/ledger-size scan can exceed 30M px², which reliably crashes the
 * renderer or the Tesseract WASM pass on mobile browsers. Desktop tolerates
 * more, but one cap for all platforms keeps behavior predictable.
 */
export const OCR_MAX_CANVAS_AREA_PX = 16_777_216;

/**
 * Hard ceiling on either canvas axis. Browsers reject canvases beyond their
 * per-axis limit, and a very thin page could otherwise satisfy the area cap
 * with one enormous axis.
 */
export const OCR_MAX_CANVAS_DIMENSION = 16_384;

/**
 * Historical minimum render scale. The hard area and per-axis caps take
 * precedence: a page large enough to require a smaller scale is fitted under
 * the caps rather than rendered above them.
 */
export const OCR_MIN_RENDER_SCALE = 0.1;

/**
 * Hard ceiling on the **decoded** pixel count of a direct image upload
 * (audit A06). The canvas area cap bounds the render target, but a direct
 * image upload is decoded at its own intrinsic size first, so a
 * decompression bomb (a few hundred KB declaring 60,000 × 60,000) would
 * allocate gigabytes before any cap applied. Accepted containers therefore
 * declare their dimensions in a header this module reads **before** any
 * decode: 40 MP comfortably covers a 24 MP phone photo and a 300 dpi
 * letter-size scan (~8.7 MP) while refusing bomb-shaped inputs.
 */
export const OCR_MAX_IMAGE_PIXELS = 40_000_000;

/** Hard ceiling on either declared image dimension (px). */
export const OCR_MAX_IMAGE_DIMENSION = 20_000;

/**
 * Hard elapsed-work budget for one browser-local OCR job. The per-page loop
 * checks this at every page boundary, and the owning component arms a timer
 * that fires it so a `recognize()` promise which never settles still ends the
 * job and terminates the worker instead of pinning the tab forever.
 */
export const OCR_JOB_DEADLINE_MS = 5 * 60 * 1000;

/** Pages recognized per continuous burst before a browser yield + checkpoint. */
export const OCR_PAGES_PER_CHUNK = 8;

/**
 * sessionStorage key for the tab-scoped OCR resume checkpoints. One key holds
 * a checkpoint per source document, so pausing one scan is not discarded by
 * another document's scan, completion, or removal.
 */
export const OCR_CHECKPOINT_STORAGE_KEY =
  "secondary-condition-finder:ocr-checkpoint:v1";

/**
 * Serialized checkpoint budget. Beyond this the sessionStorage quota risk
 * outweighs the resume benefit (Extended-depth transcript ceilings exceed
 * what sessionStorage can hold), so checkpointing degrades to disabled and
 * the job continues in memory with a warning.
 */
export const OCR_CHECKPOINT_MAX_JSON_CHARS = 2_000_000;
/** Resume expires after 15 minutes; checked before any transcript is restored. */
export const OCR_CHECKPOINT_TTL_MS = 15 * 60 * 1000;
const OCR_CHECKPOINT_MAX_PAGES = 2_000;

export interface OcrRenderMetrics {
  /** Final render scale (relative to the page's 1× viewport). */
  scale: number;
  /** Integer canvas width to allocate. */
  canvasWidth: number;
  /** Integer canvas height to allocate. */
  canvasHeight: number;
  /** True when the area cap forced the scale below the requested base. */
  downscaled: boolean;
}

/**
 * Computes safe render dimensions for one PDF page under the canvas area and
 * per-axis caps. `pageWidth`/`pageHeight` are the page's 1× (unit-scale)
 * viewport dimensions as reported by pdf.js.
 */
export function computeOcrRenderMetrics(
  pageWidth: number,
  pageHeight: number,
  maxAreaPx: number = OCR_MAX_CANVAS_AREA_PX,
): OcrRenderMetrics {
  if (!Number.isFinite(maxAreaPx) || maxAreaPx < 1) {
    throw new RangeError("Invalid canvas area limit");
  }
  const areaCap = Math.floor(maxAreaPx);

  const width = Number.isFinite(pageWidth) ? Math.max(0, pageWidth) : 0;
  const height = Number.isFinite(pageHeight) ? Math.max(0, pageHeight) : 0;
  const unitArea = width * height;
  if (!(unitArea > 0)) {
    return {
      scale: OCR_BASE_RENDER_SCALE,
      canvasWidth: 1,
      canvasHeight: 1,
      downscaled: false,
    };
  }

  // Bound the continuous area and both axes before flooring. The per-axis cap
  // is what makes the 1-pixel floor safe: a very thin page can no longer trade
  // an enormous long edge for a 1-pixel short edge (1 × 16,384 is under the
  // area cap). No minimum-scale floor is applied here — honoring one for an
  // absurd page is exactly what let the rendered area exceed the hard cap.
  const scale = Math.min(
    OCR_BASE_RENDER_SCALE,
    Math.sqrt(areaCap) / Math.sqrt(width) / Math.sqrt(height),
    areaCap / width,
    areaCap / height,
    OCR_MAX_CANVAS_DIMENSION / width,
    OCR_MAX_CANVAS_DIMENSION / height,
  );
  const canvasWidth = Math.max(1, Math.floor(width * scale));
  const canvasHeight = Math.max(1, Math.floor(height * scale));

  return { scale, canvasWidth, canvasHeight, downscaled: scale < OCR_BASE_RENDER_SCALE };
}

export interface OcrJobDeadline {
  /** True once the elapsed-work budget has been reached. */
  exceeded(): boolean;
  /** Cancels the timer. Safe to call more than once. */
  clear(): void;
}

/**
 * Arms the elapsed-work budget for one OCR job.
 *
 * `onExpire` runs exactly once, at the deadline, so the owner can terminate a
 * worker whose `recognize()` promise may never settle — the case a per-page
 * boundary check alone cannot reach, because a hung await never returns to the
 * boundary. The callback is isolated: a throw inside teardown must not defeat
 * the budget or escape as an unhandled rejection.
 */
export function startOcrJobDeadline(
  budgetMs: number = OCR_JOB_DEADLINE_MS,
  onExpire: () => void = () => {},
): OcrJobDeadline {
  let expired = false;
  if (!(Number.isFinite(budgetMs) && budgetMs > 0)) {
    return { exceeded: () => false, clear: () => {} };
  }
  const timer = setTimeout(() => {
    expired = true;
    try {
      onExpire();
    } catch {
      // Teardown failure must not defeat the budget it was arming.
    }
  }, budgetMs);
  // Do not let a pending budget keep a Node process (tests, SSR imports) alive.
  (timer as unknown as { unref?: () => void }).unref?.();
  return {
    exceeded: () => expired,
    clear: () => {
      clearTimeout(timer);
    },
  };
}

export interface ImageDimensions {
  width: number;
  height: number;
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset < 0 || offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function u16be(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function u16le(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u32be(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    bytes[offset]! * 0x1000000 +
    bytes[offset + 1]! * 0x10000 +
    bytes[offset + 2]! * 0x100 +
    bytes[offset + 3]!
  );
}

function u32le(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    bytes[offset]! +
    bytes[offset + 1]! * 0x100 +
    bytes[offset + 2]! * 0x10000 +
    bytes[offset + 3]! * 0x1000000
  );
}

function i32le(bytes: Uint8Array, offset: number): number | null {
  const value = u32le(bytes, offset);
  if (value === null) return null;
  return value >= 0x80000000 ? value - 0x100000000 : value;
}

function u24le(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 3 > bytes.length) return null;
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function valid(dimensions: ImageDimensions | null): ImageDimensions | null {
  if (!dimensions) return null;
  const { width, height } = dimensions;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return dimensions;
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  if (!signature.every((byte, index) => bytes[index] === byte)) return null;
  // IHDR must be the first chunk; its width/height are big-endian uint32 at
  // bytes 16..19 and 20..23.
  if (!asciiAt(bytes, 12, "IHDR")) return null;
  const width = u32be(bytes, 16);
  const height = u32be(bytes, 20);
  if (width === null || height === null) return null;
  return valid({ width, height });
}

/** Start-of-frame markers carry the JPEG's real dimensions (not the thumbnail). */
function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 3 < bytes.length) {
    if (bytes[pos] !== 0xff) {
      pos += 1; // resynchronize on a malformed/embedded byte
      continue;
    }
    const marker = bytes[pos + 1]!;
    if (marker === 0xff || marker === 0x00) {
      pos += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2; // standalone markers carry no length
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null; // entropy scan: no SOF
    const length = u16be(bytes, pos + 2);
    if (length === null || length < 2) return null;
    if (isJpegStartOfFrame(marker)) {
      const height = u16be(bytes, pos + 5);
      const width = u16be(bytes, pos + 7);
      if (width === null || height === null) return null;
      return valid({ width, height });
    }
    pos += 2 + length;
  }
  return null;
}

function gifDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (!asciiAt(bytes, 0, "GIF87a") && !asciiAt(bytes, 0, "GIF89a")) return null;
  const width = u16le(bytes, 6);
  const height = u16le(bytes, 8);
  if (width === null || height === null) return null;
  return valid({ width, height });
}

function bmpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (!asciiAt(bytes, 0, "BM")) return null;
  const width = i32le(bytes, 18);
  // A negative height means a top-down bitmap; the magnitude is the height.
  const height = i32le(bytes, 22);
  if (width === null || height === null) return null;
  return valid({ width, height: Math.abs(height) });
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (!asciiAt(bytes, 0, "RIFF") || !asciiAt(bytes, 8, "WEBP")) return null;
  if (asciiAt(bytes, 12, "VP8X")) {
    const width = u24le(bytes, 24);
    const height = u24le(bytes, 27);
    if (width === null || height === null) return null;
    return valid({ width: width + 1, height: height + 1 });
  }
  if (asciiAt(bytes, 12, "VP8L")) {
    // Signature byte 0x2f at 20, then 14-bit (width-1) and (height-1),
    // little-endian bit order.
    if (bytes[20] !== 0x2f) return null;
    const bits = u32le(bytes, 21);
    if (bits === null) return null;
    return valid({ width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 });
  }
  if (asciiAt(bytes, 12, "VP8 ")) {
    // Lossy frame header: 3-byte tag, then the 0x9d012a sync code at 23..25.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    const width = u16le(bytes, 26);
    const height = u16le(bytes, 28);
    if (width === null || height === null) return null;
    return valid({ width: width & 0x3fff, height: height & 0x3fff });
  }
  return null;
}

function tiffDimensions(bytes: Uint8Array): ImageDimensions | null {
  const littleEndian = bytes[0] === 0x49 && bytes[1] === 0x49;
  const bigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!littleEndian && !bigEndian) return null;
  const u16 = (offset: number) => (littleEndian ? u16le(bytes, offset) : u16be(bytes, offset));
  const u32 = (offset: number) => (littleEndian ? u32le(bytes, offset) : u32be(bytes, offset));
  if (u16(2) !== 42) return null;
  const ifdOffset = u32(4);
  if (ifdOffset === null) return null;
  const entryCount = u16(ifdOffset);
  if (entryCount === null) return null;
  let width: number | null = null;
  let height: number | null = null;
  // Bounded scan: a hostile IFD cannot make this loop unbounded work.
  for (let index = 0; index < Math.min(entryCount, 512); index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    const tag = u16(entry);
    const type = u16(entry + 2);
    if (tag === null || type === null) break;
    if (tag !== 256 && tag !== 257) continue;
    const value = type === 3 ? u16(entry + 8) : type === 4 ? u32(entry + 8) : null;
    if (value === null || value <= 0) continue;
    if (tag === 256) width = value;
    else height = value;
  }
  if (width === null || height === null) return null;
  return valid({ width, height });
}

/**
 * Declared dimensions for every container the DD-214 upload accepts
 * (PNG, JPEG, GIF, BMP, WebP, TIFF), read from the file header alone.
 * Returns null when the header is truncated, malformed, or unrecognized —
 * the caller must treat "unknown" as "cannot bound this decode".
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return (
    pngDimensions(bytes) ??
    jpegDimensions(bytes) ??
    gifDimensions(bytes) ??
    bmpDimensions(bytes) ??
    webpDimensions(bytes) ??
    tiffDimensions(bytes)
  );
}

export type ImageDecodeRejection =
  | "unknown-dimensions"
  | "too-many-pixels"
  | "dimension-too-large";

export interface ImageDecodePlan {
  accepted: boolean;
  /** Why the image was refused; `"ok"` when accepted. */
  reason: "ok" | ImageDecodeRejection;
  dimensions: ImageDimensions | null;
  /** Bounded render target for `recognize` (null when refused). */
  metrics: OcrRenderMetrics | null;
}

/**
 * Decides whether a direct image upload may be decoded, and at what bounded
 * size, **before** any decode happens (audit A06). The declared dimensions are
 * checked against a hard pixel ceiling and a per-dimension ceiling; an accepted
 * image then renders through the same canvas area cap the PDF path uses, so the
 * input handed to the OCR worker is bounded by construction.
 */
export function planImageDecode(
  bytes: Uint8Array,
  maxAreaPx: number = OCR_MAX_CANVAS_AREA_PX,
): ImageDecodePlan {
  const dimensions = readImageDimensions(bytes);
  if (!dimensions) {
    return { accepted: false, reason: "unknown-dimensions", dimensions: null, metrics: null };
  }
  if (
    dimensions.width > OCR_MAX_IMAGE_DIMENSION ||
    dimensions.height > OCR_MAX_IMAGE_DIMENSION
  ) {
    return { accepted: false, reason: "dimension-too-large", dimensions, metrics: null };
  }
  if (dimensions.width * dimensions.height > OCR_MAX_IMAGE_PIXELS) {
    return { accepted: false, reason: "too-many-pixels", dimensions, metrics: null };
  }
  return {
    accepted: true,
    reason: "ok",
    dimensions,
    metrics: computeOcrRenderMetrics(dimensions.width, dimensions.height, maxAreaPx),
  };
}

/**
 * Joins per-page recognized text **in page order** under one character budget.
 *
 * The mixed-document path recognized text pages and image-only pages in
 * separate passes, so appending each pass's results put every OCR'd page after
 * every text-layer page — a re-ordered document whose dates and duty stations
 * could be misread. Slots are indexed by page and joined here, and the character
 * budget is applied in page order, so a truncated review is the document's
 * prefix rather than whichever pass ran first.
 */
export function assemblePageOrderedText(
  pageTexts: ReadonlyArray<string | null | undefined>,
  textChars: number,
): { text: string; truncated: boolean; keptChars: number } {
  const budget = Number.isFinite(textChars) && textChars > 0 ? Math.floor(textChars) : 0;
  const parts: string[] = [];
  let kept = 0;
  let truncated = false;
  for (const raw of pageTexts) {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;
    const separator = parts.length > 0 ? 1 : 0;
    const room = budget - kept - separator;
    if (room <= 0) {
      truncated = true;
      break;
    }
    const slice = text.slice(0, room);
    if (separator === 1) kept += 1;
    parts.push(slice);
    kept += slice.length;
    if (slice.length < text.length) {
      truncated = true;
      break;
    }
  }
  return { text: parts.join("\n"), truncated, keptChars: kept };
}

/**
 * Yields to the browser between OCR chunks (double-rAF so at least one
 * composited frame occurs; setTimeout fallback for non-visual contexts).
 */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Releases a rendered canvas immediately instead of waiting for GC —
 * canvases are retained aggressively on mobile browsers, and hundreds of
 * scale-2 canvases are exactly the OOM profile we are defending against.
 */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    // best-effort release; never mask the caller's outcome
  }
}

/**
 * Canonical options for spawning the browser-local Tesseract worker.
 *
 * `workerBlobURL: false` is load-bearing, not a preference. Tesseract's
 * default (`true`) wraps `workerPath` in a Blob and spawns
 * `new Worker(URL.createObjectURL(blob))`. Production enforces Trusted Types
 * with a strict `default` policy that permits only same-origin http(s) script
 * URLs, so the blob wrapper is refused and browser-local OCR fails with
 * "Trusted Types: refused non-same-origin script URL". Direct same-origin
 * loading keeps the strict policy (and `worker-src 'self'`, which no longer
 * allowlists `blob:`) intact and works in every browser, including those that
 * do not enforce Trusted Types.
 *
 * All OCR entry points must spawn workers through `createLocalOcrWorker()` so
 * this contract cannot silently regress in one call site.
 */
export const LOCAL_OCR_WORKER_OPTIONS = {
  // The guard worker (provisioned by scripts/copy-pdf-worker.mjs) installs the
  // realm-local Trusted Types default policy that lets this worker and the
  // pinned tesseract script import their /tesseract/ assets, then forwards to
  // worker.min.js. Pointing workerPath at worker.min.js directly fails inside
  // the worker realm, whose own CSP enforces Trusted Types without any policy.
  workerPath: "/tesseract/worker-guard.js",
  corePath: "/tesseract/tesseract-core-simd.wasm.js",
  langPath: "/tesseract",
  workerBlobURL: false,
} as const;

export interface LocalOcrWorkerCreationOptions {
  /**
   * Cancels the **construction window**. Aborting terminates the worker even
   * while its `load`/`loadLanguage`/`initialize` handshake is still pending.
   *
   * Without this, a worker that stops answering during initialization is
   * unreachable: the caller has no handle until this function returns, so
   * cancel, the elapsed-work deadline and unmount all find an empty ref and the
   * worker (and the tab's busy state) lives on. REL-05's hostile-file browser
   * stress test reproduces exactly that with a stalled worker
   * (`e2e/hostile-file-stress.mjs`).
   */
  signal?: AbortSignal;
}

/**
 * Direct client for the pinned Tesseract v6 worker protocol. No OCR library,
 * image encoding, model initialization or inference runs on the page. Canvas
 * inputs cross the boundary as transferable bitmaps; worker-guard.js encodes
 * them using OffscreenCanvas before handing them to Tesseract. File/Blob bytes
 * are read asynchronously and transferred, never posted to an HTTP endpoint.
 */
export async function createLocalOcrWorker(options: LocalOcrWorkerCreationOptions = {}) {
  const worker = new Worker("/tesseract/worker-guard.js");
  let sequence = 0;
  let closed = false;
  const pending = new Map<string, {
    resolve: (result: { data: { text?: string } }) => void;
    reject: (error: Error) => void;
  }>();
  const fail = (error: Error) => {
    // One teardown per worker: an abort during initialization rejects the
    // handshake, and the factory's own catch would otherwise terminate the
    // same worker a second time (visible to an instrumented Worker and to the
    // REL-05 browser audit, which counts terminate calls).
    if (closed) return;
    for (const job of pending.values()) job.reject(error);
    pending.clear();
    closed = true;
    worker.terminate();
  };
  worker.onerror = () => fail(new Error("Browser-local OCR worker failed."));
  worker.onmessageerror = () => fail(new Error("Browser-local OCR worker message failed."));
  const cancelled = () => new Error("Browser-local OCR was cancelled.");
  const onAbort = () => fail(cancelled());
  if (options.signal?.aborted) {
    onAbort();
    throw cancelled();
  }
  options.signal?.addEventListener("abort", onAbort, { once: true });
  worker.onmessage = ({ data }) => {
    const job = pending.get(data.jobId);
    if (!job || data.status === "progress") return;
    pending.delete(data.jobId);
    if (data.status === "resolve") job.resolve({ data: data.data });
    else job.reject(new Error("Browser-local OCR operation failed."));
  };
  const send = (action: string, payload: object, transfer: Transferable[] = []) => {
    if (closed) return Promise.reject(new Error("Browser-local OCR worker is closed."));
    const jobId = `local-ocr-${++sequence}`;
    return new Promise<{ data: { text?: string } }>((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      try {
        worker.postMessage({ workerId: "local-ocr", jobId, action, payload }, transfer);
      } catch {
        fail(new Error("Could not send input to the browser-local OCR worker."));
      }
    });
  };
  try {
    await send("load", { options: { lstmOnly: true, corePath: LOCAL_OCR_WORKER_OPTIONS.corePath, logging: false } });
    await send("loadLanguage", { langs: "eng", options: { langPath: LOCAL_OCR_WORKER_OPTIONS.langPath, gzip: true, lstmOnly: true } });
    await send("initialize", { langs: "eng", oem: 1, config: {} });
  } catch (error) {
    fail(new Error("Could not initialize browser-local OCR."));
    throw error;
  } finally {
    // The signal covers construction only; the returned client owns the worker
    // from here (its `terminate()` is the teardown path).
    options.signal?.removeEventListener("abort", onAbort);
  }
  return {
    async recognize(input: HTMLCanvasElement | File | Blob) {
      if (input instanceof Blob) {
        const buffer = await input.arrayBuffer();
        return send("recognize", { image: new Uint8Array(buffer), options: {}, output: { text: true } }, [buffer]);
      }
      // createImageBitmap is asynchronous; PNG encoding happens in the worker,
      // not via canvas.toBlob/toDataURL on the page's main thread.
      const image = await createImageBitmap(input);
      try {
        return await send("recognize", { image, options: {}, output: { text: true } }, [image]);
      } finally {
        image.close();
      }
    },
    async terminate() {
      fail(new Error("Browser-local OCR was terminated."));
    },
  };
}

export interface OcrWorkerHealthProbe {
  /** The worker's recognize function (already bound to the worker). */
  recognize: (input: unknown) => Promise<unknown>;
  /** Creates a minimal probe image (e.g. a 1×1 canvas in the browser). */
  createProbeInput: () => unknown;
}

/**
 * Decides whether a recognition failure was page-specific (probe succeeds —
 * skip the page and continue) or the worker is dead, typically a WASM/OOM
 * crash (probe also fails — stop the loop; retrying every remaining page
 * just burns minutes and accumulates garbage).
 */
export async function probeWorkerHealth(
  probe: OcrWorkerHealthProbe,
): Promise<boolean> {
  try {
    await probe.recognize(probe.createProbeInput());
    return true;
  } catch {
    return false;
  }
}

export interface OcrCheckpointSegment {
  page: number;
  text: string;
}

export interface OcrCheckpoint {
  version: 1;
  /** Identity of the source document the transcript belongs to. */
  sourceFingerprint: string;
  /** Highest page fully recognized (0 when nothing recognized yet). */
  lastCompletedPage: number;
  segments: OcrCheckpointSegment[];
  recognizedChars: number;
  updatedAt: number;
}

interface OcrCheckpointStore {
  version: 1;
  checkpoints: Record<string, OcrCheckpoint>;
}

interface StorageReaderWriter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Cheap, synchronous source identity for checkpoint matching. Tab-scoped and
 * never transmitted; a matching name+size+lastModified within one tab session
 * is the same document for resume purposes.
 */
export function sourceFingerprintForFile(file: {
  name: string;
  size: number;
  lastModified: number;
}): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function isOcrCheckpoint(value: unknown): value is OcrCheckpoint {
  if (!value || typeof value !== "object") return false;
  const cp = value as Record<string, unknown>;
  return (
    cp.version === 1 &&
    typeof cp.sourceFingerprint === "string" &&
    cp.sourceFingerprint.length > 0 &&
    cp.sourceFingerprint.length <= 1_024 &&
    Number.isInteger(cp.lastCompletedPage) &&
    (cp.lastCompletedPage as number) >= 0 &&
    (cp.lastCompletedPage as number) <= OCR_CHECKPOINT_MAX_PAGES &&
    Array.isArray(cp.segments) &&
    cp.segments.length <= OCR_CHECKPOINT_MAX_PAGES &&
    cp.segments.every(
      (segment, index, segments) =>
        !!segment &&
        typeof segment === "object" &&
        Number.isInteger((segment as { page?: unknown }).page) &&
        ((segment as { page: number }).page) >= 1 &&
        ((segment as { page: number }).page) <= (cp.lastCompletedPage as number) &&
        (index === 0 || segments[index - 1].page < segment.page) &&
        typeof (segment as { text?: unknown }).text === "string",
    ) &&
    Number.isInteger(cp.recognizedChars) &&
    (cp.recognizedChars as number) >= 0 &&
    cp.recognizedChars === cp.segments.reduce((total, segment) => total + segment.text.length, 0) &&
    typeof cp.updatedAt === "number" &&
    Number.isFinite(cp.updatedAt)
  );
}

function emptyOcrCheckpointStore(): OcrCheckpointStore {
  return { version: 1, checkpoints: Object.create(null) as Record<string, OcrCheckpoint> };
}

/**
 * Accepts the current per-source store and the legacy single-checkpoint shape.
 * Invalid entries are dropped, never thrown: one damaged document's checkpoint
 * must not prevent another document from resuming.
 */
function normalizeOcrCheckpointStore(value: unknown): OcrCheckpointStore | null {
  if (isOcrCheckpoint(value)) {
    return {
      version: 1,
      checkpoints: { [value.sourceFingerprint]: value },
    };
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    !candidate.checkpoints ||
    typeof candidate.checkpoints !== "object" ||
    Array.isArray(candidate.checkpoints)
  ) {
    return null;
  }

  const checkpoints = Object.create(null) as Record<string, OcrCheckpoint>;
  for (const [fingerprint, entry] of Object.entries(
    candidate.checkpoints as Record<string, unknown>,
  )) {
    if (isOcrCheckpoint(entry) && entry.sourceFingerprint === fingerprint) {
      checkpoints[fingerprint] = entry;
    }
  }
  return { version: 1, checkpoints };
}

function ownsCheckpoint(
  store: OcrCheckpointStore,
  sourceFingerprint: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    store.checkpoints,
    sourceFingerprint,
  );
}

function isExpiredCheckpoint(checkpoint: OcrCheckpoint, now: number): boolean {
  return (
    checkpoint.updatedAt > now ||
    now - checkpoint.updatedAt >= OCR_CHECKPOINT_TTL_MS
  );
}

function writeOcrCheckpointStore(
  storage: Pick<StorageReaderWriter, "setItem" | "removeItem">,
  store: OcrCheckpointStore,
): boolean {
  if (Object.keys(store.checkpoints).length === 0) {
    storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
    return true;
  }
  const serialized = JSON.stringify(store);
  if (serialized.length > OCR_CHECKPOINT_MAX_JSON_CHARS) return false;
  storage.setItem(OCR_CHECKPOINT_STORAGE_KEY, serialized);
  return true;
}

/**
 * Persists the OCR resume checkpoint for its source fingerprint. Returns
 * false when the serialized store would exceed the budget (caller should
 * continue in memory with checkpointing disabled) or when storage is
 * unavailable/fails — never throws.
 *
 * A checkpoint for one document never evicts another document's checkpoint.
 * If the combined store would exceed the budget, the new checkpoint is not
 * saved and the existing paused run remains resumable.
 */
export function saveOcrCheckpoint(
  storage: StorageReaderWriter | null,
  checkpoint: OcrCheckpoint,
): boolean {
  if (!storage) return false;
  if (!isOcrCheckpoint(checkpoint)) return false;

  let serializedCheckpoint: string;
  try {
    serializedCheckpoint = JSON.stringify(checkpoint);
  } catch {
    return false;
  }
  if (serializedCheckpoint.length > OCR_CHECKPOINT_MAX_JSON_CHARS) return false;

  try {
    let store = emptyOcrCheckpointStore();
    const raw = storage.getItem(OCR_CHECKPOINT_STORAGE_KEY);
    if (raw && raw.length <= OCR_CHECKPOINT_MAX_JSON_CHARS) {
      try {
        const parsed: unknown = JSON.parse(raw);
        store = normalizeOcrCheckpointStore(parsed) ?? store;
      } catch {
        // An unreadable store has no resumable checkpoint to preserve.
      }
    }

    const now = Date.now();
    for (const [fingerprint, entry] of Object.entries(store.checkpoints)) {
      if (isExpiredCheckpoint(entry, now)) delete store.checkpoints[fingerprint];
    }
    store.checkpoints[checkpoint.sourceFingerprint] = checkpoint;

    const serialized = JSON.stringify(store);
    if (serialized.length > OCR_CHECKPOINT_MAX_JSON_CHARS) return false;
    storage.setItem(OCR_CHECKPOINT_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the checkpoint for the given source fingerprint. Returns null when
 * absent, malformed (treated like a corrupted store — dropped, never thrown),
 * version-mismatched, or belonging to a different document.
 *
 * Expired or invalid entries are removed without disturbing another
 * document's valid checkpoint.
 */
export function loadOcrCheckpoint(
  storage:
    | (Pick<StorageReaderWriter, "getItem"> &
        Partial<Pick<StorageReaderWriter, "setItem" | "removeItem">>)
    | null,
  sourceFingerprint: string,
  now = Date.now(),
): OcrCheckpoint | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(OCR_CHECKPOINT_STORAGE_KEY);
    if (!raw) return null;
    if (raw.length > OCR_CHECKPOINT_MAX_JSON_CHARS) {
      throw new Error("Checkpoint too large");
    }
    const parsed: unknown = JSON.parse(raw);
    const store = normalizeOcrCheckpointStore(parsed);
    if (!store) throw new Error("Invalid checkpoint store");

    let pruned = false;
    for (const [fingerprint, entry] of Object.entries(store.checkpoints)) {
      if (isExpiredCheckpoint(entry, now)) {
        delete store.checkpoints[fingerprint];
        pruned = true;
      }
    }
    if (pruned && storage.setItem && storage.removeItem) {
      writeOcrCheckpointStore(
        storage as Pick<StorageReaderWriter, "setItem" | "removeItem">,
        store,
      );
    }

    if (!ownsCheckpoint(store, sourceFingerprint)) {
      if (
        Object.keys(store.checkpoints).length === 0 &&
        storage.removeItem
      ) {
        storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
      }
      return null;
    }
    return store.checkpoints[sourceFingerprint] ?? null;
  } catch {
    try {
      storage.removeItem?.(OCR_CHECKPOINT_STORAGE_KEY);
    } catch {
      /* best effort */
    }
    return null;
  }
}

/**
 * Clears one document's checkpoint when `sourceFingerprint` is supplied, or
 * the whole checkpoint store when it is omitted. Removing one document never
 * discards another document's paused run.
 */
export function clearOcrCheckpoint(
  storage:
    | (Pick<StorageReaderWriter, "removeItem"> &
        Partial<Pick<StorageReaderWriter, "getItem" | "setItem">>)
    | null,
  sourceFingerprint?: string,
): boolean {
  if (!storage) return false;

  if (sourceFingerprint === undefined) {
    try {
      storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  if (!storage.getItem) return false;
  try {
    const raw = storage.getItem(OCR_CHECKPOINT_STORAGE_KEY);
    if (!raw) return true;
    if (raw.length > OCR_CHECKPOINT_MAX_JSON_CHARS) {
      storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
      return true;
    }
    const parsed: unknown = JSON.parse(raw);
    const store = normalizeOcrCheckpointStore(parsed);
    if (!store) {
      storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
      return true;
    }
    if (!ownsCheckpoint(store, sourceFingerprint)) return true;

    delete store.checkpoints[sourceFingerprint];
    if (Object.keys(store.checkpoints).length === 0) {
      storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
      return true;
    }
    if (!storage.setItem) return false;
    return writeOcrCheckpointStore(
      storage as Pick<StorageReaderWriter, "setItem" | "removeItem">,
      store,
    );
  } catch {
    try {
      storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }
}
