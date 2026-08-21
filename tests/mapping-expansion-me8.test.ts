import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const rows = [{"primaryId": "malaria", "currentTargetId": "epilepsy", "targetId": "anemia", "pmid": "30340592", "guardNeedle": "Require established malaria and a separately documented anem"}, {"primaryId": "hiv-aids", "currentTargetId": "uveitis", "targetId": "peripheral-neuropathy", "pmid": "33226721", "guardNeedle": "Require established HIV/AIDS and a separately diagnosed peri"}, {"primaryId": "myelodysplastic-syndrome", "currentTargetId": "leukemia", "targetId": "anemia", "pmid": "26404446", "guardNeedle": "Require established myelodysplastic syndrome and separately "}, {"primaryId": "primary-myelofibrosis", "currentTargetId": "leukemia", "targetId": "anemia", "pmid": "18947294", "guardNeedle": "Require established primary myelofibrosis and separately doc"}, {"primaryId": "heart-transplant-residuals", "currentTargetId": "skin-cancer", "targetId": "chronic-kidney-disease", "pmid": "25134671", "guardNeedle": "Require an actual heart transplant and separately establishe"}] as const;

describe("mapping expansion ME-8", () => {
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
      expect(added?.prevalence).toBe("sometimes-explored");
      expect(added?.pathwayIntelligence).toBeUndefined();
      expect(added?.rationale).toContain("Mapping Expansion Batch ME-8");
      expect(added?.rationale).toContain(row.guardNeedle);
    }
  });

  it("keeps all five new clinical references pending qualified-human verification", () => {
    for (const row of rows) {
      const added = byId.get(row.primaryId)?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(added?.sourceReferences).toHaveLength(1);
      const source = added?.sourceReferences[0];
      expect(source?.verified).toBe(false);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.sourceUrl).toContain(`/` + row.pmid + `/`);
      expect(source?.citation).toContain(`PMID ${row.pmid}`);
    }
  });

  it("moves the published matrix to P1 81 / P2+ 58", () => {
    const published = kb.filter((mapping) => mapping.draft === false);
    expect(published).toHaveLength(139);
    expect(published.filter((mapping) => mapping.suggestions.length === 1)).toHaveLength(81);
    expect(published.filter((mapping) => mapping.suggestions.length >= 2)).toHaveLength(58);
  });

  it("pins the exact ME-8 pending citation totals", () => {
    const refs = kb.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []));
    expect(refs).toHaveLength(221);
    expect(refs.filter((source) => source.verified === true)).toHaveLength(216);
    expect(refs.filter((source) => source.verified === false)).toHaveLength(5);
  });
});
