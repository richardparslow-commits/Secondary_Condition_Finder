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

  it.each([
    ["histoplasmosis", "addisons-disease", "disease-progression", "30656706"],
    ["ovarian-cancer", "peripheral-neuropathy", "treatment-complication", "24582486"],
    ["testicular-cancer", "hypogonadism", "treatment-complication", "27009402"],
    ["laryngeal-cancer", "aphonia", "treatment-complication", "29086803"],
  ])("publishes %s to %s with one bounded unverified clinical source", (primaryId, secondaryId, pathway, pmid) => {
    const mapping = byId.get(primaryId);
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe(secondaryId);
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual([pathway]);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain(pmid);
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("keeps adrenal histoplasmosis anatomically bounded rather than generalizing pulmonary disease", () => {
    const suggestion = byId.get("histoplasmosis")?.suggestions[0];
    expect(suggestion?.rationale).toMatch(/adrenal|disseminated/i);
    expect(suggestion?.rationale).toMatch(/pulmonary-only/i);
    expect(suggestion?.evidenceGaps.join(" ")).toMatch(/adrenal/i);
  });

  it("keeps the three cancer pathways treatment-specific", () => {
    expect(byId.get("ovarian-cancer")?.suggestions[0]?.rationale).toMatch(/paclitaxel|treatment/i);
    expect(byId.get("testicular-cancer")?.suggestions[0]?.rationale).toMatch(/chemotherapy|radiotherapy|treatment/i);
    expect(byId.get("laryngeal-cancer")?.suggestions[0]?.rationale).toMatch(/total laryngectomy/i);
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

  it("keeps the other six Wave 7 identities safe-draft", () => {
    for (const id of [
      "amebiasis",
      "actinomycosis",
      "nocardiosis",
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

  it("records 32 published, 75 safe-draft, and zero candidates", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(32);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(75);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
