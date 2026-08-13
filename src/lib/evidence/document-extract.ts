import type { EvidenceTextSegment } from "./extract";

export type LocalEvidenceDocumentKind = "pdf" | "docx" | "text";

export const MAX_LOCAL_EVIDENCE_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_LOCAL_EVIDENCE_PDF_PAGES = 300;
export const MAX_LOCAL_EVIDENCE_TEXT_CHARS = 500_000;

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
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
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
