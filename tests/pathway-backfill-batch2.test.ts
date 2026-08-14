import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const intentionallyUnlabeledEdges = [
  ["ankle-strain", "contralateral-knee-condition"],
  ["ankle-strain", "flatfoot"],
  ["osteoarthritis", "plantar-fasciitis"],
  ["amputation-or-loss-of-use", "depressive-disorder"],
  ["knee-injury", "ankle-strain"],
  ["knee-injury", "contralateral-knee-condition"],
] as const;

describe("controlled pathway backfill batch 2", () => {
  it("backfills only clinically-supported rheumatoid-arthritis edges", () => {
    const kb = loadKnowledgeBase();
    const mapping = kb.find((entry) => entry.id === "rheumatoid-arthritis");
    expect(mapping?.draft).toBe(false);

    const depression = mapping?.suggestions.find(
      (entry) => entry.conditionId === "depressive-disorder",
    );
    const gerd = mapping?.suggestions.find((entry) => entry.conditionId === "gerd");

    for (const suggestion of [depression, gerd]) {
      expect(suggestion?.sourceReferences.some(
        (source) => source.verificationScope === "clinical-evidence",
      )).toBe(true);
      expect(suggestion?.pathwayIntelligence?.developmentQuestions.length).toBeGreaterThan(0);
      expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
    }

    expect(depression?.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
    expect(gerd?.pathwayIntelligence?.pathways).toEqual(["medication-related"]);
  });

  it("keeps insufficient-source Musculoskeletal edges unpublished or unlabeled", () => {
    const kb = loadKnowledgeBase();
    for (const [primaryId, secondaryId] of intentionallyUnlabeledEdges) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      const suggestion = mapping?.suggestions.find(
        (entry) => entry.conditionId === secondaryId,
      );

      if (primaryId === "ankle-strain") {
        expect(mapping?.draft).toBe(true);
        expect(mapping?.suggestions).toEqual([]);
        expect(suggestion).toBeUndefined();
        continue;
      }

      expect(mapping?.draft).toBe(false);
      expect(suggestion?.pathwayIntelligence).toBeUndefined();
    }
  });

  it("preserves rank and prevalence for the newly enriched rheumatoid-arthritis edges", () => {
    const kb = loadKnowledgeBase();
    const mapping = kb.find((entry) => entry.id === "rheumatoid-arthritis");
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
  });

  it("keeps draft Musculoskeletal mappings outside the backfill", () => {
    const kb = loadKnowledgeBase();
    for (const draftId of [
      "lumbar-strain",
      "cervical-strain",
      "hip-strain",
      "ankle-strain",
      "intervertebral-disc-syndrome",
      "radiculopathy",
    ]) {
      expect(kb.find((entry) => entry.id === draftId)?.draft).toBe(true);
    }
  });
});
