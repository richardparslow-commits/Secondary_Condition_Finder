/**
 * Bounds for browser-local evidence analysis and retention, per depth mode.
 *
 * "Standard" is the default privacy-preserving envelope and must remain the
 * historical published set (20 MB/file, 10 files & 50 MB per batch, 300 PDF
 * pages, 500,000 characters, 10 retained sources) so existing copy contracts
 * and user expectations stay valid.
 *
 * "Extended" is an opt-in envelope for bulk triage of large local document
 * sets. Files still never leave the browser; the higher numbers only trade
 * more in-tab memory/time. Keep retained bytes comfortably below the browser
 * session-storage quota (~5-10 MB per origin) because the storage layer fails
 * closed to in-memory-only when the quota is exceeded.
 *
 * DOCX hardening bounds are intentionally identical across modes: raising the
 * per-file cap must not raise the declared-expansion preflight ceiling that
 * protects against archive-bomb work before decompression.
 */

export type EvidenceAnalysisDepth = "standard" | "extended";

export interface EvidenceLimits {
  /** Maximum bytes for a single uploaded/pasted source. */
  fileBytes: number;
  /** Maximum number of files considered in one local-analysis batch. */
  batchSources: number;
  /** Maximum accepted file bytes in one local-analysis batch. */
  batchBytes: number;
  /** Maximum PDF pages parsed per source. */
  pdfPages: number;
  /** Maximum extracted or pasted characters kept per source. */
  textChars: number;
  /** Maximum raw bytes for a text file before its body is read. */
  textFileBytes: number;
  /** Maximum declared uncompressed bytes for a DOCX archive. */
  docxUncompressedBytes: number;
  /** Maximum declared entries in a DOCX archive. */
  docxEntries: number;
  /** Maximum analyzed sources retained for the Step 6 checklist. */
  storedSources: number;
  /** Maximum excerpt records retained per retained source. */
  storedExcerptsPerSource: number;
  /** Maximum serialized retained-excerpt bytes in session storage. */
  storedBytes: number;
}

export const STANDARD_LIMITS: EvidenceLimits = {
  fileBytes: 20 * 1024 * 1024,
  batchSources: 10,
  batchBytes: 50 * 1024 * 1024,
  pdfPages: 300,
  textChars: 500_000,
  textFileBytes: 500_000 * 4,
  docxUncompressedBytes: 40 * 1024 * 1024,
  docxEntries: 2_000,
  storedSources: 10,
  storedExcerptsPerSource: 5,
  storedBytes: 256 * 1024,
};

export const EXTENDED_LIMITS: EvidenceLimits = {
  fileBytes: 100 * 1024 * 1024,
  batchSources: 200,
  batchBytes: 1024 * 1024 * 1024,
  pdfPages: 2_000,
  textChars: 3_000_000,
  textFileBytes: 3_000_000 * 4,
  docxUncompressedBytes: 40 * 1024 * 1024,
  docxEntries: 2_000,
  storedSources: 200,
  storedExcerptsPerSource: 10,
  storedBytes: 3 * 1024 * 1024,
};

export const EVIDENCE_DEPTH_LIMITS: Record<
  EvidenceAnalysisDepth,
  EvidenceLimits
> = {
  standard: STANDARD_LIMITS,
  extended: EXTENDED_LIMITS,
};

export const EVIDENCE_DEPTH_LABELS: Record<
  EvidenceAnalysisDepth,
  string
> = {
  standard: "Standard",
  extended: "Extended",
};

/** Formats a byte bound for user-facing copy ("20 MB", "1 GB"). */
export function formatLimitBytes(value: number): string {
  const gigabytes = value / 1024 ** 3;
  if (Number.isInteger(gigabytes)) return `${gigabytes} GB`;
  const megabytes = value / 1024 ** 2;
  if (Number.isInteger(megabytes)) return `${megabytes} MB`;
  return `${megabytes.toFixed(1)} MB`;
}

/** Formats a character bound for user-facing copy ("500,000"). */
export function formatLimitChars(value: number): string {
  return value.toLocaleString("en-US");
}
