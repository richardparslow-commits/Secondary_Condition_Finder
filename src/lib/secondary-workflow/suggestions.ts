import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import type { Recommendation } from "@/lib/engine/types";

export interface GroupedSecondarySuggestions {
  primaryId: string;
  primaryName: string;
  recommendations: Recommendation[];
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
