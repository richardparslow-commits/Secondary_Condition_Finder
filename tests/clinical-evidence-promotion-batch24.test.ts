import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 24", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes Paget disease osteoarthritis with a site-specific biomechanical pathway", () => {
    const mapping = byId.get("osteitis-deformans");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("osteoarthritis");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["biomechanical", "disease-progression"]);
    expect(suggestion?.rationale).toMatch(/adjacent|anatomically/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("18504638");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes syringomyelia Charcot arthropathy only with neurologic/anatomic correlation", () => {
    const mapping = byId.get("syringomyelia");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("charcot-arthropathy");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary", "disease-progression"]);
    expect(suggestion?.rationale).toMatch(/sensory|neuropathic|Charcot/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("35994178");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes trigeminal neuralgia depression and anxiety as somatopsychic research", () => {
    const mapping = byId.get("trigeminal-neuralgia");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions.map((entry) => entry.conditionId)).toEqual([
      "depressive-disorder",
      "anxiety-disorder",
    ]);
    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
      expect(suggestion.rationale).toMatch(/systematic-review|Systematic-review|population-level/i);
      expect(suggestion.sourceReferences).toHaveLength(2);
      expect(suggestion.sourceReferences.map((source) => source.sourceUrl)).toEqual([
        "https://pubmed.ncbi.nlm.nih.gov/40355578/",
        "https://pubmed.ncbi.nlm.nih.gov/29526561/",
      ]);
      expect(suggestion.sourceReferences.every((source) => source.verified === false)).toBe(true);
    }
  });

  it("retains broad myositis as draft rather than overgeneralizing IIM-ILD evidence", () => {
    const mapping = byId.get("myositis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.length).toBeGreaterThan(0);
  });

  it("records 23 published identities and 84 intentional safe drafts", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(23);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(84);
  });
});
