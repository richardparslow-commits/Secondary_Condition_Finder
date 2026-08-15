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

  it("promotes rectal-prolapse fecal incontinence with multifactorial continence limits", () => {
    const mapping = byId.get("rectal-prolapse");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("fecal-incontinence");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary", "disease-progression"]);
    expect(suggestion?.rationale).toMatch(/multifactorial|sphincter|pelvic-floor/i);
    expect(suggestion?.rationale).toMatch(/ventral rectopexy|prolapse correction/i);
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
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes hydronephrosis CKD only through documented persistent obstruction", () => {
    const mapping = byId.get("hydronephrosis");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("chronic-kidney-disease");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression", "intermediate-chain"]);
    expect(suggestion?.rationale).toMatch(/not synonymous|not.*infer|imaging/i);
    expect(suggestion?.rationale).toMatch(/obstruction/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/36704657/");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("withdraws three nondirectional depression associations to keep citation debt flat", () => {
    for (const id of ["gout", "myasthenia-gravis", "multiple-sclerosis"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("holds Wave totals flat while exchanging three lower-value publications", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(31);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(76);
    for (const id of ["gout", "myasthenia-gravis", "multiple-sclerosis"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("safe-draft");
    }
    for (const id of ["rectal-prolapse", "anal-fistula", "hydronephrosis"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
  });
});
