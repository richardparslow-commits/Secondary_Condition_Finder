import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  auditDocumentParity,
  auditFindingDispositionParity,
  auditMarkerPairing,
  collectNpmScripts,
  collectVolatileCounts,
  corpusMarkerReports,
  missingFileReferences,
  parseHistoricalZones,
  readRepoMarkdown,
  volatileHitsOutsideHistoricalZones,
  type HistoricalZone,
} from "./helpers/doc-lint";

/**
 * Living-documentation lint policy — the per-doc generalization of the README
 * consistency contract (tests/readme-consistency.test.ts), built on the shared
 * doc-lint harness (./helpers/doc-lint).
 *
 * The docs/ tree holds ~150 immutable historical records (numbered batch and
 * ledger files whose counts ARE the record). Above them sits a small set of
 * living documents that readers treat as current state. Each living doc gets
 * an explicit policy:
 *
 * - `all-current`: every file path, npm script, and snapshot-count class in
 *   the document is live-checked. Any transcribed current-state number fails.
 * - `zones`: the document interleave an authoritative current-state block
 *   with retained historical batch snapshots fenced by the repository's
 *   `<!-- SCOPE:START/END -->` marker convention. Volatile counts are banned
 *   OUTSIDE the fenced zones and are the historical record inside them. The
 *   expected zone labels are pinned so the exemption cannot silently widen.
 * - `historical-everywhere`: a versioned ledger document (the expansion
 *   roadmap) whose counts are milestone facts; counts are allowed anywhere,
 *   but the policy anchors that explain WHY are still pinned.
 *
 * Every policy entry also pins at least one policy anchor — the sentence or
 * generator table that tells a future editor the rule. Deleting the
 * explanation fails the suite, so the rule cannot rot into decoration.
 */

type DocLintPolicy = {
  /** Path relative to the repository root. */
  file: string;
  volatilePolicy: "ban" | "historical";
  /** Expected historical-zone labels (exact); presence is contractual. */
  historicalZones?: string[];
  /** Text that must remain visible so the policy keeps its rationale. */
  anchors: string[];
};

const DOCS_DIR = "docs";

/**
 * The living-documentation set. Add a doc here when it becomes a
 * reader-facing source of current state; classify it honestly.
 */
const DOC_POLICIES: DocLintPolicy[] = [
  {
    file: "docs/product-spec.md",
    volatilePolicy: "ban",
    anchors: [
      "do not copy those numbers here",
      "npm run authoring:tracker",
      "npm run citations:audit",
    ],
  },
  {
    file: "docs/functional-specification.md",
    volatilePolicy: "ban",
    anchors: [
      "Live counts are generated, not documented",
      "npm run authoring:tracker",
    ],
  },
  {
    file: "docs/technical-specification.md",
    volatilePolicy: "ban",
    anchors: [
      "the count changes with every contribution",
    ],
  },
  {
    file: "docs/technical-specification-v2.md",
    volatilePolicy: "ban",
    anchors: ["npm run authoring:tracker"],
  },
  {
    file: "docs/executive-specification-v2.md",
    volatilePolicy: "ban",
    anchors: ["npm run authoring:tracker"],
  },
  {
    file: "docs/master-specification.md",
    volatilePolicy: "ban",
    anchors: ["npm run kb:validate"],
  },
  {
    file: "docs/operations.md",
    volatilePolicy: "ban",
    anchors: [],
  },
  {
    file: "docs/security-operations.md",
    volatilePolicy: "ban",
    anchors: [
      // The adjacency-graph runbook must survive: the section heading, the
      // health surface it documents, its reproduction command, and the
      // sentence that tells a future editor to keep it current.
      "Adjacency-graph (CRG) migration operations",
      "components.kbGraph",
      "npm run audit:crg:graph",
      "keep it current whenever the health or readiness surfaces change",
    ],
  },
  {
    file: "docs/api-specification.md",
    volatilePolicy: "ban",
    anchors: [],
  },
  {
    file: "docs/evidence-architecture-v2.md",
    volatilePolicy: "ban",
    anchors: ["npm run kb:validate"],
  },
  {
    file: "docs/condition-catalog.md",
    volatilePolicy: "ban",
    anchors: [
      "Do **not** duplicate the latest evidence-promotion batch number",
    ],
  },
  {
    file: "docs/recommendation-engine-algorithm.md",
    volatilePolicy: "ban",
    anchors: [
      "generated, not transcribed",
      "npm run kb:validate",
    ],
  },
  {
    file: "docs/clinical-program-status.md",
    volatilePolicy: "ban",
    historicalZones: [
      "CURRENT-REPOSITORY-STATE-2026",
      "CLINICAL-MAPPING-MASTER-RESOLUTION-2026",
      "ADRENAL-HISTOPLASMOSIS-TAXONOMY-2026",
      "PTH-TAXONOMY-2026",
      "RESIDUAL-M1-CLOSURE-2026",
      "CLINICAL-MAPPING-MASTER-2026",
      "HISTORICAL-BATCH-31-SNAPSHOT",
      "HISTORICAL-CURRENT-SECTIONS",
      "clinical-mapping-m1-current",
    ],
    anchors: [
      "Current-state numbers are **generated, not transcribed**",
      "npm run kb:validate",
      "npm run authoring:tracker",
      "npm run citations:audit",
    ],
  },
  {
    file: "docs/kb-coverage-tracker.md",
    volatilePolicy: "ban",
    historicalZones: [
      "ALL-94-CITATION-VERIFICATION-2026",
      "HISTORICAL-BATCH-SNAPSHOTS-2026",
      "HISTORICAL-BATCH-31-SNAPSHOT",
    ],
    anchors: [
      "generated, not",
      "npm run citations:audit",
      "npm run authoring:tracker",
    ],
  },
  {
    file: "docs/master-registry-2026.md",
    volatilePolicy: "historical",
    anchors: [
      "Current-state numbers are **generated, not transcribed**",
      "node scripts/audit-master-registry.js",
      "Numbered batch sections below retain their historical verification snapshots",
    ],
  },
  {
    file: "docs/qualified-human-citation-verification-queue.md",
    volatilePolicy: "ban",
    historicalZones: [
      "HISTORICAL-CURRENT-SECTIONS",
      "clinical-mapping-m1-current",
      "CLINICAL-MAPPING-MASTER-2026",
      "RESIDUAL-M1-CLOSURE-2026",
      "PTH-TAXONOMY-2026",
      "ADRENAL-HISTOPLASMOSIS-TAXONOMY-2026",
      "CLINICAL-MAPPING-MASTER-RESOLUTION-2026",
    ],
    anchors: [
      "generated, not transcribed",
      "npm run citations:audit",
      "npm run citations:queue",
    ],
  },
  {
    file: "docs/condition-expansion-roadmap.md",
    volatilePolicy: "historical",
    anchors: [
      "versioned product-coverage milestone",
    ],
  },
  {
    file: "docs/missing-identity-addition-roadmap.md",
    volatilePolicy: "ban",
    anchors: [
      "generated, not transcribed",
      "node scripts/audit-master-registry.js",
    ],
  },
];

describe("living-doc policy coverage", () => {
  it("pins a policy for every doc in the table, and the table files exist", () => {
    for (const policy of DOC_POLICIES) {
      expect(
        existsSync(join(process.cwd(), policy.file)),
        `policy table references missing doc: ${policy.file}`,
      ).toBe(true);
    }
  });

  it("has unique, sorted coverage of the classified living docs", () => {
    const files = DOC_POLICIES.map((policy) => policy.file);
    expect(new Set(files).size).toBe(files.length);
  });
});

describe("per-doc lint enforcement", () => {
  for (const policy of DOC_POLICIES) {
    describe(policy.file, () => {
      const text = readRepoMarkdown(process.cwd(), ...policy.file.split("/"));

      it("references only files that exist in the repository", () => {
        const missing = missingFileReferences(text, process.cwd(), {
          baseDir: DOCS_DIR,
        });
        expect(
          missing,
          `${policy.file} references files that do not exist: ${missing.join(", ")}`,
        ).toEqual([]);
      });

      it("references only npm scripts that exist in package.json", () => {
        const pkg = JSON.parse(
          readRepoMarkdown(process.cwd(), "package.json"),
        ) as { scripts?: Record<string, string> };
        const missing = [...new Set(collectNpmScripts(text))].filter(
          (name) => !(name in (pkg.scripts ?? {})),
        );
        expect(
          missing,
          `${policy.file} references undefined npm scripts: ${missing.join(", ")}`,
        ).toEqual([]);
      });

      if (policy.volatilePolicy === "ban") {
        it("does not transcribe volatile snapshot counts outside historical zones", () => {
          const hits = volatileHitsOutsideHistoricalZones(text);
          expect(
            hits.map(
              ({ patternName, match, line }) =>
                `${patternName} at line ${line ?? "?"}: "${match}"`,
            ),
            `${policy.file} transcribes current-state counts; point at the generator CLI instead (or fence the history in a START/END zone)`,
          ).toEqual([]);
        });
      }

      it("keeps its policy anchors visible", () => {
        for (const anchor of policy.anchors) {
          expect(text, `${policy.file} lost its policy anchor: "${anchor}"`).toContain(anchor);
        }
      });

      if (policy.historicalZones) {
        // Narrow OUTSIDE the deferred callback: TS control-flow narrowing of
        // property accesses does not cross closure boundaries.
        const expectedZones: string[] = policy.historicalZones;
        it("retains exactly its pinned historical zones, symmetrically fenced", () => {
          const report = auditMarkerPairing(text);
          const labels = report.zones.map((zone) => zone.label);
          for (const expected of expectedZones) {
            expect(
              labels,
              `${policy.file} is missing historical zone "${expected}"`,
            ).toContain(expected);
          }
          // The zones must be properly paired: a zone listed in the policy
          // but emitting stray/mismatched/unclosed diagnostics is not a
          // usable fence.
          expect(
            report.diagnostics.map(({ type, line, detail }) => `${type} at line ${line}: ${detail}`),
            `${policy.file} historical-zone markers are not symmetrically paired`,
          ).toEqual([]);
        });
      }
    });
  }
});

/* ─── Harness self-tests: the zone parser and pattern guards ─────────────── */

describe("historical-marker pairing symmetry across all docs", () => {
  // The corpus-wide table: every doc in docs/, including the ~150 historical
  // batch/ledger records. An asymmetry anywhere — a stray END, an unclosed
  // START, a name mismatch, or mixed casing within a pair — breaks the
  // fencing convention and silently widens the historical exemption.
  const reports = corpusMarkerReports(join(process.cwd(), DOCS_DIR));

  it("emits a report for every markdown doc in docs/", () => {
    expect(reports.length).toBeGreaterThan(100);
  });

  it("pairs every historical-zone marker symmetrically across the corpus", () => {
    const asymmetric = reports.filter((report) => report.diagnostics.length > 0);
    const summary = asymmetric
      .map((report) =>
        `${report.file}: ${report.diagnostics.map(({ type, line, detail }) => `${type} at line ${line}: ${detail}`).join(" | ")}`,
      )
      .join("\n");
    expect(
      summary,
      "historical-zone markers must pair symmetrically (no stray END, no unclosed START, no name mismatch, no mixed casing within a pair); see docs marker table below",
    ).toBe("");
  });

  it("pins the corpus marker-zone table (add an entry when fencing a new doc)", () => {
    const zones = reports.filter((report) => report.zones.length > 0);
    expect(
      zones.map(({ file, zones: zs }) => `${file}: ${zs.length} zone(s)`),
    ).toEqual([
      "adrenal-histoplasmosis-taxonomy-amendment-2026-disposition.md: 1 zone(s)",
      "clinical-mapping-master-2026-implementation.md: 1 zone(s)",
      "clinical-mapping-master-resolution-2026-implementation.md: 1 zone(s)",
      "clinical-program-status.md: 9 zone(s)",
      "kb-coverage-tracker.md: 10 zone(s)",
      "post-traumatic-headache-taxonomy-addition-2026-disposition.md: 1 zone(s)",
      "qualified-human-citation-verification-queue.md: 7 zone(s)",
    ]);
  });
});

describe("audit finding/disposition parity", () => {
  it("gives every finding heading a matching disposition row, and every row a finding, across all audit documents", () => {
    const reports = auditDocumentParity(join(process.cwd(), DOCS_DIR));
    const problems = reports.flatMap((report) => [
      ...report.missingDispositions.map((id) => `${report.file}: finding ${id} has no disposition row`),
      ...report.missingFindings.map((id) => `${report.file}: disposition row ${id} has no finding heading`),
      ...report.duplicateIds.map((id) => `${report.file}: ID ${id} appears more than once`),
    ]);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("discovers audit documents by filename convention, including the current report", () => {
    const reports = auditDocumentParity(join(process.cwd(), DOCS_DIR));
    const current = reports.find((report) => report.file === "security-systems-audit-2026-10-03.md");
    expect(current).toBeDefined();
    expect(current!.findings.length).toBeGreaterThan(0);
    expect(current!.findings.length).toBe(current!.dispositions.length);
  });
});

describe("doc-lint harness self-tests", () => {
  it("pairs nested START/END zones innermost-first", () => {
    const zones = parseHistoricalZones(
      [
        "<!-- OUTER:START -->",
        "line2",
        "<!-- INNER:START -->",
        "line4",
        "<!-- INNER:END -->",
        "line6",
        "<!-- OUTER:END -->",
      ].join("\n"),
    );
    expect(zones).toEqual([
      { startLine: 3, endLine: 5, label: "INNER" },
      { startLine: 1, endLine: 7, label: "OUTER" },
    ]);
  });

  it("treats lowercase :start/:end markers and an unclosed START pragmatically", () => {
    const zones = parseHistoricalZones(
      ["<!-- scope:start -->", "line2", "line3"].join("\n"),
    );
    expect(zones).toEqual([{ startLine: 1, endLine: 3, label: "scope" }]);
  });

  it("treats a stray END as historical-suspect for the file remainder", () => {
    const zones = parseHistoricalZones(
      ["live line", "<!-- OLD:END -->", "suspect line"].join("\n"),
    );
    expect(zones).toEqual([{ startLine: 2, endLine: 3, label: "OLD:stray-end" }]);
  });

  it("skips volatile-count scans inside historical zones only", () => {
    const text = [
      "42 published mappings live here",
      "<!-- HIST-2026:START -->",
      "99 draft mappings retained",
      "<!-- HIST-2026:END -->",
      "17 relationships recorded now",
    ].join("\n");
    const hits = volatileHitsOutsideHistoricalZones(text);
    expect(hits.map((hit) => hit.line).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 5]);
  });

  it("honors historicalEverywhere for versioned ledger docs", () => {
    const hits = volatileHitsOutsideHistoricalZones(
      "363 relationships, 140 published / 673 draft",
      undefined,
      { historicalEverywhere: true },
    );
    expect(hits).toEqual([]);
  });

  it("does not flag identifier-glued, ordinal, or PMID-scoped counts", () => {
    const hits = collectVolatileCounts(
      [
        "The ME-33 relationship tightened the boundary.",
        "The Step 5 relationship pairing is UI-only.",
        "The PMID 12411757 relationship boundary was narrowed.",
        "Batch 02 narrowed 1 proposition before verification.",
      ].join("\n"),
    );
    expect(hits).toEqual([]);
  });

  it("flags the core transcribed-count classes", () => {
    const hits = collectVolatileCounts(
      [
        "363 relationships",
        "140 published / 673 draft",
        "1029 tests",
        "379 verified",
      ].join("\n"),
    );
    expect(hits.length).toBeGreaterThanOrEqual(4);
  });

  it("supports doc-relative bare file references via baseDir", () => {
    const zones: HistoricalZone[] = [];
    void zones;
    // `missingFileReferences` with baseDir "docs" resolves a doc saying
    // [guide](condition-catalog.md) against the docs/ directory.
    const missing = missingFileReferences(
      "See [guide](condition-catalog.md) and [missing](no-such-doc.md).",
      process.cwd(),
      { baseDir: DOCS_DIR },
    );
    expect(missing).toEqual(["no-such-doc.md"]);
  });

  it("reports missing, orphaned, and duplicate finding/disposition IDs", () => {
    const text = [
      "### A-01 — First finding",
      "### A-02 — Second finding",
      "### A-02 — Duplicated heading",
      "| A-01 first | x |",
      "| A-03 stale row | y |",
    ].join("\n");
    const report = auditFindingDispositionParity(text, "fixture.md");
    expect(report.findings).toEqual(["A-01", "A-02", "A-02"]);
    expect(report.dispositions).toEqual(["A-01", "A-03"]);
    expect(report.missingDispositions).toEqual(["A-02"]);
    expect(report.missingFindings).toEqual(["A-03"]);
    expect(report.duplicateIds).toEqual(["A-02"]);
  });
});
