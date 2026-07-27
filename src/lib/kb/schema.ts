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

export const primaryConditionSchema = z
  .object({
    /** Stable slug. Must match the filename. */
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    /** Alternate spellings and abbreviations users may type. */
    aliases: z.array(z.string().min(1)),
    /**
     * Draft entries are scaffolding awaiting human-authored mappings. They are
     * validated and version controlled but never surfaced in the UI, so an
     * unfinished entry cannot reach a veteran.
     */
    draft: z.boolean().default(false),
    /** Checklist of what a reviewer must supply. Only meaningful on drafts. */
    todo: z.array(z.string().min(1)).default([]),
    suggestions: z.array(suggestionSchema).default([]),
  })
  .superRefine((condition, ctx) => {
    if (!condition.draft && condition.suggestions.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["suggestions"],
        message:
          "A published condition needs at least one suggestion. Mark it draft: true while it is incomplete.",
      });
    }
    if (!condition.draft && condition.todo.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["todo"],
        message:
          "Resolve every todo before publishing, or keep the entry draft: true.",
      });
    }
    if (condition.draft && condition.todo.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["todo"],
        message: "A draft must state what is still needed.",
      });
    }
  });

export const knowledgeBaseSchema = z.array(primaryConditionSchema);

export type Prevalence = z.infer<typeof prevalenceSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type PrimaryCondition = z.infer<typeof primaryConditionSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
