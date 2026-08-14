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

describe("condition catalog expansion wave 3", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("moves the implemented catalog from 231 to 246 conditions", () => {
    expect(catalog).toHaveLength(246);
    expect(knowledgeBase).toHaveLength(246);
  });

  it("adds all 15 approved Wave 3 conditions", () => {
    for (const id of WAVE_THREE_IDS) {
      expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
    }
  });

  it("gives every Wave 3 condition exactly one safe draft mapping", () => {
    for (const id of WAVE_THREE_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();
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

  it("uses the respiratory pulmonary-vascular authority for pulmonary hypertension", () => {
    const condition = catalogById.get("pulmonary-hypertension");
    expect(condition).toBeDefined();
    expect(condition?.ratingSchedule).toHaveLength(1);
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.97");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/6817/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/respiratory/i);
  });
});
