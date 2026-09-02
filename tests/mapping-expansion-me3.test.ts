import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Row = {
  primaryId: string;
  targetId: string;
  pmid: string;
  citation: string;
  sourceUrl: string;
  publicationGuard: string;
};
type Ledger = {
  ledgerStatus: string;
  implementationResult: {
    relationshipEdgesAdded: number;
    sourceRowsAdded: number;
    sourceRowsVerified: number;
    pendingMasterSourcesAdded: number;
    remoteWritesPerformed: boolean;
    individualCausationClaimed: boolean;
  };
  rows: Row[];
};
type SourceReference = {
  citation?: string;
  sourceUrl?: string;
  verified?: boolean;
  verificationScope?: string;
};
type Suggestion = {
  conditionId: string;
  rank: number;
  nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined;
  rationale?: string;
  evidenceGaps?: string[];
  pathwayIntelligence?: unknown;
  sourceReferences?: SourceReference[];
};
type Mapping = { draft: boolean; suggestions?: Suggestion[] };

const root = process.cwd();
const kbDir = path.join(root, "data", "knowledge-base");
const relPath = path.join(root, "data", "evidence", "master-relationships.json");
const srcPath = path.join(root, "data", "evidence", "master-sources.json");
const ledgerPath = path.join(root, "docs", "mapping-expansion-me3-approved-implementation-ledger.json");

const loadLedger = (): Ledger => JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Ledger;
const loadMapping = (id: string): Mapping =>
  JSON.parse(fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8")) as Mapping;
const contains = (value: unknown, needle: string): boolean => {
  if (typeof value === "string") return value.includes(needle);
  if (Array.isArray(value)) return value.some((item) => contains(item, needle));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => contains(item, needle));
  }
  return false;
};

describe("Mapping Expansion Batch ME-3", () => {
  it("records exactly five locally implemented relationships without citation promotion", () => {
    const ledger = loadLedger();
    expect(ledger.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(ledger.implementationResult).toMatchObject({
      relationshipEdgesAdded: 5,
      sourceRowsAdded: 5,
      sourceRowsVerified: 0,
      pendingMasterSourcesAdded: 5,
      remoteWritesPerformed: false,
      individualCausationClaimed: false,
    });
  });

  it("preserves each approved edge at rank 2 with its approved clinical source and exact guard after citation verification", () => {
    for (const row of loadLedger().rows) {
      const mapping = loadMapping(row.primaryId);
      expect(mapping.draft).toBe(false);
      const suggestion = (mapping.suggestions ?? []).find((s) => s.conditionId === row.targetId);
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ME-3 suggestion ${row.primaryId}->${row.targetId}`);
      expect(suggestion.rank).toBe(2);
      expect(suggestion.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestion.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(suggestion.pathwayIntelligence).toBeUndefined();
      expect(suggestion.sourceReferences).toHaveLength(1);
      const source = suggestion.sourceReferences?.[0];
      expect(source?.verified).toBe(true);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.citation).toBe(row.citation);
      expect(source?.sourceUrl).toBe(row.sourceUrl);
      expect(contains(suggestion, row.publicationGuard)).toBe(true);
    }
  });

  it("keeps KB and authoritative registry identity linkage intact after citation promotion", () => {
    const ledger = loadLedger();
    const relationships = JSON.parse(fs.readFileSync(relPath, "utf8")) as {
      relationships: Array<{
        relationshipId: string;
        primaryId: string;
        targetId: string;
        rank: number;
        nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined;
        sourceIds: string[];
        publicationGuard: { status: string; structuredGuardText: string | null };
      }>;
    };
    const sources = JSON.parse(fs.readFileSync(srcPath, "utf8")) as {
      sources: Array<{ sourceId: string; status: string; verified: boolean; liveUsageCount: number }>;
    };

    for (const row of ledger.rows) {
      const rid = `rel-${row.primaryId}-to-${row.targetId}`;
      const rel = relationships.relationships.find((r) => r.relationshipId === rid);
      expect(rel).toMatchObject({
        primaryId: row.primaryId,
        targetId: row.targetId,
        rank: 2,
        sourceIds: [`pmid-${row.pmid}`],
      });
      expect(rel?.publicationGuard.status).toBe("explicit");
      expect(rel?.publicationGuard.structuredGuardText).toBe(row.publicationGuard);

      const source = sources.sources.find((s) => s.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({
        status: "active",
        verified: true,
        liveUsageCount: 1,
      });
    }
  });

  it("preserves ME-3 rows while the current graph advances to the fully verified ME-6 state", () => {
    const files = fs.readdirSync(kbDir).filter((name) => name.endsWith(".json"));
    const mappings = files.map((name) =>
      JSON.parse(fs.readFileSync(path.join(kbDir, name), "utf8")) as Mapping,
    );
    expect(files).toHaveLength(813);
    expect(mappings.filter((m) => m.draft === false)).toHaveLength(139);
    expect(mappings.filter((m) => m.draft === true)).toHaveLength(674);
    expect(mappings.reduce((sum, m) => sum + (m.suggestions ?? []).length, 0)).toBe(263);
    expect(mappings.filter((m) => m.draft === false && (m.suggestions ?? []).length === 1)).toHaveLength(66);
    expect(mappings.filter((m) => m.draft === false && (m.suggestions ?? []).length >= 2)).toHaveLength(73);
    const refs = mappings.flatMap((m) => (m.suggestions ?? []).flatMap((s) => s.sourceReferences ?? []));
    expect(refs).toHaveLength(271);
    expect(refs.filter((r) => r.verified === true)).toHaveLength(256);
    expect(refs.filter((r) => r.verified === false)).toHaveLength(15);
  });

  it("passes the fail-closed master-registry parity audit after approved citation promotion", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as { status: string; pendingVerificationSourceEntities: number };
    expect(result.status).toBe("PASS");
    expect(result.pendingVerificationSourceEntities).toBe(15);
  });
});
