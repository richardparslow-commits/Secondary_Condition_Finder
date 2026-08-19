import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 28", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes rectal-prolapse fecal incontinence without unsupported causal pathway labels", () => {
    const mapping = byId.get("rectal-prolapse");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("fecal-incontinence");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/association|treatment-response/i);
    expect(suggestion?.rationale).toMatch(/does not establish.*directly causes|does not establish.*progresses/i);
    expect(suggestion?.rationale).toMatch(/sphincter|pelvic-floor/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/25869649/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes anal-fistula continence impairment only as a sphincter-cutting treatment complication", () => {
    const mapping = byId.get("anal-fistula");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("fecal-incontinence");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication"]);
    expect(suggestion?.rationale).toMatch(/sphincter-cutting|fistulotomy/i);
    expect(suggestion?.rationale).toMatch(/low quality|generally low/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/33387100/");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("keeps hydronephrosis draft rather than substituting obstruction as the primary condition", () => {
    const mapping = byId.get("hydronephrosis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/obstruction|obstructive uropathy/i);
    expect(mapping?.todo.join(" ")).toMatch(/imaging consequence|not synonymous/i);
    expect(mapping?.todo.join(" ")).toMatch(/selected primary|primary condition/i);
  });

  it("withdraws three nondirectional depression associations", () => {
    for (const id of ["gout", "myasthenia-gravis", "multiple-sclerosis"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("preserves the Batch 28 dispositions without freezing later program totals", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    for (const id of ["gout", "myasthenia-gravis", "multiple-sclerosis", "hydronephrosis"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("safe-draft");
    }
    for (const id of ["rectal-prolapse", "anal-fistula"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
  });
});
