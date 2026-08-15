import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 26", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes transvenous pacemaker lead-associated valve disease with device limits", () => {
    const mapping = byId.get("implantable-cardiac-pacemaker");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("heart-valve-disorders");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication"]);
    expect(suggestion?.rationale).toMatch(/tricuspid/i);
    expect(suggestion?.rationale).toMatch(/transvenous/i);
    expect(suggestion?.rationale).toMatch(/leadless|epicardial/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/34389210/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes pituitary visual impairment only with optic-pathway compression", () => {
    const mapping = byId.get("pituitary-neoplasm");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("visual-impairment");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary"]);
    expect(suggestion?.rationale).toMatch(/chiasm|optic-pathway/i);
    expect(suggestion?.rationale).toMatch(/macroadenoma|suprasellar/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/32419072/");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes valve-replacement anemia only through documented paravalvular leak and hemolysis", () => {
    const mapping = byId.get("heart-valve-replacement-residuals");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("anemia");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication", "intermediate-chain"]);
    expect(suggestion?.rationale).toMatch(/paravalvular/i);
    expect(suggestion?.rationale).toMatch(/hemol/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/40103841/");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("withdraws three lower-quality published edges to hold citation debt flat", () => {
    const adjustment = byId.get("adjustment-disorder");
    expect(adjustment?.suggestions.map((entry) => entry.conditionId)).toEqual(["gerd"]);
    expect(adjustment?.suggestions.some((entry) => entry.conditionId === "sleep-apnea")).toBe(false);

    const asthma = byId.get("asthma");
    expect(asthma?.suggestions.map((entry) => entry.conditionId)).toEqual(["sleep-apnea"]);
    expect(asthma?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);

    const copd = byId.get("copd");
    expect(copd?.suggestions.map((entry) => entry.conditionId)).toEqual(["sleep-apnea"]);
    expect(copd?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);
  });

  it("records 27 published identities and 80 safe drafts", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(27);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(80);
    for (const id of ["pituitary-neoplasm", "heart-valve-replacement-residuals", "implantable-cardiac-pacemaker"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
  });
});
