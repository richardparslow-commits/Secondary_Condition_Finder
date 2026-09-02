import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import type { ContributingPrimary, Recommendation } from "@/lib/engine/types";

export interface GroupedSecondarySuggestions {
  primaryId: string;
  primaryName: string;
  recommendations: Recommendation[];
}

/**
 * A diagnosed but not-yet-service-connected condition that the recommend engine
 * identified as a possible secondary to one or more service-connected primaries.
 */
export interface LinkedNonServiceConnectedCondition {
  conditionId: string;
  conditionName: string;
  bodySystem: string;
  etiologicalConsensus: Recommendation["etiologicalConsensus"];
  /** Which service-connected primaries may link to this condition, and why. */
  linkingPrimaries: ContributingPrimary[];
}

/**
 * Step 5 is diagnosis-centered: every diagnosed condition that is not already
 * service connected is a top-level result, whether or not the current published
 * knowledge base contains a relationship from one of the selected service-
 * connected conditions. This prevents the workflow from turning back into a
 * forward-looking list of possible secondary diagnoses.
 */
export interface NonServiceConnectedConditionResult {
  conditionId: string;
  conditionName: string;
  bodySystem: string;
  recommendation: Recommendation | null;
}

export function buildNonServiceConnectedConditionResults(
  catalog: ConditionCatalog,
  diagnosedConditionIds: string[],
  serviceConnectedConditionIds: string[],
  recommendations: Recommendation[],
): NonServiceConnectedConditionResult[] {
  const byId = indexById(catalog);
  const serviceConnectedSet = new Set(serviceConnectedConditionIds);
  const recommendationByConditionId = new Map(
    recommendations.map((recommendation) => [recommendation.conditionId, recommendation] as const),
  );

  return diagnosedConditionIds
    .filter((conditionId) => !serviceConnectedSet.has(conditionId))
    .flatMap((conditionId) => {
      const condition = byId.get(conditionId);
      if (!condition) return [];

      return [{
        conditionId,
        conditionName: condition.name,
        bodySystem: condition.bodySystem,
        recommendation: recommendationByConditionId.get(conditionId) ?? null,
      }];
    })
    .sort((left, right) => left.conditionName.localeCompare(right.conditionName));
}

/**
 * Filters the full recommendation list down to conditions that the user has
 * already been diagnosed with but has not yet had service connected.
 *
 * @deprecated Step 5 now uses buildNonServiceConnectedConditionResults so
 * unlinked non-service-connected diagnoses remain visible rather than dropping
 * out of the page entirely.
 */
export function findLinkedNonServiceConnectedConditions(
  diagnosedConditionIds: string[],
  serviceConnectedConditionIds: string[],
  recommendations: Recommendation[],
): LinkedNonServiceConnectedCondition[] {
  const serviceConnectedSet = new Set(serviceConnectedConditionIds);
  const notServiceConnectedIds = new Set(
    diagnosedConditionIds.filter((id) => !serviceConnectedSet.has(id)),
  );

  return recommendations
    .filter((r) => notServiceConnectedIds.has(r.conditionId))
    .map((r) => ({
      conditionId: r.conditionId,
      conditionName: r.condition,
      bodySystem: r.bodySystem,
      etiologicalConsensus: r.etiologicalConsensus,
      linkingPrimaries: r.contributingPrimaries,
    }));
}

/**
 * Legacy primary-centered grouping retained for non-workflow callers. Current
 * Steps 5 and 6 intentionally use diagnosis-centered grouping instead.
 */
export function groupSuggestionsByPrimary(
  catalog: ConditionCatalog,
  serviceConnectedConditionIds: string[],
  recommendations: Recommendation[],
): GroupedSecondarySuggestions[] {
  const byId = indexById(catalog);

  return serviceConnectedConditionIds
    .map((primaryId) => {
      const primary = byId.get(primaryId);
      if (!primary) return null;

      const scopedRecommendations = recommendations.filter((recommendation) =>
        recommendation.contributingPrimaries.some(
          (contributingPrimary) => contributingPrimary.id === primaryId,
        ),
      );

      return {
        primaryId,
        primaryName: primary.name,
        recommendations: scopedRecommendations,
      };
    })
    .filter((group): group is GroupedSecondarySuggestions => group !== null)
    .sort((a, b) => a.primaryName.localeCompare(b.primaryName));
}
