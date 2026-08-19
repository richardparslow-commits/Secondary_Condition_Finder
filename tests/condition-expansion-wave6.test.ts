import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_SIX_IDS = [
  "specific-phobia",
  "dissociative-disorder",
  "depersonalization-derealization-disorder",
  "functional-neurological-symptom-disorder",
  "illness-anxiety-disorder",
  "body-dysmorphic-disorder",
  "hoarding-disorder",
  "delusional-disorder",
  "essential-thrombocythemia",
  "primary-myelofibrosis",
  "myelodysplastic-syndrome",
  "discoid-lupus",
  "scarring-alopecia",
  "hyperhidrosis",
] as const;

const PUBLISHED_WAVE_SIX_IDS = new Set(["discoid-lupus"]);
const FRAMEWORK_ONLY_IDS = ["body-dysmorphic-disorder", "hoarding-disorder"] as const;

describe("condition catalog expansion wave 6", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("preserves the 290-condition Wave 6 baseline while allowing later waves", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(290);
    expect(knowledgeBase.length).toBeGreaterThanOrEqual(290);
  });

  it("adds all 14 approved Wave 6 conditions", () => {
    for (const id of WAVE_SIX_IDS) {
      expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
    }
  });

  it("keeps non-promoted Wave 6 mappings safely draft while allowing reviewed publication", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    for (const id of WAVE_SIX_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();
      if (PUBLISHED_WAVE_SIX_IDS.has(id)) {
        expect(mapping?.draft).toBe(false);
        expect(mapping?.todo).toEqual([]);
        expect(mapping?.suggestions.length).toBeGreaterThan(0);
      } else {
        expect(mapping?.draft).toBe(true);
        expect(mapping?.suggestions).toEqual([]);
        expect(mapping?.todo.length).toBeGreaterThan(0);
      }
    }
  });

  it("does not automate rating-citation verification", () => {
    for (const id of WAVE_SIX_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });

  it("keeps body dysmorphic and hoarding disorder framework-only instead of borrowing OCD's code", () => {
    for (const id of FRAMEWORK_ONLY_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.130");
      expect(condition?.ratingSchedule[0]?.note).toMatch(/no single diagnosis-specific diagnostic code/i);
      expect(condition?.ratingSchedule[0]?.note).not.toMatch(/9404/i);
      expect(condition?.reviewNotes.join(" ")).toMatch(/9404|obsessive-compulsive/i);
    }
  });

  it("keeps specific phobia distinct from the existing social-anxiety identity despite shared DC 9403", () => {
    const condition = catalogById.get("specific-phobia");
    expect(condition).toBeDefined();
    expect(condition?.ratingSchedule[0]?.note).toMatch(/9403/i);
    expect(condition?.aliases.map((alias) => alias.toLowerCase())).not.toContain("social anxiety disorder");
    expect(condition?.reviewNotes.join(" ")).toMatch(/social-anxiety-disorder/i);
  });

  it("scopes the dissociative roadmap id to the diagnoses expressly named under DC 9416", () => {
    const condition = catalogById.get("dissociative-disorder");
    expect(condition).toBeDefined();
    expect(condition?.name).toMatch(/dissociative amnesia.*dissociative identity disorder/i);
    expect(condition?.ratingSchedule[0]?.note).toMatch(/9416/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/scoped|expressly named/i);
  });

  it("keeps the hematologic identities disease-specific while preserving current diagnostic codes", () => {
    const essential = catalogById.get("essential-thrombocythemia");
    const myelofibrosis = catalogById.get("primary-myelofibrosis");
    const mds = catalogById.get("myelodysplastic-syndrome");

    expect(essential?.ratingSchedule[0]?.citation).toBe("38 CFR 4.117");
    expect(essential?.ratingSchedule[0]?.note).toMatch(/7718/i);
    expect(myelofibrosis?.ratingSchedule[0]?.note).toMatch(/7718/i);
    expect(essential?.reviewNotes.join(" ")).toMatch(/primary myelofibrosis/i);
    expect(myelofibrosis?.reviewNotes.join(" ")).toMatch(/essential thrombocythemia/i);
    expect(mds?.ratingSchedule[0]?.note).toMatch(/7725/i);
  });

  it("keeps cutaneous Wave 6 identities distinct and on the skin schedule", () => {
    const discoid = catalogById.get("discoid-lupus");
    const scarring = catalogById.get("scarring-alopecia");
    const hyperhidrosis = catalogById.get("hyperhidrosis");

    expect(discoid?.ratingSchedule[0]?.citation).toBe("38 CFR 4.118");
    expect(discoid?.ratingSchedule[0]?.note).toMatch(/7809/i);
    expect(discoid?.reviewNotes.join(" ")).toMatch(/systemic-lupus-erythematosus/i);
    expect(scarring?.ratingSchedule[0]?.note).toMatch(/7830/i);
    expect(scarring?.reviewNotes.join(" ")).toMatch(/alopecia-areata/i);
    expect(hyperhidrosis?.ratingSchedule[0]?.note).toMatch(/7832/i);
  });
});
