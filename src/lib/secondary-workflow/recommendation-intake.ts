import type { Intake } from "@/lib/engine/types";

import type { SecondaryWorkflowState } from "./state";

/**
 * Builds the only recommendation-engine intake used by the current six-step
 * secondary workflow. Keeping this composition in one place prevents a route
 * from accidentally dropping the diagnosed-condition boundary.
 */
export function buildSecondaryRecommendationIntake(
  state: SecondaryWorkflowState,
): Intake {
  return {
    diagnosedConditionIds: state.diagnosedConditionIds,
    primaryConditions: state.serviceConnectedConditionIds,
    symptoms: [],
    medications: state.medications ?? [],
    treatments: state.treatments ?? [],
    exposures: [],
    history: state.history ?? [],
    conditionTimeline: state.conditionTimeline ?? {},
    notes: "",
  };
}
