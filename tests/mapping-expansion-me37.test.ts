import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["metabolic-syndrome", 10, 2, "d13299124ad519e905cf30cd89d1f0f5a9693a7c8bfd45c86fe90bbad4d9837c"],
  ["systemic-lupus-erythematosus", 11, 2, "80400eda4751949e27ea61ad6efa545d7c9710a689f794e24a8f07fc1076a416"],
  ["rheumatoid-arthritis", 12, 2, "c9324846e60e56291dd4ffda5f19fdc27672914b98abb94229826323a26d1f13"],
  ["inflammatory-bowel-disease", 13, 2, "b255f4ae8c2b3d0b0fa1d416b8f7e3e204704cdd9458d1769b26f1211e41efe2"],
  ["multiple-sclerosis", 14, 1, "12432cd54d36ffe68f4d962c8023dd18a97d876577ff3a46af0a93ac8895e5da"],
  ["thyroiditis", 15, 2, "afdcdd0f2f0e0664b33c450e84986d44872dc7e5dcf7f4ca870a7484a6e0fb14"],
  ["irritable-bowel-syndrome", 16, 1, "5039c8ec5a7f11bed61da072fc0d9d3a2a1eeceff465c6113e0316e4fb5f557f"],
  ["gerd", 17, 1, "15073b5acc6d2a0ea69491009b831f8428eec42104552016137a860fd7fcc3d4"],
  ["copd", 18, 2, "064d2080b60202141127146cba546ce235d5c61f38483dcea98f18b487e79292"],
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
    expect(relationships.currentState).toBe("ME-37-CITATION-VERIFIED");
    expect(sources.currentState).toBe("ME-37-CITATION-VERIFIED");
    expect(relationships.counts).toEqual({ relationships: 362, explicitPublicationGuards: 288, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(362);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 376,
      activeSourceEntities: 343,
      pendingVerificationSourceEntities: 0,
      activeClinicalSourceEntities: 342,
      pendingClinicalSourceEntities: 0,
      totalSourceEntitiesIncludingLineage: 352,
    });
    expect(sources.sources).toHaveLength(352);
  });
});
