import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type VerificationRow = {
  primaryId: string;
  targetId: string;
  pmid: string;
  doi: string;
  citation: string;
  sourceUrl: string;
  publicationGuard: string;
  disposition: string;
};
type Ledger = {
  ledgerStatus: string;
  summary: {
    approveAsImplemented: number;
    approveWithNarrowing: number;
    replaceSource: number;
    rejectWithdraw: number;
    rows: number;
  };
  implementationResult: {
    rowsPromoted: number;
    kbVerifiedTruePromotions: number;
    masterActivePromotions: number;
    relationshipChanges: number;
    guardChanges: number;
    sourceIdentityChanges: number;
    remoteWritesPerformed: boolean;
  };
  rows: VerificationRow[];
};
type Ref = { verified: boolean; citation: string; sourceUrl: string };
type Suggestion = {
  conditionId: string;
  rank: number;
  nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined;
  rationale: string;
  evidenceGaps: string[];
  sourceReferences: Ref[];
};
type Mapping = { suggestions: Suggestion[] };

const root = process.cwd();
const ledger = JSON.parse(
  fs.readFileSync(path.join(root, "docs", "mapping-expansion-me5-citation-verification-approved-ledger.json"), "utf8"),
) as Ledger;
const relationships = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-relationships.json"), "utf8"),
) as {
  relationships: Array<{
    relationshipId: string;
    publicationGuard: { structuredGuardText: string | null };
  }>;
};
const sources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as {
  sources: Array<{
    sourceId: string;
    status: string;
    verified: boolean;
    pmid?: string;
    doi?: string;
    verificationState?: {
      qualifiedHumanCitationReviewRequired?: boolean;
      qualifiedHumanCitationReviewDecision?: string;
    };
  }>;
};

const load = (id: string): Mapping =>
  JSON.parse(
    fs.readFileSync(path.join(root, "data", "knowledge-base", `${id}.json`), "utf8"),
  ) as Mapping;

describe("Mapping Expansion Batch ME-5 Qualified-Human Citation Verification", () => {
  it("records exactly 5 as-implemented / 0 narrowed / 0 replacement / 0 reject", () => {
    expect(ledger.ledgerStatus).toBe("APPROVED-AND-APPLIED-LOCALLY");
    expect(ledger.summary).toEqual({
      approveAsImplemented: 5,
      approveWithNarrowing: 0,
      replaceSource: 0,
      rejectWithdraw: 0,
      rows: 5,
    });
    expect(ledger.implementationResult).toEqual({
      rowsPromoted: 5,
      kbVerifiedTruePromotions: 5,
      masterActivePromotions: 5,
      relationshipChanges: 0,
      guardChanges: 0,
      sourceIdentityChanges: 0,
      remoteWritesPerformed: false,
    });
  });

  it("promotes all five KB references without changing proposition text or guards", () => {
    for (const row of ledger.rows) {
      expect(row.disposition).toBe("approve-as-implemented");
      const mapping = load(row.primaryId);
      const suggestion = mapping.suggestions.find((candidate) => candidate.conditionId === row.targetId);
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ME-5 row ${row.primaryId}->${row.targetId}`);
      expect(suggestion.rank).toBe(2);
      expect(suggestion.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestion.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(suggestion.rationale).toContain(row.publicationGuard);
      expect(suggestion.evidenceGaps.some((gap) => gap.includes(row.publicationGuard))).toBe(true);
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]).toMatchObject({
        verified: true,
        citation: row.citation,
        sourceUrl: row.sourceUrl,
      });

      const relationship = relationships.relationships.find(
        (candidate) => candidate.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`,
      );
      expect(relationship?.publicationGuard.structuredGuardText).toBe(row.publicationGuard);
    }
  });

  it("promotes the same five source identities to active with approve-as-implemented decisions", () => {
    for (const row of ledger.rows) {
      const source = sources.sources.find((candidate) => candidate.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({
        status: "active",
        verified: true,
        pmid: row.pmid,
        doi: row.doi,
      });
      expect(source?.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
      });
    }
  });

  it("preserves the five verified ME-5 sources after ME-7 qualified-human citation verification", () => {
    const output = execFileSync("npm", ["run", "citations:audit"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output.slice(output.indexOf("{"))) as {
      references: number;
      verified: number;
      retiredVerified: number;
      verifiedProvenance: number;
      unverified: number;
      reviewFindingCount: number;
      hardFindingCount: number;
    };
    expect(result).toMatchObject({
      references: 1690,
      verified: 395,
      retiredVerified: 6,
      verifiedProvenance: 401,
      unverified: 1295,
      reviewFindingCount: 0,
      hardFindingCount: 0,
    });
  }, 120000);

  it("passes master-registry parity after ME-7 verification", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as {
      status: string;
      relationships: number;
      verifiedLiveSourceUses: number;
      pendingVerificationLiveSourceUses: number;
      activeSourceEntities: number;
      pendingVerificationSourceEntities: number;
      activeClinicalSourceEntities: number;
      pendingClinicalSourceEntities: number;
    };
    expect(result).toMatchObject({
      status: "PASS",
      relationships: 870,
      verifiedLiveSourceUses: 395,
      pendingVerificationLiveSourceUses: 1295,
      activeSourceEntities: 357,
      pendingVerificationSourceEntities: 1117,
      activeClinicalSourceEntities: 356,
      pendingClinicalSourceEntities: 1117,
    });
  });
});
