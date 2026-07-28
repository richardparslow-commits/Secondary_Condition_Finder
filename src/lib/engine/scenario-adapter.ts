/**
 * Scenario to Wizard Adapter
 * Bridges legacy scenario triggers into the 6-step secondary wizard UX.
 */

export interface ScenarioPayload {
  scenarioId: string;
  primaryCondition: string;
  secondaryTarget: string;
  evidenceNotes: string[];
}

export const DEMO_SCENARIOS: Record<string, ScenarioPayload> = {
  "ptsd-sleep-apnea": {
    scenarioId: "ptsd-sleep-apnea",
    primaryCondition: "ptsd",
    secondaryTarget: "sleep-apnea",
    evidenceNotes: ["Polysomnography report attached", "Treatment logs showing chronic sleep disruption"]
  },
  "lumbar-radiculopathy": {
    scenarioId: "lumbar-radiculopathy",
    primaryCondition: "lumbar-strain",
    secondaryTarget: "radiculopathy",
    evidenceNotes: ["EMG nerve conduction study", "Lower extremity pain radiation documentation"]
  }
};

export function getScenarioWizardRoute(scenarioId: string): string {
  const scenario = DEMO_SCENARIOS[scenarioId];
  if (!scenario) return "/secondary/upload";
  
  // Route scenario directly into wizard suggestions/evidence review with prefilled context
  return `/secondary/suggestions?scenario=${scenarioId}&primary=${scenario.primaryCondition}&target=${scenario.secondaryTarget}`;
}
