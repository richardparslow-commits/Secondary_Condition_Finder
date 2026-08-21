import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type PublicationGuard = {
  status: string;
  structuredGuardText: string | null;
  boundaryText?: string;
  structuredGuardReviewPending: boolean;
};
type RelationshipRow = {
  relationshipId: string;
  publicationGuard: PublicationGuard;
};
type RelationshipRegistry = {
  status: string;
  baselineCommit: string;
  counts: {
    relationships: number;
    explicitPublicationGuards: number;
    legacyRationaleBoundaries: number;
  };
  relationships: RelationshipRow[];
};
type SourceRow = {
  sourceId: string;
  status: string;
  kind?: string;
  verified?: boolean;
  liveUsageCount?: number;
  verificationState?: {
    qualifiedHumanCitationReviewRequired?: boolean;
    qualifiedHumanCitationReviewDecision?: string;
    automaticPromotionAuthorized?: boolean;
    mappingApprovalDoesNotEqualCitationVerification?: boolean;
  };
};
type SourceRegistry = {
  status: string;
  baselineCommit: string;
  counts: {
    liveSourceReferenceUses: number;
    activeSourceEntities: number;
    pendingVerificationSourceEntities: number;
    activeClinicalSourceEntities: number;
    pendingClinicalSourceEntities: number;
    activeLegalAuthorityEntities: number;
    retiredOnlySourceEntities: number;
    supersededUnverifiedSourceEntities: number;
    bibliographicCorrectionOnlyEntities: number;
    totalSourceEntitiesIncludingLineage: number;
    retiredVerifiedRelationshipSourceUses: number;
  };
  sources: SourceRow[];
};
type AuditResult = {
  status: string;
  relationships: number;
  liveSourceReferenceUses: number;
  verifiedLiveSourceUses: number;
  pendingVerificationLiveSourceUses: number;
  activeSourceEntities: number;
  pendingVerificationSourceEntities: number;
};

const root = process.cwd();
const relationships = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-relationships.json"), "utf8"),
) as RelationshipRegistry;
const sources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as SourceRegistry;

describe("Master Relationship & Evidence Registry 2026", () => {
  it("pins the authoritative ME-4 pre-verification registry counts", () => {
    expect(relationships.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(relationships.baselineCommit).toBe("196b37b92d76827e4030da1afb25fd4165066cdb");
    expect(relationships.counts).toEqual({
      relationships: 193,
      explicitPublicationGuards: 119,
      legacyRationaleBoundaries: 74,
    });
    expect(sources.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(sources.baselineCommit).toBe("196b37b92d76827e4030da1afb25fd4165066cdb");
    expect(sources.counts).toEqual({
      liveSourceReferenceUses: 201,
      activeSourceEntities: 178,
      pendingVerificationSourceEntities: 0,
      activeClinicalSourceEntities: 177,
      pendingClinicalSourceEntities: 0,
      activeLegalAuthorityEntities: 1,
      retiredOnlySourceEntities: 1,
      supersededUnverifiedSourceEntities: 7,
      bibliographicCorrectionOnlyEntities: 1,
      totalSourceEntitiesIncludingLineage: 187,
      retiredVerifiedRelationshipSourceUses: 6,
    });
  });

  it("preserves all 74 legacy rationale boundaries without fabricating guards", () => {
    const legacy = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "legacy-rationale-boundary",
    );
    expect(legacy).toHaveLength(74);
    for (const row of legacy) {
      expect(row.publicationGuard.structuredGuardText).toBeNull();
      expect(row.publicationGuard.boundaryText).toBeTruthy();
      expect(row.publicationGuard.structuredGuardReviewPending).toBe(true);
    }
  });

  it("contains exactly five qualified-human-verified ME-4 clinical sources", () => {
    const ids = new Set(["pmid-28515118", "pmid-32059945", "pmid-37414328", "pmid-38453002", "pmid-41308609"]);
    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
    expect(
      sources.sources.filter((source) => source.status === "pending-verification"),
    ).toHaveLength(0);
  });

  it("records the approved 4-as-implemented / 1-narrowed ME-4 verification decisions", () => {
    const decisions = new Map(
      sources.sources
        .filter((source) =>
          new Set(["pmid-28515118", "pmid-32059945", "pmid-37414328", "pmid-38453002", "pmid-41308609"]).has(source.sourceId),
        )
        .map((source) => [source.sourceId, source.verificationState?.qualifiedHumanCitationReviewDecision]),
    );
    expect(decisions.get("pmid-28515118")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-32059945")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-37414328")).toBe("approve-with-narrowing");
    expect(decisions.get("pmid-38453002")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-41308609")).toBe("approve-as-implemented");

    const uveitis = relationships.relationships.find(
      (row) => row.relationshipId === "rel-uveitis-to-cataracts",
    );
    expect(uveitis?.publicationGuard.structuredGuardText).toBe(
      "Require documented noninfectious anterior uveitis and separately established cataract in the affected eye. Do not infer cataract from uveitis alone. Preserve age, inflammation severity, corticosteroid exposure, prior ocular surgery, glaucoma treatment, and other cataract contributors.",
    );
  });

  it("keeps source lineage states distinct while retaining all active ME-3 sources", () => {
    expect(sources.sources.filter((source) => source.status === "active")).toHaveLength(178);
    expect(sources.sources.filter((source) => source.status === "superseded-unverified")).toHaveLength(7);
    expect(sources.sources.filter((source) => source.status === "bibliographic-correction-only")).toHaveLength(1);
    expect(sources.sources.filter((source) => source.status === "retired-only")).toHaveLength(1);
    expect(new Set(sources.sources.map((source) => source.sourceId)).size).toBe(187);
  });

  it("keeps supersession provenance out of all 119 explicit publication guards", () => {
    const explicit = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "explicit",
    );
    expect(explicit).toHaveLength(119);
    for (const row of explicit) {
      expect(row.publicationGuard.structuredGuardText).not.toMatch(/supersedes unverified PMID/i);
    }
  });

  it("passes the final qualified-human-verified master-registry parity audit", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as AuditResult;
    expect(result).toMatchObject({
      status: "PASS",
      relationships: 193,
      liveSourceReferenceUses: 201,
      verifiedLiveSourceUses: 201,
      pendingVerificationLiveSourceUses: 0,
      activeSourceEntities: 178,
      pendingVerificationSourceEntities: 0,
    });
  });
});
