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
};

const root = process.cwd();

const relationships = JSON.parse(
  fs.readFileSync(
    path.join(root, "data", "evidence", "master-relationships.json"),
    "utf8",
  ),
) as RelationshipRegistry;

const sources = JSON.parse(
  fs.readFileSync(
    path.join(root, "data", "evidence", "master-sources.json"),
    "utf8",
  ),
) as SourceRegistry;

describe("Master Relationship & Evidence Registry 2026", () => {
  it("pins the authoritative post-ME-3-verification registry counts", () => {
    expect(relationships.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(relationships.baselineCommit).toBe(
      "4d7a60ac4cc7de8d2d91f46210f64fa15f54abd4",
    );
    expect(relationships.counts).toEqual({
      relationships: 188,
      explicitPublicationGuards: 114,
      legacyRationaleBoundaries: 74,
    });

    expect(sources.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(sources.baselineCommit).toBe(
      "4d7a60ac4cc7de8d2d91f46210f64fa15f54abd4",
    );
    expect(sources.counts).toEqual({
      liveSourceReferenceUses: 196,
      activeSourceEntities: 173,
      pendingVerificationSourceEntities: 0,
      activeClinicalSourceEntities: 172,
      pendingClinicalSourceEntities: 0,
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

  it("promotes the five ME-3 source entities to active only after qualified-human verification", () => {
    const ids = new Set([
      "pmid-31722411",
      "pmid-23999006",
      "pmid-41329412",
      "pmid-39689783",
      "pmid-38377675",
    ]);

    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);

    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
    }

    expect(
      sources.sources.filter((source) => source.status === "pending-verification"),
    ).toHaveLength(0);
  });

  it("keeps active and lineage/history source states distinct", () => {
    expect(
      sources.sources.filter((source) => source.status === "active"),
    ).toHaveLength(173);
    expect(
      sources.sources.filter((source) => source.status === "superseded-unverified"),
    ).toHaveLength(7);
    expect(
      sources.sources.filter(
        (source) => source.status === "bibliographic-correction-only",
      ),
    ).toHaveLength(1);
    expect(
      sources.sources.filter((source) => source.status === "retired-only"),
    ).toHaveLength(1);
    expect(new Set(sources.sources.map((source) => source.sourceId)).size).toBe(182);
  });

  it("keeps supersession provenance out of all 114 explicit publication guards", () => {
    const explicit = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "explicit",
    );
    expect(explicit).toHaveLength(114);

    for (const row of explicit) {
      expect(row.publicationGuard.structuredGuardText).not.toMatch(
        /supersedes unverified PMID/i,
      );
    }
  });

  it("passes the full post-verification master-registry parity audit", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/audit-master-registry.js"],
      { cwd: root, encoding: "utf8" },
    );
    const result = JSON.parse(output) as AuditResult;

    expect(result.status).toBe("PASS");
    expect(result.relationships).toBe(188);
    expect(result.liveSourceReferenceUses).toBe(196);
    expect(result.verifiedLiveSourceUses).toBe(196);
    expect(result.pendingVerificationLiveSourceUses).toBe(0);
    expect(result.activeSourceEntities).toBe(173);
  });
});
