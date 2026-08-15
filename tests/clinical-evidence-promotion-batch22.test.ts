import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 22", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("withdraws the broad skull-fracture mapping rather than preserving six legal/rating-only diagnoses", () => {
    const mapping = byId.get("skull-fracture-non-basilar-and-basal");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/six|subtype|heterogeneous/i);
  });

  it("clinically repairs only post-concussion headache research and removes anxiety", () => {
    const mapping = byId.get("post-concussion-syndrome");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("migraine-headaches");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/post-traumatic headache/i);
    expect(suggestion?.rationale).toMatch(/distinct diagnosis|does not justify|not.*every/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("42133249");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
    expect(mapping?.suggestions.some((entry) => entry.conditionId === "anxiety-disorder")).toBe(false);
  });

  it("promotes seizure-disorder depression only as association/comorbidity research", () => {
    const mapping = byId.get("seizure-disorder");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/comorbidity|association/i);
    expect(suggestion?.rationale).toMatch(/40%/);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("41967683");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });
});
