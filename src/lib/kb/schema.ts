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
  citation: z.string().trim().min(1),
  /** Plain-language explanation of what the citation covers. */
  note: z.string().trim().min(1),
  /**
   * Locked to false: citations ship unverified until a qualified human has
   * confirmed the citation is accurate and applies to this suggestion. Never
   * set to true by an automated agent.
   */
  verified: z.literal(false),
});

export const suggestionSchema = z.object({
  /**
   * Catalog id of the secondary condition. Display names are resolved from the
   * catalog, so a label can never drift between two mapping files.
   */
  conditionId: z.string().regex(/^[a-z0-9-]+$/),
  rank: z.number().int().positive(),
  prevalence: prevalenceSchema,
  rationale: z.string().min(1),
  /** What a claim on this theory typically still needs. At least one. */
  evidenceGaps: z.array(z.string().min(1)).min(1),
  sourceReferences: z.array(sourceReferenceSchema).min(1).max(3),
});

/**
 * Secondary-condition mappings for one primary. Identity (name, aliases, body
 * system, rating citations) lives in the catalog; this file holds only the
 * edges out of that condition.
 */
export const conditionMappingSchema = z
  .object({
    /** Catalog id. Must match the filename. */
    id: z.string().regex(/^[a-z0-9-]+$/),
    /**
     * Draft mappings are validated and version controlled but never surfaced.
     * Use while authoring is in progress.
     */
    draft: z.boolean().default(false),
    /** Checklist of what a reviewer must supply. Only meaningful on drafts. */
    todo: z.array(z.string().min(1)).default([]),
    suggestions: z.array(suggestionSchema).default([]),
  })
  .superRefine((mapping, ctx) => {
    if (!mapping.draft && mapping.suggestions.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["suggestions"],
        message:
          "A published mapping needs at least one suggestion. Mark it draft: true while it is incomplete.",
      });
    }
    if (!mapping.draft && mapping.todo.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["todo"],
        message:
          "Resolve every todo before publishing, or keep the mapping draft: true.",
      });
    }
    if (mapping.draft && mapping.todo.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["todo"],
        message: "A draft must state what is still needed.",
      });
    }
    const ranks = mapping.suggestions.map((s) => s.rank).sort((a, b) => a - b);
    if (ranks.some((rank, index) => rank !== index + 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["suggestions"],
        message: "Ranks must be unique and gapless, starting at 1.",
      });
    }
    if (mapping.suggestions.some((s) => s.conditionId === mapping.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["suggestions"],
        message: "A condition cannot be a secondary of itself.",
      });
    }
  });

export const knowledgeBaseSchema = z.array(conditionMappingSchema);

export type Prevalence = z.infer<typeof prevalenceSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type ConditionMapping = z.infer<typeof conditionMappingSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
