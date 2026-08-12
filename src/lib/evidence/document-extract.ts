import type { EvidenceTextSegment } from "./extract";

export type LocalEvidenceDocumentKind = "pdf" | "docx" | "text";

export interface LocalDocumentExtraction {
  kind: LocalEvidenceDocumentKind;
  sourceName: string;
  segments: EvidenceTextSegment[];
  warnings: string[];
}

function normalizeName(name: string): string {
  return name.trim() || "Local evidence document";
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
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const document = await loadingTask.promise;
  const segments: EvidenceTextSegment[] = [];
  const warnings: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = joinPdfTextItems(content.items as unknown[]);
      if (text) {
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

  return { kind: "pdf", sourceName: normalizeName(file.name), segments, warnings };
}

export async function extractDocxEvidence(file: File): Promise<LocalDocumentExtraction> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
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

  return { kind: "docx", sourceName: normalizeName(file.name), segments, warnings };
}

export async function extractTextEvidence(file: File): Promise<LocalDocumentExtraction> {
  return {
    kind: "text",
    sourceName: normalizeName(file.name),
    segments: [{ text: await file.text(), locatorPrefix: "document" }],
    warnings: [],
  };
}

export async function extractLocalEvidenceDocument(file: File): Promise<LocalDocumentExtraction> {
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
