import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 13", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 301/301 universe", () => {
    expect(catalog).toHaveLength(301);
    expect(kb).toHaveLength(301);
  });

  it("keeps bounded cauda-equina erectile-dysfunction research after source consolidation", () => {
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
    expect(suggestion?.rationale).toMatch(/lumbar disc herniation/i);
    expect(suggestion?.rationale).toMatch(/do not by themselves establish an individual causal nexus/i);
    expect(suggestion?.rationale).toMatch(/not be generalized automatically to every CES etiology/i);
    expect(suggestion?.rationale).toMatch(/vascular|endocrine|medication-related|psychogenic/i);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.verificationScope).toBe("clinical-evidence");
    expect(sources[0]?.verified).toBe(true);
    expect(sources[0]?.sourceCheckedOn).toBe("2026-08-18");
    expect(sources[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/40380123/");
  });

  it("preserves the Batch-13 legal cleanup after later asthma and COPD arrhythmia withdrawals", () => {
    for (const primaryId of ["asthma", "copd"]) {
      const mapping = byId.get(primaryId);
      const osa = mapping?.suggestions.find((suggestion) => suggestion.conditionId === "sleep-apnea");

      expect(mapping?.draft).toBe(false);
      expect(mapping?.suggestions.some((suggestion) => suggestion.conditionId === "cardiac-arrhythmia")).toBe(false);
      expect(osa).toBeDefined();
      expect(osa?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
      expect(osa?.sourceReferences.some((source) => source.verificationScope === "legal-framework")).toBe(false);
      expect(osa?.sourceReferences.some((source) => /^38 CFR/i.test(source.citation))).toBe(false);
    }
  });
});
