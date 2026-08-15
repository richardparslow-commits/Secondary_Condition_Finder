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

  it("preserves the Batch-22 anxiety withdrawal after later post-concussion headache target cleanup", () => {
    const mapping = byId.get("post-concussion-syndrome");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/post-traumatic headache/i);
    expect(mapping?.todo.join(" ")).toMatch(/primary migraine|reclassification|target/i);
  });

  it("recognizes the later evidence-quality withdrawal of seizure-disorder depression", () => {
    const mapping = byId.get("seizure-disorder");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/41967683/);
    expect(mapping?.todo.join(" ")).toMatch(/cross-sectional|prevalence|comorbidity|direction|causal|aggravat/i);
  });
});
