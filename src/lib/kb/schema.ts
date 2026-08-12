import { z } from "zod";

export const prevalenceSchema = z.enum(["commonly-explored", "sometimes-explored", "occasionally-explored"]);
export const sourceVerificationScopeSchema = z.enum(["legal-framework", "clinical-evidence", "procedural-guidance"]);
export const secondaryPathwayTypeSchema = z.enum([
  "direct-secondary",
  "aggravation",
  "medication-related",
  "treatment-complication",
  "biomechanical",
  "intermediate-chain",
  "disease-progression",
  "somatopsychic",
  "neuroautonomic",
  "adaptive-equipment",
  "care-obstacle",
]);

export const pathwayIntelligenceSchema = z.object({
  pathways: z.array(secondaryPathwayTypeSchema).min(1).max(4),
  causalChain: z.string().trim().min(1).max(500).optional(),
  developmentQuestions: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
  issuesToResolve: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
}).strict().superRefine((intelligence, ctx) => {
  if (new Set(intelligence.pathways).size !== intelligence.pathways.length) {
    ctx.addIssue({ code: "custom", path: ["pathways"], message: "Pathway labels must be unique." });
  }
});

export const sourceReferenceSchema = z.object({
  citation: z.string().trim().min(1),
  note: z.string().trim().min(1),
  verificationScope: sourceVerificationScopeSchema.default("legal-framework"),
  sourceUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
  sourceCheckedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceLocator: z.string().trim().min(1).optional(),
}).strict().superRefine((reference, ctx) => {
  if (reference.verified && !reference.sourceUrl) ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Verified sources require sourceUrl." });
  if (reference.verified && !reference.sourceCheckedOn) ctx.addIssue({ code: "custom", path: ["sourceCheckedOn"], message: "Verified sources require sourceCheckedOn." });
  if (reference.verified && !reference.sourceLocator) ctx.addIssue({ code: "custom", path: ["sourceLocator"], message: "Verified sources require sourceLocator." });
});

export const suggestionSchema = z.object({
  conditionId: z.string().regex(/^[a-z0-9-]+$/),
  rank: z.number().int().positive(),
  prevalence: prevalenceSchema,
  rationale: z.string().min(1),
  pathwayIntelligence: pathwayIntelligenceSchema.optional(),
  evidenceGaps: z.array(z.string().min(1)).min(1),
  sourceReferences: z.array(sourceReferenceSchema).min(1).max(3),
}).strict();

export const conditionMappingSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  draft: z.boolean().default(false),
  todo: z.array(z.string().min(1)).default([]),
  suggestions: z.array(suggestionSchema).default([]),
}).strict().superRefine((mapping, ctx) => {
  if (!mapping.draft && mapping.suggestions.length === 0) ctx.addIssue({ code: "custom", path: ["suggestions"], message: "A published mapping needs at least one suggestion. Mark it draft: true while it is incomplete." });
  if (!mapping.draft && mapping.todo.length > 0) ctx.addIssue({ code: "custom", path: ["todo"], message: "Resolve every todo before publishing, or keep the mapping draft: true." });
  if (mapping.draft && mapping.todo.length === 0) ctx.addIssue({ code: "custom", path: ["todo"], message: "A draft must state what is still needed." });
  const ranks = mapping.suggestions.map((s) => s.rank).sort((a, b) => a - b);
  if (ranks.some((rank, index) => rank !== index + 1)) ctx.addIssue({ code: "custom", path: ["suggestions"], message: "Ranks must be unique and gapless, starting at 1." });
  if (mapping.suggestions.some((s) => s.conditionId === mapping.id)) ctx.addIssue({ code: "custom", path: ["suggestions"], message: "A condition cannot be a secondary of itself." });
  if (!mapping.draft) {
    const weakCitationPattern = /\b(relevant|placeholder|journal study|regulation link|link|example|todo|tbd|unknown)\b/i;
    for (const [suggestionIndex, suggestion] of mapping.suggestions.entries()) {
      for (const [referenceIndex, reference] of suggestion.sourceReferences.entries()) {
        if (weakCitationPattern.test(reference.citation)) ctx.addIssue({ code: "custom", path: ["suggestions", suggestionIndex, "sourceReferences", referenceIndex, "citation"], message: "Published mappings must use traceable citation text, not placeholders." });
        if (reference.verificationScope === "clinical-evidence" && !reference.sourceUrl) ctx.addIssue({ code: "custom", path: ["suggestions", suggestionIndex, "sourceReferences", referenceIndex, "sourceUrl"], message: "Clinical evidence references require a canonical sourceUrl." });
      }
    }
  }
});

export const knowledgeBaseSchema = z.array(conditionMappingSchema);
export type Prevalence = z.infer<typeof prevalenceSchema>;
export type SourceVerificationScope = z.infer<typeof sourceVerificationScopeSchema>;
export type SecondaryPathwayType = z.infer<typeof secondaryPathwayTypeSchema>;
export type PathwayIntelligence = z.infer<typeof pathwayIntelligenceSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type ConditionMapping = z.infer<typeof conditionMappingSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
