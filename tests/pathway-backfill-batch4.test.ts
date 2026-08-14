import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const supportedSomatopsychicEdges = [
  ["stomach-cancer", "depressive-disorder"],
  ["abdominal-hernia", "depressive-disorder"],
] as const;

const intentionallyUnlabeledEdges = [
  ["stomach-cancer", "gerd"],
  ["abdominal-hernia", "gerd"],
  ["erectile-dysfunction", "gerd"],
  ["erectile-dysfunction", "depressive-disorder"],
  ["congestive-heart-failure", "depressive-disorder"],
  ["congestive-heart-failure", "gerd"],
] as const;

const safetyWithdrawnMappings = [
  "agranulocytosis",
  "al-amyloidosis",
  "addisons-disease",
  "anorexia-nervosa",
] as const;

describe("controlled pathway backfill batch 4", () => {
  it("adds a conditional somatopsychic pathway only to the two supported physical-to-mood edges", () => {
    const kb = loadKnowledgeBase();

    for (const [primaryId, secondaryId] of supportedSomatopsychicEdges) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      const suggestion = mapping?.suggestions.find(
        (entry) => entry.conditionId === secondaryId,
      );

      expect(mapping?.draft).toBe(false);
      expect(suggestion?.sourceReferences.some(
        (source) => source.verificationScope === "clinical-evidence",
      )).toBe(true);
      expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
      expect(suggestion?.pathwayIntelligence?.causalChain).toContain("if present");
      expect(suggestion?.pathwayIntelligence?.developmentQuestions.length).toBeGreaterThan(0);
      expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
    }
  });

  it("does not turn treatment-risk or comorbidity evidence into an unsupported pathway", () => {
    const kb = loadKnowledgeBase();

    for (const [primaryId, secondaryId] of intentionallyUnlabeledEdges) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      const suggestion = mapping?.suggestions.find(
        (entry) => entry.conditionId === secondaryId,
      );
      expect(mapping?.draft).toBe(false);
      expect(suggestion?.pathwayIntelligence).toBeUndefined();
    }
  });

  it("keeps later safety withdrawals unpublished", () => {
    const kb = loadKnowledgeBase();

    for (const primaryId of safetyWithdrawnMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("recognizes the alopecia-areata depression relationship only after clinical repair", () => {
    const mapping = loadKnowledgeBase().find((entry) => entry.id === "alopecia-areata");
    const depression = mapping?.suggestions.find((entry) => entry.conditionId === "depressive-disorder");
    expect(mapping?.draft).toBe(false);
    expect(depression?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
    expect(depression?.sourceReferences.some((source) => source.citation === "38 CFR 3.310")).toBe(false);
  });

  it("recognizes hypertension only after its four published edges are clinically repaired", () => {
    const mapping = loadKnowledgeBase().find((entry) => entry.id === "hypertension");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(4);
    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
      expect(suggestion.sourceReferences.some((source) => source.citation.startsWith("38 CFR"))).toBe(false);
    }
  });

  it("preserves pre-backfill rank and prevalence for the newly enriched mappings", () => {
    const kb = loadKnowledgeBase();

    for (const primaryId of ["stomach-cancer", "abdominal-hernia"]) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(
        mapping?.suggestions.map(({ conditionId, rank, prevalence }) => ({
          conditionId,
          rank,
          prevalence,
        })),
      ).toEqual([
        { conditionId: "depressive-disorder", rank: 1, prevalence: "commonly-explored" },
        { conditionId: "gerd", rank: 2, prevalence: "sometimes-explored" },
      ]);
    }
  });
});
