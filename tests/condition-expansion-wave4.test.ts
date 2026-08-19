import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_FOUR_IDS = [
  "bronchiectasis",
  "chronic-laryngitis",
  "vocal-cord-paralysis",
  "aphonia",
  "granulomatous-rhinitis",
  "bacterial-rhinitis",
  "pulmonary-vascular-disease",
  "diaphragm-paralysis",
  "narcolepsy",
  "uveitis",
  "keratitis",
  "dry-eye-syndrome",
  "retinal-dystrophy",
  "nystagmus",
  "ptosis",
] as const;

const POST_V2_PROMOTED_WAVE_FOUR_IDS = new Set([
  "uveitis",
  "retinal-dystrophy",
  "ptosis",
]);

const FRAMEWORK_ONLY_IDS = ["vocal-cord-paralysis", "dry-eye-syndrome"] as const;

describe("condition catalog expansion wave 4", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("retains the 261-condition Wave 4 checkpoint as later waves expand coverage", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(261);
    expect(knowledgeBase.length).toBeGreaterThanOrEqual(261);
    expect(catalog).toHaveLength(knowledgeBase.length);
  });

  it("adds all 15 approved Wave 4 conditions", () => {
    for (const id of WAVE_FOUR_IDS) {
      expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
    }
  });

  it("keeps non-promoted Wave 4 mappings draft while allowing reviewed post-v2 promotion", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    for (const id of WAVE_FOUR_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();
      if (POST_V2_PROMOTED_WAVE_FOUR_IDS.has(id)) {
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
    for (const id of WAVE_FOUR_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });

  it("keeps framework-only identities from inventing a dedicated diagnostic code", () => {
    for (const id of FRAMEWORK_ONLY_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.reviewNotes.join(" ")).toMatch(/no single condition-specific|no single diagnosis-specific/i);
    }
  });

  it("keeps narcolepsy on its neurological rating authority", () => {
    const condition = catalogById.get("narcolepsy");
    expect(condition).toBeDefined();
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.124a");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/8108/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/neurological/i);
  });

  it("keeps broader Wave 4 identities distinct from narrower existing catalog entries", () => {
    const pulmonary = catalogById.get("pulmonary-vascular-disease");
    const retinal = catalogById.get("retinal-dystrophy");

    expect(pulmonary).toBeDefined();
    expect(pulmonary?.aliases.map((alias) => alias.toLowerCase())).not.toContain("pulmonary hypertension");
    expect(pulmonary?.reviewNotes.join(" ")).toMatch(/pulmonary-hypertension/i);

    expect(retinal).toBeDefined();
    expect(retinal?.aliases.map((alias) => alias.toLowerCase())).not.toContain("macular degeneration");
    expect(retinal?.reviewNotes.join(" ")).toMatch(/macular-degeneration/i);
  });

  it("does not overgeneralize the central-nystagmus diagnostic code", () => {
    const condition = catalogById.get("nystagmus");
    expect(condition).toBeDefined();
    expect(condition?.ratingSchedule[0]?.note).toMatch(/6016.*central|central.*6016/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/other nystagmus types/i);
  });
});
