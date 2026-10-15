import { readFileSync } from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

import {
  assertDocxDecompressionWithinLimits,
  assertSafeDocxArchive,
  extractPdfEvidence,
} from "@/lib/evidence/document-extract";
import { STANDARD_LIMITS, type EvidenceLimits } from "@/lib/evidence/limits";

/**
 * Audit HARD-01, extractor clauses:
 *
 * 1. **The declared DOCX expansion is a claim, not a bound.** `assertSafeDocxArchive`
 *    sums the sizes the archive's central directory advertises, which rejects an
 *    honest archive bomb cheaply — but those fields are attacker-controlled text.
 *    `assertDocxDecompressionWithinLimits` inflates every entry itself,
 *    incrementally and without retaining the output, so an entry that declares a
 *    kilobyte and expands to megabytes is refused *before* Mammoth is imported.
 *    The lying-header fixture below is the whole point of the suite: the declared
 *    preflight accepts those exact bytes, which is why a second, measuring check
 *    has to exist.
 * 2. **A rejected pdf.js load must still tear the worker down.** The task is what
 *    allocates the worker, so the load await belongs inside the `try` whose
 *    `finally` destroys it; the mocked `getDocument` below rejects and the test
 *    asserts `destroy()` ran anyway.
 *
 * The ZIP fixtures are hand-built because the property under test *is* the file
 * structure: a library that writes honest headers cannot express a lying one.
 */

interface ZipEntrySpec {
  name: string;
  /** 0 = stored, 8 = deflate, anything else = unsupported by the preflight. */
  method: number;
  /** Bytes actually written into the archive (the compressed form for method 8). */
  data: Uint8Array;
  /** What both headers claim the entry expands to. */
  declaredBytes: number;
  /** General-purpose flag bits; bit 0 marks the entry encrypted. */
  flags?: number;
  /** What the central directory claims the compressed size is. */
  reportedCompressedBytes?: number;
}

/** Build a ZIP whose *declared* sizes can deliberately disagree with its bytes. */
function buildZip(entries: ZipEntrySpec[]): ArrayBuffer {
  const locals: Uint8Array[] = [];
  const records: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const flags = entry.flags ?? 0;

    const local = new Uint8Array(30 + name.length + entry.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(6, flags, true);
    localView.setUint16(8, entry.method, true);
    localView.setUint16(10, 0, true); // mod time
    localView.setUint16(12, 0, true); // mod date
    localView.setUint32(14, 0, true); // crc32 — the bound check never verifies it
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.declaredBytes, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true); // extra
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    locals.push(local);

    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true);
    recordView.setUint16(4, 20, true); // version made by
    recordView.setUint16(6, 20, true); // version needed
    recordView.setUint16(8, flags, true);
    recordView.setUint16(10, entry.method, true);
    recordView.setUint16(12, 0, true); // mod time
    recordView.setUint16(14, 0, true); // mod date
    recordView.setUint32(16, 0, true); // crc32
    recordView.setUint32(20, entry.reportedCompressedBytes ?? entry.data.length, true);
    recordView.setUint32(24, entry.declaredBytes, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint16(30, 0, true); // extra
    recordView.setUint16(32, 0, true); // comment
    recordView.setUint16(34, 0, true); // disk start
    recordView.setUint16(36, 0, true); // internal attributes
    recordView.setUint32(38, 0, true); // external attributes
    recordView.setUint32(42, offset, true);
    record.set(name, 46);
    records.push(record);

    offset += local.length;
  }

  const centralBytes = records.reduce((total, record) => total + record.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // central-directory disk
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralBytes, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true); // comment length

  const parts = [...locals, ...records, eocd];
  const total = parts.reduce((size, part) => size + part.length, 0);
  const archive = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  return archive.buffer;
}

const DOCUMENT_XML_NAME = "word/document.xml";
const HONEST_XML = new TextEncoder().encode(
  "<w:document><w:body>Service connection evidence note</w:body></w:document>",
);

function deflated(data: Uint8Array): Uint8Array {
  return new Uint8Array(deflateRawSync(data, { level: 9 }));
}

/**
 * A real archive bomb, compressed once: 64 MB of zeros deflates to a few tens of
 * kilobytes, which is what makes a lying header so effective and why the fixture
 * has to exceed the deployed Standard cap (40 MB) rather than merely be large.
 */
const BOMB_EXPANDED_BYTES = 64 * 1024 * 1024;
let bombCompressedCache: Uint8Array | null = null;

function bombCompressed(): Uint8Array {
  const cached = bombCompressedCache;
  if (cached) return cached;
  const compressed = deflated(new Uint8Array(BOMB_EXPANDED_BYTES));
  bombCompressedCache = compressed;
  return compressed;
}

describe("DOCX declared-size preflight versus the measured bound (HARD-01)", () => {
  it("accepts an honest archive whose declared and actual expansion agree", async () => {
    const archive = buildZip([
      {
        name: DOCUMENT_XML_NAME,
        method: 8,
        data: deflated(HONEST_XML),
        declaredBytes: HONEST_XML.length,
      },
    ]);

    expect(() => assertSafeDocxArchive(archive, "honest.docx")).not.toThrow();
    await expect(
      assertDocxDecompressionWithinLimits(archive, "honest.docx"),
    ).resolves.toBeUndefined();
  });

  it("is not vacuous: an honest archive bomb fails the declared-size preflight", () => {
    const archive = buildZip([
      {
        name: DOCUMENT_XML_NAME,
        method: 8,
        data: bombCompressed(),
        declaredBytes: BOMB_EXPANDED_BYTES,
      },
    ]);

    // Same bytes, honest headers: the cheap preflight already refuses them. The
    // lying-header case below is therefore testing something the first check
    // cannot see, not re-testing this one.
    expect(() => assertSafeDocxArchive(archive, "honest-bomb.docx")).toThrow(
      /declares more than/i,
    );
  });

  it("refuses a DOCX that declares a small size and inflates past the bound", async () => {
    const compressed = bombCompressed();
    // The compression ratio is what makes the lie undetectable from headers: a
    // few tens of kilobytes of deflate stream carry 64 MB of output.
    expect(compressed.length).toBeLessThan(256 * 1024);

    const archive = buildZip([
      {
        name: DOCUMENT_XML_NAME,
        method: 8,
        data: compressed,
        declaredBytes: 4096,
      },
    ]);

    expect(() => assertSafeDocxArchive(archive, "lying.docx")).not.toThrow();
    await expect(
      assertDocxDecompressionWithinLimits(archive, "lying.docx"),
    ).rejects.toThrow(/expands to more than/i);
  });

  it("counts stored entries without inflating them, and honours a lowered cap", async () => {
    const body = new Uint8Array(5_000).fill(65);
    const archive = buildZip([
      { name: DOCUMENT_XML_NAME, method: 0, data: body, declaredBytes: body.length },
    ]);
    const tinyCap: EvidenceLimits = { ...STANDARD_LIMITS, docxUncompressedBytes: 1_000 };

    await expect(
      assertDocxDecompressionWithinLimits(archive, "stored.docx"),
    ).resolves.toBeUndefined();
    await expect(
      assertDocxDecompressionWithinLimits(archive, "stored.docx", tinyCap),
    ).rejects.toThrow(/expands to more than/i);
  });

  it("refuses encrypted and unsupported-method entries instead of guessing", async () => {
    const body = new Uint8Array(64).fill(7);

    const encrypted = buildZip([
      {
        name: DOCUMENT_XML_NAME,
        method: 8,
        flags: 0x0001,
        data: deflated(body),
        declaredBytes: body.length,
      },
    ]);
    await expect(
      assertDocxDecompressionWithinLimits(encrypted, "locked.docx"),
    ).rejects.toThrow(/encrypted/i);

    const unsupported = buildZip([
      { name: DOCUMENT_XML_NAME, method: 12, data: body, declaredBytes: body.length },
    ]);
    await expect(
      assertDocxDecompressionWithinLimits(unsupported, "odd.docx"),
    ).rejects.toThrow(/unsupported DOCX compression method/i);
  });

  it("refuses an entry whose declared data range runs past the end of the file", async () => {
    const body = new Uint8Array(64).fill(3);
    const archive = buildZip([
      {
        name: DOCUMENT_XML_NAME,
        method: 0,
        data: body,
        declaredBytes: body.length,
        reportedCompressedBytes: 10 * 1024 * 1024,
      },
    ]);

    await expect(
      assertDocxDecompressionWithinLimits(archive, "truncated.docx"),
    ).rejects.toThrow(/outside the file/i);
  });

  it("skips the measured bound — rather than refusing the document — where raw deflate is unavailable", async () => {
    const archive = buildZip([
      {
        name: DOCUMENT_XML_NAME,
        method: 8,
        data: deflated(HONEST_XML),
        declaredBytes: HONEST_XML.length,
      },
    ]);

    vi.stubGlobal("DecompressionStream", undefined);
    try {
      await expect(
        assertDocxDecompressionWithinLimits(archive, "legacy-engine.docx"),
      ).resolves.toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }

    // Non-vacuity: with the engine back, the same archive really is measured.
    await expect(
      assertDocxDecompressionWithinLimits(archive, "legacy-engine.docx"),
    ).resolves.toBeUndefined();
  });
});

const pdfJsMock = vi.hoisted(() => {
  const destroy = vi.fn(async () => {});
  const getDocument = vi.fn(() => ({
    promise: Promise.reject(new Error("malformed pdf")),
    destroy,
  }));
  return { destroy, getDocument };
});

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "/pdf.worker.min.mjs" },
  getDocument: pdfJsMock.getDocument,
}));

describe("pdf.js task teardown (HARD-01)", () => {
  it("destroys the task when the document load itself rejects", async () => {
    pdfJsMock.destroy.mockClear();
    pdfJsMock.getDocument.mockClear();
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "broken.pdf", {
      type: "application/pdf",
    });

    await expect(extractPdfEvidence(file)).rejects.toThrow(/malformed pdf/i);

    // The worker is allocated with the task, so a rejected load that skipped
    // `destroy()` leaked it for the life of the tab.
    expect(pdfJsMock.getDocument).toHaveBeenCalledTimes(1);
    expect(pdfJsMock.destroy).toHaveBeenCalledTimes(1);
  });
});

describe("extractor source contracts (HARD-01)", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/lib/evidence/document-extract.ts"),
    "utf8",
  );

  it("measures DOCX expansion after the declared preflight and before Mammoth", () => {
    const declared = source.indexOf("assertSafeDocxArchive(arrayBuffer, sourceName, limits);");
    const measured = source.indexOf(
      "await assertDocxDecompressionWithinLimits(arrayBuffer, sourceName, limits);",
    );
    const mammoth = source.indexOf("mammoth.extractRawText");

    expect(declared).toBeGreaterThan(-1);
    expect(measured).toBeGreaterThan(declared);
    expect(mammoth).toBeGreaterThan(measured);
  });

  it("awaits the pdf.js load inside the try that owns the task teardown", () => {
    const task = source.indexOf("const loadingTask = pdfjs.getDocument");
    const load = source.indexOf("const document = await loadingTask.promise;");
    const destroy = source.indexOf("await loadingTask.destroy();");

    expect(task).toBeGreaterThan(-1);
    expect(load).toBeGreaterThan(task);
    expect(load).toBeLessThan(destroy);
    // The previous shape — task, then a bare await outside the try — is what the
    // finding recorded; this rejects its return.
    expect(source).not.toMatch(
      /getDocument\(\{ data: bytes \}\);\n {2}const document = await loadingTask\.promise;/,
    );
  });
});
