import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["metabolic-syndrome", 10, 2, "193c3034bce6e61954b83cd883cbe45c43240ad2b63a84c611b1152939b7343d"],
  ["systemic-lupus-erythematosus", 11, 2, "70bfca060300011fcf04e1f4a60d6716ac8dcbabf728b41139633c0711b3d0c3"],
  ["rheumatoid-arthritis", 12, 2, "3566f42e0661f949ded22ff6789598c42ce362586af067673a4ce4664cc37875"],
  ["inflammatory-bowel-disease", 13, 2, "50efc649fee66666005134b1614686b16d9b13806ddf11a9d8d59c3fccbcbe5b"],
  ["multiple-sclerosis", 14, 1, "7d6fc132e5ab895e692a44dd265a1b0109db35b3cad70fab810dbb32598e783e"],
  ["thyroiditis", 15, 2, "7e6fe2d8529987df1b4fc88c5e2b63d3657181740b072f987d4be8e20dc9ce0e"],
  ["irritable-bowel-syndrome", 16, 1, "71f39c5ce8aaae30a28c05bee1e3b45f340cd077674d21794235f113941dabd3"],
  ["gerd", 17, 1, "3d7ed0193aa63ef376994516e6342e1749ed61b1e50ee806a139d5d653b69897"],
  ["copd", 18, 2, "a18812bf47127d662d0110e3d3acf5c5d3e4e40b72972a6e75bb290c72024147"],
] as const;

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

describe("Mapping Expansion Batch ME-37", () => {
  const relationships = load<RelationshipRegistry>("data/evidence/master-relationships.json");
  const sources = load<SourceRegistry>("data/evidence/master-sources.json");
  const relationshipById = new Map(relationships.relationships.map((row) => [row.relationshipId, row]));
  const sourceById = new Map(sources.sources.map((row) => [row.sourceId, row]));

  it.each(pairs)(
    "publishes ptsd -> %s as a bounded association with qualified-human-verified evidence",
    (targetId, rank, referenceCount, expectedHash) => {
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
      const preVerificationSuggestion = structuredClone(suggestion);
      preVerificationSuggestion.sourceReferences.forEach((source) => {
        source.verified = false;
      });
      expect(relationship?.suggestionObjectHash).toBe(hash(preVerificationSuggestion));
      for (const source of suggestion.sourceReferences) {
        const preVerificationReference = structuredClone(source);
        preVerificationReference.verified = false;
        const sourceId = (source.citation.match(/PMID[:\s]*(\d{6,9})/i) ?? [])[1];
        const master = sourceId ? sourceById.get(`pmid-${sourceId}`) : undefined;
        expect(master).toBeDefined();
        expect(master?.status).toBe("active");
        expect(master?.verified).toBe(true);
        expect(master?.verificationState).toMatchObject({
          qualifiedHumanCitationReviewRequired: false,
          qualifiedHumanCitationReviewDecision: "approve-as-implemented",
          qualifiedHumanCitationReviewDate: "2026-09-06",
        });
        expect(master?.rawReferenceHashes).toContain(hash(preVerificationReference));
        expect(master?.liveUses).toContainEqual({
          relationshipId,
          primaryId: "ptsd",
          targetId,
          sourceIndex: suggestion.sourceReferences.indexOf(source),
        });
      }
    },
  );

  it("ratchets the authoritative counts on the published PTSD mapping", () => {
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 749, explicitPublicationGuards: 675, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(749);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 1343,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 848,
      activeClinicalSourceEntities: 345,
      pendingClinicalSourceEntities: 848,
      totalSourceEntitiesIncludingLineage: 1203,
    });
    expect(sources.sources).toHaveLength(1203);
  });
});
