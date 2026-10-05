import { z } from "zod";

// Explicit `.ts` extension: this module is also loaded by Node's type
// stripping (scripts/audit-crg.ts imports it directly), where an
// extensionless relative specifier fails ESM resolution.
import { MAX_PATHWAY_HOPS } from "./pathway-depth.ts";

/**
 * CRG (Causal Relational Graph) schema — multi-hop directed graph.
 *
 * ## Architecture
 *
 * The knowledge base models VA secondary-service-connection medicine as a
 * directed graph over catalog conditions. v1 assumed a rigid two-node
 * "service-connected primary → secondary" tree. This refactor decouples
 * relationships from the primary root so any catalog condition can be an
 * intermediate node, enabling tertiary claims (Primary → Secondary →
 * Tertiary) and any other depth-2 pathway:
 *
 *   - `KbEdgeSchema` — a single directed relationship whose
 *     `sourceConditionId`/`targetConditionId` are explicit catalog IDs. Edges
 *     are self-describing: they no longer derive "source" from the file they
 *     happen to live in.
 *   - `KbNodeMappingSchema` — the on-disk adjacency list. One JSON file per
 *     root condition (`nodeId`) under `data/knowledge-base/graph/` (kept out
 *     of the authored corpus root; see `src/lib/kb/graph-layout.ts`), listing
 *     its outgoing edges. The graph is the union of all node files; the
 *     recommendation engine traverses it to the shared `MAX_PATHWAY_HOPS` cap
 *     (`ClaimPathwaySchema` bounds `hops` to `.min(1).max(MAX_PATHWAY_HOPS)`).
 *   - `PathwayHopSchema` / `ClaimPathwaySchema` — a traversed pathway with a
 *     composite legal nexus derived from the hop chain (see
 *     `deriveCompositeNexus` in `./utils`).
 *
 * ## Legal framework (38 CFR § 3.310)
 *
 * Every edge must declare a nexus pathway. The two VA-recognized pathways are
 * DIRECT_CAUSATION (the source condition proximately caused the target
 * condition) and AGGRAVATION (the source condition worsened the natural
 * baseline of an already-present target condition, per Spicer v. McDonough's
 * "but for" standard). ASSOCIATION_ONLY is an honest third arm for edges where
 * the evidence supports co-occurrence but neither legal pathway is established;
 * forcing such rows into a causation or aggravation arm would overstate the
 * evidence. In a multi-hop chain a single ASSOCIATION_ONLY hop breaks the legal
 * chain end-to-end — `deriveCompositeNexus` enforces this, and
 * `compositeNexusSchema` models the result.
 *
 * ## Canonical vs. authored (bridge) nexus claims
 *
 *   - `KbNexusClaimSchema` is the canonical, edge-level union. On
 *     ASSOCIATION_ONLY it *strictly enforces* `hypothesizedOnly: true` and
 *     `status: "NOT_ESTABLISHED"` (literal fields with defaults that
 *     materialize when absent and reject any contradicting value), so an
 *     association edge can never present as established causation.
 *   - `nexusClaimSchema` is the authored union consumed by the existing 813
 *     condition-mapping files and the tamper-evidence ledger. It is a bridge:
 *     the same three arms plus the authored per-arm clinical narrative fields,
 *     with the canonical edge-level fields accepted as optional spellings. New
 *     edges should be authored canonically (`KbEdgeSchema`); the bridge keeps
 *     historical files parsing without a data migration.
 *
 * `prevalence` is deprecated and removed from the schema (it described how
 * commonly a relationship is explored, not whether A causes B). Ranking now
 * derives from `evidentiaryProfile.etiologicalConsensus`, which maps to the
 * VA "at least as likely as not" nexus standard.
 */

export const nexusClassificationSchema = z.enum(["DIRECT_CAUSATION", "AGGRAVATION", "ASSOCIATION_ONLY"]);

/**
 * Authored per-arm narrative fields, forbidden on the arms that don't use
 * them via the undefined-guard idiom (declared, but only ever `undefined`).
 * Shared across the authored and canonical arm variants.
 */
const authoredNexusGuards = {
  etiologicalTrigger: z.undefined().optional(),
  baselineProgression: z.undefined().optional(),
  aggravatingFactor: z.undefined().optional(),
  associationBasis: z.undefined().optional(),
  causationStatus: z.undefined().optional(),
} as const;

/**
 * Canonical edge-level nexus fields. On the authored (bridge) arms these stay
 * undefined-guards; the canonical ASSOCIATION_ONLY arm overrides them with
 * strictly enforced literals.
 */
const graphNexusGuards = {
  sourceConditionId: z.undefined().optional(),
  targetConditionId: z.undefined().optional(),
  hypothesizedOnly: z.undefined().optional(),
  status: z.undefined().optional(),
} as const;

/* ─── Authored (bridge) nexus union — parses the historical 813-file KB ─── */

const DirectCausationSchema = z.object({
  ...authoredNexusGuards,
  ...graphNexusGuards,
  nexusClassification: z.literal("DIRECT_CAUSATION"),
  etiologicalTrigger: z.string().min(50, "DIRECT_CAUSATION requires a specific biological trigger description of at least 50 characters."),
});

const AggravationSchema = z.object({
  ...authoredNexusGuards,
  ...graphNexusGuards,
  nexusClassification: z.literal("AGGRAVATION"),
  baselineProgression: z.string().min(50, "AGGRAVATION requires a natural non-SC baseline progression description of at least 50 characters."),
  aggravatingFactor: z.string().min(50, "AGGRAVATION requires a biomechanical or systemic aggravating factor description of at least 50 characters."),
});

const AssociationOnlySchema = z.object({
  ...authoredNexusGuards,
  ...graphNexusGuards,
  nexusClassification: z.literal("ASSOCIATION_ONLY"),
  associationBasis: z.string().min(50, "ASSOCIATION_ONLY requires a description of the reported association's basis."),
  causationStatus: z.string().min(50, "ASSOCIATION_ONLY must state why neither causation nor aggravation is established."),
});

/**
 * Authored nexus union (discriminated on `nexusClassification`). Bridge
 * layer: accepts the authored per-arm narrative fields and — additively — the
 * canonical edge-level fields, so authored KB files keep validating unchanged
 * while new graph edges can reuse this union during migration.
 */
export const nexusClaimSchema = z.discriminatedUnion("nexusClassification", [
  DirectCausationSchema,
  AggravationSchema,
  AssociationOnlySchema,
]);

/* ─── Canonical (edge-level) nexus union — strict association enforcement ─── */

const EdgeDirectCausationSchema = z.object({
  ...authoredNexusGuards,
  ...graphNexusGuards,
  nexusClassification: z.literal("DIRECT_CAUSATION"),
});

const EdgeAggravationSchema = z.object({
  ...authoredNexusGuards,
  ...graphNexusGuards,
  nexusClassification: z.literal("AGGRAVATION"),
});

/**
 * Canonical ASSOCIATION_ONLY arm. `hypothesizedOnly: true` and
 * `status: "NOT_ESTABLISHED"` are strictly enforced: the literals materialize
 * via defaults when authored data omits them, and any explicit contradicting
 * value (e.g. `hypothesizedOnly: false`, `status: "WELL_ESTABLISHED"`) is a
 * hard parse error. An association edge is therefore incapable of presenting
 * as an established causal claim at the type level and the parse level.
 */
const EdgeAssociationOnlySchema = z.object({
  ...authoredNexusGuards,
  ...graphNexusGuards,
  nexusClassification: z.literal("ASSOCIATION_ONLY"),
  hypothesizedOnly: z.literal(true).default(true),
  status: z.literal("NOT_ESTABLISHED").default("NOT_ESTABLISHED"),
});

/**
 * Canonical nexus union for graph edges. Deliberately EXCLUDES the authored
 * per-arm narrative fields (they are undefined-guarded here): an edge carries
 * its evidence in `rationale` and `evidentiaryProfile.conservativeRationale`,
 * so migrated narrative text cannot masquerade as edge-level data. Because
 * the guards keep those keys present-as-undefined in the inferred type, a
 * canonical claim remains structurally assignable to the authored
 * `NexusClaim` union. ASSOCIATION_ONLY carries the enforced literals.
 */
export const KbNexusClaimSchema = z.discriminatedUnion("nexusClassification", [
  EdgeDirectCausationSchema,
  EdgeAggravationSchema,
  EdgeAssociationOnlySchema,
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
export type KbNexusClaim = z.infer<typeof KbNexusClaimSchema>;
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
  /**
   * Self-describing content hash ("sha256-<hex>") of the source body captured
   * at human verification time. Optional while the backfill is in progress;
   * citations:decay uses it to detect silent content drift (retractions,
   * corrections) that link-rot probes cannot see. See
   * docs/citation-verification-sop.md.
   */
  contentDigest: z.string().trim().regex(/^sha256-[0-9a-f]{64}$/i).optional(),
}).strict().superRefine((reference, ctx) => {
  if (reference.verified && !reference.sourceUrl) ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Verified sources require sourceUrl." });
  if (reference.verified && !reference.sourceCheckedOn) ctx.addIssue({ code: "custom", path: ["sourceCheckedOn"], message: "Verified sources require sourceCheckedOn." });
  if (reference.verified && !reference.sourceLocator) ctx.addIssue({ code: "custom", path: ["sourceLocator"], message: "Verified sources require sourceLocator." });
  // A digest is a hash OF the sourceUrl's content, and it can only have been
  // captured during a source check.
  if (reference.contentDigest && !reference.sourceUrl) ctx.addIssue({ code: "custom", path: ["contentDigest"], message: "contentDigest is a hash of the sourceUrl content and requires sourceUrl." });
  if (reference.contentDigest && !reference.sourceCheckedOn) ctx.addIssue({ code: "custom", path: ["contentDigest"], message: "contentDigest requires the sourceCheckedOn date when the hash was captured." });

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

/**
 * Catalog condition identifier (kebab-case), shared by nodes and edges.
 */
export const catalogConditionIdSchema = z.string().regex(/^[a-z0-9-]+$/);

/**
 * Machine-readable quarantine record for a pointer identity.
 *
 * Canonical-identity reconciliation (the 2026-09-28 rotator-cuff/thumb pairs
 * and the 2026-10-03 TMJ election; see docs/modeling-debt-dispositions.md)
 * keeps the non-canonical identity as a stable pointer record so the frozen
 * one-to-one catalog/KB contract and saved workflow state stay unmoved. A
 * pointer exists only to preserve its variant name and any preserved
 * unregistered evidence: every claim for the pair is authored under
 * `canonicalId`, never under the pointer.
 *
 * This marker is the authoritative machine-readable state the fail-closed
 * guards read: the schema below refuses a pointer that authors suggestions,
 * `validate.ts` refuses any mapping that files a suggestion under a pointer,
 * `graph.ts` refuses adjacency nodes and edges for a pointer, and
 * scripts/validate-knowledge-base.js refuses the same drift in CI.
 */
export const quarantinePointerSchema = z.object({
  status: z.literal("pointer"),
  /** The canonical identity that owns every claim for this pair. */
  canonicalId: catalogConditionIdSchema,
  recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Disposition record naming the decision (repository-relative). */
  record: z.string().trim().min(1),
}).strict();

export const conditionMappingSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  draft: z.boolean().default(false),
  /**
   * Present only on quarantined pointer records; absence means the identity
   * is an ordinary authoring home for its own claims.
   */
  quarantine: quarantinePointerSchema.optional(),
  todo: z.array(z.string().min(1)).default([]),
  governanceNotes: z.array(z.string().min(1)).default([]).optional(),
  suggestions: z.array(suggestionSchema).default([]),
}).strict().superRefine((mapping, ctx) => {
  if (!mapping.draft && mapping.suggestions.length === 0) ctx.addIssue({ code: "custom", path: ["suggestions"], message: "A published mapping needs at least one suggestion. Mark it draft: true while it is incomplete." });
  if (!mapping.draft && mapping.todo.length > 0) ctx.addIssue({ code: "custom", path: ["todo"], message: "Resolve every todo before publishing, or keep the mapping draft: true." });
  if (mapping.draft && mapping.todo.length === 0) ctx.addIssue({ code: "custom", path: ["todo"], message: "A draft must state what is still needed." });
  if (mapping.quarantine) {
    if (mapping.suggestions.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["suggestions"],
        message: `A quarantined pointer identity cannot author suggestions; claims belong to its canonical identity "${mapping.quarantine.canonicalId}".`,
      });
    }
    if (mapping.quarantine.canonicalId === mapping.id) {
      ctx.addIssue({ code: "custom", path: ["quarantine", "canonicalId"], message: "A quarantined pointer must name a different canonical identity." });
    }
  }
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

/* ─── Multi-hop graph layer ────────────────────────────────────────────────
 *
 * These are the canonical graph contracts. `KbNodeMappingSchema` files form
 * an adjacency list keyed by catalog condition ID; the recommendation engine
 * stitches node files into pathways of at most 2 hops (Primary → Secondary →
 * Tertiary) and reports each traversal's composite legal nexus.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A single directed CRG edge. `sourceConditionId`/`targetConditionId` are
 * explicit so an edge is self-describing and independent of whichever node
 * file carries it — this is what decouples edges from the service-connected
 * primary root. Source citations intentionally live in the authored mapping
 * layer (`sourceReferenceSchema`); an edge references that evidence without
 * duplicating it.
 */
export const KbEdgeSchema = z.object({
  sourceConditionId: catalogConditionIdSchema,
  targetConditionId: catalogConditionIdSchema,
  /** Ordering of outgoing edges from the same source (1 = strongest). */
  rank: z.number().int().positive(),
  nexusClaim: KbNexusClaimSchema,
  causalMechanism: causalMechanismSchema,
  evidentiaryProfile: evidentiaryProfileSchema,
  rationale: z.string().min(1),
  /** Development targets the veteran must close for this edge's nexus opinion. */
  evidenceGaps: z.array(z.string().min(1)).min(1),
}).strict().superRefine((edge, ctx) => {
  if (edge.sourceConditionId === edge.targetConditionId) {
    ctx.addIssue({
      code: "custom",
      path: ["targetConditionId"],
      message: "An edge cannot be self-referential (sourceConditionId must differ from targetConditionId).",
    });
  }
  if (edge.nexusClaim.nexusClassification === "ASSOCIATION_ONLY") {
    if (!edge.causalMechanism.hypothesizedOnly) {
      ctx.addIssue({
        code: "custom",
        path: ["causalMechanism", "hypothesizedOnly"],
        message: "ASSOCIATION_ONLY edges must mark causalMechanism.hypothesizedOnly: true (the cascade is hypothesized, not established).",
      });
    }
    if (edge.nexusClaim.status !== "NOT_ESTABLISHED") {
      ctx.addIssue({
        code: "custom",
        path: ["nexusClaim", "status"],
        message: "ASSOCIATION_ONLY nexus claims must carry status \"NOT_ESTABLISHED\".",
      });
    }
    if (edge.evidentiaryProfile.etiologicalConsensus === "WELL_ESTABLISHED") {
      ctx.addIssue({
        code: "custom",
        path: ["evidentiaryProfile", "etiologicalConsensus"],
        message: "An ASSOCIATION_ONLY edge cannot claim a WELL_ESTABLISHED etiological consensus.",
      });
    }
  }
});

/**
 * The on-disk adjacency list for one JSON file: a root condition (`nodeId`)
 * plus every edge whose source is that condition. The `.refine()` guarantees
 * the adjacency invariant — an edge stored in this file must actually depart
 * from this node — so the union of all node files is a well-formed directed
 * graph with no orphaned edges and no cross-file ambiguity about a source.
 */
export const KbNodeMappingSchema = z.object({
  /** Root catalog condition ID; every outgoing edge must depart from it. */
  nodeId: catalogConditionIdSchema,
  outgoingEdges: z.array(KbEdgeSchema).default([]),
}).strict().superRefine((node, ctx) => {
  const mismatchedEdgeIndex = node.outgoingEdges.findIndex((edge) => edge.sourceConditionId !== node.nodeId);
  if (mismatchedEdgeIndex !== -1) {
    ctx.addIssue({
      code: "custom",
      path: ["outgoingEdges", mismatchedEdgeIndex, "sourceConditionId"],
      message: `Every outgoing edge's sourceConditionId must equal this file's root nodeId ("${node.nodeId}").`,
    });
  }
  const targets = node.outgoingEdges.map((edge) => edge.targetConditionId);
  if (new Set(targets).size !== targets.length) {
    ctx.addIssue({
      code: "custom",
      path: ["outgoingEdges"],
      message: "outgoingEdges must not contain duplicate targetConditionId values; author one edge per relationship.",
    });
  }
  const ranks = node.outgoingEdges.map((edge) => edge.rank).sort((a, b) => a - b);
  if (ranks.some((rank, index) => rank !== index + 1)) {
    ctx.addIssue({
      code: "custom",
      path: ["outgoingEdges"],
      message: "Edge ranks must be unique and gapless, starting at 1.",
    });
  }
});

/**
 * The legal quality of a traversed pathway, derived by `deriveCompositeNexus`
 * from the nexus classification of each hop in the chain. AGGRAVATION
 * dominates DIRECT_CAUSATION because VA proximate-cause analysis follows the
 * weakest legally recognized link; an ASSOCIATION_ONLY hop breaks the chain
 * entirely (no statutory nexus between service and the terminal condition).
 */
export const compositeNexusSchema = z.enum([
  "DIRECT_CAUSATION",
  "AGGRAVATION",
  "ASSOCIATION_ONLY_CHAIN_BROKEN",
]);

/**
 * One hop of a traversed pathway. `stepIndex` is 0-based and positional:
 * hop N's `targetConditionId` must equal hop N+1's `sourceConditionId` for
 * the chain to be contiguous (validated by `ClaimPathwaySchema`).
 */
export const PathwayHopSchema = z.object({
  /** 0-based position of this hop within the pathway. */
  stepIndex: z.number().int().min(0),
  edge: KbEdgeSchema,
}).strict();

/**
 * A fully traversed pathway of 1–`MAX_PATHWAY_HOPS` hops. One-hop pathways are
 * the classic service-connected-primary → secondary claim; two-hop pathways
 * are tertiary claims (Primary → Secondary → Tertiary) or an aggravation link
 * somewhere in the chain. `originConditionId` and `terminalConditionId` pin
 * the traversal endpoints, and `compositeNexus` must be derived from the hops
 * via `deriveCompositeNexus` (mirrored inline below to avoid a schema → utils
 * import cycle; pinned equivalent by tests).
 */
export const ClaimPathwaySchema = z.object({
  /** Catalog ID where the traversal begins (the service-connected origin). */
  originConditionId: catalogConditionIdSchema,
  /** Catalog ID where the traversal ends (the condition being claimed). */
  terminalConditionId: catalogConditionIdSchema,
  /** Contiguous hop chain; depth is capped at `MAX_PATHWAY_HOPS`. */
  hops: z.array(PathwayHopSchema).min(1).max(MAX_PATHWAY_HOPS),
  /** Derived legal nexus of the whole chain — never authored by hand. */
  compositeNexus: compositeNexusSchema,
}).strict().superRefine((pathway, ctx) => {
  const firstHop = pathway.hops[0];
  const lastHop = pathway.hops[pathway.hops.length - 1];
  if (pathway.originConditionId !== firstHop.edge.sourceConditionId) {
    ctx.addIssue({
      code: "custom",
      path: ["originConditionId"],
      message: "originConditionId must equal the first hop's sourceConditionId.",
    });
  }
  if (pathway.terminalConditionId !== lastHop.edge.targetConditionId) {
    ctx.addIssue({
      code: "custom",
      path: ["terminalConditionId"],
      message: "terminalConditionId must equal the final hop's targetConditionId.",
    });
  }
  for (const [index, hop] of pathway.hops.entries()) {
    if (hop.stepIndex !== index) {
      ctx.addIssue({
        code: "custom",
        path: ["hops", index, "stepIndex"],
        message: "Hops must be contiguous: stepIndex must equal the hop's array position.",
      });
      break;
    }
    const next = pathway.hops[index + 1];
    if (next && next.edge.sourceConditionId !== hop.edge.targetConditionId) {
      ctx.addIssue({
        code: "custom",
        path: ["hops", index + 1, "edge", "sourceConditionId"],
        message: "Pathway hops must form a contiguous chain: each hop's source must equal the previous hop's target.",
      });
      break;
    }
  }

  // Mirror of deriveCompositeNexus (./utils): keep both in sync — tests pin
  // them equal.
  let composite: "DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY_CHAIN_BROKEN" = "DIRECT_CAUSATION";
  for (const hop of pathway.hops) {
    const classification = hop.edge.nexusClaim.nexusClassification;
    if (classification === "ASSOCIATION_ONLY") {
      composite = "ASSOCIATION_ONLY_CHAIN_BROKEN";
      break;
    }
    if (classification === "AGGRAVATION") composite = "AGGRAVATION";
  }
  if (pathway.compositeNexus !== composite) {
    ctx.addIssue({
      code: "custom",
      path: ["compositeNexus"],
      message: `compositeNexus must be derived from the hop chain (expected "${composite}"; derive it with deriveCompositeNexus).`,
    });
  }
});

export type KbEdge = z.infer<typeof KbEdgeSchema>;
export type KbNodeMapping = z.infer<typeof KbNodeMappingSchema>;
export type CompositeNexus = z.infer<typeof compositeNexusSchema>;
export type PathwayHop = z.infer<typeof PathwayHopSchema>;
export type ClaimPathway = z.infer<typeof ClaimPathwaySchema>;

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
export type QuarantinePointer = z.infer<typeof quarantinePointerSchema>;
