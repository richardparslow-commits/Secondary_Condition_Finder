import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 20", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("withdraws anxiety, schizophrenia, and substance-use mappings that were legal/rating-only", () => {
    for (const id of ["anxiety-disorder", "schizophrenia", "substance-use-disorder"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("keeps only clinically sourced mTBI headache research with the migraine-target limitation", () => {
    const mapping = byId.get("mild-tbi");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("migraine-headaches");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/post-traumatic headache/i);
    expect(suggestion?.rationale).toMatch(/not.*every|does not justify/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("38568491");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("recognizes the later evidence-quality withdrawal of Parkinson depression", () => {
    const mapping = byId.get("parkinsons-disease");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/27358339/);
    expect(mapping?.todo.join(" ")).toMatch(/prevalence|screening|direction|caused|aggravat/i);
  });
});
