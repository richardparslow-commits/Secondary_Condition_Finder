import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@/lib/kb/load";

type Mapping = ReturnType<typeof loadKnowledgeBase>[number];
type RegistryRelationship = {
  relationshipId: string;
  primaryId: string;
  targetId: string;
  primaryPublicationState: string;
  rank: number;
  publicationGuard: { status: string; structuredGuardText: string | null };
  sourceIds: string[];
  suggestionObjectHash: string;
};
type RegistrySource = {
  sourceId: string;
  status: string;
  kind: string;
  pmid: string;
  verified: boolean;
  liveUsageCount: number;
  liveUses: Array<{ relationshipId: string; primaryId: string; targetId: string; sourceIndex: number }>;
};

const root = process.cwd();
const rows = [
  { primaryId: "adenomyosis", targetId: "anemia", pmid: "36182260", guard: "Require documented adenomyosis, separately established anemia, compatible bleeding/chronology, and competing-cause review; do not infer anemia from adenomyosis alone." },
  { primaryId: "acute-interstitial-pneumonia", targetId: "pulmonary-fibrosis", pmid: "11144035", guard: "Require documented acute interstitial pneumonitis, objective pulmonary fibrosis, compatible chronology, and alternative-cause review; do not infer fibrosis from acute pneumonitis or dyspnea alone." },
  { primaryId: "avascular-necrosis", targetId: "osteoarthritis", pmid: "31536264", guard: "Require documented compatible-site avascular necrosis, objective osteoarthritis, imaging correlation, chronology, and competing-cause review; do not infer osteoarthritis from AVN alone." },
  { primaryId: "autoimmune-metaplastic-atrophic-gastritis", targetId: "stomach-cancer", pmid: "36769710", guard: "Require biopsy-documented autoimmune gastritis, pathology-confirmed stomach cancer, compatible site/chronology, and specialist review; do not infer cancer from autoimmune gastritis alone." },
  { primaryId: "blind-loop-syndrome", targetId: "anemia", pmid: "32429454", guard: "Require documented blind-loop/SIBO phenotype, objective anemia, compatible nutritional findings and chronology, and competing-cause review; do not infer anemia from altered anatomy alone." },
] as const;

const kb = loadKnowledgeBase();
const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
const relationships = JSON.parse(fs.readFileSync(path.join(root, "data/evidence/master-relationships.json"), "utf8")) as { relationships: RegistryRelationship[]; counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number }; currentState: string };
const sources = JSON.parse(fs.readFileSync(path.join(root, "data/evidence/master-sources.json"), "utf8")) as { sources: RegistrySource[]; counts: { liveSourceReferenceUses: number; pendingVerificationSourceEntities: number; totalSourceEntitiesIncludingLineage: number }; currentState: string };

describe("Mapping Expansion Batch ME-24", () => {
  it("adds exactly five bounded rank-1 draft mappings with pending evidence", () => {
    for (const row of rows) {
      const mapping = byId.get(row.primaryId) as Mapping | undefined;
      expect(mapping).toBeDefined();
      expect(mapping?.draft).toBe(true);
      const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(suggestion).toBeDefined();
      expect(suggestion?.rank).toBe(1);
      expect(suggestion?.nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
      expect(suggestion?.causalMechanism.hypothesizedOnly).toBe(true);
      expect(suggestion?.evidentiaryProfile.etiologicalConsensus).toBe("NOT_ESTABLISHED");
      expect(suggestion?.evidentiaryProfile.vaNexusProbabilityAlignment).toBe("NOT_ASSERTED");
      expect(suggestion?.sourceReferences).toHaveLength(1);
      const reference = suggestion?.sourceReferences[0];
      expect(reference?.verified).toBe(true);
      expect(reference?.verificationScope).toBe("clinical-evidence");
      expect(reference?.citation).toContain(`PMID ${row.pmid}`);
      expect(suggestion?.evidenceGaps.at(-1)).toBe(`Resolution of publication guard: ${row.guard}`);
    }
  });

  it("preserves each ME-24 relationship and pending source in the authoritative registries", () => {
    for (const row of rows) {
      const relationshipId = `rel-${row.primaryId}-to-${row.targetId}`;
      const relationship = relationships.relationships.find((entry) => entry.relationshipId === relationshipId);
      expect(relationship).toMatchObject({
        primaryId: row.primaryId,
        targetId: row.targetId,
        primaryPublicationState: "draft",
        rank: 1,
        publicationGuard: { status: "explicit", structuredGuardText: row.guard },
        sourceIds: [`pmid-${row.pmid}`],
      });
      const source = sources.sources.find((entry) => entry.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({
        sourceId: `pmid-${row.pmid}`,
        status: "active",
        kind: "clinical-evidence",
        pmid: row.pmid,
        verified: true,
        liveUsageCount: 1,
        liveUses: [{ relationshipId, primaryId: row.primaryId, targetId: row.targetId, sourceIndex: 0 }],
      });
    }
  });

  it("pins the ME-24 pre-qualified-human-citation-verification aggregate state", () => {
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 744, explicitPublicationGuards: 670, legacyRationaleBoundaries: 74 });
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 1330, pendingVerificationSourceEntities: 836, totalSourceEntitiesIncludingLineage: 1191, });
    expect(sources.sources.filter((entry) => entry.status === "pending-verification")).toHaveLength(836);
    expect(sources.sources.filter((entry) => entry.status === "pending-verification" && entry.kind === "clinical-evidence")).toHaveLength(836);
  });
});
