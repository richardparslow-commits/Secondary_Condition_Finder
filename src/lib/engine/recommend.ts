import type { ConditionCatalog } from "@/lib/catalog/schema";
import { findCondition, indexById, normalizeConditionName } from "@/lib/catalog/lookup";
import type { KnowledgeBase, SourceReference } from "@/lib/kb/schema";
import { publishedMappings } from "@/lib/kb/lookup";
import { createLogger, recordRecommendationLatency } from "@/lib/observability/logger";
import {
  isLangSmithTracingEnabled,
  LANGSMITH_PROJECT_NAME,
  traceable,
} from "@/lib/observability/langsmith";

import type {
  ClinicalFrictionWarning,
  ChronologyWarning,
  ContributingPrimary,
  Intake,
  IntermediatePathEdge,
  IntermediatePathway,
  Recommendation,
  RecommendationResult,
} from "./types";

export const ENGINE_VERSION = "phase-2-crg";

/**
 * Etiological-consensus weight: how strongly the medical literature establishes
 * that A causes (or aggravates) B. Prevalence is deliberately gone; how
 * "commonly explored" a relationship is says nothing about VA nexus
 * probability. WELL_ESTABLISHED maps to "at least as likely as not" without
 * an individual-evidence discount; weaker tiers are discounted accordingly.
 */
const CONSENSUS_ORDER = {
  WELL_ESTABLISHED: 0,
  IATROGENIC_TREATMENT_EFFECT: 1,
  PROBABLE: 2,
  CONTESTED_REQUIRES_SPECIFIC_EVIDENCE: 3,
  NOT_ESTABLISHED: 4,
} as const;

const CONSENSUS_BY_RANK = [
  "WELL_ESTABLISHED",
  "IATROGENIC_TREATMENT_EFFECT",
  "PROBABLE",
  "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE",
  "NOT_ESTABLISHED",
] as const;

/**
 * Rank 1 contributes 1.0, rank 2 contributes 0.5, and so on. When several
 * primary conditions point at the same secondary, the contributions add, so a
 * suggestion supported by two primaries outranks one supported by a single
 * primary at the same rank. This is an ordering heuristic, nothing more, and
 * it is never shown to the user as a number.
 */
function rankWeight(rank: number): number {
  return 1 / rank;
}

const HISTORY_SIGNAL_ALIASES: Record<string, string[]> = {
  alcohol: ["alcohol", "alcohol use", "alcohol-related", "drinking"],
  smoking: ["smoking", "tobacco", "cigarette", "nicotine"],
  obesity: ["obesity", "overweight", "body mass index", "bmi"],
  "kidney-disease": ["kidney disease", "renal disease", "chronic kidney", "ckd"],
  "prior-trauma": ["prior trauma", "previous trauma", "injury", "traumatic"],
  "family-history": ["family history", "familial", "hereditary", "genetic"],
  "medication-effect": ["medication effect", "medication effects", "drug effect", "side effect"],
  diabetes: ["diabetes", "diabetic"],
  hypertension: ["hypertension", "high blood pressure"],
};

function canonicalHistorySignals(value: string): string[] {
  const normalized = normalizeHistoryTerm(value);
  return Object.entries(HISTORY_SIGNAL_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeHistoryTerm(alias))))
    .map(([signal]) => signal);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function dedupeWarnings<T extends { code: string; primaryId: string; message: string }>(warnings: T[]): T[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.primaryId}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeHistoryTerm(value: string): string {
  return normalizeConditionName(value).replace(/[^a-z0-9 -]/g, "");
}

function findAlternativeEtiologyWarnings(
  primary: { id: string; name: string },
  suggestion: {
    evidentiaryProfile: {
      alternativeEtiologiesToRuleOut: string[];
      alternativeEtiologyTags?: string[];
    };
  },
  intake: Intake,
): ClinicalFrictionWarning[] {
  const history = dedupe(
    (intake.history ?? [])
      .flatMap((term) => canonicalHistorySignals(term))
      .filter(Boolean),
  );
  const alternatives = suggestion.evidentiaryProfile.alternativeEtiologiesToRuleOut;
  const tags = (suggestion.evidentiaryProfile.alternativeEtiologyTags ?? []).map(normalizeHistoryTerm);
  const warnings: ClinicalFrictionWarning[] = [];

  for (const reported of history) {
    const matchingAlternative = alternatives.find((alternative) => {
      const alternativeSignals = canonicalHistorySignals(alternative);
      return alternativeSignals.includes(reported) || normalizeHistoryTerm(alternative).includes(reported);
    });
    const matchingTag = tags.find((tag) => tag === reported || tag.includes(reported) || reported.includes(tag));
    if (!matchingAlternative && !matchingTag) continue;

    warnings.push({
      code: "ALTERNATIVE_ETIOLOGY_OVERLAP",
      primaryId: primary.id,
      primaryName: primary.name,
      matchedHistory: reported,
      alternativeEtiology: matchingAlternative ?? matchingTag,
      message: `Reported history "${reported}" overlaps with an alternative etiology listed for this mapping. A qualified clinician should address whether it contributed to the diagnosed condition; this warning does not determine causation or defeat the relationship.`,
    });
  }

  return warnings;
}

function timelineYear(
  intake: Intake,
  conditionId: string,
): number | undefined {
  const timeline = intake.conditionTimeline?.[conditionId];
  return timeline?.onsetYear ?? timeline?.diagnosisYear;
}

function findChronologyWarnings(
  primary: { id: string; name: string },
  targetConditionId: string,
  nexusClassification: string,
  intake: Intake,
): ChronologyWarning[] {
  const primaryYear = timelineYear(intake, primary.id);
  const secondaryYear = timelineYear(intake, targetConditionId);
  if (primaryYear === undefined || secondaryYear === undefined) return [];

  if (nexusClassification === "DIRECT_CAUSATION" && secondaryYear < primaryYear) {
    return [{
      code: "SECONDARY_PRECEDES_PRIMARY",
      primaryId: primary.id,
      primaryName: primary.name,
      primaryYear,
      secondaryYear,
      message: `The available approximate years place the diagnosed secondary condition (${secondaryYear}) before the service-connected primary condition (${primaryYear}). Review whether the dates reflect delayed diagnosis, a different onset, or an aggravation theory; this is a chronology flag, not a medical conclusion.`,
    }];
  }

  if (nexusClassification === "AGGRAVATION" && secondaryYear >= primaryYear) {
    return [{
      code: "AGGRAVATION_BASELINE_CHRONOLOGY",
      primaryId: primary.id,
      primaryName: primary.name,
      primaryYear,
      secondaryYear,
      message: `The available approximate years do not show the secondary condition predating the service-connected primary condition. Review the documented baseline and whether the dates reflect delayed diagnosis or a different chronology; this is a chronology flag, not a medical conclusion.`,
    }];
  }

  return [];
}

function referenceIdentity(reference: SourceReference): string {
  return JSON.stringify(
    Object.entries(reference).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function dedupeReferences(references: SourceReference[]): SourceReference[] {
  const seen = new Map<string, SourceReference>();
  for (const reference of references) {
    const identity = referenceIdentity(reference);
    if (!seen.has(identity)) seen.set(identity, reference);
  }
  return [...seen.values()];
}

function pathEdge(
  conditionId: string,
  conditionName: string,
  suggestion: KnowledgeBase[number]["suggestions"][number],
  targetName: string,
): IntermediatePathEdge {
  return {
    conditionId,
    conditionName,
    targetConditionId: suggestion.conditionId,
    targetConditionName: targetName,
    rank: suggestion.rank,
    nexusClassification: suggestion.nexusClaim.nexusClassification,
    etiologicalConsensus: suggestion.evidentiaryProfile.etiologicalConsensus,
    rationale: suggestion.rationale,
    pathwayTypes: suggestion.pathwayIntelligence?.pathways ?? [],
    sourceReferences: [...suggestion.sourceReferences],
  };
}

function intermediatePathway(
  primary: { id: string; name: string },
  intermediate: { id: string; name: string },
  target: { id: string; name: string },
  firstSuggestion: KnowledgeBase[number]["suggestions"][number],
  secondSuggestion: KnowledgeBase[number]["suggestions"][number],
): IntermediatePathway {
  const firstEdge = pathEdge(primary.id, primary.name, firstSuggestion, intermediate.name);
  const secondEdge = pathEdge(intermediate.id, intermediate.name, secondSuggestion, target.name);
  return {
    primaryId: primary.id,
    primaryName: primary.name,
    intermediateId: intermediate.id,
    intermediateName: intermediate.name,
    targetId: target.id,
    targetName: target.name,
    label: "INTERMEDIATE_CHAIN",
    edges: [firstEdge, secondEdge],
    causalChain: `${primary.name} → ${intermediate.name} → ${target.name}`,
    sourceReferences: dedupeReferences([
      ...firstSuggestion.sourceReferences,
      ...secondSuggestion.sourceReferences,
    ]),
  };
}

/**
 * Returns only explicit two-edge paths through published mappings. This is a
 * research-path feature, not transitive causal inference: both source edges
 * remain visible and the path is never promoted to a direct nexus claim.
 */
function findIntermediatePathways(
  primary: { id: string; name: string },
  mappings: Map<string, KnowledgeBase[number]>,
  byId: Map<string, { id: string; name: string }>,
  diagnosedSet: Set<string>,
  recognizedIds: Set<string>,
): IntermediatePathway[] {
  const firstMapping = mappings.get(primary.id);
  if (!firstMapping) return [];

  const paths: IntermediatePathway[] = [];
  for (const firstSuggestion of firstMapping.suggestions) {
    const intermediate = byId.get(firstSuggestion.conditionId);
    if (!intermediate || intermediate.id === primary.id || recognizedIds.has(intermediate.id)) continue;

    const secondMapping = mappings.get(intermediate.id);
    if (!secondMapping) continue;

    for (const secondSuggestion of secondMapping.suggestions) {
      if (
        secondSuggestion.conditionId === primary.id ||
        secondSuggestion.conditionId === intermediate.id ||
        !diagnosedSet.has(secondSuggestion.conditionId) ||
        recognizedIds.has(secondSuggestion.conditionId)
      ) continue;

      const target = byId.get(secondSuggestion.conditionId);
      if (!target) continue;
      paths.push(intermediatePathway(primary, intermediate, target, firstSuggestion, secondSuggestion));
    }
  }

  return dedupePathways(paths);
}

function dedupePathways(pathways: IntermediatePathway[]): IntermediatePathway[] {
  return [...new Map(pathways.map((pathway) => [
    `${pathway.primaryId}:${pathway.intermediateId}:${pathway.targetId}`,
    pathway,
  ])).values()];
}

/**
 * F-02: a two-edge intermediate chain is as weak as its weakest link — Math.max
 * picks the weaker (higher-rank) consensus tier so the chain cannot be stronger
 * than either edge. Per-target consensusRank (below) uses Math.min because a
 * target with multiple supporting primaries is as strong as its strongest edge.
 */
function pathConsensusRank(path: IntermediatePathway): number {
  return Math.max(
    CONSENSUS_ORDER[path.edges[0].etiologicalConsensus],
    CONSENSUS_ORDER[path.edges[1].etiologicalConsensus],
  );
}

/**
 * Intake context is display-only. A term is surfaced only when its normalized
 * text literally overlaps authored recommendation content. It does not alter
 * ranking and does not infer drug classes, mechanisms, or individual causation.
 *
 * Authored pathway-intelligence fields are deliberately excluded from this
 * matcher so adding richer Step 5 explanation cannot create new intake matches.
 */
function matchIntakeContext(
  condition: string,
  contributingPrimaries: ContributingPrimary[],
  evidenceGaps: string[],
  intake: Intake,
): string[] {
  const terms = [
    ...intake.symptoms,
    ...intake.medications,
    ...(intake.treatments ?? []),
    ...intake.exposures,
  ];
  const authoredText = normalizeConditionName(
    [
      condition,
      ...contributingPrimaries.map((primary) => primary.rationale),
      ...evidenceGaps,
    ].join(" "),
  );

  return dedupe(
    terms.filter((term) => {
      const normalized = normalizeConditionName(term);
      return normalized.length >= 3 && authoredText.includes(normalized);
    }),
  );
}

interface Accumulated {
  conditionId: string;
  score: number;
  consensusRank: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  sourceReferences: SourceReference[];
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
