import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 8", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("repairs every published hypertension edge with condition-specific clinical evidence", () => {
    const mapping = byId.get("hypertension");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions.map((suggestion) => suggestion.conditionId)).toEqual([
      "chronic-kidney-disease",
      "ischemic-heart-disease",
      "congestive-heart-failure",
      "erectile-dysfunction",
    ]);

    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion.sourceReferences[0]?.sourceUrl).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//);
      expect(suggestion.sourceReferences[0]?.verified).toBe(false);
      expect(suggestion.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-14");
      expect(suggestion.sourceReferences.some((source) => source.citation.startsWith("38 CFR"))).toBe(false);
    }
  });

  it("keeps the renal, coronary, and heart-failure hypertension pathways bounded to individual review", () => {
    const suggestions = byId.get("hypertension")?.suggestions ?? [];
    for (const id of ["chronic-kidney-disease", "ischemic-heart-disease", "congestive-heart-failure"]) {
      const suggestion = suggestions.find((entry) => entry.conditionId === id);
      expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
      expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
      expect(suggestion?.rationale).toMatch(/individual|multifactorial|etiolog|risk factor/i);
    }
  });

  it("keeps hypertension-to-ED association-focused and does not infer medication causation", () => {
    const suggestion = byId.get("hypertension")?.suggestions.find((entry) => entry.conditionId === "erectile-dysfunction");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("27491642");
    expect(suggestion?.rationale).toMatch(/association/i);
    expect(suggestion?.rationale).toMatch(/medication-specific.*separate|not inferred/i);
  });

  it("promotes Cushing syndrome to a direct hypertension pathway with endocrine-specific evidence", () => {
    const mapping = byId.get("cushings-syndrome");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("hypertension");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary"]);
    expect(suggestion?.rationale).toMatch(/Cushing|hypercortisol/i);
    expect(suggestion?.rationale).toMatch(/persist/i);
    expect(source?.sourceUrl).toContain("35950979");
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.verified).toBe(false);
  });

  it("physically relocates type 1 diabetes into endocrine maintenance with DC 7913", () => {
    const endocrine = ids("data/conditions/endocrine.json");
    const neurological = ids("data/conditions/neurological.json");
    const condition = catalogById.get("diabetes-mellitus-type-1");

    expect(endocrine).toContain("diabetes-mellitus-type-1");
    expect(neurological).not.toContain("diabetes-mellitus-type-1");
    expect(condition?.name).toBe("Diabetes Mellitus Type 1");
    expect(condition?.aliases).toEqual(["Type 1 Diabetes", "DM1"]);
    expect(condition?.bodySystem).toBe("Endocrine");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.119");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7913/i);
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);
    expect(byId.get("diabetes-mellitus-type-1")?.draft).toBe(true);
  });
});
