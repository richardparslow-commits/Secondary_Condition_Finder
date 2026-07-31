export interface SafeIngestionResult {
  success: boolean;
  fileCount: number;
  derivedIndicators: string[];
  error?: string;
}

/**
 * Safe, non-PII-retentive file ingestion adapter.
 * Extracts minimal derived metadata (e.g. file counts, format categories)
 * without storing raw file contents or personal identifiers.
 */
export function processEvidenceFiles(fileNames: string[]): SafeIngestionResult {
  try {
    if (!Array.isArray(fileNames)) {
      return { success: false, fileCount: 0, derivedIndicators: [], error: "Invalid file input format" };
    }

    // Extract minimal structural metadata only - NO content text is retained or logged
    const derivedIndicators = fileNames.map(name => {
      const ext = name.split(".").pop()?.toLowerCase() || "unknown";
      return `format-${ext}`;
    });

    return {
      success: true,
      fileCount: fileNames.length,
      derivedIndicators: [...new Set(derivedIndicators)]
    };
  } catch {
    return { success: false, fileCount: 0, derivedIndicators: [], error: "Ingestion processing error" };
  }
}
