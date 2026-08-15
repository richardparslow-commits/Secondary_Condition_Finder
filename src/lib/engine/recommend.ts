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
      const contributingPrimaries = [...entry.contributingPrimaries].sort(
        (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
      );
      return {
        conditionId: entry.conditionId,
        condition: catalogEntry.name,
        bodySystem: catalogEntry.bodySystem,
        prevalence: PREVALENCE_BY_RANK[entry.prevalenceRank],
        score: Number(entry.score.toFixed(4)),
        contributingPrimaries,
        evidenceGaps: entry.evidenceGaps,
        sourceReferences: entry.sourceReferences,
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

  return {
    recommendations,
    recognizedPrimaries,
    unmappedPrimaries,
    unrecognizedPrimaries,
  };
}
