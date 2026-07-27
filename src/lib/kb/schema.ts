import { z } from "zod";

/**
 * Prevalence is deliberately qualitative. We do not emit numeric probabilities:
 * the knowledge base is curated, not statistically derived, and a percentage
 * would imply a precision we cannot support in a claims context.
 */
export const prevalenceSchema = z.enum([
  "commonly-explored",
  "sometimes-explored",
  "occasionally-explored",
]);

export const sourceReferenceSchema = z.object({
  /** Legal or procedural citation, e.g. "38 CFR 3.310". */
  citation: z.string().min(1),
  /** Plain-language explanation of what the citation covers. */
  note: z.string().min(1),
  /**
   * True only after a qualified human has confirmed the citation is accurate
   * and applies to this suggestion. Never set to true by an automated agent.
   */
  verified: z.boolean(),
});

export const suggestionSchema = z.object({
  /**
   * Canonical identity for the secondary condition. Suggestions from different
   * primary conditions merge on this, not on display text, so "Depressive
   * disorder" from two sources becomes one recommendation.
   */
  conditionId: z.string().regex(/^[a-z0-9-]+$/),
  /** Display label. Must be identical for every entry sharing a conditionId. */
  condition: z.string().min(1),
  rank: z.number().int().positive(),
  prevalence: prevalenceSchema,
  rationale: z.string().min(1),
  /** What a claim on this theory typically still needs. At least one. */
  evidenceGaps: z.array(z.string().min(1)).min(1),
  sourceReferences: z.array(sourceReferenceSchema).min(1),
});

export const primaryConditionSchema = z.object({
  /** Stable slug. Must match the filename. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Alternate spellings and abbreviations users may type. */
  aliases: z.array(z.string().min(1)),
  suggestions: z.array(suggestionSchema).min(1),
});

export const knowledgeBaseSchema = z.array(primaryConditionSchema);

export type Prevalence = z.infer<typeof prevalenceSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type PrimaryCondition = z.infer<typeof primaryConditionSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
