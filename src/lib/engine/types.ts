import { z } from "zod";

import type {
  EvidentiaryProfile,
  NexusClaim,
  PathwayIntelligence,
  SourceReference,
} from "@/lib/kb/schema";

export const intakeSchema = z.object({
  diagnosedConditionIds: z.array(z.string().min(1)).optional(),
  primaryConditions: z.array(z.string().min(1)).min(1),
  symptoms: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  treatments: z.array(z.string()).optional(),
  exposures: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export type Intake = z.infer<typeof intakeSchema>;

export interface ContributingPrimary {
  id: string;
  name: string;
  rank: number;
  rationale: string;
  pathwayIntelligence?: PathwayIntelligence;
  nexusClaim?: NexusClaim;
  causalMechanism?: {
    mechanismCategory: string;
    primaryVector: string;
    secondaryVector?: string;
    iatrogenicFactor?: string | null;
    hypothesizedOnly: boolean;
  };
  evidentiaryProfile?: EvidentiaryProfile;
}

export interface Recommendation {
  conditionId: string;
  condition: string;
  bodySystem: string;
  etiologicalConsensus: "WELL_ESTABLISHED" | "IATROGENIC_TREATMENT_EFFECT" | "PROBABLE" | "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE" | "NOT_ESTABLISHED";
  score: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  /** Keep the complete source record so downstream exports cannot lose provenance. */
  sourceReferences: SourceReference[];
  matchedIntakeContext: string[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  recognizedPrimaries: string[];
  unmappedPrimaries: string[];
  unrecognizedPrimaries: string[];
}
