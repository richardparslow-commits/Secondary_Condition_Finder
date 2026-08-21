import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const rows = [{"primaryId": "benign-prostatic-hyperplasia", "currentTargetId": "chronic-kidney-disease", "targetId": "urethral-stricture", "pmid": "37561537", "guardNeedle": "Require documented benign prostatic hyperplasia, docume"}, {"primaryId": "q-fever", "currentTargetId": "gallbladder-disease", "targetId": "hepatitis", "pmid": "29543806", "guardNeedle": "Require clinically established acute Q fever using appr"}, {"primaryId": "polycythemia-vera", "currentTargetId": "leukemia", "targetId": "pulmonary-hypertension", "pmid": "37311222", "guardNeedle": "Require confirmed polycythemia vera and a separately es"}, {"primaryId": "hiatal-hernia", "currentTargetId": "barretts-esophagus", "targetId": "gerd", "pmid": "10482693", "guardNeedle": "Require a documented hiatal hernia, with the source pro"}, {"primaryId": "esophageal-cancer", "currentTargetId": "cardiac-arrhythmia", "targetId": "cardiomyopathy", "pmid": "35289694", "guardNeedle": "Require documented esophageal cancer, actual exposure t"}] as const;

describe("mapping expansion ME-7", () => {
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
      expect(added?.rationale).toContain("Mapping Expansion Batch ME-7");
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

  it("moves the published matrix to P1 86 / P2+ 53", () => {
    const published = kb.filter((mapping) => mapping.draft === false);
    expect(published).toHaveLength(139);
    expect(published.filter((mapping) => mapping.suggestions.length === 1)).toHaveLength(86);
    expect(published.filter((mapping) => mapping.suggestions.length >= 2)).toHaveLength(53);
  });

  it("pins the exact ME-7 pending citation totals", () => {
    const refs = kb.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []));
    expect(refs).toHaveLength(216);
    expect(refs.filter((source) => source.verified === true)).toHaveLength(211);
    expect(refs.filter((source) => source.verified === false)).toHaveLength(5);
  });
});
