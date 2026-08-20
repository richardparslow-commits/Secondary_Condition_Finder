import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const relationships = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-relationships.json"), "utf8"),
) as {
  status: string;
  counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number };
  relationships: Array<{
    relationshipId: string;
    publicationGuard: {
      status: string;
      structuredGuardText: string | null;
      boundaryText?: string;
      structuredGuardReviewPending: boolean;
    };
  }>;
};

const sources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as {
  status: string;
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
  sources: Array<{ status: string; sourceId: string; kind?: string; verified?: boolean; liveUsageCount?: number }>;
};

describe("Master Relationship & Evidence Registry 2026", () => {
  it("pins the authoritative ME-3 pre-verification registry counts", () => {
    expect(relationships.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(relationships.counts).toEqual({
      relationships: 188,
      explicitPublicationGuards: 114,
      legacyRationaleBoundaries: 74,
    });
    expect(sources.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(sources.counts).toEqual({
      liveSourceReferenceUses: 196,
      activeSourceEntities: 168,
      pendingVerificationSourceEntities: 5,
      activeClinicalSourceEntities: 167,
      pendingClinicalSourceEntities: 5,
      activeLegalAuthorityEntities: 1,
      retiredOnlySourceEntities: 1,
      supersededUnverifiedSourceEntities: 7,
      bibliographicCorrectionOnlyEntities: 1,
      totalSourceEntitiesIncludingLineage: 182,
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

  it("requires five ME-3 sources to remain pending-verification until qualified-human promotion", () => {
    const pending = sources.sources.filter((s) => s.status === "pending-verification");
    expect(pending).toHaveLength(5);
    expect(new Set(pending.map((s) => s.sourceId))).toEqual(new Set([
      "pmid-31722411",
      "pmid-23999006",
      "pmid-41329412",
      "pmid-39689783",
      "pmid-38377675",
    ]));
    for (const source of pending) {
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(false);
      expect(source.liveUsageCount).toBe(1);
    }
  });

  it("keeps active, pending, and lineage/history source states distinct", () => {
    expect(sources.sources.filter((s) => s.status === "active")).toHaveLength(168);
    expect(sources.sources.filter((s) => s.status === "pending-verification")).toHaveLength(5);
    expect(sources.sources.filter((s) => s.status === "superseded-unverified")).toHaveLength(7);
    expect(sources.sources.filter((s) => s.status === "bibliographic-correction-only")).toHaveLength(1);
    expect(sources.sources.filter((s) => s.status === "retired-only")).toHaveLength(1);
    expect(new Set(sources.sources.map((s) => s.sourceId)).size).toBe(182);
  });

  it("keeps supersession provenance out of all 114 explicit publication guards", () => {
    const explicit = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "explicit",
    );
    expect(explicit).toHaveLength(114);
    for (const row of explicit) {
      expect(row.publicationGuard.structuredGuardText).not.toMatch(/supersedes unverified PMID/i);
    }
  });

  it("passes the full pending-verification-aware parity audit against the live KB", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as {
      status: string;
      relationships: number;
      liveSourceReferenceUses: number;
      verifiedLiveSourceUses: number;
      pendingVerificationLiveSourceUses: number;
    };
    expect(result.status).toBe("PASS");
    expect(result.relationships).toBe(188);
    expect(result.liveSourceReferenceUses).toBe(196);
    expect(result.verifiedLiveSourceUses).toBe(191);
    expect(result.pendingVerificationLiveSourceUses).toBe(5);
  });
});
