import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_EIGHT_IDS = [
  "fibromyalgia",
  "hip-strain",
  "ankle-strain",
  "contralateral-knee-condition",
  "diabetic-retinopathy",
  "insomnia",
  "substance-use-disorder",
] as const;

describe("catalog quality wave 8", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the target-v2 300/300 integrity contract", () => {
    expect(catalog).toHaveLength(300);
    expect(knowledgeBase).toHaveLength(300);
  });

  it("keeps all Wave 8 quality targets present without creating new identities", () => {
    for (const id of WAVE_EIGHT_IDS) {
      expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
    }
  });

  it("corrects fibromyalgia to the musculoskeletal DC 5025 identity", () => {
    const condition = catalogById.get("fibromyalgia");

    expect(condition?.bodySystem).toBe("Musculoskeletal System");
    expect(condition?.ratingSchedule).toHaveLength(1);
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.71a");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/5025/i);
    expect(condition?.ratingSchedule.some((reference) => /4\.88b/.test(reference.citation))).toBe(false);
    expect(condition?.reviewNotes.join(" ")).toMatch(/historical.*4\.88b|4\.88b.*carryover/i);
  });

  it("uses residual frameworks instead of invented strain-specific codes", () => {
    const hip = catalogById.get("hip-strain");
    const ankle = catalogById.get("ankle-strain");

    expect(hip?.ratingSchedule[0]?.citation).toBe("38 CFR 4.71a");
    expect(hip?.ratingSchedule[0]?.note).toMatch(/5250-5255/i);
    expect(hip?.ratingSchedule[0]?.note).toMatch(/no single hip-strain-specific/i);

    expect(ankle?.ratingSchedule[0]?.citation).toBe("38 CFR 4.71a");
    expect(ankle?.ratingSchedule[0]?.note).toMatch(/5271/i);
    expect(ankle?.ratingSchedule[0]?.note).toMatch(/no single ankle-strain-specific/i);
  });

  it("records the express diabetic-retinopathy rating identity", () => {
    const condition = catalogById.get("diabetic-retinopathy");

    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.79");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/6040/i);
  });

  it("keeps insomnia and substance-use disorder framework-only", () => {
    const insomnia = catalogById.get("insomnia");
    const substanceUse = catalogById.get("substance-use-disorder");

    expect(insomnia?.ratingSchedule[0]?.citation).toBe("38 CFR 4.130");
    expect(insomnia?.ratingSchedule[0]?.note).toMatch(/chronic sleep impairment/i);
    expect(insomnia?.ratingSchedule[0]?.note).toMatch(/not assigned.*insomnia-specific/i);

    expect(substanceUse?.ratingSchedule[0]?.citation).toBe("38 CFR 4.130");
    expect(substanceUse?.ratingSchedule[0]?.note).toMatch(/not assigned.*single generic/i);
    expect(substanceUse?.reviewNotes.join(" ")).toMatch(/service connection or compensability/i);
  });

  it("quarantines the contralateral-knee relationship placeholder instead of inventing a code", () => {
    const condition = catalogById.get("contralateral-knee-condition");

    expect(condition?.ratingSchedule).toEqual([]);
    expect(condition?.reviewNotes.join(" ")).toMatch(/not a distinct diagnosis/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/laterality.*attribute|attribute.*laterality/i);
  });

  it("does not automate verification of corrected rating references", () => {
    for (const id of WAVE_EIGHT_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });
});
