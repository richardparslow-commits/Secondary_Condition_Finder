import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pairs = [
  ["amebic-liver-abscess", "pleural-effusion", "41068883"],
  ["amputation-of-foot", "phantom-limb-pain", "34583023"],
  ["amputation-of-hand", "phantom-limb-pain", "34583023"],
  ["amputation-of-leg", "phantom-limb-pain", "34583023"],
  ["anismus-pelvic-floor-dyssynergia", "fecal-incontinence", "41713710"],
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
  liveUsageCount: number;
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

describe("Mapping Expansion Batch ME-31", () => {
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

  it("ratchets authoritative registry totals to the current ME-33 state", () => {
    expect(relationships.counts).toEqual({ relationships: 790, explicitPublicationGuards: 716, legacyRationaleBoundaries: 74 });
    expect(relationships.relationships).toHaveLength(790);
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 1460,
      pendingVerificationSourceEntities: 950,
      pendingClinicalSourceEntities: 950,
      totalSourceEntitiesIncludingLineage: 1305,
    });
    expect(sources.sources).toHaveLength(1305);
  });

  it("merges the reused phantom-limb-pain survey into one pending source entity", () => {
    const source = sourceById.get("pmid-34583023");
    expect(source).toBeDefined();
    expect(source?.liveUses).toHaveLength(6);
    expect(source?.liveUsageCount).toBe(6);
  });

  it("keeps deferred and ledger-protected alphabetical-head identities at zero suggestions", () => {
    // anhedonia is a transdiagnostic symptom, not a stand-alone condition; a -> depressive-disorder
    // edge would assert the wrong direction.
    expect(load("data/knowledge-base/anhedonia.json").suggestions).toHaveLength(0);
    // Digit-level amputation is outside the limb-level scope of the nationwide amputee survey evidence.
    expect(load("data/knowledge-base/amputation-of-thumb-fingers-toes.json").suggestions).toHaveLength(0);
    // These identities were processed in the subsequent ME-33 batch.
    expect(load("data/knowledge-base/anal-fissure.json").suggestions).toHaveLength(1);
    expect(load("data/knowledge-base/ankle-disarticulation.json").suggestions).toHaveLength(1);
  });
});
