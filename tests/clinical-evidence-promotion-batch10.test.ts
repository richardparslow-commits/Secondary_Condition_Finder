import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 10", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("publishes primary-hyperparathyroidism kidney-stone research with phenotype safeguards", () => {
    const mapping = byId.get("hyperparathyroidism");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("kidney-stones");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/primary hyperparathyroidism/i);
    expect(suggestion?.rationale).toMatch(/secondary and tertiary|secondary or tertiary/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("36245251");
    expect(source?.verified).toBe(false);
  });

  it("keeps chronic hypoparathyroidism kidney-stone research association-focused", () => {
    const mapping = byId.get("hypoparathyroidism");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("kidney-stones");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/associated/i);
    expect(suggestion?.rationale).toMatch(/not an automatic causal attribution/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("36375810");
    expect(source?.verified).toBe(false);
  });

  it("withdraws emphysema and chronic bronchitis rather than preserving legal-only medical claims", () => {
    for (const id of ["emphysema", "chronic-bronchitis"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.join(" ")).toMatch(/withdrawn/i);
      expect(mapping?.todo.join(" ")).toMatch(/legal|rating/i);
    }
  });

  it("preserves the Batch 10 hyperparathyroidism relocation after later endocrine cleanups", () => {
    const endocrine = ids("data/conditions/endocrine.json");
    const neurological = ids("data/conditions/neurological.json");
    const condition = catalogById.get("hyperparathyroidism");

    expect(endocrine).toContain("hyperparathyroidism");
    expect(neurological).not.toContain("hyperparathyroidism");
    expect(condition?.name).toBe("Hyperparathyroidism");
    expect(condition?.bodySystem).toBe("Endocrine");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.119");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7904/i);
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);

    // Batch 10 intentionally left hypoparathyroidism and hypothyroidism in
    // neurological maintenance. Batch 11 relocated hypoparathyroidism, and
    // Batch 12 subsequently relocated hypothyroidism into endocrine.
    expect(endocrine).toContain("hypoparathyroidism");
    expect(neurological).not.toContain("hypoparathyroidism");
    expect(endocrine).toContain("hypothyroidism");
    expect(neurological).not.toContain("hypothyroidism");
  });
});
