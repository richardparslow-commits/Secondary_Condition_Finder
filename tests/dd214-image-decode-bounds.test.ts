import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assemblePageOrderedText,
  computeOcrRenderMetrics,
  OCR_JOB_DEADLINE_MS,
  OCR_MAX_CANVAS_AREA_PX,
  OCR_MAX_IMAGE_DIMENSION,
  OCR_MAX_IMAGE_PIXELS,
  planImageDecode,
  readImageDimensions,
  startOcrJobDeadline,
} from "@/lib/evidence/ocr-session";

/**
 * Audit A06 browser-local bounds: the parts that can be measured without a
 * browser. The DD-214 image path previously handed the raw `File` to the OCR
 * worker, so a decompression bomb was decoded at its intrinsic size before any
 * cap applied, and a mixed PDF had its OCR'd pages appended after its
 * text-layer pages. These are the pure primitives that close both: declared
 * dimensions are read from the container header (no decode, no allocation) and
 * per-page text is joined in page order under one character budget.
 */

/** Minimal PNG header: signature + IHDR with the given dimensions. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes.set([(width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff], 16);
  bytes.set([(height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff], 20);
  return bytes;
}

/** SOI + a JFIF APP0 segment + SOF0 carrying the real dimensions. */
function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    // APP0, length 0x0010 (14 payload bytes + the 2 length bytes)
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    // SOF0: length 0x0011, precision 8, height, width, 3 components
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

function gif(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    width & 0xff, (width >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
    0x00, 0x00, 0x00,
  ]);
}

function bmp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([0x42, 0x4d], 0); // "BM"
  bytes.set([40, 0, 0, 0], 14); // BITMAPINFOHEADER size
  bytes.set([width & 0xff, (width >> 8) & 0xff, (width >> 16) & 0xff, (width >>> 24) & 0xff], 18);
  const signed = height < 0 ? height + 0x100000000 : height;
  bytes.set([signed & 0xff, (signed >> 8) & 0xff, (signed >> 16) & 0xff, (signed >>> 24) & 0xff], 22);
  return bytes;
}

function webpExtended(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  bytes.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return bytes;
}

function webpLossless(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(25);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12); // "VP8L"
  bytes[20] = 0x2f;
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  bytes.set([bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff], 21);
  return bytes;
}

function webpLossy(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
  bytes.set([0x9d, 0x01, 0x2a], 23);
  bytes.set([width & 0xff, (width >> 8) & 0xff], 26);
  bytes.set([height & 0xff, (height >> 8) & 0xff], 28);
  return bytes;
}

function tiff(width: number, height: number, littleEndian: boolean): Uint8Array {
  const bytes = new Uint8Array(34);
  const u16 = (offset: number, value: number) => {
    if (littleEndian) {
      bytes[offset] = value & 0xff;
      bytes[offset + 1] = (value >> 8) & 0xff;
    } else {
      bytes[offset] = (value >> 8) & 0xff;
      bytes[offset + 1] = value & 0xff;
    }
  };
  const u32 = (offset: number, value: number) => {
    if (littleEndian) {
      bytes[offset] = value & 0xff;
      bytes[offset + 1] = (value >> 8) & 0xff;
      bytes[offset + 2] = (value >> 16) & 0xff;
      bytes[offset + 3] = (value >>> 24) & 0xff;
    } else {
      bytes[offset] = (value >>> 24) & 0xff;
      bytes[offset + 1] = (value >> 16) & 0xff;
      bytes[offset + 2] = (value >> 8) & 0xff;
      bytes[offset + 3] = value & 0xff;
    }
  };
  bytes[0] = littleEndian ? 0x49 : 0x4d;
  bytes[1] = littleEndian ? 0x49 : 0x4d;
  u16(2, 42);
  u32(4, 8); // IFD at offset 8
  u16(8, 2); // two entries
  // Entry 0: tag 256 (ImageWidth), type 3 (SHORT), count 1, value
  u16(10, 256);
  u16(12, 3);
  u32(14, 1);
  u16(18, width);
  // Entry 1: tag 257 (ImageLength), type 3 (SHORT), count 1, value
  u16(22, 257);
  u16(24, 3);
  u32(26, 1);
  u16(30, height);
  return bytes;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("image header dimensions (A06 decode bound)", () => {
  it("reads declared dimensions from every accepted container", () => {
    expect(readImageDimensions(png(4000, 3000))).toEqual({ width: 4000, height: 3000 });
    expect(readImageDimensions(jpeg(2550, 3300))).toEqual({ width: 2550, height: 3300 });
    expect(readImageDimensions(gif(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readImageDimensions(bmp(1200, 900))).toEqual({ width: 1200, height: 900 });
    // A negative BMP height is a top-down bitmap of the same size.
    expect(readImageDimensions(bmp(1200, -900))).toEqual({ width: 1200, height: 900 });
    expect(readImageDimensions(webpExtended(1600, 1200))).toEqual({ width: 1600, height: 1200 });
    expect(readImageDimensions(webpLossless(400, 300))).toEqual({ width: 400, height: 300 });
    expect(readImageDimensions(webpLossy(800, 600))).toEqual({ width: 800, height: 600 });
    expect(readImageDimensions(tiff(2000, 1500, true))).toEqual({ width: 2000, height: 1500 });
    expect(readImageDimensions(tiff(2000, 1500, false))).toEqual({ width: 2000, height: 1500 });
  });

  it("reports unknown rather than guessing for truncated or unrecognized input", () => {
    for (const bytes of [
      new Uint8Array(0),
      new Uint8Array([0xff, 0xd8, 0xff, 0xc0]), // JPEG header cut before the SOF body
      new Uint8Array(24), // NULs: not a container signature
      png(4000, 3000).slice(0, 20), // PNG cut before the height field
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x58, 0x58, 0x58, 0x58]),
    ]) {
      expect(readImageDimensions(bytes)).toBeNull();
    }
  });
});

describe("planImageDecode", () => {
  it("refuses a bomb-shaped image from its header, before any decode", () => {
    // 10,000 × 10,000 = 100 MP: a few hundred KB on disk, ~400 MB decoded.
    const plan = planImageDecode(png(10_000, 10_000));
    expect(plan.accepted).toBe(false);
    expect(plan.reason).toBe("too-many-pixels");
    expect(plan.metrics).toBeNull();
    expect(plan.dimensions).toEqual({ width: 10_000, height: 10_000 });
    expect(10_000 * 10_000).toBeGreaterThan(OCR_MAX_IMAGE_PIXELS);

    const extreme = planImageDecode(png(60_000, 120));
    expect(extreme.reason).toBe("dimension-too-large");
    expect(60_000).toBeGreaterThan(OCR_MAX_IMAGE_DIMENSION);
  });

  it("refuses an image whose dimensions it cannot establish", () => {
    const plan = planImageDecode(new Uint8Array([1, 2, 3, 4]));
    expect(plan).toEqual({
      accepted: false,
      reason: "unknown-dimensions",
      dimensions: null,
      metrics: null,
    });
  });

  it("bounds an accepted image by the shared canvas area cap", () => {
    const plan = planImageDecode(png(4000, 3000));
    expect(plan.accepted).toBe(true);
    expect(plan.reason).toBe("ok");
    expect(plan.metrics).not.toBeNull();
    const metrics = plan.metrics!;
    expect(metrics.canvasWidth * metrics.canvasHeight).toBeLessThanOrEqual(OCR_MAX_CANVAS_AREA_PX);
    // 12 MP at the scale-2 base would be 48 MP of canvas, so the cap must
    // have pulled the scale down and said so.
    expect(metrics.downscaled).toBe(true);
    expect(metrics).toEqual(computeOcrRenderMetrics(4000, 3000));

    // A small image is not downscaled and is bounded by the base scale.
    const small = planImageDecode(jpeg(800, 600));
    expect(small.metrics?.downscaled).toBe(false);
  });
});

describe("OCR job deadline (A06 bounded elapsed work)", () => {
  it("fires once at the budget and reports expiry", () => {
    vi.useFakeTimers();
    let fired = 0;
    const deadline = startOcrJobDeadline(1_000, () => {
      fired += 1;
    });
    expect(deadline.exceeded()).toBe(false);
    vi.advanceTimersByTime(999);
    expect(deadline.exceeded()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(deadline.exceeded()).toBe(true);
    expect(fired).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(fired).toBe(1);
    deadline.clear();
  });

  it("clears without firing, and a nonsensical budget never expires", () => {
    vi.useFakeTimers();
    let fired = 0;
    const cleared = startOcrJobDeadline(1_000, () => {
      fired += 1;
    });
    cleared.clear();
    vi.advanceTimersByTime(10_000);
    expect(fired).toBe(0);
    expect(cleared.exceeded()).toBe(false);

    const disabled = startOcrJobDeadline(0, () => {
      fired += 1;
    });
    vi.advanceTimersByTime(10_000);
    expect(fired).toBe(0);
    expect(disabled.exceeded()).toBe(false);
    disabled.clear();
  });

  it("survives a throwing teardown callback and a sane default budget", () => {
    vi.useFakeTimers();
    const deadline = startOcrJobDeadline(5, () => {
      throw new Error("teardown failed");
    });
    expect(() => vi.advanceTimersByTime(5)).not.toThrow();
    expect(deadline.exceeded()).toBe(true);
    deadline.clear();
    expect(OCR_JOB_DEADLINE_MS).toBeGreaterThan(0);
  });
});

describe("assemblePageOrderedText (A06 mixed-document order)", () => {
  it("joins pages in page order, not pass order", () => {
    // Page 1 came from the text layer, page 2 from OCR, page 3 from the text
    // layer — the previous append-per-pass join produced 1, 3, 2.
    expect(assemblePageOrderedText(["page one", "page two", "page three"], 10_000)).toEqual({
      text: "page one\npage two\npage three",
      truncated: false,
      keptChars: 8 + 1 + 8 + 1 + 10,
    });
  });

  it("skips unreviewed slots without leaving blank lines", () => {
    expect(assemblePageOrderedText(["first", null, undefined], 1_000).text).toBe("first");
    expect(assemblePageOrderedText([], 1_000)).toEqual({ text: "", truncated: false, keptChars: 0 });
    expect(assemblePageOrderedText(["   "], 1_000).text).toBe("");
  });

  it("truncates the document prefix, not whichever pass ran first", () => {
    const assembled = assemblePageOrderedText(["abcdefghij", "klmnopqrst"], 12);
    expect(assembled.text).toBe("abcdefghij\nk");
    expect(assembled.truncated).toBe(true);
    expect(assembled.keptChars).toBe(12);
    // The budget counts the join separator, so the kept text never exceeds it.
    expect(assembled.text.length).toBeLessThanOrEqual(12);
  });

  it("reports truncation when the budget cannot fit the first page", () => {
    const assembled = assemblePageOrderedText(["abcdef"], 0);
    expect(assembled).toEqual({ text: "", truncated: true, keptChars: 0 });
  });
});
