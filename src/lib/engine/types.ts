import { z } from "zod";

import type { Prevalence, SourceReference } from "@/lib/kb/schema";

export const intakeSchema = z.object({
  /** Catalog ids, names, or aliases of conditions already service connected. */
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
  /** Resolved from the catalog, never stored in the mapping file. */
  condition: string;
  bodySystem: string;
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
  /** Conditions resolved against the catalog that have published mappings. */
  recognizedPrimaries: string[];
  /**
   * Conditions that exist in the catalog but have no published mappings yet.
   * Distinct from unrecognized: the condition is real, the research is not
   * written. Saying so is more useful than silence.
   */
  unmappedPrimaries: string[];
  /** Input that resolved to nothing in the catalog. */
  unrecognizedPrimaries: string[];
}
