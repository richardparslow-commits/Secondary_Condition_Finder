import { z } from "zod";

export const prevalenceSchema = z.enum(["commonly-explored", "sometimes-explored", "occasionally-explored"]);

/**
 * Legacy verification scope retained for backward compatibility with the existing KB.
 * New/updated references should also use authorityCategory + propositionRole so the
 * validator can distinguish what a source is from what proposition it is being used to prove.
 */
export const sourceVerificationScopeSchema = z.enum(["legal-framework", "clinical-evidence", "procedural-guidance"]);

export const authorityCategorySchema = z.enum([
  "statutory-authority",
  "current-regulatory-authority",
  "federal-register-final-rule",
  "federal-register-proposed-or-notice",
  "va-adjudication-guidance",
  "medical-scientific-evidence",
  "individual-evidence",
]);

export const propositionRoleSchema = z.enum([
  "legal-framework",
  "legal-presumption",
  "regulatory-history",
  "effective-date-applicability",
  "rating-criteria",
  "procedural-guidance",
  "clinical-evidence",
  "individual-fact",
]);

export const federalRegisterTypeSchema = z.enum([
  "final-rule",
  "interim-final-rule",
  "proposed-rule",
  "notice",
  "correction",
  "other",
]);

export const bindingStatusSchema = z.enum(["binding", "nonbinding", "context-only"]);

export const claimTheorySchema = z.enum([
  "direct",
  "presumptive",
  "secondary-causation",
  "secondary-aggravation",
  "tera",
  "gulf-war-mucmi",
  "increased-rating",
  "rating-change",
  "effective-date",
]);

export const nexusRequirementSchema = z.enum([
  "individual-medical-opinion",
  "legally-presumed",
  "theory-dependent",
  "not-applicable",
]);

export const regulatoryActionRelationSchema = z.enum([
  "legal-framework",
  "pending-change",
  "presumption-change",
  "rating-schedule-change",
  "effective-date-applicability",
  "procedural-context",
]);

export const regulatoryActionReferenceSchema = z.object({
  rin: z.string().trim().regex(/^\d{4}-[A-Z0-9]{4}$/),
  relation: regulatoryActionRelationSchema,
  note: z.string().trim().min(1).max(1000).optional(),
}).strict();

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

const federalRegisterFinalTypes = new Set(["final-rule", "interim-final-rule"]);
const federalRegisterNonfinalTypes = new Set(["proposed-rule", "notice"]);
const nonclinicalAuthorityCategories = new Set([
  "statutory-authority",
  "current-regulatory-authority",
  "federal-register-final-rule",
  "federal-register-proposed-or-notice",
  "va-adjudication-guidance",
]);

export const sourceReferenceSchema = z.object({
  citation: z.string().trim().min(1),
  note: z.string().trim().min(1),
  verificationScope: sourceVerificationScopeSchema.default("legal-framework"),
  authorityCategory: authorityCategorySchema.optional(),
  propositionRole: propositionRoleSchema.optional(),
  federalRegisterType: federalRegisterTypeSchema.optional(),
  bindingStatus: bindingStatusSchema.optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  applicability: z.string().trim().min(1).max(1000).optional(),
  ruleVersion: z.string().trim().min(1).max(200).optional(),
  sourceUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
  sourceCheckedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceLocator: z.string().trim().min(1).optional(),
}).strict().superRefine((reference, ctx) => {
  if (reference.verified && !reference.sourceUrl) ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Verified sources require sourceUrl." });
  if (reference.verified && !reference.sourceCheckedOn) ctx.addIssue({ code: "custom", path: ["sourceCheckedOn"], message: "Verified sources require sourceCheckedOn." });
  if (reference.verified && !reference.sourceLocator) ctx.addIssue({ code: "custom", path: ["sourceLocator"], message: "Verified sources require sourceLocator." });

  const isExplicitlyNonfinalFederalRegister =
    reference.authorityCategory === "federal-register-proposed-or-notice" ||
    (reference.federalRegisterType !== undefined && federalRegisterNonfinalTypes.has(reference.federalRegisterType));

  if (isExplicitlyNonfinalFederalRegister && reference.bindingStatus === "binding") {
    ctx.addIssue({
      code: "custom",
      path: ["bindingStatus"],
      message: "A Federal Register proposed rule or notice cannot be designated as binding authority.",
    });
  }

  if (
    reference.authorityCategory === "federal-register-final-rule" &&
    reference.federalRegisterType !== undefined &&
    federalRegisterNonfinalTypes.has(reference.federalRegisterType)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["federalRegisterType"],
      message: "A proposed rule or notice cannot be categorized as a Federal Register final rule.",
    });
  }

  if (
    reference.authorityCategory === "federal-register-proposed-or-notice" &&
    reference.federalRegisterType !== undefined &&
    federalRegisterFinalTypes.has(reference.federalRegisterType)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["federalRegisterType"],
      message: "A final or interim final rule cannot be categorized as a Federal Register proposed rule/notice.",
    });
  }

  if (
    reference.propositionRole === "clinical-evidence" &&
    reference.authorityCategory !== undefined &&
    nonclinicalAuthorityCategories.has(reference.authorityCategory)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["propositionRole"],
      message: "Legal/regulatory/guidance authority cannot be explicitly designated as clinical-causation evidence.",
    });
  }

  if (
    reference.propositionRole === "legal-presumption" &&
    (reference.authorityCategory === "medical-scientific-evidence" || reference.authorityCategory === "individual-evidence")
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["propositionRole"],
      message: "Medical or individual evidence cannot establish the existence of a legal presumption.",
    });
  }
});

export const suggestionSchema = z.object({
  conditionId: z.string().regex(/^[a-z0-9-]+$/),
  rank: z.number().int().positive(),
  prevalence: prevalenceSchema,
  rationale: z.string().min(1),
  claimTheories: z.array(claimTheorySchema).min(1).max(4).optional(),
  nexusRequirement: nexusRequirementSchema.optional(),
  regulatoryActionRefs: z.array(regulatoryActionReferenceSchema).max(10).optional(),
  pathwayIntelligence: pathwayIntelligenceSchema.optional(),
  evidenceGaps: z.array(z.string().min(1)).min(1),
  sourceReferences: z.array(sourceReferenceSchema).min(1).max(3),
}).strict().superRefine((suggestion, ctx) => {
  if (suggestion.claimTheories && new Set(suggestion.claimTheories).size !== suggestion.claimTheories.length) {
    ctx.addIssue({ code: "custom", path: ["claimTheories"], message: "Claim-theory labels must be unique." });
  }

  if (suggestion.regulatoryActionRefs) {
    const keys = suggestion.regulatoryActionRefs.map((reference) => `${reference.rin}:${reference.relation}`);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["regulatoryActionRefs"], message: "Regulatory-action references must be unique by RIN and relation." });
    }
  }

  if (
    suggestion.nexusRequirement === "legally-presumed" &&
    suggestion.claimTheories !== undefined &&
    !suggestion.claimTheories.includes("presumptive")
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["nexusRequirement"],
      message: "A legally-presumed nexus requires a presumptive claim theory when claimTheories are explicitly supplied.",
    });
  }
});

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
        if (
          (reference.verificationScope === "clinical-evidence" ||
            reference.propositionRole === "clinical-evidence" ||
            reference.authorityCategory === "medical-scientific-evidence") &&
          !reference.sourceUrl
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["suggestions", suggestionIndex, "sourceReferences", referenceIndex, "sourceUrl"],
            message: "Clinical/medical evidence references require a canonical sourceUrl.",
          });
        }
      }
    }
  }
});

export const knowledgeBaseSchema = z.array(conditionMappingSchema);
export type Prevalence = z.infer<typeof prevalenceSchema>;
export type SourceVerificationScope = z.infer<typeof sourceVerificationScopeSchema>;
export type AuthorityCategory = z.infer<typeof authorityCategorySchema>;
export type PropositionRole = z.infer<typeof propositionRoleSchema>;
export type FederalRegisterType = z.infer<typeof federalRegisterTypeSchema>;
export type BindingStatus = z.infer<typeof bindingStatusSchema>;
export type ClaimTheory = z.infer<typeof claimTheorySchema>;
export type NexusRequirement = z.infer<typeof nexusRequirementSchema>;
export type RegulatoryActionRelation = z.infer<typeof regulatoryActionRelationSchema>;
export type RegulatoryActionReference = z.infer<typeof regulatoryActionReferenceSchema>;
export type SecondaryPathwayType = z.infer<typeof secondaryPathwayTypeSchema>;
export type PathwayIntelligence = z.infer<typeof pathwayIntelligenceSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type ConditionMapping = z.infer<typeof conditionMappingSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
