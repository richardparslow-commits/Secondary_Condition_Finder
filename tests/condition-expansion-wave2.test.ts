import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_TWO_IDS = [
  "psoriatic-arthritis",
  "charcot-arthropathy",
  "sacroiliac-joint-dysfunction",
  "femoroacetabular-impingement",
  "hip-labral-tear",
  "greater-trochanteric-pain-syndrome",
  "patellar-instability",
  "acl-injury",
  "pcl-injury",
  "tarsal-metatarsal-malunion-nonunion",
  "radial-neuropathy",
  "median-neuropathy",
  "tibial-neuropathy",
  "femoral-neuropathy",
  "meralgia-paresthetica",
  "complex-regional-pain-syndrome",
  "cauda-equina-syndrome",
  "cranial-nerve-palsy",
] as const;

const FRAMEWORK_ONLY_IDS = [
  "femoroacetabular-impingement",
  "hip-labral-tear",
  "greater-trochanteric-pain-syndrome",
  "complex-regional-pain-syndrome",
  "cauda-equina-syndrome",
  "cranial-nerve-palsy",
] as const;

describe("condition catalog expansion wave 2", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("moves the implemented catalog from 213 to 231 conditions", () => {
    expect(catalog).toHaveLength(231);
    expect(knowledgeBase).toHaveLength(231);
  });

  it("adds all 18 approved Wave 2 conditions", () => {
    for (const id of WAVE_TWO_IDS) {
      expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
    }
  });

  it("gives every Wave 2 condition exactly one safe draft mapping", () => {
    for (const id of WAVE_TWO_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("does not automate rating-citation verification", () => {
    for (const id of WAVE_TWO_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });

  it("does not invent a single diagnostic code for framework-only identities", () => {
    for (const id of FRAMEWORK_ONLY_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.reviewNotes.join(" ")).toMatch(/no single condition-specific|no dedicated/i);
    }
  });
});
