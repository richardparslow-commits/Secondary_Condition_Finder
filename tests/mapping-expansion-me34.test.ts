import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["appendicitis", "female-infertility", "25303785", "e5cfc40da39f7364d8ed9481ed85d5e319e0cfe2d079211267c639be05b29e54"],
  ["arnold-chiari-malformation", "sleep-apnea", "31992420", "88671e587ad420809c0818e25a10634a15f5ed25c043165595e4d03209f50ad6"],
  ["atrial-flutter", "cerebrovascular-accident-stroke-residuals", "29223550", "f48bbe335d4546ac01ca125168f7d101941387a2fd0adaf75b13bb533d4bfa25"],
  ["burns", "contractures", "30948277", "1440c8ab17e3898cd14cf58060d07b96c58df2e10fa0e9e5e6438ca3c9ff3362"],
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
const hashPreVerification = (value: unknown) => {
  const clone = structuredClone(value) as { sourceReferences?: Array<{ verified?: boolean }>; verified?: boolean };
  if (clone.sourceReferences?.[0]) clone.sourceReferences[0].verified = false;
  if ("verified" in clone) clone.verified = false;
  return hash(clone);
};

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
    expect(relationship?.suggestionObjectHash).toBe(hashPreVerification(suggestion));
    expect(source?.status).toBe("active");
    expect(source?.verified).toBe(true);
    expect(source?.rawReferenceHashes).toContain(hashPreVerification(suggestion?.sourceReferences[0]));
    expect(source?.liveUses).toContainEqual({ relationshipId, primaryId, targetId, sourceIndex: 0 });
  });

  it("ratchets the authoritative counts without changing publication totals", () => {
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 681, explicitPublicationGuards: 607, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(681);
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 1188, pendingVerificationSourceEntities: 722, pendingClinicalSourceEntities: 722, totalSourceEntitiesIncludingLineage: 1077, });
    expect(sources.sources).toHaveLength(1077);
  });

  it("keeps the deferred and rejected candidates out of ME-34", () => {
    const bph = load<Mapping>("data/knowledge-base/benign-prostatic-hyperplasia.json");
    expect(bph.draft).toBe(false);
    expect(bph.suggestions.map((suggestion) => suggestion.conditionId)).toEqual(["chronic-kidney-disease", "urethral-stricture"]);
    expect(load<Mapping>("data/knowledge-base/bruxism-awake-sleep.json").suggestions).toHaveLength(0);
  });
});
