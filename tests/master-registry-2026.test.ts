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
    activeClinicalSourceEntities: number;
    activeLegalAuthorityEntities: number;
    retiredOnlySourceEntities: number;
    supersededUnverifiedSourceEntities: number;
    bibliographicCorrectionOnlyEntities: number;
    totalSourceEntitiesIncludingLineage: number;
    retiredVerifiedRelationshipSourceUses: number;
  };
  sources: Array<{ status: string; sourceId: string }>;
};

describe("Master Relationship & Evidence Registry 2026", () => {
  it("installs the approved authoritative current-state counts", () => {
    expect(relationships.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(relationships.counts).toEqual({
      relationships: 183,
      explicitPublicationGuards: 109,
      legacyRationaleBoundaries: 74,
    });
    expect(sources.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(sources.counts).toEqual({
      liveSourceReferenceUses: 191,
      activeSourceEntities: 168,
      activeClinicalSourceEntities: 167,
      activeLegalAuthorityEntities: 1,
      retiredOnlySourceEntities: 1,
      supersededUnverifiedSourceEntities: 7,
      bibliographicCorrectionOnlyEntities: 1,
      totalSourceEntitiesIncludingLineage: 177,
      retiredVerifiedRelationshipSourceUses: 6,
    });
  });

  it("does not fabricate structured guards for the 74 legacy rows", () => {
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

  it("keeps supersession provenance out of publication guards", () => {
    const explicit = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "explicit",
    );
    expect(explicit).toHaveLength(109);
    for (const row of explicit) {
      expect(row.publicationGuard.structuredGuardText).not.toMatch(/supersedes unverified PMID/i);
    }
  });

  it("models current sources separately from provenance-only source entities", () => {
    expect(sources.sources.filter((s) => s.status === "active")).toHaveLength(168);
    expect(sources.sources.filter((s) => s.status === "superseded-unverified")).toHaveLength(7);
    expect(sources.sources.filter((s) => s.status === "bibliographic-correction-only")).toHaveLength(1);
    expect(sources.sources.filter((s) => s.status === "retired-only")).toHaveLength(1);
    expect(new Set(sources.sources.map((s) => s.sourceId)).size).toBe(177);
  });

  it("passes the full master-registry parity audit against the live KB", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as { status: string; relationships: number; liveSourceReferenceUses: number };
    expect(result.status).toBe("PASS");
    expect(result.relationships).toBe(183);
    expect(result.liveSourceReferenceUses).toBe(191);
  });
});
