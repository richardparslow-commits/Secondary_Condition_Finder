import type { ConditionCatalog } from "@/lib/catalog/schema";
import { findCondition, indexById, normalizeConditionName } from "@/lib/catalog/lookup";
import type { KnowledgeBase, SourceReference } from "@/lib/kb/schema";
import { publishedMappings } from "@/lib/kb/lookup";

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
  score: number;
  prevalenceRank: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  sourceReferences: SourceReference[];
}

export function recommend(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
  intake: Intake,
): RecommendationResult {
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
    if (recognizedIds.has(condition.id) || unmappedPrimaries.includes(condition.name)) {
      continue;
    }
    if (!mappings.has(condition.id)) {
      unmappedPrimaries.push(condition.name);
      continue;
    }

    recognizedIds.add(condition.id);
    recognizedPrimaries.push(condition.name);
  }

  const accumulator = new Map<string, Accumulated>();

  for (const primaryId of recognizedIds) {
    const mapping = mappings.get(primaryId)!;
    const primary = byId.get(primaryId)!;

    for (const suggestion of mapping.suggestions) {
      // Do not suggest something the user already listed as service connected.
      if (recognizedIds.has(suggestion.conditionId)) continue;

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
          score: rankWeight(suggestion.rank),
          prevalenceRank: PREVALENCE_ORDER[suggestion.prevalence],
          contributingPrimaries: [contribution],
          evidenceGaps: [...suggestion.evidenceGaps],
          sourceReferences: [...suggestion.sourceReferences],
        });
      }
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
      return {
        conditionId: entry.conditionId,
        condition: catalogEntry.name,
        bodySystem: catalogEntry.bodySystem,
        prevalence: PREVALENCE_BY_RANK[entry.prevalenceRank],
        score: Number(entry.score.toFixed(4)),
        contributingPrimaries: [...entry.contributingPrimaries].sort(
          (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
        ),
        evidenceGaps: entry.evidenceGaps,
        sourceReferences: entry.sourceReferences,
        matchedIntakeContext: matchIntakeContext(catalogEntry.name, intake),
      };
    })
    .sort((a, b) => b.score - a.score || a.condition.localeCompare(b.condition));

  // Focus Engine: Constrain recommendations strictly to user-selected diagnosed conditions
  if (intake.diagnosedConditions && intake.diagnosedConditions.length > 0) {
    const diagnosedSet = new Set(
      intake.diagnosedConditions.map((c: string) => normalizeConditionName(c))
    );
    recommendations = recommendations.filter(rec => 
      diagnosedSet.has(normalizeConditionName(rec.condition))
    );
  }

  return {
    recommendations,
    recognizedPrimaries,
    unmappedPrimaries,
    unrecognizedPrimaries,
  };
}
