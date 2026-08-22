import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type VerificationRow = {
  primaryId: string;
  targetId: string;
  pmid: string;
  citation: string;
  sourceUrl: string;
  disposition: string;
  implementationPublicationGuard: string;
  verifiedPublicationGuard: string;
};
type VerificationLedger = {
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
type SourceReference = {
  verified: boolean;
  citation: string;
  sourceUrl: string;
  sourceLocator?: string;
};
type Suggestion = {
  conditionId: string;
  rationale: string;
  evidenceGaps: string[];
  sourceReferences: SourceReference[];
};
type Mapping = { suggestions: Suggestion[] };

const root = process.cwd();
const ledger = JSON.parse(
  fs.readFileSync(
    path.join(root, "docs", "mapping-expansion-me4-citation-verification-approved-ledger.json"),
    "utf8",
  ),
) as VerificationLedger;
const masterRelationships = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-relationships.json"), "utf8"),
) as {
  relationships: Array<{
    relationshipId: string;
    publicationGuard: { structuredGuardText: string | null };
  }>;
};
const masterSources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as {
  sources: Array<{
    sourceId: string;
    status: string;
    verified: boolean;
    pmid?: string;
    verificationState?: { qualifiedHumanCitationReviewDecision?: string };
  }>;
};

const load = (id: string): Mapping =>
  JSON.parse(
    fs.readFileSync(path.join(root, "data", "knowledge-base", `${id}.json`), "utf8"),
  ) as Mapping;

describe("Mapping Expansion Batch ME-4 Qualified-Human Citation Verification", () => {
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

  it("promotes all five KB references and applies only the approved uveitis narrowing", () => {
    for (const row of ledger.rows) {
      const mapping = load(row.primaryId);
      const suggestion = mapping.suggestions.find(
        (candidate) => candidate.conditionId === row.targetId,
      );
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ${row.primaryId}->${row.targetId}`);
      const reference = suggestion.sourceReferences[0];
      expect(reference.verified).toBe(true);
      expect(reference.citation).toBe(row.citation);
      expect(reference.sourceUrl).toBe(row.sourceUrl);
      expect(suggestion.rationale).toContain(row.verifiedPublicationGuard);
      expect(
        suggestion.evidenceGaps.some((gap) => gap.includes(row.verifiedPublicationGuard)),
      ).toBe(true);

      if (row.disposition === "approve-with-narrowing") {
        expect(row.primaryId).toBe("uveitis");
        expect(suggestion.rationale).not.toContain(
          "or a clinically comparable anterior-inflammatory phenotype",
        );
        expect(reference.sourceLocator).toContain(row.verifiedPublicationGuard);
      } else {
        expect(row.disposition).toBe("approve-as-implemented");
        expect(row.verifiedPublicationGuard).toBe(row.implementationPublicationGuard);
      }
    }
  });

  it("promotes the same five source identities to active with the approved decisions", () => {
    for (const row of ledger.rows) {
      const source = masterSources.sources.find(
        (candidate) => candidate.sourceId === `pmid-${row.pmid}`,
      );
      expect(source).toMatchObject({
        status: "active",
        verified: true,
        pmid: row.pmid,
      });
      expect(source?.verificationState?.qualifiedHumanCitationReviewDecision).toBe(
        row.disposition,
      );
    }
  });

  it("pins the narrowed uveitis publication guard without changing source identity", () => {
    const relationship = masterRelationships.relationships.find(
      (row) => row.relationshipId === "rel-uveitis-to-cataracts",
    );
    expect(relationship?.publicationGuard.structuredGuardText).toBe(
      "Require documented noninfectious anterior uveitis and separately established cataract in the affected eye. Do not infer cataract from uveitis alone. Preserve age, inflammation severity, corticosteroid exposure, prior ocular surgery, glaucoma treatment, and other cataract contributors.",
    );
    const source = masterSources.sources.find(
      (row) => row.sourceId === "pmid-37414328",
    );
    expect(source?.pmid).toBe("37414328");
  });

  it("preserves the verified ME-4 citations after ME-7 qualified-human citation verification", () => {
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
      references: 251,
      verified: 251,
      retiredVerified: 6,
      verifiedProvenance: 257,
      unverified: 0,
      reviewFindingCount: 0,
      hardFindingCount: 0,
    });
  });

  it("passes the authoritative registry audit after ME-7 verification", () => {
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
    };
    expect(result).toMatchObject({
      status: "PASS",
      relationships: 243,
      verifiedLiveSourceUses: 251,
      pendingVerificationLiveSourceUses: 0,
      activeSourceEntities: 228,
      pendingVerificationSourceEntities: 0,
    });
  });
});
