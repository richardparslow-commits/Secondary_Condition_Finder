export interface SafeIngestionResult {
  success: boolean;
  fileCount: number;
  derivedIndicators: string[];
  error?: string;
}

/**
 * Classifies file names and summarizes their formats without retaining file contents.
 *
 * @param fileNames - File names to classify by extension
 * @returns An ingestion result with the file count, unique `format-<extension>` indicators, and an error message when processing fails
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
