import { describe, expect, it } from "vitest";

import {
  clearOcrCheckpoint,
  computeOcrRenderMetrics,
  loadOcrCheckpoint,
  OCR_BASE_RENDER_SCALE,
  OCR_CHECKPOINT_MAX_JSON_CHARS,
  OCR_CHECKPOINT_STORAGE_KEY,
  OCR_CHECKPOINT_TTL_MS,
  OCR_MAX_CANVAS_AREA_PX,
  OCR_MIN_RENDER_SCALE,
  saveOcrCheckpoint,
  sourceFingerprintForFile,
  type OcrCheckpoint,
} from "../src/lib/evidence/ocr-session";

/**
 * Behavioral contracts for the browser-local OCR memory-safety primitives
 * (src/lib/evidence/ocr-session.ts). The orchestration in
 * LocalEvidenceAnalyzer.tsx stays pinned by the repo's structural-contract
 * convention (tests/local-ocr-cleanup-contract, tests/evidence-storage-parse-
 * warning); these tests pin the pure surfaces that orchestration relies on:
 *
 * - Canvas sizing must never exceed the pixel-area cap (mobile Safari/
 *   Chrome crash above it), with a floor so pages cannot be shrunk into
 *   illegibility and a final fit so absurd pages still stay under the cap.
 * - Resume checkpoints round-trip exactly, fail closed on any shape/
 *   version/fingerprint mismatch, and degrade to "disabled" (false, no
 *   throw) when the serialized payload exceeds the budget or storage is
 *   unavailable/quota-failing.
 */

function fakeStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function validCheckpoint(
  overrides: Record<string, unknown> = {},
): OcrCheckpoint {
  return {
    version: 1,
    sourceFingerprint: "c-file.pdf:123:456",
    lastCompletedPage: 8,
    segments: [
      { page: 1, text: "PTSD secondary to tinnitus" },
      { page: 8, text: "2/2 OSA" },
    ],
    recognizedChars: "PTSD secondary to tinnitus".length + "2/2 OSA".length,
    updatedAt: Date.now(),
    ...overrides,
  } as OcrCheckpoint;
}

describe("computeOcrRenderMetrics canvas area cap", () => {
  it("keeps the base scale for ordinary letter-size pages", () => {
    const metrics = computeOcrRenderMetrics(612, 792);
    expect(metrics.downscaled).toBe(false);
    expect(metrics.scale).toBe(OCR_BASE_RENDER_SCALE);
    expect(metrics.canvasWidth).toBe(1224);
    expect(metrics.canvasHeight).toBe(1584);
    expect(metrics.canvasWidth * metrics.canvasHeight).toBeLessThanOrEqual(
      OCR_MAX_CANVAS_AREA_PX,
    );
  });

  it("downscales oversized scanned pages to stay under the area cap", () => {
    const unitArea = 3000 * 5000;
    const metrics = computeOcrRenderMetrics(3000, 5000);
    expect(metrics.downscaled).toBe(true);
    expect(metrics.scale).toBeLessThan(OCR_BASE_RENDER_SCALE);
    expect(
      metrics.canvasWidth * metrics.canvasHeight,
    ).toBeLessThanOrEqual(OCR_MAX_CANVAS_AREA_PX);
    // Still renders at more than unit scale when the page allows it.
    expect(metrics.scale).toBeGreaterThan(1);
    expect(unitArea * metrics.scale * metrics.scale).toBeLessThanOrEqual(
      OCR_MAX_CANVAS_AREA_PX,
    );
  });

  it("respects a caller-provided cap (tighter envelope without touching the shared constant)", () => {
    const metrics = computeOcrRenderMetrics(612, 792, 612 * 792 * 1.5);
    expect(metrics.downscaled).toBe(true);
    expect(metrics.canvasWidth * metrics.canvasHeight).toBeLessThanOrEqual(
      612 * 792 * 1.5,
    );
  });

  it("degrades to 1x1 for degenerate page dimensions instead of throwing", () => {
    for (const [w, h] of [[0, 792], [612, 0], [-1, 792], [Number.NaN, 792]]) {
      const metrics = computeOcrRenderMetrics(w, h);
      expect(metrics.canvasWidth).toBe(1);
      expect(metrics.canvasHeight).toBe(1);
      expect(metrics.downscaled).toBe(false);
    }
  });

  it("never returns fewer than 1 px per dimension", () => {
    const metrics = computeOcrRenderMetrics(0.001, 0.001);
    expect(metrics.canvasWidth).toBeGreaterThanOrEqual(1);
    expect(metrics.canvasHeight).toBeGreaterThanOrEqual(1);
  });

  it("keeps the min-scale floor and final area fit for absurdly large pages", () => {
    // A 45,000 × 45,000 px page would need scale ~0.091, below the floor, so
    // the final fit must clamp the rendered area back under the cap.
    const metrics = computeOcrRenderMetrics(45_000, 45_000);
    expect(metrics.canvasWidth * metrics.canvasHeight).toBeLessThanOrEqual(
      OCR_MAX_CANVAS_AREA_PX,
    );
    expect(metrics.scale).toBeLessThanOrEqual(OCR_MIN_RENDER_SCALE);
  });
});

describe("OCR checkpoint persistence", () => {
  it("round-trips a valid checkpoint for the matching source", () => {
    const storage = fakeStorage();
    const checkpoint = validCheckpoint();
    expect(saveOcrCheckpoint(storage, checkpoint)).toBe(true);

    const loaded = loadOcrCheckpoint(storage, checkpoint.sourceFingerprint);
    expect(loaded).toEqual(checkpoint);
  });

  it("writes under the documented single storage key", () => {
    const storage = fakeStorage();
    saveOcrCheckpoint(storage, validCheckpoint());
    expect(storage.data.has(OCR_CHECKPOINT_STORAGE_KEY)).toBe(true);
  });

  it("returns null for a checkpoint belonging to a different document", () => {
    const storage = fakeStorage();
    saveOcrCheckpoint(storage, validCheckpoint());
    expect(loadOcrCheckpoint(storage, "other.pdf:1:2")).toBeNull();
  });

  it("keeps paused checkpoints for separate documents independent", () => {
    const storage = fakeStorage();
    const first = validCheckpoint();
    const second = validCheckpoint({
      sourceFingerprint: "second-opinion.pdf:9:10",
      lastCompletedPage: 1,
      segments: [{ page: 1, text: "second source" }],
      recognizedChars: "second source".length,
    });

    expect(saveOcrCheckpoint(storage, first)).toBe(true);
    expect(saveOcrCheckpoint(storage, second)).toBe(true);
    expect(loadOcrCheckpoint(storage, first.sourceFingerprint)).toEqual(first);
    expect(loadOcrCheckpoint(storage, second.sourceFingerprint)).toEqual(second);

    expect(clearOcrCheckpoint(storage, first.sourceFingerprint)).toBe(true);
    expect(loadOcrCheckpoint(storage, first.sourceFingerprint)).toBeNull();
    expect(loadOcrCheckpoint(storage, second.sourceFingerprint)).toEqual(second);

    expect(clearOcrCheckpoint(storage, second.sourceFingerprint)).toBe(true);
    expect(storage.data.size).toBe(0);
  });

  it("fails closed on malformed JSON, wrong versions, and invalid shapes", () => {
    const storage = fakeStorage();
    storage.setItem(OCR_CHECKPOINT_STORAGE_KEY, "{not-json");
    expect(loadOcrCheckpoint(storage, "x")).toBeNull();

    storage.setItem(
      OCR_CHECKPOINT_STORAGE_KEY,
      JSON.stringify(validCheckpoint({ version: 2 })),
    );
    expect(loadOcrCheckpoint(storage, "c-file.pdf:123:456")).toBeNull();

    storage.setItem(
      OCR_CHECKPOINT_STORAGE_KEY,
      JSON.stringify(validCheckpoint({ lastCompletedPage: -1 })),
    );
    expect(loadOcrCheckpoint(storage, "c-file.pdf:123:456")).toBeNull();

    storage.setItem(
      OCR_CHECKPOINT_STORAGE_KEY,
      JSON.stringify(
        validCheckpoint({
          segments: [{ page: 0, text: "page numbers start at 1" }],
        }),
      ),
    );
    expect(loadOcrCheckpoint(storage, "c-file.pdf:123:456")).toBeNull();

    storage.setItem(
      OCR_CHECKPOINT_STORAGE_KEY,
      JSON.stringify(validCheckpoint({ segments: "nope" })),
    );
    expect(loadOcrCheckpoint(storage, "c-file.pdf:123:456")).toBeNull();

    storage.setItem(
      OCR_CHECKPOINT_STORAGE_KEY,
      JSON.stringify(validCheckpoint({ sourceFingerprint: "" })),
    );
    expect(loadOcrCheckpoint(storage, "")).toBeNull();
  });

  it("deletes expired, future-dated, oversized, and inconsistent checkpoints", () => {
    for (const overrides of [
      { updatedAt: Date.now() - OCR_CHECKPOINT_TTL_MS },
      { updatedAt: Date.now() + 60_000 },
      { recognizedChars: 999 },
      { segments: [{ page: 9, text: "out of range" }] },
    ]) {
      const storage = fakeStorage();
      storage.setItem(OCR_CHECKPOINT_STORAGE_KEY, JSON.stringify(validCheckpoint(overrides)));
      expect(loadOcrCheckpoint(storage, "c-file.pdf:123:456")).toBeNull();
      expect(storage.data.size).toBe(0);
    }
    const storage = fakeStorage();
    storage.setItem(OCR_CHECKPOINT_STORAGE_KEY, "x".repeat(OCR_CHECKPOINT_MAX_JSON_CHARS + 1));
    expect(loadOcrCheckpoint(storage, "x")).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it("returns null for absent/empty storage without throwing", () => {
    expect(loadOcrCheckpoint(null, "x")).toBeNull();
    expect(loadOcrCheckpoint(fakeStorage(), "x")).toBeNull();
  });
});

describe("checkpoint budget and fail-soft storage", () => {
  it("refuses to persist a checkpoint beyond the serialized budget (returns false, storage untouched)", () => {
    const storage = fakeStorage();
    const oversized = validCheckpoint({
      segments: [{ page: 1, text: "x".repeat(OCR_CHECKPOINT_MAX_JSON_CHARS + 1024) }],
    });
    expect(saveOcrCheckpoint(storage, oversized)).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it("returns false instead of throwing when storage is unavailable or quota-fails", () => {
    expect(saveOcrCheckpoint(null, validCheckpoint())).toBe(false);

    const quotaFailing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(saveOcrCheckpoint(quotaFailing, validCheckpoint())).toBe(false);
  });

  it("clears and reports removal fail-softly", () => {
    const storage = fakeStorage();
    // Clearing an empty store is a successful no-op removal, not a failure.
    expect(clearOcrCheckpoint(storage)).toBe(true);
    saveOcrCheckpoint(storage, validCheckpoint());
    expect(clearOcrCheckpoint(storage)).toBe(true);
    expect(storage.data.size).toBe(0);
    expect(clearOcrCheckpoint(null)).toBe(false);
  });
});

describe("source fingerprints", () => {
  it("binds name, size, and lastModified and separates different files", () => {
    const fingerprint = sourceFingerprintForFile({
      name: "c-file.pdf",
      size: 2048,
      lastModified: 1_700_000_000,
    });
    expect(fingerprint).toBe("c-file.pdf:2048:1700000000");
    expect(
      sourceFingerprintForFile({
        name: "c-file.pdf",
        size: 4096,
        lastModified: 1_700_000_000,
      }),
    ).not.toBe(fingerprint);
  });
});
