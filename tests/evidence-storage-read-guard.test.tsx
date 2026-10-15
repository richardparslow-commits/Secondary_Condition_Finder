// @vitest-environment jsdom
/**
 * Read guard for the browser-local evidence store (audit HARD-01).
 *
 * The store's write budgets bound what this app writes; they do not bound what
 * this app *reads*. A store written by an older version, edited by hand, or
 * replaced by same-origin script is parsed and validated on the main thread
 * before anything renders, so the read path needs its own guards:
 *
 *   1. the payload is measured before `JSON.parse` runs at all,
 *   2. the retention window is applied before per-entry validation,
 *   3. every retained entry is validated against per-field ceilings,
 *   4. entries that fail are counted so the surface can say what was ignored.
 *
 * The mounted cases assert the last point where the user can see it — the
 * analyzer must keep the readable records and still disclose the ignored ones,
 * because a silent partial restore is the data loss this finding is about.
 */
import fs from "node:fs";
import path from "node:path";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import {
  evidenceAnalysisStorageKey,
  MAX_EXCERPT_QUOTE_CHARS,
  type EvidenceAnalysis,
  type EvidenceExcerpt,
} from "@/lib/evidence/extract";
import { parseStoredEvidenceAnalyses } from "@/components/evidence/EvidenceAnalysesProvider";
import { LocalEvidenceReview } from "@/components/evidence/LocalEvidenceReview";
import {
  EVIDENCE_DEPTH_LIMITS,
  EXTENDED_LIMITS,
  STANDARD_LIMITS,
  type EvidenceLimits,
} from "@/lib/evidence/limits";
import {
  loadStoredEvidence,
  loadStoredEvidenceWithWarning,
  MAX_STORED_EVIDENCE_READ_LIMITS,
  MAX_STORED_EVIDENCE_SOURCES,
  MAX_STORED_EXCERPTS_PER_ANALYSIS,
  MAX_STORED_LOCATOR_CHARS,
  MAX_STORED_MATCHED_TERMS,
  MAX_STORED_MATCHED_TERM_CHARS,
  MAX_STORED_SOURCE_NAME_CHARS,
  parseStoredEvidence,
  serializeStoredEvidence,
} from "@/lib/evidence/storage";

/* pdf.js is replaced with a deterministic fake: the mounted cases below read a
   seeded session store, they never parse a document. */
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
        cleanup: () => {},
      }),
    }),
    destroy: async () => {},
  }),
}));

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

function excerpt(overrides: Partial<EvidenceExcerpt> = {}): EvidenceExcerpt {
  return {
    sourceName: "kept-note.txt",
    locator: "line 1",
    quote: "Chronic knee pain documented in service treatment records.",
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: false,
    matchedTerms: [],
    ...overrides,
  };
}

function analysis(
  sourceName: string,
  excerpts: EvidenceExcerpt[] = [excerpt({ sourceName })],
): EvidenceAnalysis {
  return {
    version: 1,
    sourceName,
    excerpts,
    nexusRelevantCount: 0,
    supportingCount: excerpts.length,
  };
}

/** A record only a hostile store could hold: valid shape, impossible quote. */
function oversizedQuoteRecord(sourceName = "ignored-note.txt"): EvidenceAnalysis {
  return analysis(sourceName, [
    excerpt({ sourceName, quote: "q".repeat(MAX_EXCERPT_QUOTE_CHARS + 1) }),
  ]);
}

function storageWith(raw: string | null) {
  return { getItem: () => raw };
}

function rawStore(records: unknown[]): string {
  return JSON.stringify(records);
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  warn.mockRestore();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

/* ─── Ceilings ────────────────────────────────────────────────────────────── */

describe("read ceilings sit above every shipped write envelope", () => {
  it("never refuses a record the writer is allowed to produce", () => {
    // Executable statement of intent: the read guard is a guard, not a second,
    // tighter retention policy. If a future envelope grows past a ceiling, this
    // fails before records start disappearing in the browser.
    expect(MAX_STORED_EXCERPTS_PER_ANALYSIS).toBeGreaterThan(
      EXTENDED_LIMITS.storedExcerptsPerSource,
    );
    expect(MAX_STORED_EXCERPTS_PER_ANALYSIS).toBeGreaterThan(
      STANDARD_LIMITS.storedExcerptsPerSource,
    );
    expect(MAX_STORED_SOURCE_NAME_CHARS).toBeGreaterThan(255);
    expect(MAX_STORED_LOCATOR_CHARS).toBeGreaterThan(64);
    expect(MAX_STORED_MATCHED_TERM_CHARS).toBeGreaterThan(64);
    expect(MAX_STORED_MATCHED_TERMS).toBeGreaterThan(64);
  });
});

/* ─── Step 1: measure before parsing ──────────────────────────────────────── */

describe("payload size is measured before JSON.parse", () => {
  it("refuses an over-ceiling payload without parsing it", () => {
    const parse = vi.spyOn(JSON, "parse");
    const raw = "x".repeat(STANDARD_LIMITS.storedBytes + 1);

    const result = loadStoredEvidenceWithWarning(storageWith(raw));

    expect(parse).not.toHaveBeenCalled();
    expect(result.analyses).toEqual([]);
    expect(result.discardedEntries).toBe(0);
    expect(result.parseError).toBe("Saved evidence could not be read.");
    // Fixed code only: the notice cannot carry document text or a byte count.
    expect(warn).toHaveBeenCalledWith("[evidence-storage] STORE_OVERSIZE");
  });

  it("honours the caller's depth ceiling rather than the Standard budget", () => {
    const payload = rawStore([analysis("extended-note.txt")]);

    expect(loadStoredEvidenceWithWarning(storageWith(payload)).analyses).toHaveLength(1);

    const tight: EvidenceLimits = { ...STANDARD_LIMITS, storedBytes: 8 };
    expect(loadStoredEvidenceWithWarning(storageWith(payload), tight)).toEqual({
      analyses: [],
      parseError: "Saved evidence could not be read.",
      discardedEntries: 0,
    });
  });

  it("keeps the silent loader fail-closed for the same payload", () => {
    const raw = "x".repeat(STANDARD_LIMITS.storedBytes + 1);
    expect(loadStoredEvidence(storageWith(raw))).toEqual([]);
  });
});

/* ─── Step 2: bound the array before validating ───────────────────────────── */

describe("the retained window is applied before validation", () => {
  it("treats window eviction as retention, not as a discarded record", () => {
    const records = Array.from({ length: 30 }, (_, index) =>
      analysis(`source-${index}.txt`),
    );

    const result = loadStoredEvidenceWithWarning(storageWith(rawStore(records)));

    expect(result.analyses).toHaveLength(MAX_STORED_EVIDENCE_SOURCES);
    expect(result.discardedEntries).toBe(0);
    // The oldest entries are outside the retention window by design; reporting
    // them as ignored would teach the Veteran to distrust the notice.
    expect(warn).not.toHaveBeenCalled();
  });
});

/* ─── Step 3: per-field ceilings ──────────────────────────────────────────── */

describe("structurally hostile records are refused, not rendered", () => {
  const hostile: Array<[string, EvidenceAnalysis]> = [
    ["a quote past the classifier's own bound", oversizedQuoteRecord()],
    [
      "an unbounded matchedTerms list",
      analysis("terms.txt", [excerpt({ sourceName: "terms.txt", matchedTerms: Array.from({ length: MAX_STORED_MATCHED_TERMS + 1 }, (_, index) => `term-${index}`) })]),
    ],
    [
      "an over-long matched term",
      analysis("long-term.txt", [excerpt({ sourceName: "long-term.txt", matchedTerms: ["t".repeat(MAX_STORED_MATCHED_TERM_CHARS + 1)] })]),
    ],
    [
      "an unbounded excerpts array",
      analysis("many-excerpts.txt", Array.from({ length: MAX_STORED_EXCERPTS_PER_ANALYSIS + 1 }, (_, index) => excerpt({ sourceName: "many-excerpts.txt", locator: `line ${index + 1}` }))),
    ],
    [
      "an over-long source name",
      analysis("n".repeat(MAX_STORED_SOURCE_NAME_CHARS + 1)),
    ],
    [
      "an over-long locator",
      analysis("locator.txt", [excerpt({ sourceName: "locator.txt", locator: "l".repeat(MAX_STORED_LOCATOR_CHARS + 1) })]),
    ],
  ];

  it.each(hostile)("refuses %s", (_label, record) => {
    const result = loadStoredEvidenceWithWarning(storageWith(rawStore([record])));

    expect(result.analyses).toEqual([]);
    expect(result.discardedEntries).toBe(1);
    expect(result.parseError).toBeNull();
    expect(warn).toHaveBeenCalledWith("[evidence-storage] STORE_PARTIAL");
  });

  it("keeps the readable records and reports how many were ignored", () => {
    const result = loadStoredEvidenceWithWarning(
      storageWith(rawStore([analysis("kept-note.txt"), oversizedQuoteRecord()])),
    );

    expect(result.analyses.map((item) => item.sourceName)).toEqual(["kept-note.txt"]);
    expect(result.discardedEntries).toBe(1);
    expect(result.parseError).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[evidence-storage] STORE_PARTIAL");
  });

  it("accepts a record written at the writer's own maxima", () => {
    // Non-vacuity: the ceilings must not refuse the largest record this app can
    // legitimately write, or the guard itself becomes the data loss.
    const maximalExcerpts = Array.from(
      { length: EXTENDED_LIMITS.storedExcerptsPerSource },
      (_, index) =>
        excerpt({
          sourceName: "maximal.txt",
          locator: `line ${index + 1}`,
          quote: "q".repeat(MAX_EXCERPT_QUOTE_CHARS),
          matchedTerms: Array.from({ length: 40 }, (_, term) => `term-${term}`),
        }),
    );
    const payload = serializeStoredEvidence(
      [analysis("maximal.txt", maximalExcerpts)],
      EXTENDED_LIMITS,
    );

    const result = loadStoredEvidenceWithWarning(storageWith(payload), EXTENDED_LIMITS);

    expect(result.discardedEntries).toBe(0);
    expect(result.analyses).toHaveLength(1);
    expect(result.analyses[0]?.excerpts).toHaveLength(
      EXTENDED_LIMITS.storedExcerptsPerSource,
    );
    expect(result.analyses[0]?.excerpts[0]?.quote).toHaveLength(MAX_EXCERPT_QUOTE_CHARS);
  });
});

/* ─── Structural wiring ───────────────────────────────────────────────────── */

describe("read-guard wiring (structural)", () => {
  it("checks the byte ceiling before the parse in the shared read path", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/evidence/storage.ts"),
      "utf8",
    );
    const lengthIndex = source.indexOf("if (raw.length > limits.storedBytes)");
    const measuredIndex = source.indexOf("if (byteLength(raw) > limits.storedBytes)");
    const parseIndex = source.indexOf("parsed = JSON.parse(raw)");

    // The length check is a cheap rejection that allocates nothing; the
    // measured check is the real ceiling (UTF-8 bytes, not code units). Both
    // must sit ahead of the parse.
    expect(lengthIndex).toBeGreaterThan(-1);
    expect(measuredIndex).toBeGreaterThan(lengthIndex);
    expect(parseIndex).toBeGreaterThan(measuredIndex);
  });

  it("wires the ignored-entry count to a user-visible notice in both restore effects", () => {
    const analyzer = fs.readFileSync(
      path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx"),
      "utf8",
    );

    expect(analyzer).toContain("STORAGE_PARTIAL_WARNING");
    expect(analyzer).toContain("could not be read and was ignored");
    const branchMatches = analyzer.match(/else if \(discardedEntries > 0\)/g) ?? [];
    expect(branchMatches).toHaveLength(
      (analyzer.match(/loadStoredEvidenceWithWarning\(/g) ?? []).length,
    );
  });
});

/* ─── Mounted: what the Veteran actually sees ─────────────────────────────── */

describe("partial and unreadable stores as the user sees them", () => {
  it("keeps the readable records listed and discloses the ignored ones", async () => {
    window.sessionStorage.setItem(
      evidenceAnalysisStorageKey,
      rawStore([analysis("kept-note.txt"), oversizedQuoteRecord()]),
    );

    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    await waitFor(() =>
      expect(screen.getByText("kept-note.txt")).toBeTruthy(),
    );
    expect(
      screen.getByText(/Some saved evidence in this browser tab could not be read and was ignored/),
    ).toBeTruthy();
    expect(screen.queryByText("ignored-note.txt")).toBeNull();
  });

  it("reports an over-ceiling store instead of restoring nothing in silence", async () => {
    window.sessionStorage.setItem(
      evidenceAnalysisStorageKey,
      "x".repeat(STANDARD_LIMITS.storedBytes + 1),
    );

    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    await waitFor(() =>
      expect(
        screen.getByText(/Saved evidence in this browser tab could not be read and was not restored/),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/No evidence excerpts have been analyzed/)).toBeTruthy();
  });

  it("shows no storage notice for a store that reads cleanly", async () => {
    window.sessionStorage.setItem(
      evidenceAnalysisStorageKey,
      rawStore([analysis("kept-note.txt")]),
    );

    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);

    await waitFor(() => expect(screen.getByText("kept-note.txt")).toBeTruthy());
    expect(screen.queryByText(/could not be read/)).toBeNull();
  });
});

/* ─── One store, one reader ───────────────────────────────────────────────── */

const COMPONENTS_DIR = path.join(process.cwd(), "src", "components");

function componentFiles(directory: string = COMPONENTS_DIR): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return componentFiles(absolute);
    return /\.tsx?$/.test(entry.name) ? [absolute] : [];
  });
}

/**
 * The store has more than one reader: the analyzer restores it, and four Step 6
 * surfaces render it. Each of those four used to carry its own `JSON.parse` with
 * a `version === 1` check, so the same hand-edited store was bounded on one page
 * and unbounded on another. These cases pin the read path as one path.
 */
describe("every reader of the evidence store shares the guarded read path", () => {
  it("reads against the widest envelope this app can write", () => {
    // The Step 6 readers have no depth context. A ceiling narrower than a
    // shipped envelope would refuse or trim a legitimate Extended store on
    // whichever page opened it first — the guard becoming the loss it exists
    // to prevent.
    for (const limits of Object.values(EVIDENCE_DEPTH_LIMITS)) {
      expect(MAX_STORED_EVIDENCE_READ_LIMITS.storedBytes).toBeGreaterThanOrEqual(
        limits.storedBytes,
      );
      expect(MAX_STORED_EVIDENCE_READ_LIMITS.storedSources).toBeGreaterThanOrEqual(
        limits.storedSources,
      );
      expect(
        MAX_STORED_EVIDENCE_READ_LIMITS.storedExcerptsPerSource,
      ).toBeGreaterThanOrEqual(limits.storedExcerptsPerSource);
    }
  });

  it("refuses a payload past the ceiling before parsing it", () => {
    const parse = vi.spyOn(JSON, "parse");
    const raw = "x".repeat(MAX_STORED_EVIDENCE_READ_LIMITS.storedBytes + 1);

    expect(parseStoredEvidence(raw)).toEqual([]);
    expect(parse).not.toHaveBeenCalled();
  });

  it("measures bytes rather than UTF-16 code units against the ceiling", () => {
    // An astral character is two code units and four UTF-8 bytes, so a payload
    // can pass a length check and still be over the ceiling. Only the measured
    // check catches this one.
    const tight: EvidenceLimits = { ...STANDARD_LIMITS, storedBytes: 32 };
    const raw = "\u{2070E}".repeat(10); // 20 code units, 40 bytes

    expect(raw.length).toBeLessThanOrEqual(tight.storedBytes);
    expect(loadStoredEvidenceWithWarning(storageWith(raw), tight).parseError).toBe(
      "Saved evidence could not be read.",
    );
    expect(warn).toHaveBeenCalledWith("[evidence-storage] STORE_OVERSIZE");
    expect(parseStoredEvidence(raw, tight)).toEqual([]);
  });

  it("keeps the readable records and drops the impossible one", () => {
    const payload = rawStore([analysis("kept-note.txt"), oversizedQuoteRecord()]);

    expect(parseStoredEvidence(payload).map((item) => item.sourceName)).toEqual([
      "kept-note.txt",
    ]);
    // The provider's exported reader is the same path, so the Step 6 subtree
    // cannot accept what the analyzer's own restore would have refused.
    expect(parseStoredEvidenceAnalyses(payload).map((item) => item.sourceName)).toEqual([
      "kept-note.txt",
    ]);
  });

  it("reads a store written at the Extended maxima without discarding it", () => {
    const payload = serializeStoredEvidence(
      Array.from({ length: EXTENDED_LIMITS.storedSources }, (_, index) =>
        analysis(`source-${index}.txt`),
      ),
      EXTENDED_LIMITS,
    );

    expect(parseStoredEvidence(payload)).toHaveLength(EXTENDED_LIMITS.storedSources);
    expect(parseStoredEvidenceAnalyses(payload)).toHaveLength(EXTENDED_LIMITS.storedSources);
  });

  it("leaves no reader of the evidence store parsing the payload itself", () => {
    const offenders = componentFiles().filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return (
        source.includes("evidenceAnalysisStorageKey") &&
        source.includes("JSON.parse(")
      );
    });

    expect(offenders).toEqual([]);
  });

  it.each([
    "src/components/evidence/EvidenceAnalysesProvider.tsx",
    "src/components/evidence/LocalEvidenceReview.tsx",
    "src/components/evidence/PathwayEvidenceMapper.tsx",
    "src/components/evidence/PathwayEvidenceReview.tsx",
  ])("delegates to the shared guard from %s", (relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

    expect(source).toContain("parseStoredEvidence");
    expect(source).not.toContain("JSON.parse(");
  });
});

/* ─── Mounted: a Step 6 surface reading a hostile store ───────────────────── */

describe("a Step 6 surface reading the store directly is bounded too", () => {
  it("renders the readable excerpt and never the impossible one", async () => {
    const payload = rawStore([analysis("kept-note.txt"), oversizedQuoteRecord()]);
    window.sessionStorage.setItem(evidenceAnalysisStorageKey, payload);

    // Non-vacuity control: this is a payload the previous reader accepted —
    // both records are version 1 — so it genuinely reached the surface with a
    // quote no writer could have produced before this guard existed.
    const loose = (JSON.parse(payload) as EvidenceAnalysis[]).filter(
      (item) => item.version === 1,
    );
    expect(
      loose.some((item) => item.excerpts.some((excerpt) => excerpt.quote.length > 200)),
    ).toBe(true);

    const { unmount } = render(<LocalEvidenceReview />);

    await waitFor(() => expect(screen.getByText(/kept-note.txt/)).toBeTruthy());
    expect(screen.queryByText(/ignored-note\.txt/)).toBeNull();
    expect(document.body.textContent ?? "").not.toContain("q".repeat(200));

    unmount();
  });

  it("renders the empty state, not the payload, for a store over the ceiling", async () => {
    window.sessionStorage.setItem(
      evidenceAnalysisStorageKey,
      "x".repeat(MAX_STORED_EVIDENCE_READ_LIMITS.storedBytes + 1),
    );

    render(<LocalEvidenceReview />);

    await waitFor(() =>
      expect(
        screen.getByText(/No local evidence analysis is available in this browser tab/),
      ).toBeTruthy(),
    );
  });
});
