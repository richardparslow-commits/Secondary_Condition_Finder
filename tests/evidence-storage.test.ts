import { describe, expect, it } from "vitest";

import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
  type EvidenceExcerpt,
} from "@/lib/evidence/extract";
import {
  clearStoredEvidence,
  loadStoredEvidence,
  MAX_STORED_EVIDENCE_BYTES,
  MAX_STORED_EVIDENCE_EXCERPTS_PER_SOURCE,
  MAX_STORED_EVIDENCE_SOURCES,
  saveStoredEvidence,
  serializeStoredEvidence,
} from "@/lib/evidence/storage";

function makeAnalysis(
  index: number,
  excerptCount = 8,
  sourceName = `source-${index}`,
): EvidenceAnalysis {
  const excerpts: EvidenceExcerpt[] = Array.from(
    { length: excerptCount },
    (_, excerptIndex) => ({
      sourceName,
      locator: `page ${excerptIndex + 1}`,
      quote: `Evidence sentence ${excerptIndex + 1} for ${sourceName}.`,
      category: excerptIndex % 2 === 0 ? "causation" : "timeline",
      strength: excerptIndex % 2 === 0 ? "nexus-relevant" : "supporting",
      clinicianAuthored: true,
      matchedTerms: ["OSA"],
    }),
  );

  return {
    version: 1,
    sourceName,
    excerpts,
    nexusRelevantCount: 17,
    supportingCount: 23,
  };
}

describe("local evidence browser storage", () => {
  it("persists only the recent sources and the excerpts the UI can display while retaining counts", () => {
    const analyses = Array.from({ length: 12 }, (_, index) => makeAnalysis(index));
    const parsed = JSON.parse(serializeStoredEvidence(analyses)) as EvidenceAnalysis[];

    expect(parsed).toHaveLength(MAX_STORED_EVIDENCE_SOURCES);
    expect(parsed[0].sourceName).toBe("source-2");
    expect(parsed.at(-1)?.sourceName).toBe("source-11");
    expect(parsed.every((analysis) => analysis.excerpts.length === MAX_STORED_EVIDENCE_EXCERPTS_PER_SOURCE)).toBe(true);
    expect(parsed.every((analysis) => analysis.nexusRelevantCount === 17)).toBe(true);
    expect(parsed.every((analysis) => analysis.supportingCount === 23)).toBe(true);
  });

  it("never serializes a session payload above the configured byte budget", () => {
    const oversized = makeAnalysis(0, 8, "x".repeat(MAX_STORED_EVIDENCE_BYTES));
    const serialized = serializeStoredEvidence([oversized]);

    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(
      MAX_STORED_EVIDENCE_BYTES,
    );
    expect(serialized).toBe("[]");
  });

  it("round-trips through available storage without changing the v1 array format", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
    };

    expect(saveStoredEvidence(storage, [makeAnalysis(1)])).toBe(true);
    expect(JSON.parse(values.get(evidenceAnalysisStorageKey) ?? "null")).toBeInstanceOf(Array);
    expect(loadStoredEvidence(storage)).toHaveLength(1);
    expect(loadStoredEvidence(storage)[0].version).toBe(1);
    expect(clearStoredEvidence(storage)).toBe(true);
    expect(values.has(evidenceAnalysisStorageKey)).toBe(false);
  });

  it("fails closed when browser storage read, write, or removal throws", () => {
    const throwingStorage = {
      getItem() {
        throw new Error("storage read blocked");
      },
      setItem() {
        throw new Error("storage quota exceeded");
      },
      removeItem() {
        throw new Error("storage removal blocked");
      },
    };

    expect(loadStoredEvidence(throwingStorage)).toEqual([]);
    expect(saveStoredEvidence(throwingStorage, [makeAnalysis(1)])).toBe(false);
    expect(clearStoredEvidence(throwingStorage)).toBe(false);
  });

  it("treats malformed stored data as unavailable instead of propagating parse failures", () => {
    expect(loadStoredEvidence({ getItem: () => "{not-json" })).toEqual([]);
    expect(loadStoredEvidence({ getItem: () => JSON.stringify({ version: 1 }) })).toEqual([]);
  });

  it("rejects structurally incomplete v1 analyses and excerpts before they reach the UI", () => {
    const incompleteAnalysis = [{ version: 1, sourceName: "corrupt" }];
    const incompleteExcerpt = [
      {
        ...makeAnalysis(1),
        excerpts: [{ sourceName: "source-1", quote: "missing UI fields" }],
      },
    ];
    const invalidCounts = [
      {
        ...makeAnalysis(2),
        nexusRelevantCount: -1,
      },
    ];

    expect(
      loadStoredEvidence({ getItem: () => JSON.stringify(incompleteAnalysis) }),
    ).toEqual([]);
    expect(
      loadStoredEvidence({ getItem: () => JSON.stringify(incompleteExcerpt) }),
    ).toEqual([]);
    expect(
      loadStoredEvidence({ getItem: () => JSON.stringify(invalidCounts) }),
    ).toEqual([]);
  });
});
