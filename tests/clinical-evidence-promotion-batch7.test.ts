import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 7", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes active acromegaly to a direct hypertension research pathway", () => {
    const mapping = byId.get("acromegaly");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("hypertension");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary"]);
    expect(suggestion?.rationale).toMatch(/GH\/IGF-I/i);
    expect(suggestion?.rationale).toMatch(/sodium and water retention|sodium.*retention/i);
    expect(suggestion?.rationale).toMatch(/does not establish|not establish/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("42050227");
    expect(source?.citation).toMatch(/Pituitary\. 2026;29\(3\):76/);
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("withdraws anorexia nervosa's legal-only depression relationship", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const mapping = byId.get("anorexia-nervosa");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/withdrawn|legal framework/i);
    expect(mapping?.todo.join(" ")).toMatch(/anorexia/i);
  });

  it("physically relocates Cushing's syndrome into endocrine maintenance with DC 7907", () => {
    const endocrine = ids("data/conditions/endocrine.json");
    const neurological = ids("data/conditions/neurological.json");
    const condition = catalogById.get("cushings-syndrome");

    expect(endocrine).toContain("cushings-syndrome");
    expect(neurological).not.toContain("cushings-syndrome");
    expect(condition?.id).toBe("cushings-syndrome");
    expect(condition?.name).toBe("Cushing's Syndrome");
    expect(condition?.bodySystem).toBe("Endocrine");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.119");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7907/i);
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);
  });

  it("records the later qualified-human verification of the Batch 7 clinical source", () => {
    const source = byId.get("acromegaly")?.suggestions[0]?.sourceReferences[0];
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
    expect(source?.sourceLocator).toMatch(/distal-nephron|sodium/i);
  });
});
