import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["ischemic-heart-disease", "24176435", 4, "b45e9520845a7c195c9722427cf7ac89333a7e0cd6a766eb7e431471d03616ce"],
  ["hypertension", "27490852", 5, "3746311522f0e5f87c75ffc6b25a61d80003ffc24ab3170701c5cbc73c79c4d3"],
  ["diabetes-mellitus-type-2", "26867081", 6, "e1851109455fdeacb32b7184cf237b673c95c886bbd26d5894a4bfceba7f4301"],
  ["depressive-disorder", "23696449", 7, "7d6fd403b576182a23853d20a368e5f7719a1be548695e5ca93d6ef7be0d55fe"],
  ["insomnia", "36163136", 8, "ad83421bfd295f048dc0361be704143405e2b47b773e64b311fdbef6a5c14110"],
  ["substance-use-disorder", "11481147", 9, "0ed7299ffffe91760292136e0384e6ffb3c064d17bb979c07afc77b4bc3df63c"],
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

describe("Mapping Expansion Batch ME-36", () => {
  const relationships = load<RelationshipRegistry>("data/evidence/master-relationships.json");
  const sources = load<SourceRegistry>("data/evidence/master-sources.json");
  const relationshipById = new Map(relationships.relationships.map((row) => [row.relationshipId, row]));
  const sourceById = new Map(sources.sources.map((row) => [row.sourceId, row]));

  it.each(pairs)(
    "publishes ptsd -> %s as a bounded association with qualified-human-verified evidence",
    (targetId, pmid, rank, expectedHash) => {
      const mapping = load<Mapping>("data/knowledge-base/ptsd.json");
      const suggestion = mapping.suggestions.find((row) => row.conditionId === targetId);
      expect(mapping.draft).toBe(false);
      expect(suggestion).toBeDefined();
      expect(suggestion?.rank).toBe(rank);
      expect(suggestion?.nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
      expect(suggestion?.causalMechanism.hypothesizedOnly).toBe(true);
      expect(suggestion?.evidentiaryProfile.etiologicalConsensus).toBe("NOT_ESTABLISHED");
      expect(suggestion?.evidentiaryProfile.vaNexusProbabilityAlignment).toBe("NOT_ASSERTED");
      expect(suggestion?.sourceReferences).toHaveLength(1);
      expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
      expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion?.sourceReferences[0]?.citation).toContain(`PMID ${pmid}`);

      const relationshipId = `rel-ptsd-to-${targetId}`;
      const relationship = relationshipById.get(relationshipId);
      const source = sourceById.get(`pmid-${pmid}`);
      expect(relationship).toBeDefined();
      expect(source).toBeDefined();
      expect(relationship?.primaryPublicationState).toBe("published");
      expect(relationship?.publicationGuard.status).toBe("explicit");
      expect(relationship?.publicationGuard.structuredGuardReviewPending).toBe(false);
      expect(relationship?.suggestionObjectHash).toBe(expectedHash);
      if (!suggestion) throw new Error(`Missing suggestion ptsd->${targetId}`);
      const preVerificationSuggestion = structuredClone(suggestion);
      preVerificationSuggestion.sourceReferences[0].verified = false;
      expect(relationship?.suggestionObjectHash).toBe(hash(preVerificationSuggestion));
      const preVerificationReference = structuredClone(suggestion.sourceReferences[0]);
      preVerificationReference.verified = false;
      expect(source?.status).toBe("active");
      expect(source?.verified).toBe(true);
      expect(source?.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        qualifiedHumanCitationReviewDate: "2026-09-06",
      });
      expect(source?.rawReferenceHashes).toContain(hash(preVerificationReference));
      expect(source?.liveUses).toContainEqual({ relationshipId, primaryId: "ptsd", targetId, sourceIndex: 0 });
    },
  );

  it("ratchets the authoritative counts on the published PTSD mapping", () => {
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 738, explicitPublicationGuards: 664, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(738);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 1315,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 825,
      activeClinicalSourceEntities: 345,
      pendingClinicalSourceEntities: 825,
      totalSourceEntitiesIncludingLineage: 1180,
    });
    expect(sources.sources).toHaveLength(1180);
  });
});
