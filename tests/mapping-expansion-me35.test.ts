import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["brown-s-quard-syndrome", "urinary-incontinence", "11746547", "c508c99e03b55f7274f0f0daf9f1d2b7c326465df8c1e772ab275a933a612f52"],
  ["brain-tumors", "seizure-disorder", "26332282", "5825ee8da529f9a401a05e7c03c4a449bdfce0562e0c48da0d1e988660ec1619"],
  ["brugada-syndrome", "cardiac-arrhythmia", "27378596", "10e95bdc744dd1b8a1a339129d50bb7a6927383bbd897268b1df09072fe01713"],
  ["bell-s-palsy", "keratitis", "28319442", "e226e6a50e9be0f30174dcb8706270df4071d433722477a3f0d7565dd75e363d"],
  ["bowen-s-disease", "squamous-cell-carcinoma", "7804989", "bf652f4a0eef9d19a6dbccb213b475f2620c8bc6a7364789779c3f83b0dc6906"],
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
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 691, explicitPublicationGuards: 617, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(691);
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 1210, activeSourceEntities: 346, pendingVerificationSourceEntities: 737, activeClinicalSourceEntities: 345, pendingClinicalSourceEntities: 737, totalSourceEntitiesIncludingLineage: 1092, });
    expect(sources.sources).toHaveLength(1092);
  });
});
