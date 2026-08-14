import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@/lib/kb/load";

const expectedBackfill = {
  copd: { "sleep-apnea": ["direct-secondary", "aggravation"], "cardiac-arrhythmia": ["intermediate-chain"] },
  asthma: { "sleep-apnea": ["direct-secondary", "aggravation"], "cardiac-arrhythmia": ["direct-secondary"] },
} as const;
const intentionallyUnlabeledMappings = ["chronic-sinusitis","chronic-rhinitis","pulmonary-fibrosis","interstitial-lung-disease","sleep-apnea"] as const;
const safetyWithdrawnMappings = ["ageusia","emphysema","chronic-bronchitis"] as const;

describe("controlled pathway backfill batch 3", () => {
  it("backfills only Respiratory edges whose attached source set includes clinical evidence", () => {
    const kb = loadKnowledgeBase();
    for (const [primaryId, secondaries] of Object.entries(expectedBackfill)) {
      const mapping = kb.find((entry) => entry.id === primaryId); expect(mapping?.draft).toBe(false);
      for (const [secondaryId, pathways] of Object.entries(secondaries)) {
        const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === secondaryId);
        expect(suggestion?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
        expect(suggestion?.pathwayIntelligence?.pathways).toEqual(pathways);
        expect(suggestion?.pathwayIntelligence?.developmentQuestions.length).toBeGreaterThan(0);
        expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps insufficient-source Respiratory and ENT mappings unpublished or unlabeled", () => {
    const kb = loadKnowledgeBase();
    for (const primaryId of intentionallyUnlabeledMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId); expect(mapping?.draft).toBe(false);
      for (const suggestion of mapping?.suggestions ?? []) expect(suggestion.pathwayIntelligence).toBeUndefined();
    }
    for (const primaryId of safetyWithdrawnMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId); expect(mapping?.draft).toBe(true); expect(mapping?.suggestions).toEqual([]); expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("allows anosmia depression research only with olfactory-specific clinical evidence", () => {
    const mapping = loadKnowledgeBase().find((entry) => entry.id === "anosmia");
    const depression = mapping?.suggestions.find((entry) => entry.conditionId === "depressive-disorder");
    expect(mapping?.draft).toBe(false);
    expect(depression?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
    expect(depression?.sourceReferences.some((source) => source.citation === "38 CFR 3.310")).toBe(false);
    expect(depression?.rationale).toMatch(/association|does not establish/i);
  });

  it("does not infer a medication pathway onto the asthma-arrhythmia edge", () => {
    const asthma = loadKnowledgeBase().find((entry) => entry.id === "asthma");
    const arrhythmia = asthma?.suggestions.find((entry) => entry.conditionId === "cardiac-arrhythmia");
    expect(arrhythmia?.pathwayIntelligence?.pathways).toEqual(["direct-secondary"]);
    expect(arrhythmia?.pathwayIntelligence?.pathways).not.toContain("medication-related");
  });

  it("preserves pre-backfill rank and prevalence for COPD and asthma", () => {
    const kb = loadKnowledgeBase();
    for (const primaryId of ["copd", "asthma"]) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.suggestions.map(({ conditionId, rank, prevalence }) => ({ conditionId, rank, prevalence }))).toEqual([
        { conditionId: "sleep-apnea", rank: 1, prevalence: "commonly-explored" },
        { conditionId: "cardiac-arrhythmia", rank: 2, prevalence: "sometimes-explored" },
      ]);
    }
  });

  it("keeps draft Respiratory and ENT mappings outside the backfill", () => {
    const kb = loadKnowledgeBase();
    for (const draftId of ["bronchiolitis","sarcoidosis","deviated-nasal-septum","laryngeal-stenosis","pneumoconiosis","noise-induced-hearing-loss","tinnitus"]) expect(kb.find((entry) => entry.id === draftId)?.draft).toBe(true);
  });
});
