import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 21", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 301/301 universe", () => {
    expect(catalog).toHaveLength(301);
    expect(kb).toHaveLength(301);
  });

  it("withdraws four neurological mappings whose exact downstream diagnoses were unsupported", () => {
    for (const id of ["micro-tbi", "subdural-hematoma", "epidural-hematoma", "rem-sleep-disorder"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("recognizes the later multiple-sclerosis depression prevalence withdrawal", () => {
    const mapping = byId.get("multiple-sclerosis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/prevalence|heterogeneity/i);
    expect(mapping?.todo.join(" ")).toMatch(/causal|aggravation|directional/i);
  });
});
