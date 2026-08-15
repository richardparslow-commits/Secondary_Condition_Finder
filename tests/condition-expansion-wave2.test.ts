import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const WAVE_TWO_IDS = ["psoriatic-arthritis","charcot-arthropathy","sacroiliac-joint-dysfunction","femoroacetabular-impingement","hip-labral-tear","greater-trochanteric-pain-syndrome","patellar-instability","acl-injury","pcl-injury","tarsal-metatarsal-malunion-nonunion","radial-neuropathy","median-neuropathy","tibial-neuropathy","femoral-neuropathy","meralgia-paresthetica","complex-regional-pain-syndrome","cauda-equina-syndrome","cranial-nerve-palsy"] as const;
const CURRENTLY_PUBLISHED = new Set(["femoroacetabular-impingement","acl-injury","pcl-injury","cauda-equina-syndrome"]);
const FRAMEWORK_ONLY_IDS = ["femoroacetabular-impingement","hip-labral-tear","greater-trochanteric-pain-syndrome","complex-regional-pain-syndrome","cauda-equina-syndrome","cranial-nerve-palsy"] as const;

describe("condition catalog expansion wave 2", () => {
  const catalog = loadConditionCatalog(); const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));
  it("keeps catalog and knowledge-base coverage one-to-one as later waves expand", () => { expect(catalog.length).toBeGreaterThanOrEqual(231); expect(knowledgeBase).toHaveLength(catalog.length); });
  it("preserves all 18 approved Wave 2 conditions", () => { for (const id of WAVE_TWO_IDS) expect(catalogById.has(id), `missing catalog condition ${id}`).toBe(true); });
  it("keeps non-published or later-withdrawn Wave 2 mappings draft while allowing reviewed publication", () => {
    for (const id of WAVE_TWO_IDS) {
      const mapping = mappingById.get(id); expect(mapping).toBeDefined();
      if (CURRENTLY_PUBLISHED.has(id)) { expect(mapping?.draft).toBe(false); expect(mapping?.todo).toEqual([]); expect(mapping?.suggestions.length).toBeGreaterThan(0); }
      else { expect(mapping?.draft).toBe(true); expect(mapping?.suggestions).toEqual([]); expect(mapping?.todo.length).toBeGreaterThan(0); }
    }
  });
  it("records the later PsA association-only withdrawal", () => {
    const mapping = mappingById.get("psoriatic-arthritis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/prevalence|comorbidity|direction|caused|aggravat/i);
  });
  it("does not automate rating-citation verification", () => { for (const id of WAVE_TWO_IDS) { const condition = catalogById.get(id); expect(condition).toBeDefined(); expect(condition?.ratingSchedule.length).toBeGreaterThan(0); expect(condition?.ratingSchedule.every((reference) => reference.verified === false)).toBe(true); } });
  it("does not invent a single diagnostic code for framework-only identities", () => { for (const id of FRAMEWORK_ONLY_IDS) { const condition = catalogById.get(id); expect(condition).toBeDefined(); expect(condition?.reviewNotes.join(" ")).toMatch(/no single condition-specific|no dedicated/i); } });
});
