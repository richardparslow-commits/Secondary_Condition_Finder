import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * Regression contracts for the ME approval-ledger join in
 * `scripts/audit-me-compliance.js` — the `me` half of the CI gate named
 * "Audit ME / CRG compliance", documented as auditing every ME relationship.
 *
 * The gate used to answer a weaker question than its name. It read only
 * `ledger.rows`, so the fourteen ledgers that number their approvals under
 * `relationships`/`mappings` were invisible; it skipped an unparsable ledger
 * with `catch { continue; }`, so the ME-20 ledger's committed JSON (a raw
 * newline inside a string) removed a whole approved batch from the audit; and
 * its join was one-way, so an approved relationship that vanished from the
 * corpus simply lowered `meRelationshipsPresent` from 120 to 119 across
 * 2026-09-13 → 2026-10-09 without anything failing. 15 of 39 ledgers and 71 of
 * 191 approved relationships were unaudited while the gate stayed green.
 *
 * These cases pin the repaired contract: every shape is read, an unreadable or
 * unrecognized ledger fails closed, and a declared-but-absent approved
 * relationship is reported unless it is named in the exact-pair allowance.
 */

const requireCjs = createRequire(import.meta.url);
const meAudit = requireCjs("../scripts/audit-me-compliance.js") as {
  LEDGER_PAIR_KEYS: string[];
  ME_LEDGER_ABSENT_ALLOWLIST: Set<string>;
  readLedgerPairs: (ledger: unknown) => {
    recognized: { key: string; rows: unknown[] }[];
    unrecognized: { key: string; count: number }[];
  };
  loadMeLedgerPairs: (options?: { rootDir?: string }) => {
    ledgers: { ledger: string; file: string; shapes: string[]; rows: { pair: string; shape: string }[] }[];
    violations: { ledger: string; rule: string; message: string }[];
  };
  liveCorpusPairs: (kbDir?: string) => Map<string, string>;
  joinMeLedgersToCorpus: (
    ledgers: unknown[],
    livePairs: Map<string, string>,
  ) => {
    present: { ledger: string; pair: string }[];
    absent: { ledger: string; pair: string }[];
    uniquePairs: number;
  };
  classifyAbsentRelationships: (
    absent: { ledger: string; pair: string }[],
    allowlist?: Set<string>,
  ) => { allowlisted: { ledger: string; pair: string }[]; unexpected: { ledger: string; pair: string }[] };
  isPairRow: (row: unknown) => boolean;
};

const ROOT = process.cwd();
const tempDirs: string[] = [];

function fixtureDir(files: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-ledger-join-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("ME ledger shape extraction", () => {
  it("reads approved rows from every shape the batches actually use", () => {
    const { recognized, unrecognized } = meAudit.readLedgerPairs({
      rows: [{ primaryId: "a", targetId: "b" }],
      relationships: [{ primaryId: "c", targetId: "d" }],
      mappings: [{ primaryId: "e", targetId: "f" }],
    });

    expect(recognized.map((entry) => entry.key)).toEqual(["rows", "relationships", "mappings"]);
    expect(recognized.map((entry) => entry.rows.length)).toEqual([1, 1, 1]);
    expect(unrecognized).toEqual([]);
    // The gate's own key list is the contract; a key added to one side only
    // would let a batch's approvals be read by nothing.
    expect(meAudit.LEDGER_PAIR_KEYS).toEqual(["rows", "relationships", "mappings"]);
  });

  it("reports pair rows held under a key the audit does not recognize", () => {
    const { recognized, unrecognized } = meAudit.readLedgerPairs({
      relationships: [{ primaryId: "a", targetId: "b" }],
      entries: [{ primaryId: "c", targetId: "d" }, { primaryId: "e", targetId: "f" }],
    });

    expect(recognized.map((entry) => entry.key)).toEqual(["relationships"]);
    expect(unrecognized).toEqual([{ key: "entries", count: 2 }]);
  });

  it("does not treat a malformed row as an approved relationship", () => {
    expect(meAudit.isPairRow({ primaryId: "a", targetId: "b" })).toBe(true);
    expect(meAudit.isPairRow({ primaryId: "a" })).toBe(false);
    expect(meAudit.isPairRow({ primaryId: "a", targetId: 7 })).toBe(false);
    expect(meAudit.isPairRow(["a", "b"])).toBe(false);
    expect(meAudit.isPairRow(null)).toBe(false);
  });
});

describe("ME ledger loading fails closed", () => {
  it("reads every implementation ledger and ignores the other ledger kinds", () => {
    const dir = fixtureDir({
      "mapping-expansion-me7-approved-implementation-ledger.json": {
        rows: [{ primaryId: "a", targetId: "b" }],
      },
      "mapping-expansion-me8-approved-implementation-ledger.json": {
        relationships: [{ primaryId: "c", targetId: "d" }],
      },
      "mapping-expansion-me8-citation-verification-approved-ledger.json": {
        relationships: [{ primaryId: "ignored", targetId: "ignored" }],
      },
      "notes.json": { rows: [{ primaryId: "ignored", targetId: "ignored" }] },
    });

    const { ledgers, violations } = meAudit.loadMeLedgerPairs({ rootDir: dir });

    expect(violations).toEqual([]);
    expect(ledgers.map((ledger) => ledger.ledger)).toEqual(["ME7", "ME8"]);
    expect(ledgers.map((ledger) => ledger.rows.map((row) => row.pair))).toEqual([
      ["a->b"],
      ["c->d"],
    ]);
  });

  it("refuses an unparsable ledger instead of skipping the whole batch", () => {
    // The exact defect the ME-20 ledger shipped with: a raw newline inside a
    // JSON string, which `JSON.parse` rejects.
    const broken = '{"rows":[{"primaryId":"a","targetId":"b","note":"line one\nline two"}]}';
    const dir = fixtureDir({
      "mapping-expansion-me20-approved-implementation-ledger.json": broken,
    });

    const { ledgers, violations } = meAudit.loadMeLedgerPairs({ rootDir: dir });

    expect(ledgers).toEqual([]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe("ME-LEDGER-UNREADABLE");
    expect(violations[0]!.ledger).toBe("ME20");
    expect(violations[0]!.message).toContain("is not valid JSON");
    expect(violations[0]!.message).toContain("fails closed instead of skipping it");
  });

  it("refuses a ledger whose approvals are stored under an unknown shape", () => {
    const dir = fixtureDir({
      "mapping-expansion-me40-approved-implementation-ledger.json": {
        entries: [{ primaryId: "a", targetId: "b" }],
      },
    });

    const { ledgers, violations } = meAudit.loadMeLedgerPairs({ rootDir: dir });

    expect(ledgers).toEqual([]);
    expect(violations).toHaveLength(2);
    expect(violations.map((entry) => entry.rule)).toEqual(["ME-LEDGER-SHAPE", "ME-LEDGER-SHAPE"]);
    expect(violations[0]!.message).toContain('under "entries"');
    expect(violations[1]!.message).toContain("declares no approved relationship rows");
  });

  it("treats a ledger of malformed rows as unattributable rather than empty", () => {
    const dir = fixtureDir({
      "mapping-expansion-me41-approved-implementation-ledger.json": {
        rows: [{ primaryId: "a" }, { targetId: "b" }],
      },
    });

    const { ledgers, violations } = meAudit.loadMeLedgerPairs({ rootDir: dir });

    expect(ledgers).toEqual([]);
    expect(violations.map((entry) => entry.rule)).toEqual(["ME-LEDGER-SHAPE"]);
  });

  it("reports an unreadable ledger directory instead of passing vacuously", () => {
    const { ledgers, violations } = meAudit.loadMeLedgerPairs({
      rootDir: path.join(os.tmpdir(), `me-ledger-missing-${process.pid}-${Date.now()}`),
    });

    expect(ledgers).toEqual([]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe("ME-LEDGER-UNREADABLE");
  });
});

describe("ME ledger join is two-way", () => {
  function ledger(rows: { pair: string }[]) {
    return { ledger: "ME99", file: "fixture.json", shapes: ["rows"], rows };
  }

  it("separates declared relationships that are present from those that are not", () => {
    const joined = meAudit.joinMeLedgersToCorpus(
      [ledger([{ pair: "a->b" }, { pair: "c->d" }])],
      new Map([["a->b", "a.json"]]),
    );

    expect(joined.present).toHaveLength(1);
    expect(joined.absent.map((row) => row.pair)).toEqual(["c->d"]);
    expect(joined.uniquePairs).toBe(2);
  });

  it("allows only the named absence, never an equal number of a different one", () => {
    const allowlist = new Set(["ME17 tinnitus->depressive-disorder"]);

    const allowed = meAudit.classifyAbsentRelationships(
      [{ ledger: "ME17", pair: "tinnitus->depressive-disorder" }],
      allowlist,
    );
    expect(allowed.allowlisted).toHaveLength(1);
    expect(allowed.unexpected).toEqual([]);

    // One approved relationship swapped for another must not pass on the
    // strength of the allowance: the allowance is an exact pair.
    const swapped = meAudit.classifyAbsentRelationships(
      [{ ledger: "ME17", pair: "tinnitus->insomnia" }],
      allowlist,
    );
    expect(swapped.allowlisted).toEqual([]);
    expect(swapped.unexpected.map((row) => row.pair)).toEqual(["tinnitus->insomnia"]);

    // An equal-sized absence in another batch is likewise not covered.
    const otherBatch = meAudit.classifyAbsentRelationships(
      [{ ledger: "ME31", pair: "tinnitus->depressive-disorder" }],
      allowlist,
    );
    expect(otherBatch.unexpected).toHaveLength(1);
  });

  it("reads the authored corpus as primary->target pairs", () => {
    const dir = fixtureDir({
      "data/knowledge-base/alpha.json": { id: "alpha", suggestions: [{ conditionId: "beta" }] },
      "data/knowledge-base/sub/graph.json": { nodeId: "x", outgoingEdges: [] },
    });

    const pairs = meAudit.liveCorpusPairs(path.join(dir, "data/knowledge-base"));

    expect([...pairs.keys()]).toEqual(["alpha->beta"]);
  });
});

describe("ME ledger join over the live corpus", () => {
  const { ledgers, violations } = meAudit.loadMeLedgerPairs({ rootDir: path.join(ROOT, "docs") });
  const joined = meAudit.joinMeLedgersToCorpus(
    ledgers,
    meAudit.liveCorpusPairs(path.join(ROOT, "data", "knowledge-base")),
  );
  const absence = meAudit.classifyAbsentRelationships(joined.absent);
  const declared = ledgers.reduce((sum, entry) => sum + entry.rows.length, 0);

  it("audits every implementation ledger without an unreadable or unknown shape", () => {
    expect(violations).toEqual([]);
    expect(ledgers).toHaveLength(39);
    // All three historical shapes are in use, which is exactly why reading only
    // `rows` left 66 approvals unaudited.
    expect([...new Set(ledgers.flatMap((entry) => entry.shapes))].sort()).toEqual([
      "mappings",
      "relationships",
      "rows",
    ]);
  });

  it("parses the ME-20 ledger that shipped as invalid JSON", () => {
    const me20 = ledgers.find((entry) => entry.ledger === "ME20");
    expect(me20, "the ME-20 approval ledger must be readable").toBeDefined();
    expect(me20!.rows).toHaveLength(5);
    for (const row of me20!.rows) {
      expect(joined.present.some((present) => present.pair === row.pair)).toBe(true);
    }
  });

  it("accounts for every declared approved relationship on both sides of the join", () => {
    expect(declared).toBe(191);
    expect(joined.present.length + joined.absent.length).toBe(declared);
    expect(joined.uniquePairs).toBeGreaterThan(0);
  });

  it("reports any absence the allowance does not name", () => {
    // The live contract: every approved relationship is in the corpus, except
    // the exact pairs recorded in ME_LEDGER_ABSENT_ALLOWLIST, each of which is
    // surfaced in the report rather than dropped from a count.
    expect(absence.unexpected).toEqual([]);
    for (const row of joined.absent) {
      expect(meAudit.ME_LEDGER_ABSENT_ALLOWLIST.has(`${row.ledger} ${row.pair}`)).toBe(true);
    }
  });
});
