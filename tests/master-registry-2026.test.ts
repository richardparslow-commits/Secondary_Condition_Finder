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
  it("pins the authoritative fully verified ME-6 registry counts", () => {
    expect(relationships.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(relationships.baselineCommit).toBe("59c41777a4f55628d08ca080ad49f450adb06bca");
    expect(relationships.counts).toEqual({
      relationships: 208,
      explicitPublicationGuards: 134,
      legacyRationaleBoundaries: 74,
    });
    expect(sources.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(sources.baselineCommit).toBe("59c41777a4f55628d08ca080ad49f450adb06bca");
    expect(sources.counts).toEqual({
      liveSourceReferenceUses: 216,
      activeSourceEntities: 188,
      pendingVerificationSourceEntities: 5,
      activeClinicalSourceEntities: 187,
      pendingClinicalSourceEntities: 5,
      activeLegalAuthorityEntities: 1,
      retiredOnlySourceEntities: 1,
      supersededUnverifiedSourceEntities: 7,
      bibliographicCorrectionOnlyEntities: 1,
      totalSourceEntitiesIncludingLineage: 202,
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
    ).toHaveLength(5);
  });

  it("contains exactly five qualified-human-verified ME-5 clinical sources", () => {
    const ids = new Set(["pmid-37730081", "pmid-31515657", "pmid-33208169", "pmid-24816764", "pmid-35103762"]);
    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
  });

  it("contains exactly five qualified-human-verified ME-6 clinical sources", () => {
    const ids = new Set(["pmid-29129575", "pmid-29730199", "pmid-27400319", "pmid-31444993", "pmid-12411757"]);
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
    const decisions = new Map(
      selected.map((source) => [source.sourceId, source.verificationState?.qualifiedHumanCitationReviewDecision]),
    );
    expect(decisions.get("pmid-29129575")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-29730199")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-27400319")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-31444993")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-12411757")).toBe("approve-with-narrowing");

    const narrowed = relationships.relationships.find(
      (row) => row.relationshipId === "rel-chronic-pyelonephritis-to-hypertension",
    );
    expect(narrowed?.publicationGuard.structuredGuardText).toBe(
      'Require documented chronic pyelonephritis only in the presence of objectively established vesicoureteral reflux/reflux nephropathy with renal parenchymal scarring, and require separately established hypertension. Do not generalize this source to chronic pyelonephritis, recurrent urinary infection, or renal scarring without documented reflux nephropathy. Treat the cohort as phenotype-specific risk evidence rather than proof that reflux nephropathy caused hypertension in an individual. Preserve primary hypertension, diabetes, chronic kidney disease from other causes, renal-artery disease, endocrine causes, medications, and other contributors.',
    );
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
    expect(sources.sources.filter((source) => source.status === "active")).toHaveLength(188);
    expect(sources.sources.filter((source) => source.status === "superseded-unverified")).toHaveLength(7);
    expect(sources.sources.filter((source) => source.status === "bibliographic-correction-only")).toHaveLength(1);
    expect(sources.sources.filter((source) => source.status === "retired-only")).toHaveLength(1);
    expect(new Set(sources.sources.map((source) => source.sourceId)).size).toBe(202);
  });

  it("keeps supersession provenance out of all 134 explicit publication guards", () => {
    const explicit = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "explicit",
    );
    expect(explicit).toHaveLength(134);
    for (const row of explicit) {
      expect(row.publicationGuard.structuredGuardText).not.toMatch(/supersedes unverified PMID/i);
    }
  });

  it("passes the final qualified-human-verified ME-6 master-registry parity audit", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as AuditResult;
    expect(result).toMatchObject({
      status: "PASS",
      relationships: 208,
      liveSourceReferenceUses: 216,
      verifiedLiveSourceUses: 211,
      pendingVerificationLiveSourceUses: 5,
      activeSourceEntities: 188,
      pendingVerificationSourceEntities: 5,
    });
  });
});
