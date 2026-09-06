import { describe, expect, it } from "vitest";

import {
  extractTextEvidence,
  MAX_LOCAL_EVIDENCE_FILE_BYTES,
  MAX_LOCAL_EVIDENCE_PDF_PAGES,
  MAX_LOCAL_EVIDENCE_TEXT_CHARS,
  MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES,
} from "@/lib/evidence/document-extract";
import type { EvidenceAnalysis, EvidenceExcerpt } from "@/lib/evidence/extract";
import {
  EXTENDED_LIMITS,
  STANDARD_LIMITS,
  EVIDENCE_DEPTH_LIMITS,
  type EvidenceLimits,
} from "@/lib/evidence/limits";
import {
  loadStoredEvidence,
  MAX_STORED_EVIDENCE_BYTES,
  MAX_STORED_EVIDENCE_EXCERPTS_PER_SOURCE,
  MAX_STORED_EVIDENCE_SOURCES,
  serializeStoredEvidence,
} from "@/lib/evidence/storage";

function makeExcerpt(text: string): EvidenceExcerpt {
  return {
    sourceName: "source",
    locator: "page 1",
    quote: text,
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: false,
    matchedTerms: [],
  };
}

function makeAnalysis(index: number, excerptCount = 3): EvidenceAnalysis {
  return {
    version: 1,
    sourceName: `source-${index}`,
    excerpts: Array.from({ length: excerptCount }, (_, e) =>
      makeExcerpt(`excerpt ${index}-${e}`),
    ),
    nexusRelevantCount: 0,
    supportingCount: excerptCount,
  };
}

describe("evidence analysis depth limits", () => {
  it("keeps Standard limits identical to the historical published envelope", () => {
    expect(EVIDENCE_DEPTH_LIMITS.standard).toBe(STANDARD_LIMITS);
    expect(STANDARD_LIMITS.fileBytes).toBe(MAX_LOCAL_EVIDENCE_FILE_BYTES);
    expect(STANDARD_LIMITS.pdfPages).toBe(MAX_LOCAL_EVIDENCE_PDF_PAGES);
    expect(STANDARD_LIMITS.textChars).toBe(MAX_LOCAL_EVIDENCE_TEXT_CHARS);
    expect(STANDARD_LIMITS.textFileBytes).toBe(
      MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES,
    );
    expect(STANDARD_LIMITS.storedSources).toBe(MAX_STORED_EVIDENCE_SOURCES);
    expect(STANDARD_LIMITS.storedExcerptsPerSource).toBe(
      MAX_STORED_EVIDENCE_EXCERPTS_PER_SOURCE,
    );
    expect(STANDARD_LIMITS.storedBytes).toBe(MAX_STORED_EVIDENCE_BYTES);
    // Pin the exact historical numbers so copy contracts cannot drift silently.
    expect(STANDARD_LIMITS.fileBytes).toBe(20 * 1024 * 1024);
    expect(STANDARD_LIMITS.batchSources).toBe(10);
    expect(STANDARD_LIMITS.batchBytes).toBe(50 * 1024 * 1024);
    expect(STANDARD_LIMITS.pdfPages).toBe(300);
    expect(STANDARD_LIMITS.textChars).toBe(500_000);
    expect(STANDARD_LIMITS.storedSources).toBe(10);
    expect(STANDARD_LIMITS.storedExcerptsPerSource).toBe(5);
    expect(STANDARD_LIMITS.storedBytes).toBe(256 * 1024);
  });

  it("raises every functional envelope in Extended mode", () => {
    const numericKeys: Array<keyof EvidenceLimits> = [
      "fileBytes",
      "batchSources",
      "batchBytes",
      "pdfPages",
      "textChars",
      "textFileBytes",
      "storedSources",
      "storedExcerptsPerSource",
      "storedBytes",
    ];
    for (const key of numericKeys) {
      expect(EXTENDED_LIMITS[key]).toBeGreaterThan(STANDARD_LIMITS[key]);
    }
    // Extended covers the real-world case that motivated it: a 41 MB C-File.
    expect(EXTENDED_LIMITS.fileBytes).toBeGreaterThan(41 * 1024 * 1024);
    // DOCX archive-bomb preflight bounds must NOT scale with the per-file cap.
    expect(EXTENDED_LIMITS.docxUncompressedBytes).toBe(
      STANDARD_LIMITS.docxUncompressedBytes,
    );
    expect(EXTENDED_LIMITS.docxEntries).toBe(STANDARD_LIMITS.docxEntries);
  });

  it("retains more sources and excerpts under Extended limits", () => {
    const analyses = Array.from({ length: 40 }, (_, index) =>
      makeAnalysis(index),
    );

    const standard = JSON.parse(
      serializeStoredEvidence(analyses),
    ) as EvidenceAnalysis[];
    expect(standard).toHaveLength(STANDARD_LIMITS.storedSources);
    expect(
      standard.every(
        (analysis) =>
          analysis.excerpts.length <= STANDARD_LIMITS.storedExcerptsPerSource,
      ),
    ).toBe(true);

    const extended = JSON.parse(
      serializeStoredEvidence(analyses, EXTENDED_LIMITS),
    ) as EvidenceAnalysis[];
    expect(extended.length).toBeGreaterThan(STANDARD_LIMITS.storedSources);
    expect(extended.every((analysis) =>
      analysis.excerpts.length <= EXTENDED_LIMITS.storedExcerptsPerSource,
    )).toBe(true);
  });

  it("loads retained sources according to the caller's depth", () => {
    const payload = serializeStoredEvidence(
      Array.from({ length: 30 }, (_, index) => makeAnalysis(index)),
      EXTENDED_LIMITS,
    );
    const storage = { getItem: () => payload };

    expect(loadStoredEvidence(storage)).toHaveLength(
      STANDARD_LIMITS.storedSources,
    );
    expect(loadStoredEvidence(storage, EXTENDED_LIMITS)).toHaveLength(30);
    expect(loadStoredEvidence(null)).toEqual([]);
  });

  it("applies the higher text preflight only in Extended mode", async () => {
    const text = () => Promise.resolve("");
    const oversizedForStandard = {
      name: "large-record.txt",
      type: "text/plain",
      size: MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES + 1,
      text,
    } as unknown as File;

    await expect(extractTextEvidence(oversizedForStandard)).rejects.toThrow(
      /raw text preflight limit/i,
    );

    const extraction = await extractTextEvidence(
      oversizedForStandard,
      EXTENDED_LIMITS,
    );
    expect(extraction.sourceName).toBe("large-record.txt");

    const overExtendedCap = {
      name: "even-larger.txt",
      type: "text/plain",
      size: EXTENDED_LIMITS.textFileBytes + 1,
      text,
    } as unknown as File;
    await expect(
      extractTextEvidence(overExtendedCap, EXTENDED_LIMITS),
    ).rejects.toThrow(/raw text preflight limit/i);
  });
});
