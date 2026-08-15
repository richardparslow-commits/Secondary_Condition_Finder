import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 15", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("keeps psoriatic-arthritis depression research association-focused after source consolidation", () => {
    const mapping = byId.get("psoriatic-arthritis");
    const suggestion = mapping?.suggestions[0];
    const sources = suggestion?.sourceReferences ?? [];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.rank).toBe(1);
    expect(suggestion?.prevalence).toBe("commonly-explored");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/psoriatic arthritis/i);
    expect(suggestion?.rationale).toMatch(/population-level/i);
    expect(suggestion?.rationale).toMatch(/do not establish/i);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.verificationScope).toBe("clinical-evidence");
    expect(sources[0]?.verified).toBe(false);
    expect(sources[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/38797775/");
  });

  it("retires only redundant PTSD legal references while preserving all three clinical relationships", () => {
    const mapping = byId.get("ptsd");

    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions.map((suggestion) => suggestion.conditionId)).toEqual([
      "sleep-apnea",
      "migraine-headaches",
      "erectile-dysfunction",
    ]);

    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion.sourceReferences.some((source) => /^38 CFR/i.test(source.citation))).toBe(false);
    }
  });
});
