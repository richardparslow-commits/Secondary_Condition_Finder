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
    expect(suggestion?.sourceReferences).toHaveLength(1);
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
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("35994178");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes trigeminal neuralgia depression and anxiety with one focused source per target", () => {
    const mapping = byId.get("trigeminal-neuralgia");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions.map((entry) => entry.conditionId)).toEqual([
      "depressive-disorder",
      "anxiety-disorder",
    ]);
    const depression = mapping?.suggestions[0];
    const anxiety = mapping?.suggestions[1];
    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
      expect(suggestion.rationale).toMatch(/systematic-review|Systematic-review|population-level/i);
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]?.verified).toBe(false);
    }
    expect(depression?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/40355578/");
    expect(anxiety?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/29526561/");
  });

  it("recognizes later evidence-quality review without losing the surviving Batch 24 edges", () => {
    const adjustment = byId.get("adjustment-disorder");
    expect(adjustment?.draft).toBe(true);
    expect(adjustment?.suggestions).toEqual([]);
    expect(adjustment?.todo.join(" ")).toMatch(/35362447/);
    expect(adjustment?.todo.join(" ")).toMatch(/adjustment disorder.*condition-specific|condition-specific.*adjustment disorder/i);

    const psaDepression = byId.get("psoriatic-arthritis")?.suggestions[0];
    expect(psaDepression?.sourceReferences).toHaveLength(1);
    expect(psaDepression?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/38797775/");

    const cesEd = byId.get("cauda-equina-syndrome")?.suggestions[0];
    expect(cesEd?.sourceReferences).toHaveLength(1);
    expect(cesEd?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/40380123/");

    const depressionEd = byId.get("depressive-disorder")?.suggestions.find((entry) => entry.conditionId === "erectile-dysfunction");
    expect(depressionEd?.sourceReferences).toHaveLength(1);
    expect(depressionEd?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/34247952/");
  });

  it("retains broad myositis as draft rather than overgeneralizing IIM-ILD evidence", () => {
    const mapping = byId.get("myositis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.length).toBeGreaterThan(0);
  });

  it("preserves the three Batch 24 promotions without freezing later program totals", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    for (const id of ["osteitis-deformans", "syringomyelia", "trigeminal-neuralgia"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
