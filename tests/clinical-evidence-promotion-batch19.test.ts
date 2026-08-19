import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 19", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("withdraws four legal/rating-only mental mappings", () => {
    for (const id of ["bipolar-disorder", "persistent-depressive-disorder", "social-anxiety-disorder", "somatic-symptom-disorder"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
      expect(mapping?.todo.join(" ")).toMatch(/clinical|legal|rating/i);
    }
  });

  it("publishes thyroiditis-to-hypothyroidism only for a persistent autoimmune phenotype", () => {
    const mapping = byId.get("thyroiditis");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("hypothyroidism");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/autoimmune|Hashimoto/i);
    expect(suggestion?.rationale).toMatch(/transient|subacute|postpartum/i);
    expect(suggestion?.pathwayIntelligence?.issuesToResolve.join(" ")).toMatch(/not be generalized|subtype/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("42232752");
    expect(source?.verified).toBe(true);
  });
});
