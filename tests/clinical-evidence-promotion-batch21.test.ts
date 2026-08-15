import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 21", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("withdraws four neurological mappings whose exact downstream diagnoses were unsupported", () => {
    for (const id of ["micro-tbi", "subdural-hematoma", "epidural-hematoma", "rem-sleep-disorder"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("promotes multiple-sclerosis depression only as association/comorbidity research", () => {
    const mapping = byId.get("multiple-sclerosis");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/comorbidity|association/i);
    expect(suggestion?.rationale).toMatch(/30\.5/);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("28017241");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });
});
