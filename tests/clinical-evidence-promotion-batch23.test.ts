import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 23", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("recognizes the later adjustment-disorder GERD withdrawal after phenotype review", () => {
    const adjustment = byId.get("adjustment-disorder");
    expect(adjustment?.draft).toBe(true);
    expect(adjustment?.suggestions).toEqual([]);
    expect(adjustment?.todo.join(" ")).toMatch(/adjustment disorder.*condition-specific|condition-specific.*adjustment disorder/i);
    expect(adjustment?.todo.join(" ")).toMatch(/anxiety|depression|psychosocial/i);
  });

  it("keeps the later consolidated depression erectile-dysfunction source", () => {
    const depression = byId.get("depressive-disorder");
    const ed = depression?.suggestions.find((entry) => entry.conditionId === "erectile-dysfunction");
    expect(ed?.sourceReferences.filter((source) => source.verificationScope === "clinical-evidence")).toHaveLength(1);
    expect(ed?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/34247952/");
    expect(ed?.sourceReferences.some((source) => source.verificationScope === "legal-framework")).toBe(false);
  });

  it("recognizes the later gout depression withdrawal", () => {
    const mapping = byId.get("gout");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/modest|association|incident/i);
    expect(mapping?.todo.join(" ")).toMatch(/caus|aggravat|direction/i);
  });

  it("recognizes the later myasthenia-gravis depression withdrawal", () => {
    const mapping = byId.get("myasthenia-gravis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/prevalence/i);
    expect(mapping?.todo.join(" ")).toMatch(/causal|aggravation|directional/i);
  });

  it("preserves the Batch-23 cleanup without freezing later evidence-led dispositions", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.find((entry) => entry.id === "gout")?.disposition).toBe("safe-draft");
    expect(entries.find((entry) => entry.id === "myasthenia-gravis")?.disposition).toBe("safe-draft");
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
