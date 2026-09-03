import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 18", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

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

  it("withdraws agoraphobia and panic disorder rather than preserving legal-only medical propositions", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    for (const id of ["agoraphobia", "panic-disorder"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
      expect(mapping?.todo.join(" ")).toMatch(/clinical|legal|rating/i);
    }
  });

  it("publishes only a phenotype-bounded pulmonary-hypertension to right-heart-failure pathway", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("pulmonary-hypertension");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("congestive-heart-failure");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/pre-capillary|pulmonary arterial hypertension/i);
    expect(suggestion?.rationale).toMatch(/group 2|left-heart/i);
    expect(suggestion?.pathwayIntelligence?.issuesToResolve.join(" ")).toMatch(/group 2|left-heart/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("36017548");
    expect(source?.verified).toBe(true);
  }, 120000);

  it("physically relocates pulmonary hypertension into respiratory maintenance without changing identity", () => {
    const cardiovascular = ids("data/conditions/cardiovascular-expansion-wave-3.json");
    const respiratory = ids("data/conditions/respiratory-expansion-wave-4.json");
    const condition = catalogById.get("pulmonary-hypertension");

    expect(cardiovascular).not.toContain("pulmonary-hypertension");
    expect(respiratory).toContain("pulmonary-hypertension");
    expect(condition?.name).toBe("Pulmonary Hypertension");
    expect(condition?.bodySystem).toBe("Respiratory System");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.97");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/6817/i);
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);
  });
});
