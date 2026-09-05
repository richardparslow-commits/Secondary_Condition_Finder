import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["scleroderma", "interstitial-lung-disease", "32113575"],
  ["hypertrophic-obstructive-cardiomyopathy", "congestive-heart-failure", "29655822"],
  ["superior-semicircular-canal-dehiscence", "conductive-hearing-loss", "15021770"],
  ["dysphagia", "malnutrition-residuals", "35985419"],
  ["mixed-connective-tissue-disease", "pulmonary-hypertension", "37497727"],
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

describe("Mapping Expansion Batch ME-28", () => {
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
    expect(source.liveUses).toEqual([{ relationshipId, primaryId, targetId, sourceIndex: 0 }]);
  });

  it("ratchets authoritative registry totals to ME-28", () => {
    expect(relationships.counts).toEqual({ relationships: 347, explicitPublicationGuards: 273, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(347);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 355,
      pendingVerificationSourceEntities: 0,
      pendingClinicalSourceEntities: 0,
      totalSourceEntitiesIncludingLineage: 338,
    });
    expect(sources.sources).toHaveLength(338);
  });
});
