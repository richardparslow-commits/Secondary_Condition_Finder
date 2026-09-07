import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["ischemic-heart-disease", "24176435", 4, "d1821c51de60779896f5a1d7de5fb0e913dad64ad034e480fa81316cfd854849"],
  ["hypertension", "27490852", 5, "c4fe7929ec63f859e87cc68ce01079bd7e98bcac37f5e15543babbf9aaf84e7d"],
  ["diabetes-mellitus-type-2", "26867081", 6, "2719c34964049b2224ba89f340f25662f3593c8c20c8065dbfe6bf576539f359"],
  ["depressive-disorder", "23696449", 7, "cbb2139619de9d76dd244aa9ea6f6a482baa9a6cd21efffb4cff2cc222580d13"],
  ["insomnia", "36163136", 8, "4e2336f781a57dca0fe4848187c60ab2edefa8a0e7450876589516c6949a98f4"],
  ["substance-use-disorder", "11481147", 9, "98f643e700577d70e59747ce37fd0b216b70ab774f9ca16db1ede86e86d2c90a"],
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
    expect(relationships.currentState).toBe("ME-39-CITATION-VERIFIED");
    expect(sources.currentState).toBe("ME-39-CITATION-VERIFIED");
    expect(relationships.counts).toEqual({ relationships: 363, explicitPublicationGuards: 289, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(363);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 379,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 0,
      activeClinicalSourceEntities: 345,
      pendingClinicalSourceEntities: 0,
      totalSourceEntitiesIncludingLineage: 355,
    });
    expect(sources.sources).toHaveLength(355);
  });
});
