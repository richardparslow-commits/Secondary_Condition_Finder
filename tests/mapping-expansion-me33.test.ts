import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["anal-fissure", "fecal-incontinence", "17665247"],
  ["ankle-disarticulation", "phantom-limb-pain", "28242264"],
  ["ankyloglossia", "dysphagia", "31367903"],
  ["apraxia", "dysphagia", "35508738"],
  ["anterior-interosseous-nerve-syndrome", "peripheral-nerve-paralysis", "21611763"],
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

type Mapping = {
  draft: boolean;
  suggestions: Suggestion[];
};

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
    pendingVerificationSourceEntities: number;
    pendingClinicalSourceEntities: number;
    totalSourceEntitiesIncludingLineage: number;
  };
  sources: SourceRow[];
};

const load = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(`${root}/${relativePath}`, "utf8")) as T;

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const hash = (value: unknown) =>
  crypto.createHash("sha256").update(canonical(value)).digest("hex");

const hashPreVerification = (value: unknown) => {
  const clone = structuredClone(value) as { sourceReferences?: Array<{ verified?: boolean }>; verified?: boolean };
  if (clone.sourceReferences?.[0]) clone.sourceReferences[0].verified = false;
  if ("verified" in clone) clone.verified = false;
  return hash(clone);
};

describe("Mapping Expansion Batch ME-33", () => {
  const relationships = load<RelationshipRegistry>("data/evidence/master-relationships.json");
  const sources = load<SourceRegistry>("data/evidence/master-sources.json");
  const relationshipById = new Map(relationships.relationships.map((row) => [row.relationshipId, row]));
  const sourceById = new Map(sources.sources.map((row) => [row.sourceId, row]));

  it.each(pairs)("keeps %s -> %s draft-only and citation-pending", (primaryId, targetId, pmid) => {
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
    expect(relationship?.suggestionObjectHash).toBe(hashPreVerification(suggestion));
    expect(source?.status).toBe("active");
    expect(source?.verified).toBe(true);
    expect(source?.rawReferenceHashes).toContain(hashPreVerification(suggestion?.sourceReferences[0]));
    expect(source?.liveUses).toContainEqual({ relationshipId, primaryId, targetId, sourceIndex: 0 });
  });

  it("ratchets the authoritative ME-33 counts", () => {
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 658, explicitPublicationGuards: 584, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(658);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 1128,
      pendingVerificationSourceEntities: 674,
      pendingClinicalSourceEntities: 674,
      totalSourceEntitiesIncludingLineage: 1029,
    });
    expect(sources.sources).toHaveLength(1029);

    const mappings = fs.readdirSync(`${root}/data/knowledge-base`).filter((file) => file.endsWith(".json")).map((file) => load<Mapping>(`data/knowledge-base/${file}`));
    const references = mappings.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences));
    expect(mappings.reduce((total, mapping) => total + mapping.suggestions.length, 0)).toBe(658);
    expect(references).toHaveLength(1128);
    expect(references.filter((reference) => reference.verified === true)).toHaveLength(383);
    expect(references.filter((r) => r.verified === false)).toHaveLength(745);
  });

  it("keeps deferred identities outside the batch", () => {
    expect(load<Mapping>("data/knowledge-base/anosmia.json").suggestions).toHaveLength(0);
    expect(load<Mapping>("data/knowledge-base/anhedonia.json").suggestions).toHaveLength(0);
    expect(load<Mapping>("data/knowledge-base/acrocyanosis.json").suggestions).toHaveLength(0);
    expect(load<Mapping>("data/knowledge-base/amputation-of-thumb-fingers-toes.json").suggestions).toHaveLength(0);
  });
});
