import { describe, it, expect } from "vitest";
import { recommend } from "../src/lib/engine/recommend";
import { loadConditionCatalog } from "../src/lib/catalog/load";
import { loadKnowledgeBase } from "../src/lib/kb/load";

describe("Secondary recommendation pipeline", () => {
  it("executes the complete intake-to-recommendation pipeline with document choice", () => {
    const catalog = loadConditionCatalog();
    const kb = loadKnowledgeBase();

    const intake = {
      primaryConditions: ["Lumbar Strain"],
      diagnosedConditionIds: ["radiculopathy"],
      symptoms: ["Lower back pain", "Numbness in leg"],
      medications: ["Ibuprofen"],
      exposures: ["Burn pits"],
      notes: "Service connected back injury.",
    };

    const result = recommend(catalog, kb, intake);

    expect(result.recognizedPrimaries).toContain("Lumbar Strain");
    expect(result.unrecognizedPrimaries).toEqual([]);
    expect(result.recommendations.every((recommendation) =>
      intake.diagnosedConditionIds.includes(recommendation.conditionId),
    )).toBe(true);
  });
});
