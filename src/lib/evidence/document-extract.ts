import type { EvidenceTextSegment } from "./extract";

export type LocalEvidenceDocumentKind = "pdf" | "docx" | "text";

export const MAX_LOCAL_EVIDENCE_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_LOCAL_EVIDENCE_PDF_PAGES = 300;
export const MAX_LOCAL_EVIDENCE_TEXT_CHARS = 500_000;
export const MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES = MAX_LOCAL_EVIDENCE_TEXT_CHARS * 4;
export const MAX_LOCAL_EVIDENCE_DOCX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;
export const MAX_LOCAL_EVIDENCE_DOCX_ENTRIES = 2_000;

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_EOCD_MIN_BYTES = 22;
const ZIP_MAX_COMMENT_BYTES = 0xffff;

export interface LocalDocumentExtraction {
  kind: LocalEvidenceDocumentKind;
  sourceName: string;
  segments: EvidenceTextSegment[];
  warnings: string[];
}

function normalizeName(name: string): string {
  return name.trim() || "Local evidence document";
}

function assertFileSize(file: File): void {
  if (file.size > MAX_LOCAL_EVIDENCE_FILE_BYTES) {
    throw new Error(`${normalizeName(file.name)} exceeds the 20 MB local-analysis limit.`);
  }
}

function assertExtractedTextSize(charCount: number, sourceName: string): void {
  if (charCount > MAX_LOCAL_EVIDENCE_TEXT_CHARS) {
    throw new Error(
      `${sourceName} exceeds the ${MAX_LOCAL_EVIDENCE_TEXT_CHARS.toLocaleString("en-US")} character local-analysis limit. Split or narrow the source before analysis.`,
    );
  }
}

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
 * before expensive extraction begins.
 */
export function assertSafeDocxArchive(
  arrayBuffer: ArrayBuffer,
  sourceName: string,
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
  if (totalEntries > MAX_LOCAL_EVIDENCE_DOCX_ENTRIES) {
    throw new Error(
      `${sourceName} contains too many archive entries for local analysis (${totalEntries} > ${MAX_LOCAL_EVIDENCE_DOCX_ENTRIES}).`,
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
      declaredUncompressedBytes > MAX_LOCAL_EVIDENCE_DOCX_UNCOMPRESSED_BYTES
    ) {
      throw new Error(
        `${sourceName} declares more than ${Math.floor(MAX_LOCAL_EVIDENCE_DOCX_UNCOMPRESSED_BYTES / (1024 * 1024))} MB of expanded DOCX content. Split or narrow the source before analysis.`,
      );
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error(`${sourceName} has an inconsistent DOCX central-directory size.`);
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

export async function extractPdfEvidence(file: File): Promise<LocalDocumentExtraction> {
  assertFileSize(file);
  const sourceName = normalizeName(file.name);
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const document = await loadingTask.promise;
  const segments: EvidenceTextSegment[] = [];
  const warnings: string[] = [];
  let extractedChars = 0;

  try {
    if (document.numPages > MAX_LOCAL_EVIDENCE_PDF_PAGES) {
      throw new Error(
        `${sourceName} has ${document.numPages} pages; local PDF analysis is limited to ${MAX_LOCAL_EVIDENCE_PDF_PAGES} pages per source. Split the record into smaller documents before analysis.`,
      );
    }

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = joinPdfTextItems(content.items as unknown[]);
      if (text) {
        extractedChars += text.length;
        assertExtractedTextSize(extractedChars, sourceName);
        segments.push({ text, locatorPrefix: `page ${pageNumber}` });
      } else {
        warnings.push(`Page ${pageNumber} contained no extractable text. It may be image-only or require OCR.`);
      }
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  if (segments.length === 0) {
    warnings.push("No extractable PDF text was found. Scanned/image-only records require OCR before this app can analyze their text.");
  }

  return { kind: "pdf", sourceName, segments, warnings };
}

export async function extractDocxEvidence(file: File): Promise<LocalDocumentExtraction> {
  assertFileSize(file);
  const sourceName = normalizeName(file.name);
  const arrayBuffer = await file.arrayBuffer();
  assertSafeDocxArchive(arrayBuffer, sourceName);

  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  assertExtractedTextSize(result.value.length, sourceName);
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

export async function extractTextEvidence(file: File): Promise<LocalDocumentExtraction> {
  assertFileSize(file);
  const sourceName = normalizeName(file.name);
  if (file.size > MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES) {
    throw new Error(
      `${sourceName} exceeds the ${Math.floor(MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES / (1024 * 1024))} MB raw text preflight limit. Split or narrow the source before analysis.`,
    );
  }
  const text = await file.text();
  assertExtractedTextSize(text.length, sourceName);
  return {
    kind: "text",
    sourceName,
    segments: [{ text, locatorPrefix: "document" }],
    warnings: [],
  };
}

export async function extractLocalEvidenceDocument(file: File): Promise<LocalDocumentExtraction> {
  assertFileSize(file);
  const lower = file.name.toLocaleLowerCase();
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) return extractPdfEvidence(file);
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return extractDocxEvidence(file);
  }
  return extractTextEvidence(file);
}
