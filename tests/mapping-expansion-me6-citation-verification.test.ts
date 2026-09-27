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
  implementationPublicationGuard: string;
  finalPublicationGuard: string;
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
    sourceReferenceSnapshotChanges: number;
    sourceIdentityChanges: number;
    remoteWritesPerformed: boolean;
  };
  rows: VerificationRow[];
};
type Ref = { verified: boolean; citation: string; sourceUrl: string; sourceLocator?: string };
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
  fs.readFileSync(path.join(root, "docs", "mapping-expansion-me6-citation-verification-approved-ledger.json"), "utf8"),
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
  JSON.parse(fs.readFileSync(path.join(root, "data", "knowledge-base", `${id}.json`), "utf8")) as Mapping;

describe("Mapping Expansion Batch ME-6 Qualified-Human Citation Verification", () => {
  it("records exactly 4 as-implemented / 1 narrowed / 0 replacement / 0 reject", () => {
    expect(ledger.ledgerStatus).toBe("APPROVED-AND-APPLIED-LOCALLY");
    expect(ledger.summary).toEqual({
      approveAsImplemented: 4,
      approveWithNarrowing: 1,
      replaceSource: 0,
      rejectWithdraw: 0,
      rows: 5,
    });
    expect(ledger.implementationResult).toEqual({
      rowsPromoted: 5,
      kbVerifiedTruePromotions: 5,
      masterActivePromotions: 5,
      relationshipChanges: 1,
      guardChanges: 1,
      sourceReferenceSnapshotChanges: 1,
      sourceIdentityChanges: 0,
      remoteWritesPerformed: false,
    });
  });

  it("promotes all five KB references and applies only the approved PMID 12411757 narrowing", () => {
    for (const row of ledger.rows) {
      const mapping = load(row.primaryId);
      const suggestion = mapping.suggestions.find((candidate) => candidate.conditionId === row.targetId);
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ME-6 row ${row.primaryId}->${row.targetId}`);
      expect(suggestion.rank).toBe(2);
      expect(suggestion.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestion.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(suggestion.rationale).toContain(row.finalPublicationGuard);
      expect(suggestion.evidenceGaps.some((gap) => gap.includes(row.finalPublicationGuard))).toBe(true);
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]).toMatchObject({
        verified: true,
        citation: row.citation,
        sourceUrl: row.sourceUrl,
      });
      if (row.disposition === "approve-with-narrowing") {
        expect(row.pmid).toBe("12411757");
        expect(row.finalPublicationGuard).not.toBe(row.implementationPublicationGuard);
        expect(suggestion.rationale).not.toContain(row.implementationPublicationGuard);
      } else {
        expect(row.disposition).toBe("approve-as-implemented");
        expect(row.finalPublicationGuard).toBe(row.implementationPublicationGuard);
      }

      const relationship = relationships.relationships.find(
        (candidate) => candidate.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`,
      );
      expect(relationship?.publicationGuard.structuredGuardText).toBe(row.finalPublicationGuard);
    }
  });

  it("promotes the same five source identities to active with the approved decisions", () => {
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
        qualifiedHumanCitationReviewDecision: row.disposition,
      });
    }
  });

  it("preserves the verified ME-6 sources in the final 216/216 ME-7 citation state", () => {
    const output = execFileSync("npm", ["run", "citations:audit"], { cwd: root, encoding: "utf8" });
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
      references: 1397,
      verified: 383,
      retiredVerified: 6,
      verifiedProvenance: 389,
      unverified: 1014,
      reviewFindingCount: 0,
      hardFindingCount: 0,
    });
  }, 120000);

  it("passes final master-registry parity with no pending source entities", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], { cwd: root, encoding: "utf8" });
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
      relationships: 769,
      verifiedLiveSourceUses: 383,
      pendingVerificationLiveSourceUses: 1014,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 890,
      activeClinicalSourceEntities: 345,
      pendingClinicalSourceEntities: 890,
    });
  });
});
