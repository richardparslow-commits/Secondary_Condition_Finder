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
  prevalence: Recommendation["prevalence"];
  /** Which service-connected primaries may link to this condition, and why. */
  linkingPrimaries: ContributingPrimary[];
}

/**
 * Filters the full recommendation list down to conditions that the user has
 * already been diagnosed with but has not yet had service connected. These are
 * the highest-priority results to surface: the user already has the condition;
 * they just need to establish the service connection.
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
      prevalence: r.prevalence,
      linkingPrimaries: r.contributingPrimaries,
    }));
}

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
