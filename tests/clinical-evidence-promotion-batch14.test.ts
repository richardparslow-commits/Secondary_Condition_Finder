import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 14", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("clinically repairs the published sleep-apnea mapping without converting associations into automatic causal pathways", () => {
    const mapping = byId.get("sleep-apnea");

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(
      mapping?.suggestions.map(({ conditionId, rank, prevalence }) => ({
        conditionId,
        rank,
        prevalence,
      })),
    ).toEqual([
      { conditionId: "hypertension", rank: 1, prevalence: "commonly-explored" },
      { conditionId: "depressive-disorder", rank: 2, prevalence: "sometimes-explored" },
      { conditionId: "anxiety-disorder", rank: 3, prevalence: "sometimes-explored" },
    ]);

    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.pathwayIntelligence).toBeUndefined();
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion.sourceReferences[0]?.verified).toBe(false);
      expect(suggestion.sourceReferences.some((source) => /^38 CFR/i.test(source.citation))).toBe(false);
    }
  });

  it("uses condition-specific sources and withdraws the unsupported directional GERD edge", () => {
    const mapping = byId.get("sleep-apnea");
    const bySecondary = new Map(
      (mapping?.suggestions ?? []).map((suggestion) => [suggestion.conditionId, suggestion]),
    );

    expect(bySecondary.get("hypertension")?.sourceReferences[0]?.sourceUrl).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/40364148/",
    );
    expect(bySecondary.get("depressive-disorder")?.sourceReferences[0]?.sourceUrl).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/38888794/",
    );
    expect(bySecondary.get("anxiety-disorder")?.sourceReferences[0]?.sourceUrl).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/30453780/",
    );
    expect(bySecondary.has("gerd")).toBe(false);
  });
});
