import { findPrimaryCondition, normalizeConditionName } from "@/lib/kb/lookup";
import type { KnowledgeBase, SourceReference } from "@/lib/kb/schema";

import type {
  ContributingPrimary,
  Intake,
  Recommendation,
  RecommendationResult,
} from "./types";

export const ENGINE_VERSION = "phase-1";

const PREVALENCE_ORDER = {
  "commonly-explored": 0,
  "sometimes-explored": 1,
  "occasionally-explored": 2,
} as const;

const PREVALENCE_BY_RANK = [
  "commonly-explored",
  "sometimes-explored",
  "occasionally-explored",
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

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function dedupeReferences(references: SourceReference[]): SourceReference[] {
  const seen = new Map<string, SourceReference>();
  for (const reference of references) {
    if (!seen.has(reference.citation)) seen.set(reference.citation, reference);
  }
  return [...seen.values()];
}

/** Intake terms whose text overlaps the suggestion. Display only. */
function matchIntakeContext(condition: string, intake: Intake): string[] {
  const terms = [...intake.symptoms, ...intake.medications, ...intake.exposures];
  const target = normalizeConditionName(condition);

  return dedupe(
    terms.filter((term) => {
      const normalized = normalizeConditionName(term);
      if (normalized.length < 3) return false;
      return target.includes(normalized) || normalized.includes(target);
    }),
  );
}

interface Accumulated {
  conditionId: string;
  condition: string;
  score: number;
  prevalenceRank: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  sourceReferences: SourceReference[];
}

export function recommend(
  kb: KnowledgeBase,
  intake: Intake,
): RecommendationResult {
  const recognizedPrimaries: string[] = [];
  const unrecognizedPrimaries: string[] = [];
  const recognizedPrimaryIds = new Set<string>();
  const accumulator = new Map<string, Accumulated>();

  for (const input of dedupe(intake.primaryConditions.map((c) => c.trim()))) {
    const primary = findPrimaryCondition(kb, input);

    if (!primary) {
      unrecognizedPrimaries.push(input);
      continue;
    }
    if (recognizedPrimaryIds.has(primary.id)) continue;

    recognizedPrimaryIds.add(primary.id);
    recognizedPrimaries.push(primary.name);
  }

  for (const primaryId of recognizedPrimaryIds) {
    const primary = kb.find((condition) => condition.id === primaryId)!;

    for (const suggestion of primary.suggestions) {
      // Do not suggest something the user already listed as service connected.
      if (recognizedPrimaryIds.has(suggestion.conditionId)) continue;

      const existing = accumulator.get(suggestion.conditionId);
      const contribution: ContributingPrimary = {
        id: primary.id,
        name: primary.name,
        rank: suggestion.rank,
        rationale: suggestion.rationale,
      };

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
        existing.prevalenceRank = Math.min(
          existing.prevalenceRank,
          PREVALENCE_ORDER[suggestion.prevalence],
        );
      } else {
        accumulator.set(suggestion.conditionId, {
          conditionId: suggestion.conditionId,
          condition: suggestion.condition,
          score: rankWeight(suggestion.rank),
          prevalenceRank: PREVALENCE_ORDER[suggestion.prevalence],
          contributingPrimaries: [contribution],
          evidenceGaps: [...suggestion.evidenceGaps],
          sourceReferences: [...suggestion.sourceReferences],
        });
      }
    }
  }

  const recommendations: Recommendation[] = [...accumulator.values()]
    .map((entry) => ({
      conditionId: entry.conditionId,
      condition: entry.condition,
      prevalence: PREVALENCE_BY_RANK[entry.prevalenceRank],
      score: Number(entry.score.toFixed(4)),
      contributingPrimaries: [...entry.contributingPrimaries].sort(
        (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
      ),
      evidenceGaps: entry.evidenceGaps,
      sourceReferences: entry.sourceReferences,
      matchedIntakeContext: matchIntakeContext(entry.condition, intake),
    }))
    .sort((a, b) => b.score - a.score || a.condition.localeCompare(b.condition));

  return { recommendations, recognizedPrimaries, unrecognizedPrimaries };
}
