import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_THREE_IDS = [
  "thyroiditis",
  "nontoxic-thyroid-enlargement",
  "acromegaly",
  "hyperaldosteronism",
  "hyperpituitarism",
  "diabetes-insipidus",
  "pituitary-neoplasm",
  "hypertensive-heart-disease",
  "cardiomyopathy",
  "heart-valve-replacement-residuals",
  "coronary-bypass-residuals",
  "heart-transplant-residuals",
  "implantable-cardiac-pacemaker",
  "thromboangiitis-obliterans",
  "pulmonary-hypertension",
] as const;

const POST_V2_PROMOTED_WAVE_THREE_IDS = new Set([
  "cardiomyopathy",
  "hypertensive-heart-disease",
  "hyperaldosteronism",
]);

describe("condition catalog expansion wave 3", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("keeps catalog and knowledge-base coverage one-to-one as later waves expand", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(246);
    expect(knowledgeBase).toHaveLength(catalog.length);
  });

  it("preserves all 15 approved Wave 3 conditions", () => {
    for (const id of WAVE_THREE_IDS) {
      expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
    }
  });

  it("keeps non-promoted Wave 3 mappings draft while allowing reviewed post-v2 promotion", () => {
    for (const id of WAVE_THREE_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();

      if (POST_V2_PROMOTED_WAVE_THREE_IDS.has(id)) {
        expect(mapping?.draft).toBe(false);
        expect(mapping?.todo).toEqual([]);
        expect(mapping?.suggestions.length).toBeGreaterThan(0);
        continue;
      }

      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("does not automate rating-citation verification", () => {
    for (const id of WAVE_THREE_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });

  it("keeps behavior-sensitive pituitary neoplasms on the benign/malignant framework", () => {
    const condition = catalogById.get("pituitary-neoplasm");
    expect(condition).toBeDefined();
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7914.*7915|7915.*7914/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/benign.*malignant|malignant.*benign/i);
  });

  it("keeps DC 7916 hyperpituitarism scoped to prolactin-secreting pituitary dysfunction", () => {
    const condition = catalogById.get("hyperpituitarism");
    expect(condition).toBeDefined();
    expect(condition?.name).toMatch(/prolactin-secreting pituitary dysfunction/i);
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7916/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/not.*generic|every form/i);
  });

  it("uses the respiratory pulmonary-vascular authority for pulmonary hypertension", () => {
    const condition = catalogById.get("pulmonary-hypertension");
    expect(condition).toBeDefined();
    expect(condition?.ratingSchedule).toHaveLength(1);
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.97");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/6817/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/respiratory/i);
  });
});
