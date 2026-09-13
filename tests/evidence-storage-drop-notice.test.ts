import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  serializeStoredEvidence,
  serializeStoredEvidenceWithInfo,
} from "@/lib/evidence/storage";
import { STANDARD_LIMITS, type EvidenceLimits } from "@/lib/evidence/limits";
import type { EvidenceAnalysis } from "@/lib/evidence/extract";

/**
 * Contract for silent-data-loss prevention in evidence storage (audit
 * finding #3, remediated in #386):
 *
 * 1. serializeStoredEvidenceWithInfo reports an accurate dropped count when
 *    byte-budget or source-cap eviction discards oldest-first.
 * 2. The committed shape round-trips: what survives serialization is exactly
 *    what loadStoredEvidence returns.
 * 3. The analyzer surfaces the dropped count to the user as a warning
 *    (structural pins — repo convention for client components), so eviction
 *    is never silent.
 */
function makeAnalysis(sourceName: string, quote: string): EvidenceAnalysis {
  return {
    version: 1,
    sourceName,
    excerpts: [
      {
        sourceName,
        locator: "page 1",
        quote,
        category: "diagnosis",
        strength: "supporting",
        clinicianAuthored: false,
        matchedTerms: [],
      },
    ],
    nexusRelevantCount: 0,
    supportingCount: 1,
  };
}

describe("serializeStoredEvidenceWithInfo drop accounting", () => {
  it("reports zero dropped when everything fits within the byte budget", () => {
    const analyses = [
      makeAnalysis("source-a", "small note"),
      makeAnalysis("source-b", "another small note"),
    ];

    const info = serializeStoredEvidenceWithInfo(analyses, STANDARD_LIMITS);

    expect(info.dropped).toBe(0);
    expect(JSON.parse(info.serialized)).toHaveLength(2);
  });

  it("drops oldest sources first under byte pressure with an accurate count", () => {
    const limits: EvidenceLimits = {
      ...STANDARD_LIMITS,
      storedSources: 10,
      storedBytes: 400,
    };
    const analyses = [
      makeAnalysis("old-source", "x".repeat(300)),
      makeAnalysis("middle-source", "x".repeat(300)),
      makeAnalysis("newest-source", "kept"),
    ];

    const info = serializeStoredEvidenceWithInfo(analyses, limits);

    expect(info.dropped).toBe(2);
    const surviving = JSON.parse(info.serialized) as EvidenceAnalysis[];
    expect(surviving).toHaveLength(1);
    expect(surviving[0]?.sourceName).toBe("newest-source");
  });

  it("applies the source cap before accounting — cap eviction never inflates dropped", () => {
    // Rationale: commitAnalysis caps state identically (.slice(-storedSources)),
    // so cap-evicted sources never diverge from what the user sees. `dropped`
    // isolates the byte-budget eviction, which is the only silent divergence.
    const limits: EvidenceLimits = {
      ...STANDARD_LIMITS,
      storedSources: 1,
      storedBytes: STANDARD_LIMITS.storedBytes,
    };
    const analyses = [makeAnalysis("older", "kept text"), makeAnalysis("newer", "kept text")];

    const info = serializeStoredEvidenceWithInfo(analyses, limits);

    expect(info.dropped).toBe(0);
    const surviving = JSON.parse(info.serialized) as EvidenceAnalysis[];
    expect(surviving).toHaveLength(1);
    expect(surviving[0]?.sourceName).toBe("newer");
  });

  it("returns an empty store with a full drop count when nothing fits", () => {
    const limits: EvidenceLimits = {
      ...STANDARD_LIMITS,
      storedSources: 10,
      storedBytes: 10,
    };

    const info = serializeStoredEvidenceWithInfo(
      [makeAnalysis("too-big", "x".repeat(500))],
      limits,
    );

    expect(info.serialized).toBe("[]");
    expect(info.dropped).toBe(1);
  });

  it("keeps the string-only API consistent with the info variant", () => {
    const analyses = [makeAnalysis("source", "text")];
    expect(serializeStoredEvidence(analyses, STANDARD_LIMITS)).toBe(
      serializeStoredEvidenceWithInfo(analyses, STANDARD_LIMITS).serialized,
    );
  });
});

describe("commitAnalysis user notification contract (structural)", () => {
  const analyzer = fs.readFileSync(
    path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx"),
    "utf8",
  );

  it("computes the dropped count via serializeStoredEvidenceWithInfo before saving", () => {
    const commitIndex = analyzer.indexOf("function commitAnalysis(");
    expect(commitIndex).toBeGreaterThan(-1);
    const body = analyzer.slice(commitIndex, analyzer.indexOf("function dropAnalysis(", commitIndex));
    expect(body).toContain("serializeStoredEvidenceWithInfo(next, limits)");
    expect(body).toContain("info.dropped > 0");
    expect(body.indexOf("saveStored(")).toBeGreaterThan(body.indexOf("info.dropped > 0"));
  });

  it("defers the warning outside the state updater and names the remedy", () => {
    const commitIndex = analyzer.indexOf("function commitAnalysis(");
    const body = analyzer.slice(commitIndex, analyzer.indexOf("function dropAnalysis(", commitIndex));
    expect(body).toContain("queueMicrotask(");
    expect(body).toContain("Storage limit reached (");
    expect(body).toContain("older analyzed source(s) were dropped");
    expect(body).toContain("Extended depth");
  });
});
