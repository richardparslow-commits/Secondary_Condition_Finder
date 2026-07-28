/**
 * Roadmap Milestone Gating Configuration
 * Controls feature availability for out-of-scope or experimental claim categories.
 */

export interface RoadmapMilestoneConfig {
  featureKey: string;
  title: string;
  targetMilestone: string;
  enabled: boolean;
}

export const ROADMAP_MILESTONES: Record<string, RoadmapMilestoneConfig> = {
  experimentalMentalHealthSecondaryEngine: {
    featureKey: "experimentalMentalHealthSecondaryEngine",
    title: "Advanced Mental Health Secondary Matrix",
    targetMilestone: "Phase 3 (Q4 2026)",
    enabled: false
  },
  thirdPartyVsoIntegrationSync: {
    featureKey: "thirdPartyVsoIntegrationSync",
    title: "Direct VSO Case Management API Sync",
    targetMilestone: "Phase 4 (2027)",
    enabled: false
  }
};

export function isFeatureEnabled(featureKey: string): boolean {
  return ROADMAP_MILESTONES[featureKey]?.enabled === true;
}
