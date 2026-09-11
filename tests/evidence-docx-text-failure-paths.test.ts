import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractDocxEvidence,
  extractTextEvidence,
} from "@/lib/evidence/document-extract";
import { STANDARD_LIMITS } from "@/lib/evidence/limits";

/**
 * Failure-path contracts for the DOCX and plain-text extractors:
 *
 * 1. A DOCX that passes the ZIP preflight but fails inside Mammoth must
 *    propagate the parser error (no swallowing) — guards against silent
 *    regressions where a parser failure would masquerade as "no text".
 * 2. Mammoth conversion messages must surface as prefixed warnings.
 * 3. A text file whose body (read after preflight) exceeds the character
 *    budget must fail closed on the character limit.
 * 4. Empty DOCX/text sources produce explicit no-text warnings rather than
 *    empty successes.
 */

/** Minimal single-entry ZIP: EOCD only claims what the local header provides. */
function makeDocxLikeZip(): ArrayBuffer {
  const name = "word/document.xml";
  const content = "<w:p><w:r><w:t>ignored</w:t></w:r></w:p>";
  const nameBytes = new TextEncoder().encode(name);
  const contentBytes = new TextEncoder().encode(content);
  const crc32 = 0; // preflight never verifies CRC; mammoth is mocked anyway

  const local = new Uint8Array(30 + nameBytes.length + contentBytes.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true); // local file header
  lv.setUint32(4, 20, true); // version needed
  lv.setUint16(8, 0, true); // method: stored
  lv.setUint32(14, crc32, true);
  lv.setUint32(18, contentBytes.length, true); // compressed
  lv.setUint32(22, contentBytes.length, true); // uncompressed
  lv.setUint16(26, nameBytes.length, true);
  lv.setUint16(28, 0, true);
  local.set(nameBytes, 30);
  local.set(contentBytes, 30 + nameBytes.length);

  const cd = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(cd.buffer);
  cv.setUint32(0, 0x02014b50, true); // central directory signature
  cv.setUint32(20, contentBytes.length, true); // compressed size
  cv.setUint32(24, contentBytes.length, true); // uncompressed size
  cv.setUint16(28, nameBytes.length, true);
  const cdOffset = local.length;

  const total = local.length + cd.length + 22;
  const eocd = new Uint8Array(total);
  const ev = new DataView(eocd.buffer, total - 22);
  ev.setUint32(0, 0x06054b50, true); // EOCD
  ev.setUint16(8, 1, true); // entries on this disk
  ev.setUint16(10, 1, true); // total entries
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, cdOffset, true);
  eocd.set(local, 0);
  eocd.set(cd, local.length);

  return eocd.buffer;
}

function makeDocxFile(): File {
  return new File([makeDocxLikeZip()], "clinical-notes.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

const mammothMocks = vi.hoisted(() => ({
  extractRawText: vi.fn(),
}));

vi.mock("mammoth", () => ({
  extractRawText: mammothMocks.extractRawText,
}));

describe("DOCX extractor failure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates a Mammoth parser failure after the ZIP preflight passes", async () => {
    mammothMocks.extractRawText.mockRejectedValue(new Error("encrypted document part"));

    await expect(extractDocxEvidence(makeDocxFile(), STANDARD_LIMITS)).rejects.toThrow(
      "encrypted document part",
    );
    expect(mammothMocks.extractRawText).toHaveBeenCalledTimes(1);
  });

  it("surfaces Mammoth conversion messages as prefixed warnings", async () => {
    mammothMocks.extractRawText.mockResolvedValue({
      value: "Operative report: cholecystectomy, uncomplicated recovery.",
      messages: [{ message: "Ignored unsupported style 'Foo'." }],
    });

    const result = await extractDocxEvidence(makeDocxFile(), STANDARD_LIMITS);

    expect(result.kind).toBe("docx");
    expect(result.segments).toEqual([
      { text: "Operative report: cholecystectomy, uncomplicated recovery.", locatorPrefix: "paragraph 1" },
    ]);
    expect(result.warnings).toEqual(["DOCX parser: Ignored unsupported style 'Foo'."]);
  });

  it("warns when a DOCX yields no extractable text", async () => {
    mammothMocks.extractRawText.mockResolvedValue({ value: "   \n  ", messages: [] });

    const result = await extractDocxEvidence(makeDocxFile(), STANDARD_LIMITS);

    expect(result.segments).toEqual([]);
    expect(result.warnings).toContain("No extractable DOCX text was found.");
  });
});

describe("text extractor failure paths", () => {
  it("fails closed when the body read after preflight exceeds the character budget", async () => {
    const body = "x".repeat(STANDARD_LIMITS.textChars + 1);
    const file = new File([body], "progress-note.txt", { type: "text/plain" });

    // size (bytes) stays within textFileBytes; the character budget is the guard that fires
    await expect(extractTextEvidence(file, STANDARD_LIMITS)).rejects.toThrow(
      /character local-analysis limit/i,
    );
  });

  it("returns a document-locator segment for a valid plain-text source", async () => {
    const file = new File(["Assessment: PTSD, chronic, service related."], "note.txt", {
      type: "text/plain",
    });

    const result = await extractTextEvidence(file, STANDARD_LIMITS);

    expect(result.kind).toBe("text");
    expect(result.segments).toEqual([
      { text: "Assessment: PTSD, chronic, service related.", locatorPrefix: "document" },
    ]);
    expect(result.warnings).toEqual([]);
  });
});
