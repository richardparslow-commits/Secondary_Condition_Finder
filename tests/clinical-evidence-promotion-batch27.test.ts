import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 27", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 301/301 universe", () => {
    expect(catalog).toHaveLength(301);
    expect(kb).toHaveLength(301);
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
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
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
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
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
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
  });

  it("withdraws three nondirectional comorbidity edges to keep citation debt flat", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

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

  it("preserves the Batch 27 Wave dispositions without freezing later program totals", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { totalIdentities: number; waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(ledger.totalIdentities).toBe(107);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    for (const id of ["uveitis", "retinal-dystrophy", "ptosis"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
  });
});
