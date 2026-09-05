import { z } from "zod";

/**
 * CRG (Causal Relational Graph) schema.
 *
 * Every suggestion must declare a nexus pathway. The two VA-recognized legal
 * pathways under 38 CFR § 3.310 are DIRECT_CAUSATION (the SC condition
 * proximately caused the secondary condition) and AGGRAVATION (the SC
 * condition worsened the natural baseline of an already-present condition).
 * ASSOCIATION_ONLY is an honest third arm for edges where the evidence
 * supports co-occurrence/association but neither legal pathway is established;
 * forcing such rows into a causation or aggravation arm would overstate the
 * evidence. The proposal's two pathways are implemented exactly as specified;
 * the third arm is additive and required for truthful authoring.
 *
 * `prevalence` is deprecated and removed from the schema (it described how
 * commonly a relationship is explored, not whether A causes B). Ranking now
 * derives from `evidentiaryProfile.etiologicalConsensus`, which maps to the
 * VA "at least as likely as not" nexus standard.
 */

export const nexusClassificationSchema = z.enum(["DIRECT_CAUSATION", "AGGRAVATION", "ASSOCIATION_ONLY"]);

const DirectCausationSchema = z.object({
  nexusClassification: z.literal("DIRECT_CAUSATION"),
  etiologicalTrigger: z.string().min(50, "DIRECT_CAUSATION requires a specific biological trigger description of at least 50 characters."),
  baselineProgression: z.undefined().optional(),
  aggravatingFactor: z.undefined().optional(),
  associationBasis: z.undefined().optional(),
  causationStatus: z.undefined().optional(),
});

const AggravationSchema = z.object({
  nexusClassification: z.literal("AGGRAVATION"),
  etiologicalTrigger: z.undefined().optional(),
  baselineProgression: z.string().min(50, "AGGRAVATION requires a natural non-SC baseline progression description of at least 50 characters."),
  aggravatingFactor: z.string().min(50, "AGGRAVATION requires a biomechanical or systemic aggravating factor description of at least 50 characters."),
  associationBasis: z.undefined().optional(),
  causationStatus: z.undefined().optional(),
});

const AssociationOnlySchema = z.object({
  nexusClassification: z.literal("ASSOCIATION_ONLY"),
  etiologicalTrigger: z.undefined().optional(),
  baselineProgression: z.undefined().optional(),
  aggravatingFactor: z.undefined().optional(),
  associationBasis: z.string().min(50, "ASSOCIATION_ONLY requires a description of the reported association's basis."),
  causationStatus: z.string().min(50, "ASSOCIATION_ONLY must state why neither causation nor aggravation is established."),
});

export const nexusClaimSchema = z.discriminatedUnion("nexusClassification", [
  DirectCausationSchema,
  AggravationSchema,
  AssociationOnlySchema,
]);

/**
 * The pathophysiological mechanism gives the edge its biological "weight".
 * Mechanism categories are a strict enum so authors cannot paste vague text.
 * NOT_ESTABLISHED is reserved for ASSOCIATION_ONLY edges where the biological
 * cascade is not established; the vectors then describe the hypothesized link,
 * never a proven causal pathway.
 */
export const mechanismCategorySchema = z.enum([
  "MICROVASCULAR_METABOLIC",
  "BIOMECHANICAL_ALTERATION",
  "NEUROENDOCRINE_CASCADE",
  "PHARMACOLOGICAL_IATROGENIC",
  "PSYCHOPHYSIOLOGICAL",
  "SYSTEMIC_INFLAMMATORY",
  "IMMUNE_MEDIATED",
  "THROMBOTIC_OR_VASCULAR",
  "NEUROLOGICAL_DEGENERATION",
  "METABOLIC_OR_NUTRITIONAL",
  "MALIGNANT_TRANSFORMATION",
  "INFECTIOUS_SPREAD",
  "MECHANICAL_OR_COMPRESSIVE",
  "POST_SURGICAL_OR_TREATMENT",
  "MULTIFACTORIAL",
  "NOT_ESTABLISHED",
]);

export const causalMechanismSchema = z.object({
  mechanismCategory: mechanismCategorySchema,
  primaryVector: z.string().min(50, "primaryVector must describe the primary physiological or physical cascade (at least 50 characters)."),
  secondaryVector: z.string().min(1).optional(),
  iatrogenicFactor: z.string().min(1).nullable().optional(),
  hypothesizedOnly: z.boolean().default(false),
}).strict();

/**
 * Etiological consensus replaces prevalence. Tiers map to the VA ">= 50%
 * probability" nexus standard used by C&P examiners.
 */
export const etiologicalConsensusSchema = z.enum([
  "WELL_ESTABLISHED",
  "PROBABLE",
  "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE",
  "IATROGENIC_TREATMENT_EFFECT",
  "NOT_ESTABLISHED",
]);

export const vaNexusProbabilityAlignmentSchema = z.enum([
  "AT_LEAST_AS_LIKELY_AS_NOT",
  "LESS_THAN_AS_LIKELY_AS_NOT",
  "LEGALLY_PRESUMED",
  "NOT_ASSERTED",
]);

export const evidentiaryProfileSchema = z.object({
  etiologicalConsensus: etiologicalConsensusSchema,
  vaNexusProbabilityAlignment: vaNexusProbabilityAlignmentSchema,
  conservativeRationale: z.string().min(50, "conservativeRationale must state, in medically conservative terms, the basis for the nexus claim."),
  evidenceGaps: z.string().min(1),
  alternativeEtiologiesToRuleOut: z.array(z.string().min(1)).min(1, "At least one alternative etiology must be listed to rule out."),
  /** Optional controlled tags support conservative intake-overlap warnings. */
  alternativeEtiologyTags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).optional(),
  requiresSpecificDbqEvidence: z.boolean().default(false),
}).strict().superRefine((profile, ctx) => {
  const contested = profile.etiologicalConsensus === "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE";
  if (contested && profile.alternativeEtiologiesToRuleOut.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["alternativeEtiologiesToRuleOut"],
      message: "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE mappings must list at least 2 alternative etiologies to rule out.",
    });
  }
  if (contested && !profile.requiresSpecificDbqEvidence) {
    ctx.addIssue({
      code: "custom",
      path: ["requiresSpecificDbqEvidence"],
      message: "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE mappings require specific DBQ evidence.",
    });
  }
});

export type NexusClassification = z.infer<typeof nexusClassificationSchema>;
export type NexusClaim = z.infer<typeof nexusClaimSchema>;
export type MechanismCategory = z.infer<typeof mechanismCategorySchema>;
export type CausalMechanism = z.infer<typeof causalMechanismSchema>;
export type EtiologicalConsensus = z.infer<typeof etiologicalConsensusSchema>;
export type VaNexusProbabilityAlignment = z.infer<typeof vaNexusProbabilityAlignmentSchema>;
export type EvidentiaryProfile = z.infer<typeof evidentiaryProfileSchema>;

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
  nexusClaim: nexusClaimSchema,
  causalMechanism: causalMechanismSchema,
  evidentiaryProfile: evidentiaryProfileSchema,
  rationale: z.string().min(1),
  claimTheories: z.array(claimTheorySchema).min(1).max(4).optional(),
  nexusRequirement: nexusRequirementSchema.optional(),
  regulatoryActionRefs: z.array(regulatoryActionReferenceSchema).max(10).optional(),
  pathwayIntelligence: pathwayIntelligenceSchema.optional(),
  evidenceGaps: z.array(z.string().min(1)).min(1),
  sourceReferences: z.array(sourceReferenceSchema).min(1).max(3),
}).strict().superRefine((suggestion, ctx) => {
  if (suggestion.nexusClaim.nexusClassification === "ASSOCIATION_ONLY" && !suggestion.causalMechanism.hypothesizedOnly) {
    ctx.addIssue({
      code: "custom",
      path: ["causalMechanism", "hypothesizedOnly"],
      message: "ASSOCIATION_ONLY edges must mark causalMechanism as hypothesizedOnly (the cascade is hypothesized, not established).",
    });
  }
  if (suggestion.nexusClaim.nexusClassification === "ASSOCIATION_ONLY" && suggestion.evidentiaryProfile.etiologicalConsensus === "WELL_ESTABLISHED") {
    ctx.addIssue({
      code: "custom",
      path: ["evidentiaryProfile", "etiologicalConsensus"],
      message: "An ASSOCIATION_ONLY edge cannot claim a WELL_ESTABLISHED etiological consensus.",
    });
  }
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
