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

/** Never render below this scale even for absurdly large pages. */
export const OCR_MIN_RENDER_SCALE = 0.1;

/** Pages recognized per continuous burst before a browser yield + checkpoint. */
export const OCR_PAGES_PER_CHUNK = 8;

/** sessionStorage key for the single-slot OCR resume checkpoint. */
export const OCR_CHECKPOINT_STORAGE_KEY =
  "secondary-condition-finder:ocr-checkpoint:v1";

/**
 * Serialized checkpoint budget. Beyond this the sessionStorage quota risk
 * outweighs the resume benefit (Extended-depth transcript ceilings exceed
 * what sessionStorage can hold), so checkpointing degrades to disabled and
 * the job continues in memory with a warning.
 */
export const OCR_CHECKPOINT_MAX_JSON_CHARS = 2_000_000;

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
 * Computes safe render dimensions for one PDF page under the canvas area
 * cap. `pageWidth`/`pageHeight` are the page's 1× (unit-scale) viewport
 * dimensions as reported by pdf.js.
 */
export function computeOcrRenderMetrics(
  pageWidth: number,
  pageHeight: number,
  maxAreaPx: number = OCR_MAX_CANVAS_AREA_PX,
): OcrRenderMetrics {
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

  let scale = OCR_BASE_RENDER_SCALE;
  const maxSafeScale = Math.sqrt(maxAreaPx / unitArea);
  if (maxSafeScale < scale) {
    scale = Math.max(OCR_MIN_RENDER_SCALE, maxSafeScale);
  }
  let canvasWidth = Math.max(1, Math.floor(width * scale));
  let canvasHeight = Math.max(1, Math.floor(height * scale));

  // Safety net: if the minimum-scale floor still exceeds the cap (absurdly
  // large page), fit exactly under the cap instead of crashing.
  if (canvasWidth * canvasHeight > maxAreaPx) {
    const fitScale = Math.sqrt(maxAreaPx / unitArea);
    canvasWidth = Math.max(1, Math.floor(width * fitScale));
    canvasHeight = Math.max(1, Math.floor(height * fitScale));
    scale = fitScale;
  }

  return { scale, canvasWidth, canvasHeight, downscaled: scale < OCR_BASE_RENDER_SCALE };
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
    Number.isInteger(cp.lastCompletedPage) &&
    (cp.lastCompletedPage as number) >= 0 &&
    Array.isArray(cp.segments) &&
    cp.segments.every(
      (segment) =>
        !!segment &&
        typeof segment === "object" &&
        Number.isInteger((segment as { page?: unknown }).page) &&
        ((segment as { page: number }).page) >= 1 &&
        typeof (segment as { text?: unknown }).text === "string",
    ) &&
    Number.isInteger(cp.recognizedChars) &&
    (cp.recognizedChars as number) >= 0 &&
    typeof cp.updatedAt === "number"
  );
}

/**
 * Persists the OCR resume checkpoint. Returns false when the serialized
 * checkpoint would exceed the budget (caller should continue in memory with
 * checkpointing disabled) or when storage is unavailable/fails — never throws.
 */
export function saveOcrCheckpoint(
  storage: StorageReaderWriter | null,
  checkpoint: OcrCheckpoint,
): boolean {
  if (!storage) return false;
  try {
    const serialized = JSON.stringify(checkpoint);
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
 */
export function loadOcrCheckpoint(
  storage: Pick<StorageReaderWriter, "getItem"> | null,
  sourceFingerprint: string,
): OcrCheckpoint | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(OCR_CHECKPOINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isOcrCheckpoint(parsed)) return null;
    if (parsed.sourceFingerprint !== sourceFingerprint) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOcrCheckpoint(
  storage: Pick<StorageReaderWriter, "removeItem"> | null,
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(OCR_CHECKPOINT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
