import { describe, expect, it, vi } from "vitest";

import { recommend, recommendWithTracing } from "@/lib/engine/recommend";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { conditionCatalogSchema } from "@/lib/catalog/schema";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { knowledgeBaseSchema, type EvidentiaryProfile, type KnowledgeBase } from "@/lib/kb/schema";
import { intakeSchema, type Intake } from "@/lib/engine/types";
import { buildNonServiceConnectedConditionResults } from "@/lib/secondary-workflow/suggestions";
import { buildCausalMechanism, buildEvidentiaryProfile } from "./helpers/crg-fixtures";

/**
 * Recommendation aggregation must not depend on primary discovery order.
 * Diagnosed targets are essential: without them no intermediate paths compose.
 * Schema-valid causal fixtures pin mixed/path-only scores and provenance;
 * published-corpus checks also compare complete recommendation projections.
 */

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();

function intake(primaryConditions: string[]) {
  return intakeSchema.parse({
    primaryConditions,
    diagnosedConditionIds: catalog.map((condition) => condition.id),
  });
}

function scoreFor(targetId: string, primaries: string[]): number | undefined {
  const result = recommend(catalog, kb, intake(primaries));
  return result.recommendations.find((r) => r.conditionId === targetId)?.score;
}

/** Every permutation of a small list, so ordering cannot be accidentally fixed. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) result.push([item, ...tail]);
  });
  return result;
}

describe("recommendation aggregation is order invariant", () => {
  it("keeps a shared target's score identical under every primary ordering", () => {
    const published = kb.filter((mapping) => !mapping.draft);
    let pair: { primaryA: string; primaryB: string; sharedTarget: string } | null = null;
    for (const mapping of published) {
      for (const other of published) {
        if (other.id === mapping.id) continue;
        const shared = mapping.suggestions.find((suggestion) =>
          other.suggestions.some(
            (candidate) => candidate.conditionId === suggestion.conditionId,
          ),
        );
        if (shared) {
          pair = { primaryA: mapping.id, primaryB: other.id, sharedTarget: shared.conditionId };
          break;
        }
      }
      if (pair) break;
    }
    expect(pair).not.toBeNull();
    const { primaryA, primaryB, sharedTarget } = pair!;

    const scores = permutations([primaryA, primaryB]).map((order) =>
      scoreFor(sharedTarget, order),
    );
    expect(scores[0]).toBeDefined();
    expect(new Set(scores).size).toBe(1);
  });

  it("keeps every recommendation score stable when a three-primary intake is reordered", () => {
    // Pick three published primaries that overlap on at least one target, so
    // ordering genuinely changes discovery order inside the accumulator.
    const published = kb.filter((mapping) => !mapping.draft).slice(0, 3);
    expect(published.length).toBe(3);

    const baseline = recommend(
      catalog,
      kb,
      intake(published.map((mapping) => mapping.id)),
    );
    const baselineScores = new Map(
      baseline.recommendations.map((recommendation) => [
        recommendation.conditionId,
        recommendation.score,
      ]),
    );

    for (const order of permutations(published.map((mapping) => mapping.id))) {
      const result = recommend(catalog, kb, intake(order));
      const scores = new Map(
        result.recommendations.map((recommendation) => [
          recommendation.conditionId,
          recommendation.score,
        ]),
      );
      // The same target set, and the same score for every target.
      expect([...scores.keys()].sort()).toEqual([...baselineScores.keys()].sort());
      for (const [conditionId, score] of scores) {
        expect(score).toBe(baselineScores.get(conditionId));
      }
      // Provenance, warnings, consensus, context, and nested paths are stable too.
      expect(result.recommendations).toEqual(baseline.recommendations);
    }
  });
});

const syntheticCatalog = conditionCatalogSchema.parse(
  ["primary-a", "primary-b", "primary-c", "middle", "other-middle", "target", "peer", "unrelated"].map((id) => ({
    id,
    name: id,
    aliases: [],
    bodySystem: "Test",
    ratingSchedule: [],
    reviewNotes: ["Synthetic permutation fixture, not clinical evidence."],
  })),
);

type Suggestion = KnowledgeBase[number]["suggestions"][number];

function edge(
  conditionId: string,
  citation: string,
  rank = 1,
  consensus: EvidentiaryProfile["etiologicalConsensus"] = "PROBABLE",
): Suggestion {
  return {
    conditionId,
    rank,
    nexusClaim: {
      nexusClassification: "DIRECT_CAUSATION",
      etiologicalTrigger: "A synthetic biological trigger described only for schema-valid recommendation aggregation tests.",
    },
    causalMechanism: buildCausalMechanism({ hypothesizedOnly: false }),
    evidentiaryProfile: buildEvidentiaryProfile({
      etiologicalConsensus: consensus,
      alternativeEtiologiesToRuleOut: ["Alcohol exposure in this synthetic fixture"],
    }),
    rationale: `Synthetic ${citation} rationale.`,
    evidenceGaps: [`Review ${citation}.`],
    sourceReferences: [{
      citation,
      note: `Synthetic provenance for ${citation}.`,
      verificationScope: "clinical-evidence",
      sourceUrl: `https://example.test/${citation.toLowerCase()}`,
      verified: false,
    }],
  };
}

function mapping(id: string, suggestions: Suggestion[], draft = false) {
  return { id, draft, todo: draft ? ["Pending synthetic publication review"] : [], suggestions };
}

function syntheticRecommendations(kb: KnowledgeBase, primaries: string[], extra: Partial<Intake> = {}) {
  return recommend(syntheticCatalog, kb, intakeSchema.parse({
    ...extra,
    primaryConditions: primaries,
    diagnosedConditionIds: ["target", "peer"],
  })).recommendations;
}

function expectPermutationInvariant(kb: KnowledgeBase, primaries: string[], extra: Partial<Intake> = {}) {
  const baseline = syntheticRecommendations(kb, primaries, extra);
  expect(baseline.length).toBeGreaterThan(0);
  for (const order of permutations(primaries)) {
    expect(syntheticRecommendations(kb, order, extra)).toEqual(baseline);
  }
  return baseline;
}

describe("diagnosed-target direct/path permutation regressions", () => {
  it.each([1, 2])("keeps rank-%i direct evidence authoritative when a stronger path is found first", (rank) => {
    const kb = knowledgeBaseSchema.parse([
      mapping("primary-a", [edge("middle", "A-M", 1, "WELL_ESTABLISHED")]),
      mapping("middle", [edge("target", "M-T", 1, "WELL_ESTABLISHED")]),
      mapping("primary-b", [
        ...(rank === 2 ? [edge("unrelated", "B-U")] : []),
        edge("target", "B-T", rank),
      ]),
    ]);
    const [target] = expectPermutationInvariant(kb, ["primary-a", "primary-b"]);
    expect(target.conditionId).toBe("target");
    expect(target.score).toBe(1 / rank);
    expect(target.etiologicalConsensus).toBe("PROBABLE");
    expect(target.contributingPrimaries.map((primary) => primary.id)).toEqual(["primary-b"]);
    expect(target.evidenceGaps).toEqual(["Review B-T."]);
    expect(target.sourceReferences).toEqual(kb[2].suggestions[rank - 1].sourceReferences);
    expect(target.intermediatePathways).toHaveLength(1);
    expect(target.intermediatePathways?.[0].sourceReferences.map((reference) => reference.citation)).toEqual(["A-M", "M-T"]);
  });

  it("sums all path-only scores and merges contributors, consensus, and complete shared-edge provenance", () => {
    const kb = knowledgeBaseSchema.parse([
      mapping("primary-a", [edge("middle", "A-M")]),
      mapping("primary-b", [edge("unrelated", "B-U"), edge("middle", "B-M", 2, "WELL_ESTABLISHED")]),
      mapping("middle", [edge("target", "M-T", 1, "WELL_ESTABLISHED")]),
    ]);
    const [target] = expectPermutationInvariant(kb, ["primary-a", "primary-b"]);
    expect(target.score).toBe(1.5);
    expect(target.etiologicalConsensus).toBe("WELL_ESTABLISHED");
    expect(target.contributingPrimaries.map((primary) => primary.id)).toEqual(["primary-a", "primary-b"]);
    expect(target.contributingPrimaries.every((primary) => primary.rationale.includes("not a direct nexus finding"))).toBe(true);
    expect(target.intermediatePathways).toHaveLength(2);
    expect(target.sourceReferences).toEqual([
      kb[0].suggestions[0].sourceReferences[0],
      kb[2].suggestions[0].sourceReferences[0],
      kb[1].suggestions[1].sourceReferences[0],
    ]);
  });

  it("uses each path's weakest edge before merging consensus across distinct routes", () => {
    const kb = knowledgeBaseSchema.parse([
      mapping("primary-a", [edge("middle", "A-M", 1, "WELL_ESTABLISHED")]),
      mapping("primary-b", [edge("unrelated", "B-U"), edge("other-middle", "B-N", 2)]),
      mapping("middle", [edge("target", "M-T", 1, "NOT_ESTABLISHED")]),
      mapping("other-middle", [edge("target", "N-T", 1, "WELL_ESTABLISHED")]),
    ]);
    const [target] = expectPermutationInvariant(kb, ["primary-a", "primary-b"]);
    expect(target.score).toBe(1.5);
    expect(target.etiologicalConsensus).toBe("PROBABLE");
    expect(target.intermediatePathways?.map((path) => path.intermediateId)).toEqual(["middle", "other-middle"]);
    expect(target.sourceReferences.map((reference) => reference.citation)).toEqual(["A-M", "M-T", "B-N", "N-T"]);
  });

  it("collects multiple paths from one primary without double counting repeated primary inputs", () => {
    const kb = knowledgeBaseSchema.parse([
      mapping("primary-a", [edge("middle", "A-M"), edge("other-middle", "A-N", 2)]),
      mapping("middle", [edge("target", "M-T")]),
      mapping("other-middle", [edge("target", "N-T")]),
    ]);
    const [target] = syntheticRecommendations(kb, ["primary-a"]);
    expect(target.score).toBe(1.5);
    expect(target.intermediatePathways).toHaveLength(2);
    expect(target.sourceReferences.map((reference) => reference.citation)).toEqual(["A-M", "M-T", "A-N", "N-T"]);
    expect(syntheticRecommendations(kb, ["primary-a", " PRIMARY-A ", "primary-a"])).toEqual([target]);
  });

  it("keeps three-primary mixed output, warnings, context, and target ordering stable under all six permutations", () => {
    const kb = knowledgeBaseSchema.parse([
      mapping("primary-a", [edge("middle", "A-M", 1, "WELL_ESTABLISHED")]),
      mapping("middle", [edge("target", "M-T", 1, "WELL_ESTABLISHED")]),
      mapping("primary-b", [edge("target", "B-T"), edge("peer", "B-P", 2)]),
      mapping("primary-c", [edge("peer", "C-P"), edge("target", "C-T", 2, "NOT_ESTABLISHED")]),
    ]);
    const results = expectPermutationInvariant(kb, ["primary-a", "primary-b", "primary-c"], {
      history: ["Alcohol"],
      symptoms: ["B-T"],
      conditionTimeline: {
        "primary-b": { onsetYear: 2020 },
        "primary-c": { onsetYear: 2021 },
        target: { diagnosisYear: 2015 },
      },
    });
    const target = results.find((recommendation) => recommendation.conditionId === "target")!;
    expect(results.map((recommendation) => recommendation.conditionId)).toEqual(["peer", "target"]);
    expect(results.map((recommendation) => recommendation.score)).toEqual([1.5, 1.5]);
    expect(target.contributingPrimaries.map((primary) => primary.id)).toEqual(["primary-b", "primary-c"]);
    expect(target.etiologicalConsensus).toBe("PROBABLE");
    expect(target.evidenceGaps).toEqual(["Review B-T.", "Review C-T."]);
    expect(target.sourceReferences.map((reference) => reference.citation)).toEqual(["B-T", "C-T"]);
    expect(target.clinicalFrictionWarnings?.map((warning) => warning.primaryId)).toEqual(["primary-b", "primary-c"]);
    expect(target.chronologyWarnings?.map((warning) => warning.primaryId)).toEqual(["primary-b", "primary-c"]);
    expect(target.matchedIntakeContext).toEqual(["B-T"]);
    expect(target.intermediatePathways).toHaveLength(1);
  });

  it("preserves the async workflow projection while recognition summaries retain input order", async () => {
    vi.stubEnv("LANGSMITH_TRACING", "false");
    try {
      const kb = knowledgeBaseSchema.parse([
        mapping("primary-a", [edge("middle", "A-M")]),
        mapping("middle", [edge("target", "M-T")]),
        mapping("primary-b", [edge("target", "B-T")]),
      ]);
      const expected = buildNonServiceConnectedConditionResults(
        syntheticCatalog, ["target", "peer"], ["primary-a", "primary-b"],
        syntheticRecommendations(kb, ["primary-a", "primary-b"]),
      );
      expect(expected.map((result) => result.conditionId)).toEqual(["peer", "target"]);
      expect(expected[0].recommendation).toBeNull();
      expect(expected[1].recommendation?.score).toBe(1);
      for (const order of permutations(["primary-a", "primary-b"])) {
        const result = await recommendWithTracing(syntheticCatalog, kb, intakeSchema.parse({
          primaryConditions: order,
          diagnosedConditionIds: ["target", "peer"],
        }));
        expect(result.recognizedPrimaries).toEqual(order);
        expect(buildNonServiceConnectedConditionResults(
          syntheticCatalog, ["target", "peer"], order, result.recommendations,
        )).toEqual(expected);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("retains the diagnosed boundary, published-only paths, and empty output behavior", () => {
    const kb = knowledgeBaseSchema.parse([
      mapping("primary-a", [edge("middle", "A-M")]),
      mapping("middle", [edge("target", "M-T")], true),
      mapping("primary-b", [edge("target", "B-T")]),
    ]);
    const [target] = expectPermutationInvariant(kb, ["primary-a", "primary-b"]);
    expect(target.score).toBe(1);
    expect(target.intermediatePathways).toEqual([]);
    expect(target.sourceReferences.map((reference) => reference.citation)).toEqual(["B-T"]);
    expect(syntheticRecommendations(kb, ["primary-a"])).toEqual([]);
    expect(syntheticRecommendations(kb, ["unrelated"])).toEqual([]);
    expect(recommend(syntheticCatalog, kb, intakeSchema.parse({
      primaryConditions: ["primary-b"], diagnosedConditionIds: [],
    })).recommendations).toEqual([]);
    expect(recommend(syntheticCatalog, kb, intakeSchema.parse({
      primaryConditions: ["primary-a", "primary-b", "target"], diagnosedConditionIds: ["target"],
    })).recommendations).toEqual([]);
  });
});
