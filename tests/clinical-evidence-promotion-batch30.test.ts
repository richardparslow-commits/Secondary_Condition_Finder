import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 30", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("recognizes Batch-8 qualified-human verification of ovarian-cancer treatment neuropathy", () => {
    const mapping = byId.get("ovarian-cancer");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("peripheral-neuropathy");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication"]);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("24582486");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("keeps testicular-cancer treatment hypogonadism unverified", () => {
    const mapping = byId.get("testicular-cancer");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("hypogonadism");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication"]);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("27009402");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
  });

  it("keeps pulmonary histoplasmosis draft because adrenal evidence cannot be enforced by the current identity", () => {
    const mapping = byId.get("histoplasmosis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/pulmonary|adrenal|disseminated|disease-site/i);
    expect(mapping?.todo.join(" ")).toMatch(/30656706/);
  });

  it("recognizes later M1 publication of laryngeal-cancer to aphonia as treatment-specific", () => {
    const mapping = byId.get("laryngeal-cancer");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("aphonia");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication"]);
    expect(suggestion?.sourceReferences).toHaveLength(2);
    expect(suggestion?.sourceReferences.every((reference) => reference.verified === false)).toBe(true);
  });

  it("keeps the two surviving cancer pathways treatment-specific", () => {
    expect(byId.get("ovarian-cancer")?.suggestions[0]?.rationale).toMatch(/paclitaxel|treatment/i);
    expect(byId.get("testicular-cancer")?.suggestions[0]?.rationale).toMatch(/chemotherapy|radiotherapy|treatment/i);
  });

  it("withdraws three nondirectional published depression edges", () => {
    for (const id of ["parkinsons-disease", "seizure-disorder", "psoriatic-arthritis"] as const) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.join(" ")).toMatch(/direction|prevalence|comorbidity|screen|caused|aggravat/i);
    }
  });

  it("narrows trigeminal neuralgia by removing the weaker anxiety-only psychometric edge", () => {
    const mapping = byId.get("trigeminal-neuralgia");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("depressive-disorder");
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.sourceUrl).toContain("40355578");
    expect(mapping?.suggestions.some((suggestion) => suggestion.conditionId === "anxiety-disorder")).toBe(false);
  });

  it("keeps the other seven Wave 7 identities safe-draft", () => {
    for (const id of [
      "amebiasis",
      "actinomycosis",
      "nocardiosis",
      "histoplasmosis",
      "strongyloidiasis",
      "rickettsial-ehrlichial-anaplasma-infection",
      "mandibular-nonunion",
    ] as const) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("records 31 published, 76 safe-draft, and zero candidates", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(31);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(76);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
