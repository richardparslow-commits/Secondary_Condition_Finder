import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 27", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes uveitic glaucoma only with objective glaucoma and mechanism review", () => {
    const mapping = byId.get("uveitis");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("glaucoma");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression", "treatment-complication"]);
    expect(suggestion?.rationale).toMatch(/ocular hypertension alone|not interchangeable/i);
    expect(suggestion?.rationale).toMatch(/corticosteroid/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/31816329/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes retinal-dystrophy visual impairment with phenotype-specific limits", () => {
    const mapping = byId.get("retinal-dystrophy");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("visual-impairment");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/heterogeneous/i);
    expect(suggestion?.rationale).toMatch(/visual-field|visual-acuity|acuity/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/34839010/");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes ptosis visual impairment only with objective mechanical field obstruction", () => {
    const mapping = byId.get("ptosis");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("visual-impairment");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary"]);
    expect(suggestion?.rationale).toMatch(/superior visual field/i);
    expect(suggestion?.rationale).toMatch(/objective|testing/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/35895522/");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("withdraws three nondirectional comorbidity edges to keep citation debt flat", () => {
    for (const id of ["anosmia", "alopecia-areata", "hypothyroidism"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
    expect(byId.get("anosmia")?.todo.join(" ")).toMatch(/causal pathways|directional/i);
    expect(byId.get("alopecia-areata")?.todo.join(" ")).toMatch(/comorbidity|directional/i);
    expect(byId.get("hypothyroidism")?.todo.join(" ")).toMatch(/modest|subgroup|directional/i);
  });

  it("records 31 published identities and 76 safe drafts", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(31);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(76);
    for (const id of ["uveitis", "retinal-dystrophy", "ptosis"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
  });
});
