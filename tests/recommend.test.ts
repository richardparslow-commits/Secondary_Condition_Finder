import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { conditionCatalogSchema } from "@/lib/catalog/schema";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { knowledgeBaseSchema } from "@/lib/kb/schema";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema, type Intake } from "@/lib/engine/types";
import {
  buildCausalMechanism,
  buildEvidentiaryProfile,
  buildNexusClaim,
} from "./helpers/crg-fixtures";

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

  it("never emits a numeric confidence, only a qualitative etiological-consensus tier", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Diabetes mellitus type II"] }),
    );
    for (const recommendation of recommendations) {
      expect([
        "WELL_ESTABLISHED",
        "IATROGENIC_TREATMENT_EFFECT",
        "PROBABLE",
        "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE",
        "NOT_ESTABLISHED",
      ]).toContain(recommendation.etiologicalConsensus);
    }
  });

  it("adds alternative-etiology warnings without changing score or ordering", () => {
    const syntheticCatalog = conditionCatalogSchema.parse([
      { id: "primary-condition", name: "Primary Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
      { id: "secondary-condition", name: "Secondary Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
      { id: "other-condition", name: "Other Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
    ]);
    const syntheticKb = knowledgeBaseSchema.parse([
      {
        id: "primary-condition",
        draft: false,
        todo: [],
        suggestions: [
          {
            conditionId: "secondary-condition",
            rank: 1,
            nexusClaim: buildNexusClaim(),
            causalMechanism: buildCausalMechanism(),
            evidentiaryProfile: buildEvidentiaryProfile({
              alternativeEtiologiesToRuleOut: ["Alcohol exposure or alcohol-related disease"],
              alternativeEtiologyTags: ["alcohol"],
            }),
            rationale: "Bounded association fixture.",
            evidenceGaps: ["Review alternatives."],
            sourceReferences: [{ citation: "Fixture", note: "Fixture", verified: false }],
          },
          {
            conditionId: "other-condition",
            rank: 2,
            nexusClaim: buildNexusClaim(),
            causalMechanism: buildCausalMechanism(),
            evidentiaryProfile: buildEvidentiaryProfile(),
            rationale: "Second bounded association fixture.",
            evidenceGaps: ["Review evidence."],
            sourceReferences: [{ citation: "Fixture 2", note: "Fixture", verified: false }],
          },
        ],
      },
    ]);
    const base = recommend(syntheticCatalog, syntheticKb, intake({ primaryConditions: ["primary-condition"] }));
    const withHistory = recommend(syntheticCatalog, syntheticKb, intake({
      primaryConditions: ["primary-condition"],
      history: ["Alcohol"],
    }));

    expect(withHistory.recommendations.map((recommendation) => recommendation.conditionId)).toEqual(
      base.recommendations.map((recommendation) => recommendation.conditionId),
    );
    expect(withHistory.recommendations.map((recommendation) => recommendation.score)).toEqual(
      base.recommendations.map((recommendation) => recommendation.score),
    );
    expect(withHistory.recommendations[0]?.clinicalFrictionWarnings).toHaveLength(1);
    expect(withHistory.recommendations[0]?.clinicalFrictionWarnings?.[0]?.code).toBe("ALTERNATIVE_ETIOLOGY_OVERLAP");
    expect(withHistory.recommendations[1]?.clinicalFrictionWarnings).toEqual([]);
  });

  it("flags direct-causation chronology conflicts and leaves missing dates neutral", () => {
    const syntheticCatalog = conditionCatalogSchema.parse([
      { id: "primary-condition", name: "Primary Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
      { id: "secondary-condition", name: "Secondary Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
    ]);
    const syntheticKb = knowledgeBaseSchema.parse([{
      id: "primary-condition",
      draft: false,
      todo: [],
      suggestions: [{
        conditionId: "secondary-condition",
        rank: 1,
        nexusClaim: {
          nexusClassification: "DIRECT_CAUSATION",
          etiologicalTrigger: "A specific fixture biological trigger is described here with enough detail for schema validation and review.",
        },
        causalMechanism: buildCausalMechanism({ hypothesizedOnly: false }),
        evidentiaryProfile: buildEvidentiaryProfile({ etiologicalConsensus: "PROBABLE" }),
        rationale: "Direct-causation chronology fixture.",
        evidenceGaps: ["Review chronology."],
        sourceReferences: [{ citation: "Fixture", note: "Fixture", verified: false }],
      }],
    }]);
    const conflict = recommend(syntheticCatalog, syntheticKb, intake({
      primaryConditions: ["primary-condition"],
      conditionTimeline: {
        "primary-condition": { onsetYear: 2020 },
        "secondary-condition": { diagnosisYear: 2015 },
      },
    }));
    const neutral = recommend(syntheticCatalog, syntheticKb, intake({
      primaryConditions: ["primary-condition"],
      conditionTimeline: { "primary-condition": { onsetYear: 2020 } },
    }));

    expect(conflict.recommendations[0]?.chronologyWarnings?.[0]?.code).toBe("SECONDARY_PRECEDES_PRIMARY");
    expect(neutral.recommendations[0]?.chronologyWarnings).toEqual([]);
  });

  it("surfaces only bounded published two-hop paths to diagnosed targets with edge provenance", () => {
    const syntheticCatalog = conditionCatalogSchema.parse([
      ...["primary-condition", "intermediate-condition", "target-condition", "unrelated-target", "third-hop-condition"].map((id) => ({
        id,
        name: id.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
        aliases: [],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: ["test"],
      })),
    ]);
    const edge = (conditionId: string, citation: string, rank: number) => ({
      conditionId,
      rank,
      nexusClaim: buildNexusClaim(),
      causalMechanism: buildCausalMechanism(),
      evidentiaryProfile: buildEvidentiaryProfile(),
      rationale: `Published fixture edge to ${conditionId}.`,
      evidenceGaps: ["Review each individual link."],
      sourceReferences: [{ citation, note: "Published fixture provenance", verified: false }],
    });
    const syntheticKb = knowledgeBaseSchema.parse([
      {
        id: "primary-condition",
        draft: false,
        todo: [],
        suggestions: [
          edge("intermediate-condition", "PRIMARY-INTERMEDIATE", 1),
          edge("unrelated-target", "PRIMARY-UNRELATED", 2),
        ],
      },
      {
        id: "intermediate-condition",
        draft: false,
        todo: [],
        suggestions: [
          edge("target-condition", "INTERMEDIATE-TARGET", 1),
          edge("third-hop-condition", "INTERMEDIATE-THIRD-HOP", 2),
        ],
      },
    ]);

    const withoutBoundary = recommend(
      syntheticCatalog,
      syntheticKb,
      intake({ primaryConditions: ["primary-condition"] }),
    );
    expect(withoutBoundary.recommendations).toHaveLength(2);
    expect(withoutBoundary.recommendations.some((recommendation) => recommendation.intermediatePathways?.length)).toBe(false);

    const result = recommend(
      syntheticCatalog,
      syntheticKb,
      intake({
        primaryConditions: ["primary-condition"],
        diagnosedConditionIds: ["target-condition"],
      }),
    );
    expect(result.recommendations.map((recommendation) => recommendation.conditionId)).toEqual(["target-condition"]);

    const pathway = result.recommendations[0]?.intermediatePathways?.[0];
    expect(pathway?.label).toBe("INTERMEDIATE_CHAIN");
    expect(pathway?.causalChain).toBe("Primary Condition → Intermediate Condition → Target Condition");
    expect(pathway?.edges).toHaveLength(2);
    expect(pathway?.edges[0]?.sourceReferences[0]?.citation).toBe("PRIMARY-INTERMEDIATE");
    expect(pathway?.edges[1]?.sourceReferences[0]?.citation).toBe("INTERMEDIATE-TARGET");
    expect(pathway?.sourceReferences.map((reference) => reference.citation)).toEqual([
      "PRIMARY-INTERMEDIATE",
      "INTERMEDIATE-TARGET",
    ]);
    expect(result.recommendations[0]?.contributingPrimaries[0]?.rationale).toContain("not a direct nexus finding");

    const draftIntermediateKb = knowledgeBaseSchema.parse([
      syntheticKb[0],
      {
        ...syntheticKb[1],
        draft: true,
        todo: ["intermediate mapping requires publication review"],
      },
    ]);
    const draftResult = recommend(
      syntheticCatalog,
      draftIntermediateKb,
      intake({
        primaryConditions: ["primary-condition"],
        diagnosedConditionIds: ["target-condition"],
      }),
    );
    expect(draftResult.recommendations).toEqual([]);
  });

  it("does not change a direct recommendation score when an intermediate path reaches the same diagnosed target", () => {
    const syntheticCatalog = conditionCatalogSchema.parse([
      { id: "primary-condition", name: "Primary Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
      { id: "intermediate-condition", name: "Intermediate Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
      { id: "target-condition", name: "Target Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
      { id: "peer-condition", name: "Peer Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
    ]);
    const makeSuggestion = (conditionId: string, rank: number, citation: string) => ({
      conditionId,
      rank,
      nexusClaim: buildNexusClaim(),
      causalMechanism: buildCausalMechanism(),
      evidentiaryProfile: buildEvidentiaryProfile(),
      rationale: "Synthetic published edge.",
      evidenceGaps: ["Review the edge."],
      sourceReferences: [{ citation, note: "Fixture", verified: false }],
    });
    const syntheticKb = knowledgeBaseSchema.parse([
      {
        id: "primary-condition",
        draft: false,
        todo: [],
        suggestions: [
          makeSuggestion("target-condition", 1, "DIRECT-TARGET"),
          makeSuggestion("peer-condition", 2, "DIRECT-PEER"),
          makeSuggestion("intermediate-condition", 3, "PRIMARY-INTERMEDIATE"),
        ],
      },
      {
        id: "intermediate-condition",
        draft: false,
        todo: [],
        suggestions: [makeSuggestion("target-condition", 1, "INTERMEDIATE-TARGET")],
      },
    ]);
    const result = recommend(syntheticCatalog, syntheticKb, intake({
      primaryConditions: ["primary-condition"],
      diagnosedConditionIds: ["target-condition", "peer-condition"],
    }));
    expect(result.recommendations.map((recommendation) => recommendation.conditionId)).toEqual([
      "target-condition",
      "peer-condition",
    ]);
    expect(result.recommendations.map((recommendation) => recommendation.score)).toEqual([1, 0.5]);
    expect(result.recommendations[0]?.intermediatePathways).toHaveLength(1);
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
            nexusClaim: buildNexusClaim(),
            causalMechanism: buildCausalMechanism(),
            evidentiaryProfile: buildEvidentiaryProfile(),
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
