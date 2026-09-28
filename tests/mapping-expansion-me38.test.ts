import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();

// targetId, rank, sourceReferenceCount, suggestionObjectHash (computed over the final,
// qualified-human-verified suggestion object stored in the knowledge base)
const pair = ["rem-sleep-disorder", 19, 3, "81e02838536109ca23c0fc2c345e2fc3947bd09b519763165dcb02d163db7a07"] as const;

type SourceReference = { citation: string; verified: boolean; verificationScope: string };
type Suggestion = {
  conditionId: string;
  rank: number;
  nexusClaim: { nexusClassification: string };
  causalMechanism: { hypothesizedOnly: boolean };
  evidentiaryProfile: { etiologicalConsensus: string; vaNexusProbabilityAlignment: string };
  sourceReferences: SourceReference[];
};
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type RelationshipRow = {
  relationshipId: string;
  primaryPublicationState: string;
  publicationGuard: { status: string; structuredGuardReviewPending: boolean };
  suggestionObjectHash: string;
};
type SourceRow = {
  sourceId: string;
  status: string;
  verified: boolean;
  rawReferenceHashes: string[];
  liveUses: unknown[];
  verificationState?: {
    qualifiedHumanCitationReviewRequired: boolean;
    qualifiedHumanCitationReviewDecision: string;
    qualifiedHumanCitationReviewDate: string;
  };
};
type RelationshipRegistry = {
  currentState: string;
  counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number };
  relationships: RelationshipRow[];
};
type SourceRegistry = {
  currentState: string;
  counts: {
    liveSourceReferenceUses: number;
    activeSourceEntities: number;
    pendingVerificationSourceEntities: number;
    activeClinicalSourceEntities: number;
    pendingClinicalSourceEntities: number;
    totalSourceEntitiesIncludingLineage: number;
  };
  sources: SourceRow[];
};

const load = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(`${root}/${relativePath}`, "utf8")) as T;
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const hash = (value: unknown) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

describe("Mapping Expansion Batch ME-38", () => {
  const relationships = load<RelationshipRegistry>("data/evidence/master-relationships.json");
  const sources = load<SourceRegistry>("data/evidence/master-sources.json");
  const relationshipById = new Map(relationships.relationships.map((row) => [row.relationshipId, row]));
  const sourceById = new Map(sources.sources.map((row) => [row.sourceId, row]));

  it("publishes ptsd -> rem-sleep-disorder as a bounded association with qualified-human-verified evidence", () => {
    const [targetId, rank, referenceCount, expectedHash] = pair;
    const mapping = load<Mapping>("data/knowledge-base/ptsd.json");
    const suggestion = mapping.suggestions.find((row) => row.conditionId === targetId);
    expect(mapping.draft).toBe(false);
    expect(suggestion).toBeDefined();
    expect(suggestion?.rank).toBe(rank);
    expect(suggestion?.nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
    expect(suggestion?.causalMechanism.hypothesizedOnly).toBe(true);
    expect(suggestion?.evidentiaryProfile.etiologicalConsensus).toBe("NOT_ESTABLISHED");
    expect(suggestion?.evidentiaryProfile.vaNexusProbabilityAlignment).toBe("NOT_ASSERTED");
    expect(suggestion?.sourceReferences).toHaveLength(referenceCount);
    for (const source of suggestion?.sourceReferences ?? []) {
      expect(source.verified).toBe(true);
      expect(source.verificationScope).toBe("clinical-evidence");
    }

    const relationshipId = `rel-ptsd-to-${targetId}`;
    const relationship = relationshipById.get(relationshipId);
    expect(relationship).toBeDefined();
    expect(relationship?.primaryPublicationState).toBe("published");
    expect(relationship?.publicationGuard.status).toBe("explicit");
    expect(relationship?.publicationGuard.structuredGuardReviewPending).toBe(false);
    expect(relationship?.suggestionObjectHash).toBe(expectedHash);
    if (!suggestion) throw new Error(`Missing suggestion ptsd->${targetId}`);
    // ME-38 entered qualified-human-verified sources at implementation, so the stored
    // registry hash is computed over the final verified suggestion object in the KB.
    expect(relationship?.suggestionObjectHash).toBe(hash(suggestion));
    for (const source of suggestion.sourceReferences) {
      const sourceId = (source.citation.match(/PMID[\s:]*(\d{6,9})/i) ?? [])[1];
      const master = sourceId ? sourceById.get(`pmid-${sourceId}`) : undefined;
      expect(master).toBeDefined();
      expect(master?.status).toBe("active");
      expect(master?.verified).toBe(true);
      expect(master?.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        qualifiedHumanCitationReviewDate: "2026-09-06",
      });
      expect(master?.rawReferenceHashes).toContain(hash(source));
      expect(master?.liveUses).toContainEqual({
        relationshipId,
        primaryId: "ptsd",
        targetId,
        sourceIndex: suggestion.sourceReferences.indexOf(source),
      });
    }
  });

  it("ratchets the authoritative counts on the published PTSD mapping", () => {
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 820, explicitPublicationGuards: 746, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(820);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 1548,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 1012,
      activeClinicalSourceEntities: 345,
      pendingClinicalSourceEntities: 1012,
      totalSourceEntitiesIncludingLineage: 1367,
    });
    expect(sources.sources).toHaveLength(1367);
  });
});
