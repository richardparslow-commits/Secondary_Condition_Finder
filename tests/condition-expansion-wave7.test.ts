import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_SEVEN_IDS = [
  "amebiasis",
  "actinomycosis",
  "nocardiosis",
  "histoplasmosis",
  "strongyloidiasis",
  "rickettsial-ehrlichial-anaplasma-infection",
  "ovarian-cancer",
  "testicular-cancer",
  "laryngeal-cancer",
  "mandibular-nonunion",
] as const;

const PUBLISHED_WAVE_SEVEN_IDS = new Set([
  "ovarian-cancer",
  "testicular-cancer",
]);

describe("condition catalog expansion wave 7", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("reaches the target-v2 catalog at exactly 300 conditions", () => {
    expect(catalog).toHaveLength(300);
    expect(knowledgeBase).toHaveLength(300);
  });

  it("preserves all 10 approved Wave 7 identities", () => {
    for (const id of WAVE_SEVEN_IDS) expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
  });

  it("publishes only two evidence-led Wave 7 relationships and keeps the other eight safe-draft", () => {
    for (const id of WAVE_SEVEN_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();
      if (PUBLISHED_WAVE_SEVEN_IDS.has(id)) {
        expect(mapping?.draft).toBe(false);
        expect(mapping?.todo).toEqual([]);
        expect(mapping?.suggestions).toHaveLength(1);
      } else {
        expect(mapping?.draft).toBe(true);
        expect(mapping?.suggestions).toEqual([]);
        expect(mapping?.todo.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps adrenal histoplasmosis out of the pulmonary-only mapping", () => {
    const mapping = mappingById.get("histoplasmosis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/pulmonary|adrenal|disseminated|disease-site/i);
  });

  it("does not equate post-laryngectomy voice handicap with the aphonia diagnosis", () => {
    const mapping = mappingById.get("laryngeal-cancer");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/aphonia|alaryngeal|voice handicap|natural laryngeal/i);
  });

  it("does not automate rating-citation verification", () => {
    for (const id of WAVE_SEVEN_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });

  it("does not revive the removed historical amebiasis DC 7321", () => {
    const condition = catalogById.get("amebiasis");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.88b");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/6320/i);
    expect(condition?.ratingSchedule[0]?.note).toMatch(/7321.*removed|removed.*7321/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/do not assign historical dc 7321/i);
    expect(condition?.ratingSchedule.some((reference) => /4\.114/.test(reference.citation))).toBe(false);
  });

  it("keeps pulmonary infectious codes scoped to pulmonary disease", () => {
    const actinomycosis = catalogById.get("actinomycosis");
    const nocardiosis = catalogById.get("nocardiosis");
    const histoplasmosis = catalogById.get("histoplasmosis");
    expect(actinomycosis?.ratingSchedule[0]?.citation).toBe("38 CFR 4.97");
    expect(actinomycosis?.ratingSchedule[0]?.note).toMatch(/6822/i);
    expect(actinomycosis?.reviewNotes.join(" ")).toMatch(/extra-pulmonary/i);
    expect(nocardiosis?.ratingSchedule[0]?.citation).toBe("38 CFR 4.97");
    expect(nocardiosis?.ratingSchedule[0]?.note).toMatch(/6823/i);
    expect(nocardiosis?.reviewNotes.join(" ")).toMatch(/extra-pulmonary/i);
    expect(histoplasmosis?.name).toMatch(/lung/i);
    expect(histoplasmosis?.ratingSchedule[0]?.note).toMatch(/6834/i);
    expect(histoplasmosis?.reviewNotes.join(" ")).toMatch(/extra-pulmonary/i);
  });

  it("keeps strongyloidiasis severity scope and the DC 6317 infection grouping explicit", () => {
    const strongyloidiasis = catalogById.get("strongyloidiasis");
    const grouped = catalogById.get("rickettsial-ehrlichial-anaplasma-infection");
    expect(strongyloidiasis?.ratingSchedule[0]?.citation).toBe("38 CFR 4.88b");
    expect(strongyloidiasis?.ratingSchedule[0]?.note).toMatch(/6325/i);
    expect(strongyloidiasis?.ratingSchedule[0]?.note).toMatch(/hyperinfection|disseminated/i);
    expect(strongyloidiasis?.reviewNotes.join(" ")).toMatch(/do not treat dc 6325/i);
    expect(grouped?.ratingSchedule[0]?.note).toMatch(/6317/i);
    expect(grouped?.ratingSchedule[0]?.note).toMatch(/rickettsial.*ehrlichia.*anaplasma/i);
    expect(grouped?.reviewNotes.join(" ")).toMatch(/does not imply.*etiology|shared rating identity/i);
  });

  it("models the three cancers with their actual broader system malignancy codes", () => {
    const ovarian = catalogById.get("ovarian-cancer");
    const testicular = catalogById.get("testicular-cancer");
    const laryngeal = catalogById.get("laryngeal-cancer");
    expect(ovarian?.ratingSchedule[0]?.citation).toBe("38 CFR 4.116");
    expect(ovarian?.ratingSchedule[0]?.note).toMatch(/7627/i);
    expect(ovarian?.ratingSchedule[0]?.note).toMatch(/system-level.*(?:rather than|not).*ovary-specific/i);
    expect(testicular?.ratingSchedule[0]?.citation).toBe("38 CFR 4.115b");
    expect(testicular?.ratingSchedule[0]?.note).toMatch(/7528/i);
    expect(testicular?.ratingSchedule[0]?.note).toMatch(/system-level.*(?:rather than|not).*testis-specific/i);
    expect(testicular?.reviewNotes.join(" ")).toMatch(/7523|7524/);
    expect(laryngeal?.ratingSchedule[0]?.citation).toBe("38 CFR 4.97");
    expect(laryngeal?.ratingSchedule[0]?.note).toMatch(/6819/i);
    expect(laryngeal?.ratingSchedule[0]?.note).toMatch(/system-level.*(?:rather than|not).*larynx-specific/i);
    expect(laryngeal?.reviewNotes.join(" ")).toMatch(/respiratory-cancer/i);
  });

  it("keeps mandibular nonunion distinct from a generic mandibular fracture", () => {
    const condition = catalogById.get("mandibular-nonunion");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.150");
    expect(condition?.ratingSchedule[0]?.note).toMatch(/9903/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/maxillofacial-fracture/i);
    expect(condition?.reviewNotes.join(" ")).toMatch(/fracture.*does not.*establish nonunion/i);
  });
});
