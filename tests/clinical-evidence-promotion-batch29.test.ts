import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 29", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes scalp discoid lupus to scarring alopecia with phenotype and anatomy limits", () => {
    const mapping = byId.get("discoid-lupus");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("scarring-alopecia");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/scalp/i);
    expect(suggestion?.rationale).toMatch(/cicatricial|scarring/i);
    expect(suggestion?.rationale).toMatch(/alopecia areata|nonscarring/i);
    expect(suggestion?.rationale).toMatch(/systemic lupus/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/35817588/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("withdraws adjustment-disorder GERD because the cited phenotype was anxiety/depression rather than adjustment disorder", () => {
    const mapping = byId.get("adjustment-disorder");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/35362447/);
    expect(mapping?.todo.join(" ")).toMatch(/anxiety|depression|psychosocial/i);
  });

  it("preserves the Batch-29 Wave 6 disposition without freezing later program totals", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.find((entry) => entry.id === "discoid-lupus")?.disposition).toBe("published-evidence-led");
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });

  it("keeps target-mismatched Wave 6 hematologic candidates safely draft", () => {
    for (const id of ["essential-thrombocythemia", "primary-myelofibrosis", "myelodysplastic-syndrome"] as const) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });
});
