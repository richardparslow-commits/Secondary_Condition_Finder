import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 13", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes bounded cauda-equina erectile-dysfunction research without converting outcome data into automatic causation", () => {
    const mapping = byId.get("cauda-equina-syndrome");
    const suggestion = mapping?.suggestions[0];
    const sources = suggestion?.sourceReferences ?? [];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("erectile-dysfunction");
    expect(suggestion?.rank).toBe(1);
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/sexual dysfunction/i);
    expect(suggestion?.rationale).toMatch(/erectile dysfunction/i);
    expect(suggestion?.rationale).toMatch(/do not by themselves establish an individual causal nexus/i);
    expect(suggestion?.rationale).toMatch(/vascular|endocrine|medication-related|psychogenic/i);
    expect(sources).toHaveLength(2);
    expect(sources.every((source) => source.verificationScope === "clinical-evidence")).toBe(true);
    expect(sources.every((source) => source.verified === false)).toBe(true);
    expect(sources.map((source) => source.sourceUrl)).toEqual([
      "https://pubmed.ncbi.nlm.nih.gov/40380123/",
      "https://pubmed.ncbi.nlm.nih.gov/42472710/",
    ]);
  });

  it("retires only the redundant local legal-framework references from asthma and COPD arrhythmia research", () => {
    for (const primaryId of ["asthma", "copd"]) {
      const mapping = byId.get(primaryId);
      const arrhythmia = mapping?.suggestions.find((suggestion) => suggestion.conditionId === "cardiac-arrhythmia");

      expect(mapping?.draft).toBe(false);
      expect(arrhythmia).toBeDefined();
      expect(arrhythmia?.sourceReferences).toHaveLength(1);
      expect(arrhythmia?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(arrhythmia?.sourceReferences.some((source) => source.verificationScope === "legal-framework")).toBe(false);
      expect(arrhythmia?.sourceReferences.some((source) => /^38 CFR/i.test(source.citation))).toBe(false);
    }
  });
});
