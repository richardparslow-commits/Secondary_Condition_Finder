/**
 * Regression suite for Heal defect 1 (2026-11-03 run):
 * "A second document with the same file name silently replaces the first".
 *
 * Retention keyed on `sourceName`, so analyzing `letter.txt` from a second
 * folder overwrote the first document's excerpts, and Remove deleted both.
 * These cases pin the fix at three layers: the pure retention rules, the
 * serialized store that has to carry the new identity, and the analyzer wiring
 * that supplies it on both the file and OCR paths.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  analyzeEvidenceSegments,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";
import { STANDARD_LIMITS } from "@/lib/evidence/limits";
import {
  evidenceAnalysisIdentity,
  mergeEvidenceAnalysis,
  removeEvidenceAnalysis,
} from "@/lib/evidence/retention";
import { loadStoredEvidence, serializeStoredEvidence } from "@/lib/evidence/storage";

function makeAnalysis(
  sourceName: string,
  sourceId?: string,
  quote = "diabetes mellitus aggravated by service",
): EvidenceAnalysis {
  return {
    version: 1,
    sourceName,
    ...(sourceId ? { sourceId } : {}),
    excerpts: [
      {
        sourceName,
        locator: "page 1",
        quote,
        category: "aggravation",
        strength: "supporting",
        clinicianAuthored: false,
        matchedTerms: [],
      },
    ],
    nexusRelevantCount: 0,
    supportingCount: 1,
  };
}

function reader(payload: string | null) {
  return { getItem: () => payload };
}

describe("mergeEvidenceAnalysis keeps same-named documents apart", () => {
  it("retains both documents when two files share a name", () => {
    const first = makeAnalysis("letter.txt", "staged-1", "aggravated by the diabetes");
    const second = makeAnalysis("letter.txt", "staged-2", "due to the diabetes mellitus");

    const merged = mergeEvidenceAnalysis([first], second, STANDARD_LIMITS.storedSources);

    expect(merged).toHaveLength(2);
    expect(merged.map((analysis) => analysis.sourceId)).toEqual(["staged-1", "staged-2"]);
    expect(merged.map((analysis) => analysis.excerpts[0]!.quote)).toEqual([
      "aggravated by the diabetes",
      "due to the diabetes mellitus",
    ]);
  });

  it("replaces the earlier result when the same document is re-analyzed", () => {
    const first = makeAnalysis("letter.txt", "staged-1", "first reading");
    const reanalyzed = makeAnalysis("letter.txt", "staged-1", "second reading");

    const merged = mergeEvidenceAnalysis([first], reanalyzed, STANDARD_LIMITS.storedSources);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.excerpts[0]!.quote).toBe("second reading");
  });

  it("keeps name identity for records written before source ids existed", () => {
    const legacy = makeAnalysis("pasted note", undefined, "first");
    const replacement = makeAnalysis("pasted note", undefined, "second");

    expect(evidenceAnalysisIdentity(legacy)).toBe("name:pasted note");
    const merged = mergeEvidenceAnalysis([legacy], replacement, STANDARD_LIMITS.storedSources);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.excerpts[0]!.quote).toBe("second");
  });

  it("evicts oldest-first past the retention window", () => {
    const existing = [
      makeAnalysis("a", "staged-1"),
      makeAnalysis("b", "staged-2"),
      makeAnalysis("c", "staged-3"),
    ];

    const merged = mergeEvidenceAnalysis(existing, makeAnalysis("d", "staged-4"), 3);

    expect(merged.map((analysis) => analysis.sourceId)).toEqual([
      "staged-2",
      "staged-3",
      "staged-4",
    ]);
  });

  it("removes only the document it was asked for", () => {
    const merged = mergeEvidenceAnalysis(
      [makeAnalysis("letter.txt", "staged-1")],
      makeAnalysis("letter.txt", "staged-2"),
      STANDARD_LIMITS.storedSources,
    );

    const remaining = removeEvidenceAnalysis(merged, "staged-1");

    expect(remaining.map((analysis) => analysis.sourceId)).toEqual(["staged-2"]);
  });
});

describe("the store round-trips two same-named documents", () => {
  it("returns both records after serialize and load", () => {
    const analyses = [
      makeAnalysis("letter.txt", "staged-1", "aggravated by the diabetes"),
      makeAnalysis("letter.txt", "staged-2", "due to the diabetes mellitus"),
    ];

    const payload = serializeStoredEvidence(analyses, STANDARD_LIMITS);
    const loaded = loadStoredEvidence(reader(payload), STANDARD_LIMITS);

    expect(loaded).toHaveLength(2);
    expect(loaded.map((analysis) => analysis.sourceName)).toEqual([
      "letter.txt",
      "letter.txt",
    ]);
    expect(loaded.map((analysis) => analysis.sourceId)).toEqual([
      "staged-1",
      "staged-2",
    ]);
  });

  it("still loads a record written before source ids existed", () => {
    const payload = serializeStoredEvidence([makeAnalysis("legacy.txt")], STANDARD_LIMITS);

    const loaded = loadStoredEvidence(reader(payload), STANDARD_LIMITS);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.sourceId).toBeUndefined();
  });

  it("refuses an unbounded source id rather than loading it", () => {
    const payload = serializeStoredEvidence(
      [
        makeAnalysis("letter.txt", "staged-1"),
        makeAnalysis("letter.txt", "x".repeat(129)),
      ],
      STANDARD_LIMITS,
    );

    const loaded = loadStoredEvidence(reader(payload), STANDARD_LIMITS);

    expect(loaded.map((analysis) => analysis.sourceId)).toEqual(["staged-1"]);
  });
});

describe("analysis carries the document id it was given", () => {
  it("keeps the id on the record while the name stays the label", () => {
    const analysis = analyzeEvidenceSegments(
      [{ text: "Peripheral neuropathy is aggravated by diabetes mellitus.", locatorPrefix: "page 1" }],
      { sourceId: "staged-7", sourceName: "letter.txt", credential: "physician" },
      ["peripheral neuropathy"],
    );

    expect(analysis.sourceId).toBe("staged-7");
    expect(analysis.sourceName).toBe("letter.txt");
    expect(analysis.excerpts.length).toBeGreaterThan(0);
  });
});

describe("the analyzer wires identity instead of the file name (structural)", () => {
  const analyzer = fs.readFileSync(
    path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx"),
    "utf8",
  );

  it("gives every staged document an id unique to this page load", () => {
    // The per-load prefix is what stops a post-reload id from colliding with a
    // document already restored from session storage.
    expect(analyzer).toContain("sourceId: `staged-${stagedSessionId}-${id}`");
    expect(analyzer).toContain("crypto.randomUUID()");
  });

  it("passes that id into both the file and OCR analysis paths", () => {
    const passes = analyzer.match(/sourceId: row\.sourceId/g) ?? [];
    expect(passes).toHaveLength(2);
  });

  it("merges by identity, never by source name", () => {
    expect(analyzer).toContain("mergeEvidenceAnalysis(");
    expect(analyzer).toContain("removeEvidenceAnalysis(");
    expect(analyzer).not.toContain("existing.sourceName !== analysis.sourceName");
  });

  it("keys the excerpt summary by identity so both cards render", () => {
    expect(analyzer).toContain("key={evidenceAnalysisIdentity(analysis)}");
  });
});
