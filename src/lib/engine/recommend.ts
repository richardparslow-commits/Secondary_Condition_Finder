import type { ConditionCatalog } from "@/lib/catalog/schema";
import { findCondition, indexById } from "@/lib/catalog/lookup";
import type { KnowledgeBase } from "@/lib/kb/schema";
import { publishedMappings } from "@/lib/kb/lookup";
import { createLogger, recordRecommendationLatency } from "@/lib/observability/logger";
import {
  isLangSmithTracingEnabled,
  LANGSMITH_PROJECT_NAME,
  traceable,
} from "@/lib/observability/langsmith";

import { CONSENSUS_BY_RANK, CONSENSUS_ORDER, rankWeight } from "./ranking";
import {
  dedupe,
  dedupeWarnings,
  findAlternativeEtiologyWarnings,
  findChronologyWarnings,
  matchIntakeContext,
} from "./signals";
import {
  dedupePathways,
  dedupeReferences,
  findIntermediatePathways,
  pathConsensusRank,
} from "./pathways";
import type {
  ClinicalFrictionWarning,
  ChronologyWarning,
  ContributingPrimary,
  Intake,
  IntermediatePathway,
  Recommendation,
  RecommendationResult,
} from "./types";

export const ENGINE_VERSION = "phase-2-crg";

interface Accumulated {
  conditionId: string;
  score: number;
  consensusRank: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  sourceReferences: import("@/lib/kb/schema").SourceReference[];
  clinicalFrictionWarnings: ClinicalFrictionWarning[];
  chronologyWarnings: ChronologyWarning[];
  intermediatePathways: IntermediatePathway[];
}

function recommendImpl(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
  intake: Intake,
): RecommendationResult {
  const startedAt = Date.now();
  const logger = createLogger("recommendation-engine");
  const byId = indexById(catalog);
  const mappings = publishedMappings(kb);

  const recognizedPrimaries: string[] = [];
  const unmappedPrimaries: string[] = [];
  const unrecognizedPrimaries: string[] = [];
  const recognizedIds = new Set<string>();

  for (const input of dedupe(intake.primaryConditions.map((c) => c.trim()))) {
    const condition = findCondition(catalog, input);

    if (!condition) {
      unrecognizedPrimaries.push(input);
      continue;
    }
    if (recognizedIds.has(condition.id)) {
      continue;
    }

    // Catalog recognition and mapping publication are separate concerns. A
    // known condition remains recognized even when its mapping is draft-only;
    // in that case it is reported as unmapped and contributes no suggestions.
    recognizedIds.add(condition.id);
    recognizedPrimaries.push(condition.name);
    if (!mappings.has(condition.id)) {
      unmappedPrimaries.push(condition.name);
    }
  }

  const accumulator = new Map<string, Accumulated>();

  for (const primaryId of recognizedIds) {
    const mapping = mappings.get(primaryId);
    if (!mapping) continue;
    const primary = byId.get(primaryId)!;

    for (const suggestion of mapping.suggestions) {
      // Do not suggest something the user already listed as service connected,
      // including a recognized primary whose own mapping is currently draft.
      if (recognizedIds.has(suggestion.conditionId)) continue;

      const existing = accumulator.get(suggestion.conditionId);
      const contribution: ContributingPrimary = {
        id: primary.id,
        name: primary.name,
        rank: suggestion.rank,
        rationale: suggestion.rationale,
        pathwayIntelligence: suggestion.pathwayIntelligence,
        nexusClaim: suggestion.nexusClaim,
        causalMechanism: suggestion.causalMechanism,
        evidentiaryProfile: suggestion.evidentiaryProfile,
      };
      const frictionWarnings = findAlternativeEtiologyWarnings(primary, suggestion, intake);
      const chronologyWarnings = findChronologyWarnings(
        primary,
        suggestion.conditionId,
        suggestion.nexusClaim.nexusClassification,
        intake,
      );

      if (existing) {
        existing.score += rankWeight(suggestion.rank);
        existing.contributingPrimaries.push(contribution);
        existing.evidenceGaps = dedupe([
          ...existing.evidenceGaps,
          ...suggestion.evidenceGaps,
        ]);
        existing.sourceReferences = dedupeReferences([
          ...existing.sourceReferences,
          ...suggestion.sourceReferences,
        ]);
        existing.clinicalFrictionWarnings = dedupeWarnings([
          ...existing.clinicalFrictionWarnings,
          ...frictionWarnings,
        ]);
        existing.chronologyWarnings = dedupeWarnings([
          ...existing.chronologyWarnings,
          ...chronologyWarnings,
        ]);
        existing.intermediatePathways = dedupePathways([
          ...existing.intermediatePathways,
        ]);
        // F-02: per-target consensus keeps the strongest (lowest-rank) tier across primaries.
        existing.consensusRank = Math.min(
          existing.consensusRank,
          CONSENSUS_ORDER[suggestion.evidentiaryProfile.etiologicalConsensus],
        );
      } else {
        accumulator.set(suggestion.conditionId, {
          conditionId: suggestion.conditionId,
          score: rankWeight(suggestion.rank),
          consensusRank: CONSENSUS_ORDER[suggestion.evidentiaryProfile.etiologicalConsensus],
          contributingPrimaries: [contribution],
          evidenceGaps: [...suggestion.evidenceGaps],
          sourceReferences: [...suggestion.sourceReferences],
          clinicalFrictionWarnings: frictionWarnings,
          chronologyWarnings,
          intermediatePathways: [],
        });
      }
    }

    const paths = findIntermediatePathways(
      primary,
      mappings,
      byId,
      new Set(intake.diagnosedConditionIds ?? []),
      recognizedIds,
    );
    for (const pathway of paths) {
      const existing = accumulator.get(pathway.targetId);
      if (existing) {
        existing.intermediatePathways = dedupePathways([
          ...existing.intermediatePathways,
          pathway,
        ]);
        continue;
      }

      accumulator.set(pathway.targetId, {
        conditionId: pathway.targetId,
        score: 1 / (pathway.edges[0].rank * pathway.edges[1].rank),
        consensusRank: pathConsensusRank(pathway),
        contributingPrimaries: [{
          id: pathway.primaryId,
          name: pathway.primaryName,
          rank: pathway.edges[0].rank,
          rationale: `Bounded intermediate-chain research path: ${pathway.causalChain}. Each edge requires separate individual medical support; the path is not a direct nexus finding.`,
        }],
        evidenceGaps: [
          "Independently establish the intermediate condition and both links in the proposed chain with compatible chronology and individual medical evidence",
        ],
        sourceReferences: [...pathway.sourceReferences],
        clinicalFrictionWarnings: [],
        chronologyWarnings: [],
        intermediatePathways: [pathway],
      });
    }
  }

  let recommendations: Recommendation[] = [...accumulator.values()]
    .map((entry) => {
      const catalogEntry = byId.get(entry.conditionId);
      if (!catalogEntry) {
        // Referential integrity is enforced by test; this guards runtime.
        throw new Error(
          `Suggestion references unknown catalog condition "${entry.conditionId}".`,
        );
      }
      const contributingPrimaries = [...entry.contributingPrimaries].sort(
        (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
      );
      return {
        conditionId: entry.conditionId,
        condition: catalogEntry.name,
        bodySystem: catalogEntry.bodySystem,
        etiologicalConsensus: CONSENSUS_BY_RANK[entry.consensusRank],
        score: Number(entry.score.toFixed(4)),
        contributingPrimaries,
        evidenceGaps: entry.evidenceGaps,
        sourceReferences: entry.sourceReferences,
        clinicalFrictionWarnings: entry.clinicalFrictionWarnings,
        chronologyWarnings: entry.chronologyWarnings,
        intermediatePathways: entry.intermediatePathways,
        matchedIntakeContext: matchIntakeContext(
          catalogEntry.name,
          contributingPrimaries,
          entry.evidenceGaps,
          intake,
        ),
      };
    })
    .sort((a, b) => b.score - a.score || a.condition.localeCompare(b.condition));

  // Focus Engine: when the current workflow supplies the diagnosed set, keep
  // recommendation output strictly inside that exact catalog-id boundary.
  if (intake.diagnosedConditionIds) {
    const diagnosedSet = new Set(intake.diagnosedConditionIds);
    recommendations = recommendations.filter((recommendation) =>
      diagnosedSet.has(recommendation.conditionId),
    );
  }

  // F-01: single recording point for both sync `recommend` and `recommendTraced`.
  // When LANGSMITH_TRACING=true, `recommendWithTracing` calls `recommendTraced`
  // which delegates to `recommendImpl` here, so latency is recorded exactly once
  // inside this function — the traceable wrapper adds no second metric.
  const durationMs = Date.now() - startedAt;
  try {
    recordRecommendationLatency(durationMs, {
      primaryCount: String(recognizedPrimaries.length),
      recommendationCount: String(recommendations.length),
    });
    logger.info("recommendation executed", {
      durationMs,
      primaryCount: recognizedPrimaries.length,
      recommendationCount: recommendations.length,
      unmappedCount: unmappedPrimaries.length,
    });
  } catch {
    // metrics/logging are best-effort
  }

  return {
    recommendations,
    recognizedPrimaries,
    unmappedPrimaries,
    unrecognizedPrimaries,
  };
}

/**
 * Primary export — synchronous, deterministic, no tracing overhead. Tests
 * and all existing callers import this. Kept sync so the funded `220/220`
 * suite does not need to be rewritten to `await`.
 */
export function recommend(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
  intake: Intake,
): RecommendationResult {
  return recommendImpl(catalog, kb, intake);
}

/**
 * LangSmith-traced entry point. When LANGSMITH_TRACING=true every Step 5
 * call appears in the configured project (default `secondary-condition-finder`)
 * so Engine can cluster traces into issues and — when a repository is
 * connected — open automated PRs against this codebase. Input/output
 * redaction stays in the same contract as `logger.ts`: only counts/ids are
 * attached to traces (never raw evidence or workflow payloads).
 *
 * This wraps a `Promise`-returning function, so it always returns
 * `Promise<RecommendationResult>`. Server pages should `await` it.
 */
export const recommendTraced = traceable(
  async (
    catalog: ConditionCatalog,
    kb: KnowledgeBase,
    intake: Intake,
  ): Promise<RecommendationResult> => recommendImpl(catalog, kb, intake),
  {
    name: "recommend",
    run_type: "chain",
    project_name: LANGSMITH_PROJECT_NAME,
    tags: ["secondary-condition-finder", "recommendation-engine", ENGINE_VERSION],
    // Only attach safe metadata — never raw intake text or evidence.
    processInputs: (inputs) => {
      // inputs is { args: [catalog, kb, intake] } when called with 3 args.
      const args = (inputs as { args?: unknown[] }).args;
      const intakeArg = args?.[2] as Intake | undefined;
      if (!intakeArg) return { input: "no-intake" };
      return {
        diagnosedConditionIds: intakeArg.diagnosedConditionIds?.length ?? 0,
        primaryConditions: intakeArg.primaryConditions?.length ?? 0,
        hasTimeline: Boolean(intakeArg.conditionTimeline && Object.keys(intakeArg.conditionTimeline).length),
        engineVersion: ENGINE_VERSION,
      };
    },
    processOutputs: (outputs) => {
      const result = outputs as unknown as RecommendationResult;
      if (!result || typeof result !== "object") return { outputs };
      return {
        recommendationCount: (result as RecommendationResult).recommendations?.length ?? 0,
        recognizedPrimaries: (result as RecommendationResult).recognizedPrimaries?.length ?? 0,
        unmappedPrimaries: (result as RecommendationResult).unmappedPrimaries?.length ?? 0,
      };
    },
  },
);

/**
 * Convenience helper for `async` server components/pages. Returns a
 * `RecommendationResult` whether or not LangSmith is configured, so the
 * same call site works in local dev (no key), CI (no tracing), and
 * production (tracing on + Engine connected). When tracing is disabled this
 * is just a direct sync call with no Promise overhead beyond the `async`
 * wrapper.
 */
export async function recommendWithTracing(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
  intake: Intake,
): Promise<RecommendationResult> {
  if (!isLangSmithTracingEnabled()) {
    return recommendImpl(catalog, kb, intake);
  }
  return recommendTraced(catalog, kb, intake);
}
