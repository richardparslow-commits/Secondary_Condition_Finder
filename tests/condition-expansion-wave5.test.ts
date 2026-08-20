import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_FIVE_IDS = [
  "esophageal-stricture", "achalasia", "barretts-esophagus", "gastroparesis",
  "peritoneal-adhesions", "short-bowel-syndrome", "fecal-incontinence",
  "rectal-prolapse", "anal-fistula", "chronic-liver-disease",
  "chronic-pyelonephritis", "hydronephrosis", "urethral-stricture",
  "varicocele-hydrocele", "epididymitis-orchitis",
] as const;

const FRAMEWORK_ONLY_IDS = ["gastroparesis", "varicocele-hydrocele"] as const;
const POST_V2_PROMOTED_WAVE_FIVE_IDS = new Set([
  "achalasia",
  "barretts-esophagus",
  "rectal-prolapse",
  "anal-fistula",
  "chronic-liver-disease",
  "chronic-pyelonephritis",
  "urethral-stricture",
]);

describe("condition catalog expansion wave 5", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("preserves the 276-condition Wave 5 checkpoint as later waves expand coverage", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(276);
    expect(knowledgeBase.length).toBeGreaterThanOrEqual(276);
  });

  it("adds all 15 approved Wave 5 conditions", () => {
    for (const id of WAVE_FIVE_IDS) expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
  });

  it("keeps non-promoted or review-withdrawn Wave 5 mappings draft while allowing reviewed publication", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    for (const id of WAVE_FIVE_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();
      if (POST_V2_PROMOTED_WAVE_FIVE_IDS.has(id)) {
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

  it("keeps hydronephrosis draft when the evidence belongs to upstream obstruction", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = mappingById.get("hydronephrosis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/obstruction|obstructive uropathy/i);
    expect(mapping?.todo.join(" ")).toMatch(/primary condition|selected primary/i);
  });

  it("does not automate rating-citation verification", () => {
    for (const id of WAVE_FIVE_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });

  it("keeps framework-only identities from inventing an analogous diagnostic code", () => {
    for (const id of FRAMEWORK_ONLY_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule[0]?.note).toMatch(/no single diagnosis-specific diagnostic code/i);
      expect(condition?.reviewNotes.length).toBeGreaterThan(0);
    }
  });

  it("keeps chronic liver disease distinct from existing hepatitis and cirrhosis identities", () => {
    const condition = catalogById.get("chronic-liver-disease");
    expect(condition).toBeDefined();
    expect(condition?.name).toMatch(/without cirrhosis/i);
    expect(condition?.aliases).toEqual([]);
    expect(condition?.reviewNotes.join(" ")).toMatch(/hepatitis.*cirrhosis|cirrhosis.*hepatitis/i);
  });

  it("keeps chronic epididymitis/orchitis distinct from prostatitis despite a shared infection framework", () => {
    const condition = catalogById.get("epididymitis-orchitis");
    expect(condition).toBeDefined();
    expect(condition?.aliases.map((alias) => alias.toLowerCase())).not.toContain("prostatitis");
    expect(condition?.reviewNotes.join(" ")).toMatch(/prostatitis/i);
  });

  it("keeps known renal and urinary identities on the genitourinary schedule", () => {
    for (const id of ["chronic-pyelonephritis", "hydronephrosis", "urethral-stricture"] as const) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.115b");
    }
  });
});
