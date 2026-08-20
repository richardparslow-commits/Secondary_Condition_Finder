import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 11", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the frozen 302/302 universe", () => {
    expect(catalog).toHaveLength(302);
    expect(kb).toHaveLength(302);
  });

  it("recognizes the later withdrawal of the modest hypothyroidism-depression association", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const mapping = byId.get("hypothyroidism");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/modest|subgroup|directional/i);
  });

  it("publishes confirmed hypogonadism-to-osteoporosis research with bone-health safeguards", () => {
    const mapping = byId.get("hypogonadism");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("osteoporosis");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/confirmed male hypogonadism|confirmed clinical hypogonadism/i);
    expect(suggestion?.rationale).toMatch(/fracture/i);
    expect(suggestion?.pathwayIntelligence?.issuesToResolve.join(" ")).toMatch(/fracture/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("29499097");
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("clinically repairs only the ILD-to-OSA edge and removes the legal-only arrhythmia edge", () => {
    const mapping = byId.get("interstitial-lung-disease");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("sleep-apnea");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/association|prevalence/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("33403599");
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
    expect(mapping?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);
  });

  it("withdraws broad pulmonary-fibrosis claims rather than generalizing IPF evidence", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const mapping = byId.get("pulmonary-fibrosis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/withdrawn/i);
    expect(mapping?.todo.join(" ")).toMatch(/idiopathic pulmonary fibrosis|IPF/i);
  });

  it("preserves the Batch 11 hypoparathyroidism relocation after Batch 12 moves hypothyroidism", () => {
    const endocrine = ids("data/conditions/endocrine.json");
    const neurological = ids("data/conditions/neurological.json");
    const condition = catalogById.get("hypoparathyroidism");
    expect(endocrine).toContain("hypoparathyroidism");
    expect(neurological).not.toContain("hypoparathyroidism");
    expect(condition?.name).toBe("Hypoparathyroidism");
    expect(condition?.bodySystem).toBe("Endocrine");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.119");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7905/i);
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);
    expect(endocrine).toContain("hypothyroidism");
    expect(neurological).not.toContain("hypothyroidism");
  });
});
