import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_ONE_IDS = [
  "gout",
  "osteoporosis",
  "osteomalacia",
  "osteitis-deformans",
  "bursitis",
  "myositis",
  "heterotopic-ossification",
  "tendinopathy",
  "pes-cavus",
  "metatarsalgia",
  "hallux-rigidus",
  "hammertoe",
  "parkinsons-disease",
  "multiple-sclerosis",
  "myasthenia-gravis",
  "syringomyelia",
  "seizure-disorder",
  "trigeminal-neuralgia",
  "ulnar-neuropathy",
  "common-peroneal-neuropathy",
] as const;

const POST_V2_PROMOTED_WAVE_ONE_IDS = new Set([
  "gout",
  "parkinsons-disease",
  "multiple-sclerosis",
  "myasthenia-gravis",
  "seizure-disorder",
]);

describe("condition catalog expansion wave 1", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("keeps catalog and knowledge-base coverage one-to-one as later waves expand", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(213);
    expect(knowledgeBase).toHaveLength(catalog.length);
  });

  it("preserves all 20 approved Wave 1 conditions", () => {
    for (const id of WAVE_ONE_IDS) expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true);
  });

  it("keeps non-promoted Wave 1 mappings draft while allowing reviewed post-v2 promotion", () => {
    for (const id of WAVE_ONE_IDS) {
      const mapping = mappingById.get(id);
      expect(mapping, `missing mapping for ${id}`).toBeDefined();
      if (POST_V2_PROMOTED_WAVE_ONE_IDS.has(id)) {
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
    for (const id of WAVE_ONE_IDS) {
      const condition = catalogById.get(id);
      expect(condition).toBeDefined();
      expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
      expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true);
    }
  });
});
