import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["appendicitis", "female-infertility", "25303785", "c3a1d6baf88ee09d2d8239e1648324c635ea5391e13843c6d9abda65dc9555cc"],
  ["arnold-chiari-malformation", "sleep-apnea", "31992420", "cd3ad42f01a90c90f8dda7d0994dd8f5ef3319c3ef5be4f4f6c048272bdcbcc0"],
  ["atrial-flutter", "cerebrovascular-accident-stroke-residuals", "29223550", "aabdf81bd804c3731dad43383ccec26e3028dc8473db8f8ca5852ad2279d9098"],
  ["burns", "contractures", "30948277", "2460583cd6202031d4afd609dfd5dddf130fb952c43375320a90d5ba3b380ee6"],
] as const;

type SourceReference = {
  citation: string;
  verified: boolean;
  verificationScope: string;
};

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
type SourceRow = { sourceId: string; status: string; verified: boolean; rawReferenceHashes: string[]; liveUses: unknown[] };
type RelationshipRegistry = { currentState: string; counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number }; relationships: RelationshipRow[] };
type SourceRegistry = { currentState: string; counts: { liveSourceReferenceUses: number; pendingVerificationSourceEntities: number; pendingClinicalSourceEntities: number; totalSourceEntitiesIncludingLineage: number }; sources: SourceRow[] };

const load = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(`${root}/${relativePath}`, "utf8")) as T;
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const hash = (value: unknown) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

describe("Mapping Expansion Batch ME-34", () => {
  const relationships = load<RelationshipRegistry>("data/evidence/master-relationships.json");
  const sources = load<SourceRegistry>("data/evidence/master-sources.json");
  const relationshipById = new Map(relationships.relationships.map((row) => [row.relationshipId, row]));
  const sourceById = new Map(sources.sources.map((row) => [row.sourceId, row]));

  it.each(pairs)("keeps %s -> %s draft-only and citation-pending", (primaryId, targetId, pmid, expectedHash) => {
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
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
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
    expect(relationship?.suggestionObjectHash).toBe(hash(suggestion));
    expect(source?.status).toBe("pending-verification");
    expect(source?.verified).toBe(false);
    expect(source?.rawReferenceHashes).toContain(hash(suggestion?.sourceReferences[0]));
    expect(source?.liveUses).toContainEqual({ relationshipId, primaryId, targetId, sourceIndex: 0 });
  });

  it("ratchets the authoritative counts without changing publication totals", () => {
    expect(relationships.currentState).toBe("ME34-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    expect(sources.currentState).toBe("ME34-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    expect(relationships.counts).toEqual({ relationships: 342, explicitPublicationGuards: 268, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(342);
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 350, pendingVerificationSourceEntities: 91, pendingClinicalSourceEntities: 91, totalSourceEntitiesIncludingLineage: 333 });
    expect(sources.sources).toHaveLength(333);
  });

  it("keeps the deferred and rejected candidates out of ME-34", () => {
    const bph = load<Mapping>("data/knowledge-base/benign-prostatic-hyperplasia.json");
    expect(bph.draft).toBe(false);
    expect(bph.suggestions.map((suggestion) => suggestion.conditionId)).toEqual(["chronic-kidney-disease", "urethral-stricture"]);
    expect(load<Mapping>("data/knowledge-base/bruxism-awake-sleep.json").suggestions).toHaveLength(0);
  });
});
