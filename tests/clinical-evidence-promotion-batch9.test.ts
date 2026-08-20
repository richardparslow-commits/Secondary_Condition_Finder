import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 9", () => {
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

  it("promotes type 1 diabetes to a bounded CKD disease-progression pathway", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("diabetes-mellitus-type-1");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("chronic-kidney-disease");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/5 years|longstanding/i);
    expect(suggestion?.rationale).toMatch(/alternative kidney disease|atypical/i);
    expect(source?.sourceUrl).toContain("41358881");
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("repairs ED-to-depression while removing the unsupported ED-to-GERD treatment chain", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("erectile-dysfunction");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    const suggestion = mapping?.suggestions[0];
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.rank).toBe(1);
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/bidirectional/i);
    expect(suggestion?.rationale).toMatch(/does not establish|causal direction/i);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("29960891");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("physically relocates hyperthyroidism into endocrine maintenance with DC 7900", () => {
    const endocrine = ids("data/conditions/endocrine.json");
    const neurological = ids("data/conditions/neurological.json");
    const condition = catalogById.get("hyperthyroidism");

    expect(endocrine).toContain("hyperthyroidism");
    expect(neurological).not.toContain("hyperthyroidism");
    expect(condition?.name).toBe("Hyperthyroidism");
    expect(condition?.bodySystem).toBe("Endocrine");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.119");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7900/i);
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);
  });

  it("reflects later qualified-human verification for both Batch 9 clinical sources", () => {
    const diabetes = byId.get("diabetes-mellitus-type-1")?.suggestions[0]?.sourceReferences[0];
    expect(diabetes?.verified).toBe(true);
    expect(diabetes?.sourceCheckedOn).toBe("2026-08-18");

    const erectileDysfunction = byId.get("erectile-dysfunction")?.suggestions[0]?.sourceReferences[0];
    expect(erectileDysfunction?.verified).toBe(true);
    expect(erectileDysfunction?.sourceCheckedOn).toBe("2026-08-18");
  });
});
