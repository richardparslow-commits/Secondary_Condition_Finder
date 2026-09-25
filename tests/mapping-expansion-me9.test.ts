import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const rows = [{"primaryId": "discoid-lupus", "currentTargetId": "scarring-alopecia", "targetId": "systemic-lupus-erythematosus", "pmid": "41178896", "guardNeedle": "Require established discoid lupus erythematosus and separate"}, {"primaryId": "colorectal-cancer", "currentTargetId": "peripheral-neuropathy", "targetId": "fecal-incontinence", "pmid": "33277056", "guardNeedle": "Require established colon cancer within the colorectal-cance"}, {"primaryId": "hypogonadism", "currentTargetId": "osteoporosis", "targetId": "erectile-dysfunction", "pmid": "34856556", "guardNeedle": "Require established androgen-deficiency hypogonadism consist"}, {"primaryId": "pancreatitis", "currentTargetId": "cardiac-inflammatory-disease", "targetId": "pancreatic-cancer", "pmid": "35142721", "guardNeedle": "Primary phenotype must be chronic pancreatitis, not an isola"}, {"primaryId": "hypoparathyroidism", "currentTargetId": "kidney-stones", "targetId": "chronic-kidney-disease", "pmid": "33599907", "guardNeedle": "Require chronic hypoparathyroidism and separately establishe"}] as const;

describe("mapping expansion ME-9", () => {
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("adds exactly the approved five rank-2 relationships while preserving rank 1", () => {
    for (const row of rows) {
      const mapping = byId.get(row.primaryId);
      expect(mapping).toBeDefined();
      expect(mapping?.draft).toBe(false);
      expect(mapping?.suggestions).toHaveLength(2);
      expect(mapping?.suggestions[0]?.conditionId).toBe(row.currentTargetId);
      expect(mapping?.suggestions[0]?.rank).toBe(1);
      const added = mapping?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(added?.rank).toBe(2);
      expect(added?.nexusClaim?.nexusClassification).toBeDefined(); expect(added?.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(added?.pathwayIntelligence).toBeUndefined();
      expect(added?.rationale).toContain("Mapping Expansion Batch ME-9");
      expect(added?.rationale).toContain(row.guardNeedle);
    }
  });

  it("keeps all five ME-9 clinical references qualified-human verified", () => {
    for (const row of rows) {
      const added = byId.get(row.primaryId)?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(added?.sourceReferences).toHaveLength(1);
      const source = added?.sourceReferences[0];
      expect(source?.verified).toBe(true);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.sourceUrl).toContain(`/` + row.pmid + `/`);
      expect(source?.citation).toContain(`PMID ${row.pmid}`);
    }
  });

  it("moves the published matrix to P1 76 / P2+ 63", () => {
    const published = kb.filter((mapping) => mapping.draft === false);
    expect(published).toHaveLength(140);
    expect(published.filter((mapping) => mapping.suggestions.length === 1)).toHaveLength(67);
    expect(published.filter((mapping) => mapping.suggestions.length >= 2)).toHaveLength(73);
  });

  it("pins the exact final ME-9 citation totals", () => {
    const refs = kb.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []));
expect(refs).toHaveLength(1051);
    expect(refs.filter((source) => source.verified === true)).toHaveLength(383);
expect(refs.filter((r) => r.verified === false)).toHaveLength(668);
  });
});
