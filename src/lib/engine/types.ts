import { z } from "zod";

import type {
  PathwayIntelligence,
  SourceVerificationScope,
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
}

export interface Recommendation {
  conditionId: string;
  condition: string;
  bodySystem: string;
  prevalence: "commonly-explored" | "sometimes-explored" | "occasionally-explored";
  score: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  sourceReferences: Array<{
    citation: string;
    note: string;
    verified: boolean;
    verificationScope?: SourceVerificationScope;
  }>;
  matchedIntakeContext: string[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  recognizedPrimaries: string[];
  unmappedPrimaries: string[];
  unrecognizedPrimaries: string[];
}
