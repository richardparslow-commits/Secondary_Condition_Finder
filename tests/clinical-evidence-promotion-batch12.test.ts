import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 12", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the frozen 302/302 universe", () => {
    expect(catalog).toHaveLength(302);
    expect(kb).toHaveLength(302);
  });

  it("repairs chronic-rhinitis to OSA only for a documented allergic-rhinitis phenotype", () => {
    const mapping = byId.get("chronic-rhinitis");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("sleep-apnea");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/allergic-rhinitis phenotype|allergic rhinitis/i);
    expect(suggestion?.rationale).toMatch(/association/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("40774162");
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
    expect(mapping?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);
  });

  it("repairs chronic-sinusitis to OSA as association-focused CRS research", () => {
    const mapping = byId.get("chronic-sinusitis");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("sleep-apnea");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/association/i);
    expect(suggestion?.rationale).toMatch(/Mendelian|genetic/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("41969980");
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
    expect(mapping?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);
  });

  it("physically relocates hypothyroidism into endocrine maintenance with DC 7903 while allowing later clinical withdrawal", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const endocrine = ids("data/conditions/endocrine.json");
    const neurological = ids("data/conditions/neurological.json");
    const condition = catalogById.get("hypothyroidism");
    const mapping = byId.get("hypothyroidism");

    expect(endocrine).toContain("hypothyroidism");
    expect(neurological).not.toContain("hypothyroidism");
    expect(condition?.name).toBe("Hypothyroidism");
    expect(condition?.bodySystem).toBe("Endocrine");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.119");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7903/i);
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/modest|subgroup|directional/i);
  });
});
