import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const rows = [{"primaryId": "bronchiectasis", "currentTargetId": "pulmonary-hypertension", "targetId": "sleep-apnea", "pmid": "41905893", "guardNeedle": "Do not infer obstructive sleep apnea from bronchiectasis alo"}, {"primaryId": "thyroiditis", "currentTargetId": "hypothyroidism", "targetId": "urticaria", "pmid": "42511690", "guardNeedle": "Require autoimmune thyroiditis and chronic urticaria to be i"}, {"primaryId": "charcot-arthropathy", "currentTargetId": "amputation-or-loss-of-use", "targetId": "osteomyelitis", "pmid": "42141385", "guardNeedle": "Require established Charcot neuroarthropathy of the foot plu"}, {"primaryId": "lyme-disease", "currentTargetId": "cranial-nerve-palsy", "targetId": "uveitis", "pmid": "41546697", "guardNeedle": "Require Lyme disease or Lyme borreliosis and uveitis to be i"}, {"primaryId": "narcolepsy", "currentTargetId": "depressive-disorder", "targetId": "hypertension", "pmid": "41747645", "guardNeedle": "Require separately diagnosed hypertension. Preserve obesity,"}] as const;

describe("mapping expansion ME-10", () => {
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
      expect(added?.rationale).toContain("Mapping Expansion Batch ME-10");
      expect(added?.rationale).toContain(row.guardNeedle);
    }
  });

  it("preserves all five ME-10 clinical references after qualified-human citation verification", () => {
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

  it("moves the published matrix to P1 71 / P2+ 68", () => {
    const published = kb.filter((mapping) => mapping.draft === false);
    expect(published).toHaveLength(139);
    expect(published.filter((mapping) => mapping.suggestions.length === 1)).toHaveLength(66);
    expect(published.filter((mapping) => mapping.suggestions.length >= 2)).toHaveLength(73);
  });

  it("pins the exact final ME-10 citation totals", () => {
    const refs = kb.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []));
expect(refs).toHaveLength(350);
    expect(refs.filter((source) => source.verified === true)).toHaveLength(256);
expect(refs.filter((source) => source.verified === false)).toHaveLength(94);
  });
});
