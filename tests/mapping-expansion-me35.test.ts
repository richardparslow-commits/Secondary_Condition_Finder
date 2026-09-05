import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["brown-s-quard-syndrome", "urinary-incontinence", "11746547", "67012dbce3a6883c7a8c1fd2aa4b22aec9a6b586e12a91adc20d2809005b217b"],
  ["brain-tumors", "seizure-disorder", "26332282", "8b5bb5bb6fc7377818f7f1d59a4bdb45d606dfdeed7cf72b2e5b7917f4605956"],
  ["brugada-syndrome", "cardiac-arrhythmia", "27378596", "8292c7dda742a0ad7a380d70011da8eaa5dd9011b14cd60fab2b4a1ec28eedb2"],
  ["bell-s-palsy", "keratitis", "28319442", "622a7c753b129bbbe6b94fdd485c3f13135efb94d99ffad7249e64cc73b9b7cb"],
  ["bowen-s-disease", "squamous-cell-carcinoma", "7804989", "cf502267f4b16606987ac0286175529b09220dbc5928fb9c541fcd8cf7906014"],
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
type SourceRow = { sourceId: string; status: string; verified: boolean; rawReferenceHashes: string[]; liveUses: unknown[]; verificationState?: { qualifiedHumanCitationReviewRequired: boolean; qualifiedHumanCitationReviewDecision: string; qualifiedHumanCitationReviewDate: string } };
type RelationshipRegistry = { currentState: string; counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number }; relationships: RelationshipRow[] };
type SourceRegistry = { currentState: string; counts: { liveSourceReferenceUses: number; pendingVerificationSourceEntities: number; pendingClinicalSourceEntities: number; totalSourceEntitiesIncludingLineage: number }; sources: SourceRow[] };

const load = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(`${root}/${relativePath}`, "utf8")) as T;
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const hash = (value: unknown) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

describe("Mapping Expansion Batch ME-35", () => {
  const relationships = load<RelationshipRegistry>("data/evidence/master-relationships.json");
  const sources = load<SourceRegistry>("data/evidence/master-sources.json");
  const relationshipById = new Map(relationships.relationships.map((row) => [row.relationshipId, row]));
  const sourceById = new Map(sources.sources.map((row) => [row.sourceId, row]));

  it.each(pairs)("keeps %s -> %s draft-only with verified bounded evidence", (primaryId, targetId, pmid, expectedHash) => {
    const mapping = load<Mapping>(`data/knowledge-base/${primaryId}.json`);
    const suggestion = mapping.suggestions.find((row) => row.conditionId === targetId);
    expect(mapping.draft).toBe(true);
    expect(suggestion).toBeDefined();
    expect(suggestion?.rank).toBe(1);
    expect(suggestion?.nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
    expect(suggestion?.causalMechanism.hypothesizedOnly).toBe(true);
    expect(suggestion?.evidentiaryProfile.etiologicalConsensus).toBe("NOT_ESTABLISHED");
    expect(suggestion?.evidentiaryProfile.vaNexusProbabilityAlignment).toBe("NOT_ASSERTED");
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.citation).toContain(`PMID ${pmid}`);

    const relationshipId = `rel-${primaryId}-to-${targetId}`;
    const relationship = relationshipById.get(relationshipId);
    const source = sourceById.get(`pmid-${pmid}`);
    expect(relationship).toBeDefined();
    expect(source).toBeDefined();
    expect(relationship?.primaryPublicationState).toBe("draft");
    expect(relationship?.publicationGuard.status).toBe("explicit");
    expect(relationship?.publicationGuard.structuredGuardReviewPending).toBe(false);
    expect(relationship?.suggestionObjectHash).toBe(expectedHash);
    if (!suggestion) throw new Error(`Missing suggestion ${primaryId}->${targetId}`);
    const preVerificationSuggestion = structuredClone(suggestion);
    preVerificationSuggestion.sourceReferences[0].verified = false;
    expect(relationship?.suggestionObjectHash).toBe(hash(preVerificationSuggestion));
    expect(source?.status).toBe("active");
    expect(source?.verified).toBe(true);
    expect(source?.verificationState).toMatchObject({ qualifiedHumanCitationReviewRequired: false, qualifiedHumanCitationReviewDecision: "approve-as-implemented", qualifiedHumanCitationReviewDate: "2026-09-03" });
    expect(source?.rawReferenceHashes).toContain(hash(suggestion?.sourceReferences[0]));
    expect(source?.liveUses).toContainEqual({ relationshipId, primaryId, targetId, sourceIndex: 0 });
  });

  it("ratchets the authoritative counts without changing publication totals", () => {
    expect(relationships.currentState).toBe("ME35-CITATION-VERIFIED");
    expect(sources.currentState).toBe("ME35-CITATION-VERIFIED");
    expect(relationships.counts).toEqual({ relationships: 347, explicitPublicationGuards: 273, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(347);
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 355, activeSourceEntities: 329, pendingVerificationSourceEntities: 0, activeClinicalSourceEntities: 328, pendingClinicalSourceEntities: 0, totalSourceEntitiesIncludingLineage: 338 });
    expect(sources.sources).toHaveLength(338);
  });
});
