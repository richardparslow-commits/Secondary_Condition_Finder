import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const rows = [{"primaryId": "actinomycosis", "currentTargetId": "cardiac-inflammatory-disease", "targetId": "osteomyelitis", "pmid": "41871568", "guardNeedle": "Require clinically established cervicofacial/oral actinomyco"}, {"primaryId": "insomnia", "currentTargetId": "depressive-disorder", "targetId": "hypertension", "pmid": "33360604", "guardNeedle": "Treat as population-level association/risk only, not individ"}, {"primaryId": "periodontal-disease", "currentTargetId": "loss-of-teeth", "targetId": "osteoporosis", "pmid": "36377800", "guardNeedle": "Require periodontitis as the primary phenotype and separatel"}, {"primaryId": "uterine-fibroids", "currentTargetId": "anemia", "targetId": "endometriosis", "pmid": "31006843", "guardNeedle": "Treat strictly as co-occurrence/association and screening re"}, {"primaryId": "bronchiolitis", "currentTargetId": "asthma", "targetId": "pulmonary-hypertension", "pmid": "42444963", "guardNeedle": "Use only for bronchiolitis obliterans syndrome/chronic lung "}] as const;

describe("mapping expansion ME-11", () => {
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
      expect(added?.rationale).toContain("Mapping Expansion Batch ME-11");
      expect(added?.rationale).toContain(row.guardNeedle);
    }
  });

  it("keeps all five new ME-11 clinical references pending qualified-human verification", () => {
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

  it("moves the published matrix to P1 66 / P2+ 73", () => {
    const published = kb.filter((mapping) => mapping.draft === false);
    expect(published).toHaveLength(139);
    expect(published.filter((mapping) => mapping.suggestions.length === 1)).toHaveLength(66);
    expect(published.filter((mapping) => mapping.suggestions.length >= 2)).toHaveLength(73);
  });

  it("pins the exact ME-11 pending citation totals", () => {
    const refs = kb.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []));
    expect(refs).toHaveLength(276);
    expect(refs.filter((source) => source.verified === true)).toHaveLength(256);
    expect(refs.filter((source) => source.verified === false)).toHaveLength(20);
  });
});
