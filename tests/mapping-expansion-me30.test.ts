import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["alice-in-wonderland-syndrome", "migraine-headaches", "42065956"],
  ["agranulocytosis", "cellulitis", "28823525"],
  ["als", "dysphagia", "41744126"],
  ["alzheimer-s-disease", "insomnia", "41985272"],
  ["amputation-of-arm", "phantom-limb-pain", "34583023"],
] as const;
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
const load = (path: string) => JSON.parse(fs.readFileSync(`${root}/${path}`, "utf8"));
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

describe("Mapping Expansion Batch ME-30", () => {
  const relationships = load("data/evidence/master-relationships.json");
  const sources = load("data/evidence/master-sources.json");
  const relationshipById = new Map<string, RelationshipRow>(relationships.relationships.map((row: RelationshipRow) => [row.relationshipId, row]));
  const sourceById = new Map<string, SourceRow>(sources.sources.map((row: SourceRow) => [row.sourceId, row]));

  it.each(pairs)("keeps %s -> %s draft-only and citation-pending", (primaryId, targetId, pmid) => {
    const mapping = load(`data/knowledge-base/${primaryId}.json`);
    const suggestion = mapping.suggestions.find((row: { conditionId: string }) => row.conditionId === targetId);
    expect(mapping.draft).toBe(true);
    expect(suggestion).toBeDefined();
    expect(suggestion.nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
    expect(suggestion.causalMechanism.hypothesizedOnly).toBe(true);
    expect(suggestion.evidentiaryProfile.etiologicalConsensus).toBe("NOT_ESTABLISHED");
    expect(suggestion.sourceReferences).toHaveLength(1);
    expect(suggestion.sourceReferences[0].verified).toBe(true);
    expect(suggestion.sourceReferences[0].citation).toContain(`PMID ${pmid}`);
    expect(suggestion.sourceReferences[0].verificationScope).toBe("clinical-evidence");

    const relationshipId = `rel-${primaryId}-to-${targetId}`;
    const relationship = relationshipById.get(relationshipId);
    const source = sourceById.get(`pmid-${pmid}`);
    if (!relationship || !source) throw new Error(`Missing registry linkage for ${relationshipId}`);
    expect(relationship.primaryPublicationState).toBe("draft");
    expect(relationship.publicationGuard.status).toBe("explicit");
    expect(relationship.publicationGuard.structuredGuardReviewPending).toBe(false);
    expect(relationship.suggestionObjectHash).toBe(hashPreVerification(suggestion));
    expect(source.status).toBe("active");
    expect(source.verified).toBe(true);
    expect(source.rawReferenceHashes).toContain(hashPreVerification(suggestion.sourceReferences[0]));
    expect(source.liveUses).toContainEqual({ relationshipId, primaryId, targetId, sourceIndex: 0 });
  });

  it("ratchets authoritative registry totals to ME-30", () => {
    expect(relationships.counts).toEqual({ relationships: 646, explicitPublicationGuards: 572, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(646);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 1101,
      pendingVerificationSourceEntities: 653,
      pendingClinicalSourceEntities: 653,
      totalSourceEntitiesIncludingLineage: 1008,
    });
    expect(sources.sources).toHaveLength(1008);
  });

  it("keeps final-closed and deferred alphabetical-head identities at zero suggestions", () => {
    // FINAL-CLOSE-DIRECTION: earlier broad psychosocial evidence was withdrawn; no adjustment-disorder-specific
    // progression evidence was authored this batch, so the closure remains in force.
    expect(load("data/knowledge-base/adjustment-disorder.json").suggestions).toHaveLength(0);
    // Plural synonym identity stays empty to avoid duplicating the singular identity.
    expect(load("data/knowledge-base/adjustment-disorders.json").suggestions).toHaveLength(0);
    // No credible condition-specific target: acquired syndactyly and acrocyanosis remain draft-only.
    expect(load("data/knowledge-base/acquired-syndactyly.json").suggestions).toHaveLength(0);
    expect(load("data/knowledge-base/acrocyanosis.json").suggestions).toHaveLength(0);
    // The narrower alopecia-areata identity already carries the depressive-disorder edge; broader alopecia stays empty.
    expect(load("data/knowledge-base/alopecia.json").suggestions).toHaveLength(0);
  });
});
