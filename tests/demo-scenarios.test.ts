import { describe, expect, it } from "vitest";

import scenarios from "../data/demo-scenarios.json";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { draftMappings } from "@/lib/kb/lookup";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema } from "@/lib/engine/types";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();
const draftPrimaryIds = new Set(draftMappings(kb).map((mapping) => mapping.id));

describe("demo scenarios", () => {
  it("ships at least three scenarios", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(3);
  });

  it.each(scenarios.map((scenario) => [scenario.id, scenario] as const))(
    "runs %s end to end without manual fixes",
    (_id, scenario) => {
      const intake = intakeSchema.parse(scenario.intake);
      const result = recommend(catalog, kb, intake);

      expect(result.recommendations.length).toBeGreaterThan(0);
      for (const recommendation of result.recommendations) {
        expect(recommendation.contributingPrimaries[0].rationale).toBeTruthy();
        expect(recommendation.sourceReferences.length).toBeGreaterThan(0);
        for (const primary of recommendation.contributingPrimaries) {
          expect(draftPrimaryIds.has(primary.id)).toBe(false);
        }
      }
    },
  );
});
