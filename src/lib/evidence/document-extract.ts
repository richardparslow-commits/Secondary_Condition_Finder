/**
 * Browser-only document extraction (PDF, DOCX, plain text).
 *
 * **Browser-only** — must never be imported from app pages, Server Actions,
 * or API routes. This module is part of the evidence-parser boundary
 * (see docs/evidence-parser-boundary.md). It uses client-only libraries
 * (pdfjs-dist, mammoth) and browser File APIs to extract text from uploaded
 * medical documents without transmitting raw bytes to the server.
 */
import type { EvidenceTextSegment } from "./extract";
import {
  formatLimitBytes,
  formatLimitChars,
  STANDARD_LIMITS,
  type EvidenceLimits,
} from "./limits";

export type LocalEvidenceDocumentKind = "pdf" | "docx" | "text";

/**
 * Legacy Standard-mode aliases. Extraction functions take an explicit
 * EvidenceLimits argument (defaulting to STANDARD_LIMITS) so the same parser
 * serves both depth modes; these names remain exported for callers and tests
 * that pin the Standard envelope.
 */
export const MAX_LOCAL_EVIDENCE_FILE_BYTES = STANDARD_LIMITS.fileBytes;
export const MAX_LOCAL_EVIDENCE_PDF_PAGES = STANDARD_LIMITS.pdfPages;
export const MAX_LOCAL_EVIDENCE_TEXT_CHARS = STANDARD_LIMITS.textChars;
export const MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES = STANDARD_LIMITS.textFileBytes;
export const MAX_LOCAL_EVIDENCE_DOCX_UNCOMPRESSED_BYTES =
  STANDARD_LIMITS.docxUncompressedBytes;
export const MAX_LOCAL_EVIDENCE_DOCX_ENTRIES = STANDARD_LIMITS.docxEntries;

export interface LocalDocumentExtraction {
  kind: LocalEvidenceDocumentKind;
  sourceName: string;
  segments: EvidenceTextSegment[];
  warnings: string[];
}

function normalizeName(name: string): string {
  return name.trim() || "Local evidence document";
}

function assertFileSize(file: File, limits: EvidenceLimits): void {
  if (file.size > limits.fileBytes) {
    throw new Error(
      `${normalizeName(file.name)} exceeds the ${formatLimitBytes(limits.fileBytes)} local-analysis limit.`,
    );
  }
}

function assertExtractedTextSize(
  charCount: number,
  sourceName: string,
  limits: EvidenceLimits,
): void {
  if (charCount > limits.textChars) {
    throw new Error(
      `${sourceName} exceeds the ${formatLimitChars(limits.textChars)} character local-analysis limit. Split or narrow the source before analysis.`,
    );
  }
}

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_EOCD_MIN_BYTES = 22;
const ZIP_MAX_COMMENT_BYTES = 0xffff;
const ZIP_LOCAL_HEADER_BYTES = 30;
const ZIP_CENTRAL_DIRECTORY_BYTES = 46;
/** Compression methods this preflight understands: stored and deflate. */
const ZIP_METHOD_STORED = 0;
const ZIP_METHOD_DEFLATE = 8;
/** General-purpose bit 0: the entry's data is encrypted. */
const ZIP_FLAG_ENCRYPTED = 0x0001;

function findZipEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(
    0,
    view.byteLength - ZIP_EOCD_MIN_BYTES - ZIP_MAX_COMMENT_BYTES,
  );
  for (let offset = view.byteLength - ZIP_EOCD_MIN_BYTES; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) return offset;
  }
  return -1;
}

/**
 * Performs a cheap DOCX ZIP-directory preflight before Mammoth decompresses the
 * archive. This is not a substitute for parser hardening, but it rejects
 * obviously oversized/ZIP64/multi-disk archives and bounds declared expansion
 * before expensive extraction begins. The DOCX expansion bounds are shared by
 * both depth modes and deliberately do not scale with the per-file byte cap.
 */
export function assertSafeDocxArchive(
  arrayBuffer: ArrayBuffer,
  sourceName: string,
  limits: EvidenceLimits = STANDARD_LIMITS,
): void {
  const view = new DataView(arrayBuffer);
  const eocdOffset = findZipEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    throw new Error(`${sourceName} is not a valid bounded DOCX/ZIP archive.`);
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error(`${sourceName} uses an unsupported multi-disk or ZIP64 archive layout.`);
  }
  if (totalEntries > limits.docxEntries) {
    throw new Error(
      `${sourceName} contains too many archive entries for local analysis (${totalEntries} > ${limits.docxEntries}).`,
    );
  }
  if (
    centralDirectoryOffset + centralDirectorySize > eocdOffset ||
    centralDirectoryOffset + centralDirectorySize > view.byteLength
  ) {
    throw new Error(`${sourceName} has an invalid DOCX central-directory boundary.`);
  }

  let offset = centralDirectoryOffset;
  let declaredUncompressedBytes = 0;
  // #10: hard iteration ceiling guards against adversarial archive preflight
  const maxIterations = Math.min(totalEntries, limits.docxEntries, 2000);
  if (totalEntries > maxIterations) {
    throw new Error(`${sourceName} contains too many archive entries for local analysis (${totalEntries} > ${maxIterations}).`);
  }
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`${sourceName} has a malformed DOCX central directory.`);
    }

    const uncompressedBytes = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (uncompressedBytes === 0xffffffff) {
      throw new Error(`${sourceName} contains a ZIP64 entry that is not accepted for local analysis.`);
    }

    declaredUncompressedBytes += uncompressedBytes;
    if (
      !Number.isSafeInteger(declaredUncompressedBytes) ||
      declaredUncompressedBytes > limits.docxUncompressedBytes
    ) {
      throw new Error(
        `${sourceName} declares more than ${formatLimitBytes(limits.docxUncompressedBytes)} of expanded DOCX content. Split or narrow the source before analysis.`,
      );
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error(`${sourceName} has an inconsistent DOCX central-directory size.`);
  }
}

interface DocxEntryRange {
  /** General-purpose flags from the central-directory record. */
  flags: number;
  /** Compression method from the central-directory record. */
  method: number;
  /** Compressed size from the central-directory record. */
  compressedBytes: number;
  /** Offset of the entry's data within the archive. */
  dataStart: number;
}

/**
 * Locate every archive entry's data range.
 *
 * Sizes come from the *central directory*, which is what a reader actually
 * honours: a local header may declare zeros when the entry uses a trailing data
 * descriptor, so the local header is used only to skip its own name/extra
 * fields. This is deliberately a second walk of a directory
 * `assertSafeDocxArchive` already validated — that function owns the structural
 * verdicts and their messages, so reusing its loop would have re-opened them;
 * here the only job is "where does each entry's compressed data start and end".
 */
function docxEntryRanges(view: DataView, sourceName: string): DocxEntryRange[] {
  const eocdOffset = findZipEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    throw new Error(`${sourceName} is not a valid bounded DOCX/ZIP archive.`);
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const ranges: DocxEntryRange[] = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (
      offset + ZIP_CENTRAL_DIRECTORY_BYTES > view.byteLength ||
      view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      throw new Error(`${sourceName} has a malformed DOCX central directory.`);
    }

    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedBytes = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    if (
      localHeaderOffset + ZIP_LOCAL_HEADER_BYTES > view.byteLength ||
      view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE
    ) {
      throw new Error(`${sourceName} has a malformed DOCX local file header.`);
    }

    // The local header's own name/extra lengths — not the central directory's —
    // set where its data begins.
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart =
      localHeaderOffset + ZIP_LOCAL_HEADER_BYTES + localNameLength + localExtraLength;

    if (dataStart + compressedBytes > view.byteLength) {
      throw new Error(
        `${sourceName} has a DOCX archive entry whose data lies outside the file.`,
      );
    }

    ranges.push({ flags, method, compressedBytes, dataStart });
    offset += ZIP_CENTRAL_DIRECTORY_BYTES + fileNameLength + extraLength + commentLength;
  }

  return ranges;
}

/**
 * Whether this engine can inflate a raw deflate stream.
 *
 * `"deflate-raw"` is the format a ZIP method-8 entry stores, and engines that
 * do not implement it throw from the constructor (Safari < 16.4, Node < 21) —
 * which is the only portable capability probe available for it. The stream is
 * never read.
 */
function canInflateDeflateRaw(): boolean {
  if (typeof DecompressionStream !== "function") return false;
  try {
    const probe = new DecompressionStream("deflate-raw");
    probe.readable.getReader().releaseLock();
    return true;
  } catch {
    return false;
  }
}

function docxExpansionExceededMessage(
  sourceName: string,
  limits: EvidenceLimits,
): string {
  return `${sourceName} expands to more than ${formatLimitBytes(limits.docxUncompressedBytes)} of DOCX content. Split or narrow the source before analysis.`;
}

/**
 * Count one entry's decompressed length without retaining it.
 *
 * Returns `null` as soon as the running count passes `budget`, and the reader is
 * cancelled in the `finally` so a bomb stops being inflated at the bound instead
 * of running to completion. Only chunk lengths are accumulated, so peak extra
 * memory is one decompressor chunk rather than the expanded entry. A stream the
 * decompressor itself rejects (truncated, or a declared size that does not match
 * the bytes) becomes this module's own bounded message rather than a raw
 * `DOMException`: an entry that cannot be read cannot be bounded either, so it is
 * refused the same way an over-cap entry is.
 */
async function countInflatedEntryBytes(
  arrayBuffer: ArrayBuffer,
  sourceName: string,
  range: DocxEntryRange,
  budget: number,
): Promise<number | null> {
  const compressed = new Uint8Array(
    arrayBuffer,
    range.dataStart,
    range.compressedBytes,
  );
  // The entry is handed to the decompressor through its writable side rather
  // than `pipeThrough`: the DOM types model `DecompressionStream`'s writable as
  // `WritableStream<BufferSource>`, which `pipeThrough` refuses to accept as a
  // `WritableStream<Uint8Array>` even though a `Uint8Array` is a `BufferSource`.
  // The write promise is only awaited through the failed read below, so its
  // rejection is swallowed here to keep it from surfacing as unhandled twice.
  const decompressor = new DecompressionStream("deflate-raw");
  const writer = decompressor.writable.getWriter();
  void writer
    .write(compressed)
    .then(() => writer.close())
    .catch(() => {});
  const reader = decompressor.readable.getReader();
  let counted = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      counted += value.byteLength;
      if (counted > budget) return null;
    }
  } catch {
    throw new Error(
      `${sourceName} has a DOCX archive entry whose compressed data cannot be read.`,
    );
  } finally {
    await reader.cancel().catch(() => {});
  }
  return counted;
}

/**
 * Bounds what a DOCX archive can expand to when it is *actually* decompressed.
 *
 * `assertSafeDocxArchive` sums the sizes the archive **declares**, which is the
 * cheap check that rejects an honest archive bomb before any work begins. It is
 * not a bound on work: the central directory and the local headers are
 * attacker-controlled text, so an entry can declare a kilobyte and inflate to
 * gigabytes — and Mammoth, handed the buffer, would allocate that before the
 * post-extraction character check could run. This function therefore inflates
 * every entry itself first, incrementally, discarding each chunk and keeping the
 * count: a lying archive is refused before the document parser is even loaded.
 *
 * Call it **after** `assertSafeDocxArchive`, whose structural validation and
 * entry/declared-size limits are a precondition (the call site enforces that
 * order). The cost is one extra decompression pass over a file the user chose to
 * analyse; the bound is the same `docxUncompressedBytes` the declared-size
 * preflight uses, so the two checks agree on what "too much DOCX" means.
 *
 * Degrades rather than refuses: where raw-deflate inflation is unavailable the
 * incremental check is skipped so the declared-size preflight stands alone,
 * because refusing every DOCX on an older engine would be the worse failure.
 */
export async function assertDocxDecompressionWithinLimits(
  arrayBuffer: ArrayBuffer,
  sourceName: string,
  limits: EvidenceLimits = STANDARD_LIMITS,
): Promise<void> {
  const ranges = docxEntryRanges(new DataView(arrayBuffer), sourceName);
  const deflateSupported = canInflateDeflateRaw();
  let expandedBytes = 0;

  for (const range of ranges) {
    if ((range.flags & ZIP_FLAG_ENCRYPTED) !== 0) {
      throw new Error(
        `${sourceName} is an encrypted DOCX archive; local analysis does not open encrypted documents.`,
      );
    }

    if (range.method === ZIP_METHOD_STORED) {
      // A stored entry is never decompressed, so its compressed size is exactly
      // what it contributes and no inflation is needed to know that.
      expandedBytes += range.compressedBytes;
    } else if (range.method === ZIP_METHOD_DEFLATE) {
      if (!deflateSupported) return;
      const counted = await countInflatedEntryBytes(
        arrayBuffer,
        sourceName,
        range,
        limits.docxUncompressedBytes - expandedBytes,
      );
      if (counted === null) {
        throw new Error(docxExpansionExceededMessage(sourceName, limits));
      }
      expandedBytes += counted;
    } else {
      throw new Error(
        `${sourceName} uses an unsupported DOCX compression method (${range.method}) for local analysis.`,
      );
    }

    if (expandedBytes > limits.docxUncompressedBytes) {
      throw new Error(docxExpansionExceededMessage(sourceName, limits));
    }
  }
}

function textItemValue(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const value = (item as { str?: unknown }).str;
  return typeof value === "string" ? value : "";
}

function textItemHasEol(item: unknown): boolean {
  return Boolean(item && typeof item === "object" && (item as { hasEOL?: unknown }).hasEOL === true);
}

function joinPdfTextItems(items: unknown[]): string {
  let text = "";
  for (const item of items) {
    const value = textItemValue(item);
    if (!value) continue;
    if (text && !text.endsWith("\n") && !text.endsWith(" ")) text += " ";
    text += value;
    if (textItemHasEol(item)) text += "\n";
  }
  return text.trim();
}

export async function extractPdfEvidence(
  file: File,
  limits: EvidenceLimits = STANDARD_LIMITS,
): Promise<LocalDocumentExtraction> {
  assertFileSize(file, limits);
  const sourceName = normalizeName(file.name);
  // Legacy main build: the modern build relies on very recent standardized
  // helpers (Uint8Array.toHex, Map.getOrInsertComputed) that older browsers
  // lack — see scripts/copy-pdf-worker.mjs for the matching legacy worker.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const segments: EvidenceTextSegment[] = [];
  const warnings: string[] = [];
  let extractedChars = 0;

  try {
    // The load promise belongs *inside* this try. pdf.js allocates its worker
    // when the task is created, so a load that rejects (malformed PDF, worker
    // spawn failure) is exactly the case that must still reach the
    // `loadingTask.destroy()` below — awaiting it outside left that worker
    // alive after a failed extraction.
    const document = await loadingTask.promise;

    if (document.numPages > limits.pdfPages) {
      throw new Error(
        `${sourceName} has ${document.numPages} pages; local PDF analysis is limited to ${limits.pdfPages} pages per source. Split the record into smaller documents before analysis.`,
      );
    }

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = joinPdfTextItems(content.items as unknown[]);
        if (text) {
          extractedChars += text.length;
          assertExtractedTextSize(extractedChars, sourceName, limits);
          segments.push({ text, locatorPrefix: `page ${pageNumber}` });
        } else {
          warnings.push(`Page ${pageNumber} contained no extractable text. It may be image-only or require OCR.`);
        }
      } finally {
        try {
          page.cleanup();
        } catch {
          // cleanup is best-effort; ignore errors to avoid masking extraction failures
        }
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  if (segments.length === 0) {
    warnings.push("No extractable PDF text was found. Scanned/image-only records require OCR before this app can analyze their text.");
  }

  return { kind: "pdf", sourceName, segments, warnings };
}

export async function extractDocxEvidence(
  file: File,
  limits: EvidenceLimits = STANDARD_LIMITS,
): Promise<LocalDocumentExtraction> {
  assertFileSize(file, limits);
  const sourceName = normalizeName(file.name);
  const arrayBuffer = await file.arrayBuffer();
  assertSafeDocxArchive(arrayBuffer, sourceName, limits);
  // The declared sizes above are a claim; this is the measurement, and it runs
  // before Mammoth is even imported so a lying archive cannot make the parser
  // allocate first.
  await assertDocxDecompressionWithinLimits(arrayBuffer, sourceName, limits);

  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  assertExtractedTextSize(result.value.length, sourceName, limits);
  const paragraphs = result.value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const segments = paragraphs.map((text, index) => ({
    text,
    locatorPrefix: `paragraph ${index + 1}`,
  }));

  const warnings = result.messages.map((message) => {
    const text = typeof message.message === "string" ? message.message : String(message.message ?? "DOCX extraction warning");
    return `DOCX parser: ${text}`;
  });

  if (segments.length === 0) warnings.push("No extractable DOCX text was found.");

  return { kind: "docx", sourceName, segments, warnings };
}

export async function extractTextEvidence(
  file: File,
  limits: EvidenceLimits = STANDARD_LIMITS,
): Promise<LocalDocumentExtraction> {
  assertFileSize(file, limits);
  const sourceName = normalizeName(file.name);
  if (file.size > limits.textFileBytes) {
    throw new Error(
      `${sourceName} exceeds the ${formatLimitBytes(limits.textFileBytes)} raw text preflight limit. Split or narrow the source before analysis.`,
    );
  }
  const text = await file.text();
  assertExtractedTextSize(text.length, sourceName, limits);
  return {
    kind: "text",
    sourceName,
    segments: [{ text, locatorPrefix: "document" }],
    warnings: [],
  };
}

export async function extractLocalEvidenceDocument(
  file: File,
  limits: EvidenceLimits = STANDARD_LIMITS,
): Promise<LocalDocumentExtraction> {
  assertFileSize(file, limits);
  const lower = file.name.toLocaleLowerCase();
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) return extractPdfEvidence(file, limits);
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return extractDocxEvidence(file, limits);
  }
  return extractTextEvidence(file, limits);
}
