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

const VERIFIED_UVEITIS_GUARD = "Require documented noninfectious anterior uveitis and separately established cataract in the affected eye. Do not infer cataract from uveitis alone. Preserve age, inflammation severity, corticosteroid exposure, prior ocular surgery, glaucoma treatment, and other cataract contributors.";

const root = process.cwd();
const kbDir = path.join(root, "data", "knowledge-base");
const ledger = JSON.parse(
  fs.readFileSync(path.join(root, "docs", "mapping-expansion-me4-approved-implementation-ledger.json"), "utf8"),
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
  sources: Array<{ sourceId: string; status: string; verified: boolean; liveUsageCount: number }>;
};

const load = (id: string): Mapping =>
  JSON.parse(fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8")) as Mapping;

describe("Mapping Expansion Batch ME-4", () => {
  it("records exactly five locally implemented relationships without citation promotion", () => {
    expect(ledger.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(ledger.rows).toHaveLength(5);
    expect(ledger.implementationResult).toMatchObject({
      relationshipEdgesAdded: 5,
      sourceRowsAdded: 5,
      sourceRowsVerified: 0,
      pendingMasterSourcesAdded: 5,
      remoteWritesPerformed: false,
      individualCausationClaimed: false,
    });
  });

  it("preserves each implemented ME-4 row at rank 2 while current citation verification is applied", () => {
    for (const row of ledger.rows) {
      const mapping = load(row.primaryId);
      expect(mapping.draft).toBe(false);
      const suggestion = (mapping.suggestions ?? []).find(
        (candidate) => candidate.conditionId === row.targetId,
      );
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ME-4 row ${row.primaryId}->${row.targetId}`);
      expect(suggestion.rank).toBe(2);
      expect(suggestion.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestion.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(suggestion.pathwayIntelligence).toBeUndefined();
      expect(suggestion.sourceReferences).toHaveLength(1);
      const source = suggestion.sourceReferences?.[0];
      expect(source?.verified).toBe(true);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.citation).toBe(row.citation);
      expect(source?.sourceUrl).toBe(row.sourceUrl);
      expect(suggestion.rationale).toContain(row.primaryId === "uveitis" ? VERIFIED_UVEITIS_GUARD : row.publicationGuard);
      expect(
        suggestion.evidenceGaps?.some((gap) => gap.includes(row.primaryId === "uveitis" ? VERIFIED_UVEITIS_GUARD : row.publicationGuard)),
      ).toBe(true);
    }
  });

  it("preserves the same five relationship/source identities after citation verification", () => {
    for (const row of ledger.rows) {
      const rid = `rel-${row.primaryId}-to-${row.targetId}`;
      const relationship = relRegistry.relationships.find(
        (candidate) => candidate.relationshipId === rid,
      );
      expect(relationship).toMatchObject({
        primaryId: row.primaryId,
        targetId: row.targetId,
        rank: 2,
        sourceIds: [`pmid-${row.pmid}`],
      });
      expect(relationship?.publicationGuard.status).toBe("explicit");
      expect(relationship?.publicationGuard.structuredGuardText).toBe(row.primaryId === "uveitis" ? VERIFIED_UVEITIS_GUARD : row.publicationGuard);

      const source = srcRegistry.sources.find(
        (candidate) => candidate.sourceId === `pmid-${row.pmid}`,
      );
      expect(source).toMatchObject({
        status: "active",
        verified: true,
        liveUsageCount: 1,
      });
    }
  });

  it("preserves ME-4 rows while current state advances to fully verified ME-6", () => {
    const files = fs.readdirSync(kbDir).filter((name) => name.endsWith(".json"));
    const mappings = files.map((name) =>
      JSON.parse(fs.readFileSync(path.join(kbDir, name), "utf8")) as Mapping,
    );
    expect(files).toHaveLength(813);
    expect(mappings.filter((mapping) => mapping.draft === false)).toHaveLength(140);
    expect(mappings.filter((mapping) => mapping.draft === true)).toHaveLength(673);
    expect(mappings.reduce((sum, mapping) => sum + (mapping.suggestions ?? []).length, 0)).toBe(861);
    expect(
      mappings.filter((mapping) => mapping.draft === false && (mapping.suggestions ?? []).length === 1),
    ).toHaveLength(67);
    expect(
      mappings.filter((mapping) => mapping.draft === false && (mapping.suggestions ?? []).length >= 2),
    ).toHaveLength(73);
    const refs = mappings.flatMap((mapping) =>
      (mapping.suggestions ?? []).flatMap((suggestion) => suggestion.sourceReferences ?? []),
    );
expect(refs).toHaveLength(1666);
    expect(refs.filter((ref) => ref.verified === true)).toHaveLength(384);
expect(refs.filter((r) => r.verified === false)).toHaveLength(1282);
  });

  it("passes citation and master-registry gates after ME-7 verification", { timeout: 30_000 }, () => {
    const citationOutput = execFileSync("npm", ["run", "citations:audit"], {
      cwd: root,
      encoding: "utf8",
    });
    const citation = JSON.parse(citationOutput.slice(citationOutput.indexOf("{"))) as {
      references: number;
      verified: number;
      verifiedProvenance: number;
      unverified: number;
      reviewFindingCount: number;
      hardFindingCount: number;
    };
    expect(citation).toMatchObject({
      references: 1666,
      verified: 384,
      verifiedProvenance: 390,
      unverified: 1282,
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
      pendingVerificationSourceEntities: number;
    };
    expect(master).toMatchObject({
      status: "PASS",
      relationships: 861,
      pendingVerificationSourceEntities: 1105,
    });
  });
});
