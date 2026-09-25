import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Row = {
  primaryId: string;
  currentTargetId: string;
  targetId: string;
  pmid: string;
  doi: string;
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
  citation: string;
  sourceUrl: string;
  verified: boolean;
  verificationScope: string;
};
type Suggestion = {
  conditionId: string;
  rank: number;
  nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined;
  rationale: string;
  evidenceGaps: string[];
  pathwayIntelligence?: unknown;
  sourceReferences: SourceReference[];
};
type Mapping = { draft: boolean; suggestions: Suggestion[] };

const root = process.cwd();
const kbDir = path.join(root, "data", "knowledge-base");
const ledger = JSON.parse(
  fs.readFileSync(path.join(root, "docs", "mapping-expansion-me5-approved-implementation-ledger.json"), "utf8"),
) as Ledger;
const relRegistry = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-relationships.json"), "utf8"),
) as {
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
const srcRegistry = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as {
  sources: Array<{
    sourceId: string;
    status: string;
    verified: boolean;
    liveUsageCount: number;
    pmid?: string;
    doi?: string;
  }>;
};

const load = (id: string): Mapping =>
  JSON.parse(fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8")) as Mapping;

describe("Mapping Expansion Batch ME-5", () => {
  it("records exactly five locally implemented relationships without citation promotion", () => {
    expect(ledger.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(ledger.rows).toHaveLength(5);
    expect(ledger.implementationResult).toEqual({
      relationshipEdgesAdded: 5,
      sourceRowsAdded: 5,
      sourceRowsVerified: 0,
      pendingMasterSourcesAdded: 5,
      remoteWritesPerformed: false,
      individualCausationClaimed: false,
    });
  });

  it("preserves each approved row at rank 2 with the exact guard after citation verification", () => {
    for (const row of ledger.rows) {
      const mapping = load(row.primaryId);
      expect(mapping.draft).toBe(false);
      const suggestion = mapping.suggestions.find((candidate) => candidate.conditionId === row.targetId);
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ME-5 row ${row.primaryId}->${row.targetId}`);
      expect(suggestion.rank).toBe(2);
      expect(suggestion.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestion.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(suggestion.pathwayIntelligence).toBeUndefined();
      expect(suggestion.rationale).toContain(row.publicationGuard);
      expect(suggestion.evidenceGaps.some((gap) => gap.includes(row.publicationGuard))).toBe(true);
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]).toMatchObject({
        verified: true,
        verificationScope: "clinical-evidence",
        citation: row.citation,
        sourceUrl: row.sourceUrl,
      });
    }
  });

  it("preserves the same five relationships and source identities after citation verification", () => {
    for (const row of ledger.rows) {
      const rid = `rel-${row.primaryId}-to-${row.targetId}`;
      const relationship = relRegistry.relationships.find((candidate) => candidate.relationshipId === rid);
      expect(relationship).toMatchObject({
        primaryId: row.primaryId,
        targetId: row.targetId,
        rank: 2,
        sourceIds: [`pmid-${row.pmid}`],
      });
      expect(relationship?.publicationGuard).toMatchObject({
        status: "explicit",
        structuredGuardText: row.publicationGuard,
      });

      const source = srcRegistry.sources.find((candidate) => candidate.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({
        status: "active",
        verified: true,
        liveUsageCount: 1,
        pmid: row.pmid,
        doi: row.doi,
      });
    }
  });

  it("preserves verified ME-5 rows while the current state advances to fully verified ME-6", () => {
    const files = fs.readdirSync(kbDir).filter((name) => name.endsWith(".json"));
    const mappings = files.map((name) =>
      JSON.parse(fs.readFileSync(path.join(kbDir, name), "utf8")) as Mapping,
    );
    expect(files).toHaveLength(813);
    expect(mappings.filter((mapping) => mapping.draft === false)).toHaveLength(140);
    expect(mappings.filter((mapping) => mapping.draft === true)).toHaveLength(673);
    expect(mappings.reduce((sum, mapping) => sum + mapping.suggestions.length, 0)).toBe(596);
    expect(mappings.filter((mapping) => mapping.draft === false && mapping.suggestions.length === 1)).toHaveLength(67);
    expect(mappings.filter((mapping) => mapping.draft === false && mapping.suggestions.length >= 2)).toHaveLength(73);

    const refs = mappings.flatMap((mapping) =>
      mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []),
    );
expect(refs).toHaveLength(982);
    expect(refs.filter((ref) => ref.verified === true)).toHaveLength(383);
expect(refs.filter((r) => r.verified === false)).toHaveLength(599);
  });

  it("passes citation and master-registry gates after ME-7 verification", { timeout: 30_000 }, () => {
    const citationOutput = execFileSync("npm", ["run", "citations:audit"], {
      cwd: root,
      encoding: "utf8",
    });
    const citation = JSON.parse(citationOutput.slice(citationOutput.indexOf("{"))) as {
      references: number;
      verified: number;
      retiredVerified: number;
      verifiedProvenance: number;
      unverified: number;
      reviewFindingCount: number;
      hardFindingCount: number;
    };
    expect(citation).toMatchObject({
      references: 982,
      verified: 383,
      retiredVerified: 6,
      verifiedProvenance: 389,
      unverified: 599,
      reviewFindingCount: 0,
      hardFindingCount: 0,
    });

    const masterOutput = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const master = JSON.parse(masterOutput) as {
      status: string;
      relationships: number;
      verifiedLiveSourceUses: number;
      pendingVerificationLiveSourceUses: number;
      activeSourceEntities: number;
      pendingVerificationSourceEntities: number;
    };
    expect(master).toMatchObject({
      status: "PASS",
      relationships: 596,
      verifiedLiveSourceUses: 383,
      pendingVerificationLiveSourceUses: 599,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 548,
    });
  });
});
