import { z } from "zod";

import type { Prevalence, SourceReference } from "@/lib/kb/schema";

export const intakeSchema = z.object({
  /** One or more service-connected primary conditions. Free text. */
  primaryConditions: z.array(z.string().min(1)).min(1, {
    message: "Enter at least one service-connected condition.",
  }),
  symptoms: z.array(z.string().min(1)).default([]),
  medications: z.array(z.string().min(1)).default([]),
  exposures: z.array(z.string().min(1)).default([]),
  notes: z.string().max(2000).default(""),
});

export type Intake = z.infer<typeof intakeSchema>;

export interface ContributingPrimary {
  id: string;
  name: string;
  rank: number;
  rationale: string;
}

export interface Recommendation {
  conditionId: string;
  condition: string;
  prevalence: Prevalence;
  /**
   * Ordering weight only. Not a probability, not a confidence score, and never
   * shown to the user as a number.
   */
  score: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  sourceReferences: SourceReference[];
  /**
   * Free-text intake terms that overlap this suggestion. Displayed as context
   * the user supplied. Deliberately does NOT affect score: inferring clinical
   * significance from a symptom list would be diagnostic behavior.
   */
  matchedIntakeContext: string[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  /** Primary conditions we resolved against the knowledge base. */
  recognizedPrimaries: string[];
  /** Primary conditions we could not resolve. Surfaced to the user. */
  unrecognizedPrimaries: string[];
}
