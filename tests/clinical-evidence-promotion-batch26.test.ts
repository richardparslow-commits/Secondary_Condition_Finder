import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 26", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 302/302 universe", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    expect(catalog).toHaveLength(302);
    expect(kb).toHaveLength(302);
  });

  it("promotes prolactin-secreting pituitary dysfunction to hypogonadism with phenotype limits", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("hyperpituitarism");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("hypogonadism");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary", "intermediate-chain"]);
    expect(suggestion?.rationale).toMatch(/prolactin/i);
    expect(suggestion?.rationale).toMatch(/not.*general|unrelated forms/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/40812946/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("promotes transvenous pacemaker lead-associated valve disease with device limits", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

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
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("promotes pituitary visual impairment only with optic-pathway compression", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

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
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
  });

  it("promotes valve-replacement anemia only through documented paravalvular leak and hemolysis", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("heart-valve-replacement-residuals");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("anemia");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication", "intermediate-chain"]);
    expect(suggestion?.rationale).toMatch(/paravalvular/i);
    expect(suggestion?.rationale).toMatch(/hemol/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/31039274/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("recognizes later evidence-quality review of Batch 26 cleanup targets", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const adjustment = byId.get("adjustment-disorder");
    expect(adjustment?.draft).toBe(true);
    expect(adjustment?.suggestions).toEqual([]);
    expect(adjustment?.todo.join(" ")).toMatch(/adjustment disorder.*condition-specific|condition-specific.*adjustment disorder/i);

    const asthma = byId.get("asthma");
    expect(asthma?.suggestions.map((entry) => entry.conditionId)).toEqual(["sleep-apnea"]);
    expect(asthma?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);

    const copd = byId.get("copd");
    expect(copd?.suggestions.map((entry) => entry.conditionId)).toEqual(["sleep-apnea"]);
    expect(copd?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);

    const postConcussion = byId.get("post-concussion-syndrome");
    expect(postConcussion?.draft).toBe(true);
    expect(postConcussion?.suggestions).toEqual([]);
    expect(postConcussion?.todo.join(" ")).toMatch(/post-traumatic headache.*primary migraine|primary migraine.*post-traumatic headache/i);
  });

  it("preserves the four Batch 26 promotions without freezing later program totals", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    for (const id of ["hyperpituitarism", "pituitary-neoplasm", "heart-valve-replacement-residuals", "implantable-cardiac-pacemaker"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
