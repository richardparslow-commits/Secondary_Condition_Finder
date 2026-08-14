import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { conditionCatalogSchema } from "@/lib/catalog/schema";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { knowledgeBaseSchema } from "@/lib/kb/schema";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema, type Intake } from "@/lib/engine/types";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();

function intake(partial: Partial<Intake> & Pick<Intake, "primaryConditions">): Intake {
  return intakeSchema.parse(partial);
}

function firstOverlappingPrimaryPair(): {
  primaryA: string;
  primaryB: string;
  sharedConditionId: string;
} {
  const published = kb.filter((mapping) => !mapping.draft);
  for (let i = 0; i < published.length; i += 1) {
    for (let j = i + 1; j < published.length; j += 1) {
      const a = published[i];
      const b = published[j];
      const overlap = a.suggestions.find((suggestion) =>
        b.suggestions.some((candidate) => candidate.conditionId === suggestion.conditionId),
      );
      if (overlap) {
        return {
          primaryA: a.id,
          primaryB: b.id,
          sharedConditionId: overlap.conditionId,
        };
      }
    }
  }
  throw new Error("Expected at least one overlapping primary pair in published mappings.");
}

describe("recommend", () => {
  it("ports the original prototype ordering for PTSD", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: [" PTSD "] }),
    );
    // Display names come from the catalog, not the mapping file.
    expect(recommendations.map((r) => r.conditionId)).toEqual([
      "sleep-apnea",
      "migraine-headaches",
      "erectile-dysfunction",
    ]);
    expect(recommendations[0].condition).toBe(
      "Sleep Apnea (Obstructive, Central, Mixed)",
    );
  });

  it("returns rationale, evidence gaps, and citations for every suggestion", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["ptsd"] }),
    );
    for (const recommendation of recommendations) {
      expect(recommendation.contributingPrimaries.length).toBeGreaterThan(0);
      expect(recommendation.contributingPrimaries[0].rationale).toBeTruthy();
      expect(recommendation.evidenceGaps.length).toBeGreaterThan(0);
      expect(recommendation.sourceReferences.length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for an unknown primary and reports it as unrecognized", () => {
    const result = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["unknown condition"] }),
    );
    expect(result.recommendations).toEqual([]);
    expect(result.unrecognizedPrimaries).toEqual(["unknown condition"]);
    expect(result.unmappedPrimaries).toEqual([]);
    expect(result.recognizedPrimaries).toEqual([]);
  });

  it("carries the body system through from the catalog", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["ptsd"] }),
    );
    for (const recommendation of recommendations) {
      expect(recommendation.bodySystem.length).toBeGreaterThan(0);
    }
  });

  it("resolves a primary by alias as well as by name", () => {
    const byId = recommend(catalog, kb, intake({ primaryConditions: ["ptsd"] }));
    const byName = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Post-Traumatic Stress Disorder (PTSD)"] }),
    );
    expect(byName.recommendations).toEqual(byId.recommendations);
  });

  it("separates recognized, unmapped, and unrecognized primaries", () => {
    const result = recommend(
      catalog,
      kb,
      intake({
        primaryConditions: ["Tinnitus", "Plantar Fasciitis", "not a condition"],
      }),
    );
    expect(result.recognizedPrimaries).toEqual(["Tinnitus", "Plantar Fasciitis"]);
    expect(result.unmappedPrimaries).toEqual(["Tinnitus", "Plantar Fasciitis"]);
    expect(result.unrecognizedPrimaries).toEqual(["not a condition"]);
    expect(result.recommendations).toEqual([]);
  });

  it("merges a suggestion shared by two primaries and ranks it above single-source peers", () => {
    const { primaryA, primaryB, sharedConditionId } = firstOverlappingPrimaryPair();
    const result = recommend(
      catalog,
      kb,
      intake({ primaryConditions: [primaryA, primaryB] }),
    );
    const shared = result.recommendations.find(
      (r) => r.conditionId === sharedConditionId,
    );

    expect(shared).toBeDefined();
    expect(shared!.contributingPrimaries).toHaveLength(2);
    expect(shared!.score).toBeGreaterThan(0.5);
  });

  it("does not suggest a condition the user already listed as a primary", () => {
    // PTSD currently includes sleep apnea as an authored research suggestion.
    // When sleep apnea is also selected as a primary, it must be filtered out.
    const ptsdOnly = recommend(catalog, kb, intake({ primaryConditions: ["PTSD"] }));
    expect(ptsdOnly.recommendations.map((r) => r.conditionId)).toContain(
      "sleep-apnea",
    );

    const both = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["PTSD", "sleep-apnea"] }),
    );
    expect(both.recommendations.map((r) => r.conditionId)).not.toContain(
      "sleep-apnea",
    );
  });

  it("deduplicates repeated primary conditions", () => {
    const single = recommend(catalog, kb, intake({ primaryConditions: ["PTSD"] }));
    const doubled = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["PTSD", "ptsd", " PTSD "] }),
    );
    expect(doubled.recognizedPrimaries).toEqual([
      "Post-Traumatic Stress Disorder (PTSD)",
    ]);
    expect(doubled.recommendations).toEqual(single.recommendations);
  });

  it("sorts strictly by descending score", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["PTSD", "sleep-apnea"] }),
    );
    const scores = recommendations.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("surfaces matching intake context without changing the ranking", () => {
    const base = recommend(catalog, kb, intake({ primaryConditions: ["PTSD"] }));
    const withContext = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["PTSD"], symptoms: ["migraine"] }),
    );

    expect(withContext.recommendations.map((r) => r.condition)).toEqual(
      base.recommendations.map((r) => r.condition),
    );
    expect(withContext.recommendations.map((r) => r.score)).toEqual(
      base.recommendations.map((r) => r.score),
    );

    const migraine = withContext.recommendations.find(
      (r) => r.conditionId === "migraine-headaches",
    );
    expect(migraine?.matchedIntakeContext).toContain("migraine");
  });

  it("never emits a numeric confidence, only a qualitative prevalence band", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Diabetes mellitus type II"] }),
    );
    for (const recommendation of recommendations) {
      expect([
        "commonly-explored",
        "sometimes-explored",
        "occasionally-explored",
      ]).toContain(recommendation.prevalence);
    }
  });

  it("ignores draft mappings when building recommendations", () => {
    const syntheticCatalog = conditionCatalogSchema.parse([
      {
        id: "primary-condition",
        name: "Primary Condition",
        aliases: [],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: ["test fixture"],
      },
      {
        id: "secondary-condition",
        name: "Secondary Condition",
        aliases: [],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: ["test fixture"],
      },
    ]);
    const syntheticKb = knowledgeBaseSchema.parse([
      {
        id: "primary-condition",
        draft: true,
        todo: ["human review pending"],
        suggestions: [
          {
            conditionId: "secondary-condition",
            rank: 1,
            prevalence: "commonly-explored",
            rationale: "draft only",
            evidenceGaps: ["draft only"],
            sourceReferences: [{ citation: "test", note: "test", verified: false }],
          },
        ],
      },
    ]);

    const result = recommend(
      syntheticCatalog,
      syntheticKb,
      intake({ primaryConditions: ["primary-condition"] }),
    );

    expect(result.recommendations).toEqual([]);
    expect(result.recognizedPrimaries).toEqual(["Primary Condition"]);
    expect(result.unmappedPrimaries).toEqual(["Primary Condition"]);
  });
});

describe("intakeSchema", () => {
  it("requires at least one primary condition", () => {
    expect(() => intakeSchema.parse({ primaryConditions: [] })).toThrow();
  });

  it("defaults the optional intake fields", () => {
    const parsed = intakeSchema.parse({ primaryConditions: ["PTSD"] });
    expect(parsed.symptoms).toEqual([]);
    expect(parsed.medications).toEqual([]);
    expect(parsed.exposures).toEqual([]);
    expect(parsed.notes).toBe("");
  });
});
