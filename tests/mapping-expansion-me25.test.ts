import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@/lib/kb/load";

type Mapping = ReturnType<typeof loadKnowledgeBase>[number];
type Relationship = {
  relationshipId: string;
  primaryId: string;
  targetId: string;
  primaryPublicationState: string;
  rank: number;
  publicationGuard: { status: string; structuredGuardText: string };
  sourceIds: string[];
  suggestionObjectHash: string;
};
type Source = {
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
  { primaryId: "acanthosis-nigricans", targetId: "diabetes-mellitus-type-2", pmid: "36698243", guard: "Require documented acanthosis nigricans, independently established type 2 diabetes, compatible metabolic phenotype/chronology, and competing-cause review; do not infer diabetes from a skin finding alone." },
  { primaryId: "beriberi", targetId: "congestive-heart-failure", pmid: "29360523", guard: "Require documented wet-beriberi/thiamine-deficiency phenotype, objective heart failure, compatible chronology, and competing-cause review; do not infer heart failure from beriberi alone." },
  { primaryId: "atrial-septal-defect", targetId: "pulmonary-hypertension", pmid: "30305956", guard: "Require documented ASD anatomy, objective pulmonary hypertension, compatible shunt/chronology, and competing-cause review; do not infer pulmonary hypertension from an ASD label alone." },
  { primaryId: "bird-fancier-s-lung", targetId: "pulmonary-fibrosis", pmid: "21870048", guard: "Require documented avian-antigen hypersensitivity-pneumonitis phenotype, objective fibrosis, compatible chronology, and alternative-cause review; do not infer fibrosis from exposure or dyspnea alone." },
  { primaryId: "atrophic-glossitis", targetId: "anemia", pmid: "31076315", guard: "Require documented atrophic glossitis, objective anemia subtype and hematinic findings, compatible chronology, and competing-cause review; do not infer anemia from tongue appearance alone." },
] as const;
const kb = loadKnowledgeBase();
const mappings = new Map(kb.map((mapping) => [mapping.id, mapping]));
const relationships = JSON.parse(fs.readFileSync(path.join(root, "data/evidence/master-relationships.json"), "utf8")) as { relationships: Relationship[]; counts: Record<string, number>; currentState: string };
const sources = JSON.parse(fs.readFileSync(path.join(root, "data/evidence/master-sources.json"), "utf8")) as { sources: Source[]; counts: Record<string, number>; currentState: string };

describe("Mapping Expansion Batch ME-25", () => {
  it("adds exactly five bounded rank-1 draft mappings with pending clinical evidence", () => {
    for (const row of rows) {
      const mapping = mappings.get(row.primaryId) as Mapping | undefined;
      expect(mapping).toBeDefined();
      expect(mapping?.draft).toBe(true);
      expect(mapping?.todo.length).toBeGreaterThan(0);
      const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(suggestion).toBeDefined();
      expect(suggestion?.rank).toBe(1);
      expect(suggestion?.nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
      expect(suggestion?.causalMechanism.hypothesizedOnly).toBe(true);
      expect(suggestion?.evidentiaryProfile.etiologicalConsensus).toBe("NOT_ESTABLISHED");
      expect(suggestion?.evidentiaryProfile.vaNexusProbabilityAlignment).toBe("NOT_ASSERTED");
      expect(suggestion?.pathwayIntelligence).toBeUndefined();
      expect(suggestion?.sourceReferences).toHaveLength(1);
      expect(suggestion?.sourceReferences[0]?.citation).toContain(`PMID ${row.pmid}`);
      expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
      expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion?.evidenceGaps.at(-1)).toBe(`Resolution of publication guard: ${row.guard}`);
    }
  });

  it("preserves all five ME-25 rows and pending sources in the authoritative registries", () => {
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
      expect(relationship?.suggestionObjectHash).toMatch(/^[a-f0-9]{64}$/);
      const source = sources.sources.find((entry) => entry.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({
        sourceId: `pmid-${row.pmid}`,
        status: "pending-verification",
        kind: "clinical-evidence",
        pmid: row.pmid,
        verified: false,
        liveUsageCount: 1,
        liveUses: [{ relationshipId, primaryId: row.primaryId, targetId: row.targetId, sourceIndex: 0 }],
      });
    }
  });

  it("pins the ME-25 pre-qualified-human-citation-verification aggregate state", () => {
    expect(relationships.currentState).toBe("ME29-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    expect(sources.currentState).toBe("ME29-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    expect(relationships.counts).toEqual({ relationships: 318, explicitPublicationGuards: 244, legacyRationaleBoundaries: 74 });
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 326, pendingVerificationSourceEntities: 70, totalSourceEntitiesIncludingLineage: 312 });
    expect(sources.sources.filter((entry) => entry.status === "pending-verification")).toHaveLength(70);
    expect(sources.sources.filter((entry) => entry.status === "pending-verification" && entry.kind === "clinical-evidence")).toHaveLength(70);
  });
});
