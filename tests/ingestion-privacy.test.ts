import { describe, it, expect } from "vitest";
import { processEvidenceFiles } from "../src/lib/engine/ingestion";

describe("P2 Ticket 8: Safe Evidence Ingestion Pipeline", () => {
  it("extracts minimal derived metadata without retaining raw filenames or text", () => {
    const result = processEvidenceFiles(["medical_record_smith_ssn_1234.pdf", "lab_results.pdf"]);
    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(2);
    expect(result.derivedIndicators).toEqual(["format-pdf"]);
    
    // Ensure no PII or raw names leak into derived indicators
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("smith");
    expect(serialized).not.toContain("1234");
  });

  it("handles malformed inputs gracefully without throwing exceptions", () => {
    // @ts-expect-error testing invalid input boundary
    const result = processEvidenceFiles(null);
    expect(result.success).toBe(false);
    expect(result.fileCount).toBe(0);
    expect(result.error).toBeDefined();
  });
});
