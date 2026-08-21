import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type VerificationRow = { disposition: string };
type VerificationLedger = {
  ledgerStatus: string;
  rows: VerificationRow[];
  implementationResult: {
    rowsPromoted: number;
    kbVerifiedTruePromotions: number;
    masterActivePromotions: number;
    relationshipChanges: number;
    guardChanges: number;
    sourceIdentityChanges: number;
    remoteWritesPerformed: boolean;
  };
};
type ImplementationRow = {
  primaryId: string;
  targetId: string;
  pmid: string;
  citation: string;
  sourceUrl: string;
  publicationGuard: string;
};
type ImplementationLedger = { rows: ImplementationRow[] };
type SourceReference = {
  verified: boolean;
  verificationScope: string;
  citation: string;
  sourceUrl: string;
};
type Suggestion = {
  conditionId: string;
  rationale: string;
  evidenceGaps: string[];
  sourceReferences: SourceReference[];
};
type Mapping = { suggestions: Suggestion[] };
type MasterSource = {
  sourceId: string;
  status: string;
  verified: boolean;
  liveUsageCount: number;
};
type MasterSources = {
  counts: {
    activeSourceEntities: number;
    pendingVerificationSourceEntities: number;
    activeClinicalSourceEntities: number;
    pendingClinicalSourceEntities: number;
  };
  sources: MasterSource[];
};

const root = process.cwd();
const verificationLedger = JSON.parse(
  fs.readFileSync(
    path.join(root, "docs", "mapping-expansion-me3-citation-verification-approved-ledger.json"),
    "utf8",
  ),
) as VerificationLedger;
const implementationLedger = JSON.parse(
  fs.readFileSync(
    path.join(root, "docs", "mapping-expansion-me3-approved-implementation-ledger.json"),
    "utf8",
  ),
) as ImplementationLedger;
const sources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as MasterSources;

const load = (id: string): Mapping =>
  JSON.parse(
    fs.readFileSync(path.join(root, "data", "knowledge-base", `${id}.json`), "utf8"),
  ) as Mapping;

describe("Mapping Expansion Batch ME-3 Citation Verification", () => {
  it("records 5/5 approved-as-implemented qualified-human decisions", () => {
    expect(verificationLedger.ledgerStatus).toBe("APPROVED-AND-APPLIED-LOCALLY");
    expect(verificationLedger.rows).toHaveLength(5);
    expect(
      verificationLedger.rows.every((row) => row.disposition === "approve-as-implemented"),
    ).toBe(true);
    expect(verificationLedger.implementationResult).toEqual({
      rowsPromoted: 5,
      kbVerifiedTruePromotions: 5,
      masterActivePromotions: 5,
      relationshipChanges: 0,
      guardChanges: 0,
      sourceIdentityChanges: 0,
      remoteWritesPerformed: false,
    });
  });

  it("promotes exactly the five approved ME-3 KB references without changing citation/source identity or guards", () => {
    for (const row of implementationLedger.rows) {
      const mapping = load(row.primaryId);
      const suggestion = mapping.suggestions.find(
        (candidate) => candidate.conditionId === row.targetId,
      );
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ${row.primaryId}->${row.targetId}`);
      const reference = suggestion.sourceReferences[0];
      expect(reference.verified).toBe(true);
      expect(reference.verificationScope).toBe("clinical-evidence");
      expect(reference.citation).toBe(row.citation);
      expect(reference.sourceUrl).toBe(row.sourceUrl);
      expect(suggestion.rationale).toContain(row.publicationGuard);
      expect(
        suggestion.evidenceGaps.some((gap) => gap.includes(row.publicationGuard)),
      ).toBe(true);
    }
  });

  it("promotes the same five normalized master sources from pending-verification to active", () => {
    expect(sources.counts).toMatchObject({
      activeSourceEntities: 188,
      pendingVerificationSourceEntities: 5,
      activeClinicalSourceEntities: 187,
      pendingClinicalSourceEntities: 5,
    });
    for (const row of implementationLedger.rows) {
      const source = sources.sources.find(
        (candidate) => candidate.sourceId === `pmid-${row.pmid}`,
      );
      expect(source).toMatchObject({
        status: "active",
        verified: true,
        liveUsageCount: 1,
      });
    }
  });

  it("preserves all five ME-3 verified rows after ME-6 qualified-human citation verification", () => {
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
      references: 216,
      verified: 211,
      retiredVerified: 6,
      verifiedProvenance: 217,
      unverified: 5,
      reviewFindingCount: 5,
      hardFindingCount: 0,
    });
  });

  it("passes the authoritative final master-registry parity audit", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as {
      status: string;
      verifiedLiveSourceUses: number;
      pendingVerificationLiveSourceUses: number;
      activeSourceEntities: number;
    };
    expect(result).toMatchObject({
      status: "PASS",
      verifiedLiveSourceUses: 211,
      pendingVerificationLiveSourceUses: 5,
      activeSourceEntities: 188,
    });
  });
});
