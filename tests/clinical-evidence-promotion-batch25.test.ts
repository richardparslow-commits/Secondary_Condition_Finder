import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 25", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes FAI hip osteoarthritis with morphology-specific limits", () => {
    const mapping = byId.get("femoroacetabular-impingement");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("osteoarthritis");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["biomechanical", "disease-progression"]);
    expect(suggestion?.rationale).toMatch(/cam-type/i);
    expect(suggestion?.rationale).toMatch(/pincer/i);
    expect(suggestion?.rationale).toMatch(/same hip|same-hip/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/26524551/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("does not overgeneralize Lisfranc PTOA evidence to malunion/nonunion", () => {
    const mapping = byId.get("tarsal-metatarsal-malunion-nonunion");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
  });

  it("does not turn broad named neuropathies into generic CRPS pathways", () => {
    for (const id of ["radial-neuropathy", "median-neuropathy", "tibial-neuropathy", "femoral-neuropathy"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
    }
  });

  it("pays for the new published source without raising review debt", () => {
    const gerd = byId.get("rheumatoid-arthritis")?.suggestions.find((entry) => entry.conditionId === "gerd");
    expect(gerd?.sourceReferences.filter((source) => source.verificationScope === "clinical-evidence")).toHaveLength(1);
    expect(gerd?.sourceReferences.some((source) => source.sourceUrl === "https://pubmed.ncbi.nlm.nih.gov/33674957/")).toBe(false);
    expect(gerd?.sourceReferences.some((source) => source.sourceUrl === "https://pubmed.ncbi.nlm.nih.gov/18671778/")).toBe(true);
  });

  it("preserves the Batch 25 FAI promotion without freezing later program totals", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.find((entry) => entry.id === "femoroacetabular-impingement")?.disposition).toBe("published-evidence-led");
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
