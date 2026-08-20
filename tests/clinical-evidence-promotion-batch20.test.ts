import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 20", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 301/301 universe", () => {
    expect(catalog).toHaveLength(301);
    expect(kb).toHaveLength(301);
  });

  it("withdraws anxiety, schizophrenia, and substance-use mappings that were legal/rating-only", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    for (const id of ["anxiety-disorder", "schizophrenia", "substance-use-disorder"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("keeps only clinically sourced mTBI post-traumatic-headache research", () => {
    const mapping = byId.get("mild-tbi");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("post-traumatic-headache");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/mild traumatic brain injury/i);
    expect(suggestion?.rationale).toMatch(/within 7 days/i);
    expect(suggestion?.rationale).toMatch(/greater than 3 months/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("38568491");
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-19");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("recognizes the later evidence-quality withdrawal of Parkinson depression", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const mapping = byId.get("parkinsons-disease");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/27358339/);
    expect(mapping?.todo.join(" ")).toMatch(/prevalence|screening|direction|caused|aggravat/i);
  });
});
