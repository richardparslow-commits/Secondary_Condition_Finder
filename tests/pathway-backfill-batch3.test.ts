import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@/lib/kb/load";

const expectedBackfill = {
  copd: { "sleep-apnea": ["direct-secondary", "aggravation"] },
  asthma: { "sleep-apnea": ["direct-secondary", "aggravation"] },
} as const;
const intentionallyUnlabeledMappings = ["sleep-apnea"] as const;
const safetyWithdrawnMappings = ["ageusia","emphysema","chronic-bronchitis","pulmonary-fibrosis"] as const;

describe("controlled pathway backfill batch 3", () => {
  it("backfills only surviving Respiratory edges whose attached source set includes clinical evidence", () => {
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

  it("keeps untouched insufficient-source Respiratory and ENT mappings unpublished or unlabeled", () => {
    const kb = loadKnowledgeBase();
    for (const primaryId of intentionallyUnlabeledMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId); expect(mapping?.draft).toBe(false);
      for (const suggestion of mapping?.suggestions ?? []) expect(suggestion.pathwayIntelligence).toBeUndefined();
    }
    for (const primaryId of safetyWithdrawnMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId); expect(mapping?.draft).toBe(true); expect(mapping?.suggestions).toEqual([]); expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("recognizes the Batch 11 ILD repair without inferring causation or preserving arrhythmia", () => {
    const mapping = loadKnowledgeBase().find((entry) => entry.id === "interstitial-lung-disease");
    const osa = mapping?.suggestions.find((entry) => entry.conditionId === "sleep-apnea");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(osa?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
    expect(osa?.sourceReferences[0]?.sourceUrl).toContain("33403599");
    expect(osa?.pathwayIntelligence).toBeUndefined();
    expect(osa?.rationale).toMatch(/association|prevalence/i);
    expect(mapping?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);
  });

  it("recognizes the Batch 12 rhinitis and sinusitis repairs without preserving arrhythmia", () => {
    const kb = loadKnowledgeBase();
    const rhinitis = kb.find((entry) => entry.id === "chronic-rhinitis");
    const sinusitis = kb.find((entry) => entry.id === "chronic-sinusitis");

    expect(rhinitis?.draft).toBe(false);
    expect(rhinitis?.suggestions).toHaveLength(1);
    expect(rhinitis?.suggestions[0]?.conditionId).toBe("sleep-apnea");
    expect(rhinitis?.suggestions[0]?.sourceReferences[0]?.sourceUrl).toContain("40774162");
    expect(rhinitis?.suggestions[0]?.pathwayIntelligence).toBeUndefined();
    expect(rhinitis?.suggestions[0]?.rationale).toMatch(/allergic-rhinitis phenotype|allergic rhinitis/i);
    expect(rhinitis?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);

    expect(sinusitis?.draft).toBe(false);
    expect(sinusitis?.suggestions).toHaveLength(1);
    expect(sinusitis?.suggestions[0]?.conditionId).toBe("sleep-apnea");
    expect(sinusitis?.suggestions[0]?.sourceReferences[0]?.sourceUrl).toContain("41969980");
    expect(sinusitis?.suggestions[0]?.pathwayIntelligence).toBeUndefined();
    expect(sinusitis?.suggestions[0]?.rationale).toMatch(/association-focused|association/i);
    expect(sinusitis?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);
  });

  it("recognizes the later anosmia depression withdrawal", () => {
    const mapping = loadKnowledgeBase().find((entry) => entry.id === "anosmia");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/causal pathways|directional/i);
  });

  it("recognizes the later asthma and COPD arrhythmia withdrawals", () => {
    const kb = loadKnowledgeBase();
    for (const primaryId of ["asthma", "copd"]) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.draft).toBe(false);
      expect(mapping?.suggestions.some((entry) => entry.conditionId === "cardiac-arrhythmia")).toBe(false);
    }
  });

  it("preserves pre-backfill rank and prevalence for surviving COPD and asthma edges", () => {
    const kb = loadKnowledgeBase();
    for (const primaryId of ["copd", "asthma"]) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.suggestions.map(({ conditionId, rank, prevalence }) => ({ conditionId, rank, prevalence }))).toEqual([
        { conditionId: "sleep-apnea", rank: 1, prevalence: "commonly-explored" },
      ]);
    }
  });

  it("keeps draft Respiratory and ENT mappings outside the backfill", () => {
    const kb = loadKnowledgeBase();
    for (const draftId of ["bronchiolitis","sarcoidosis","deviated-nasal-septum","laryngeal-stenosis","pneumoconiosis","noise-induced-hearing-loss","tinnitus"]) expect(kb.find((entry) => entry.id === draftId)?.draft).toBe(true);
  });
});
