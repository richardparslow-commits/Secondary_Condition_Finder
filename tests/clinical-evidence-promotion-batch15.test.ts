import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 15", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 302/302 universe", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    expect(catalog).toHaveLength(302);
    expect(kb).toHaveLength(302);
  });

  it("recognizes the later evidence-quality withdrawal of PsA depression research", () => {
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

    const mapping = byId.get("psoriatic-arthritis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/38797775/);
    expect(mapping?.todo.join(" ")).toMatch(/prevalence|comorbidity|direction|caused|aggravat/i);
  });

  it("retires only redundant PTSD legal references while preserving all three clinical relationships", () => {
    const mapping = byId.get("ptsd");

    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions.map((suggestion) => suggestion.conditionId)).toEqual([
      "sleep-apnea",
      "migraine-headaches",
      "erectile-dysfunction",
    ]);

    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.sourceReferences).toHaveLength(1);
      expect(suggestion.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion.sourceReferences.some((source) => /^38 CFR/i.test(source.citation))).toBe(false);
    }
  });
});
