import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const expectedBackfill = {
  "adjustment-disorder": {
    "sleep-apnea": ["direct-secondary", "aggravation"],
    gerd: ["direct-secondary", "aggravation"],
  },
  "depressive-disorder": {
    "sleep-apnea": ["medication-related", "intermediate-chain"],
    "erectile-dysfunction": ["medication-related"],
  },
} as const;

const intentionallyUnlabeledMappings = [
  "micro-tbi",
  "post-concussion-syndrome",
  "subdural-hematoma",
  "epidural-hematoma",
  "skull-fracture-non-basilar-and-basal",
  "rem-sleep-disorder",
] as const;

const safetyWithdrawnMappings = [
  "agoraphobia",
  "panic-disorder",
  "bipolar-disorder",
  "persistent-depressive-disorder",
  "social-anxiety-disorder",
  "somatic-symptom-disorder",
  "anxiety-disorder",
  "schizophrenia",
  "substance-use-disorder",
] as const;

describe("controlled pathway backfill batch 1", () => {
  it("backfills only edges whose attached source set includes clinical evidence", () => {
    const kb = loadKnowledgeBase();

    for (const [primaryId, secondaries] of Object.entries(expectedBackfill)) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.draft).toBe(false);

      for (const [secondaryId, pathways] of Object.entries(secondaries)) {
        const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === secondaryId);
        expect(suggestion?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
        expect(suggestion?.pathwayIntelligence?.pathways).toEqual(pathways);
        expect(suggestion?.pathwayIntelligence?.developmentQuestions.length).toBeGreaterThan(0);
        expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps untouched reviewed legal-framework-only neurological mappings unlabeled", () => {
    const kb = loadKnowledgeBase();
    for (const primaryId of intentionallyUnlabeledMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.draft).toBe(false);
      for (const suggestion of mapping?.suggestions ?? []) expect(suggestion.pathwayIntelligence).toBeUndefined();
    }
  });

  it("recognizes later safety withdrawals", () => {
    const kb = loadKnowledgeBase();
    for (const primaryId of safetyWithdrawnMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("recognizes the Batch 20 mTBI headache repair without inventing broader pathway metadata", () => {
    const mapping = loadKnowledgeBase().find((entry) => entry.id === "mild-tbi");
    const headache = mapping?.suggestions.find((entry) => entry.conditionId === "migraine-headaches");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(headache?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
    expect(headache?.sourceReferences[0]?.sourceUrl).toContain("38568491");
    expect(headache?.pathwayIntelligence).toBeUndefined();
    expect(headache?.rationale).toMatch(/post-traumatic headache/i);
    expect(mapping?.suggestions.some((entry) => entry.conditionId === "depressive-disorder")).toBe(false);
  });

  it("preserves the pre-backfill ranking and prevalence of enriched edges", () => {
    const kb = loadKnowledgeBase();
    const adjustment = kb.find((entry) => entry.id === "adjustment-disorder");
    const depression = kb.find((entry) => entry.id === "depressive-disorder");

    expect(adjustment?.suggestions.map(({ conditionId, rank, prevalence }) => ({ conditionId, rank, prevalence }))).toEqual([
      { conditionId: "sleep-apnea", rank: 1, prevalence: "commonly-explored" },
      { conditionId: "gerd", rank: 2, prevalence: "commonly-explored" },
      { conditionId: "migraine-headaches", rank: 3, prevalence: "sometimes-explored" },
    ]);

    expect(depression?.suggestions.map(({ conditionId, rank, prevalence }) => ({ conditionId, rank, prevalence }))).toEqual([
      { conditionId: "sleep-apnea", rank: 1, prevalence: "sometimes-explored" },
      { conditionId: "erectile-dysfunction", rank: 2, prevalence: "commonly-explored" },
    ]);
  });

  it("does not treat safety-withdrawn mappings as backfill candidates", () => {
    const kb = loadKnowledgeBase();
    for (const draftId of ["migraine-headaches", "ocd", ...safetyWithdrawnMappings]) expect(kb.find((entry) => entry.id === draftId)?.draft).toBe(true);
  });
});
