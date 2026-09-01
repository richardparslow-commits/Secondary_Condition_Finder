import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 22", () => {
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

  it("withdraws the broad skull-fracture mapping rather than preserving six legal/rating-only diagnoses", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("skull-fracture-non-basilar-and-basal");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/six|subtype|heterogeneous/i);
  });

  it("preserves the Batch-22 anxiety withdrawal after later post-concussion headache target cleanup", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("post-concussion-syndrome");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/post-traumatic headache/i);
    expect(mapping?.todo.join(" ")).toMatch(/primary migraine|reclassification|target/i);
  });

  it("recognizes the later evidence-quality withdrawal of seizure-disorder depression", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("seizure-disorder");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/41967683/);
    expect(mapping?.todo.join(" ")).toMatch(/cross-sectional|prevalence|comorbidity|direction|causal|aggravat/i);
  });
});
