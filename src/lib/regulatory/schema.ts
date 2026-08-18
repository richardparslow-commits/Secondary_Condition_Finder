import { z } from "zod";

import { claimTheorySchema } from "../kb/schema";

export const rinSchema = z.string().trim().regex(/^\d{4}-[A-Z0-9]{4}$/, "RIN must use the NNNN-XXXX format used by Reginfo/OIRA.");
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const datePrecisionSchema = z.enum(["year", "month", "day"]);
export const regulatoryDateSchema = z.object({
  value: z.string().regex(/^\d{4}(?:-\d{2})?(?:-\d{2})?$/),
  precision: datePrecisionSchema,
  status: z.enum(["anticipated", "published", "effective", "applicability", "deadline", "historical"]),
  note: z.string().trim().min(1).max(1000).optional(),
}).strict().superRefine((value, ctx) => {
  const expectedSegments = value.precision === "year" ? 1 : value.precision === "month" ? 2 : 3;
  if (value.value.split("-").length !== expectedSegments) {
    ctx.addIssue({ code: "custom", path: ["value"], message: `Date precision '${value.precision}' does not match '${value.value}'.` });
  }
});

export const agendaStageSchema = z.enum([
  "prerule",
  "proposed-rule",
  "final-rule",
  "long-term",
  "completed",
]);

export const regulatoryLifecycleStateSchema = z.enum([
  "agenda-planned",
  "prerule",
  "oira-review-proposed",
  "proposed-published",
  "comments-open",
  "comments-closed",
  "oira-review-final",
  "final-published",
  "effective",
  "codified",
  "long-term",
  "completed",
  "withdrawn",
  "delayed",
  "stayed",
  "corrected",
  "superseded",
  "rescinded",
  "vacated",
]);

export const federalRegisterDocumentTypeSchema = z.enum([
  "rule",
  "interim-final-rule",
  "proposed-rule",
  "notice",
  "correction",
  "presidential-document",
  "other",
]);

export const federalRegisterLegalStatusSchema = z.enum([
  "nonbinding-proposal",
  "published-not-effective",
  "effective",
  "stayed",
  "delayed",
  "withdrawn",
  "superseded",
  "rescinded",
  "vacated",
  "context-only",
]);

export const applicabilityScopeSchema = z.enum([
  "all-claims",
  "claims-received-on-or-after",
  "pending-claims",
  "pending-before-va",
  "pending-before-federal-courts",
  "rating-period-on-or-after",
  "date-range",
  "custom",
]);

export const applicabilityRuleSchema = z.object({
  scope: applicabilityScopeSchema,
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  text: z.string().trim().min(1).max(2000),
  requiresHumanInterpretation: z.boolean().default(false),
}).strict().superRefine((rule, ctx) => {
  if (rule.startDate && rule.endDate && rule.startDate > rule.endDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "Applicability endDate cannot precede startDate." });
  }
});

export const cfrReferenceSchema = z.object({
  title: z.number().int().positive(),
  part: z.number().int().nonnegative().optional(),
  section: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1).max(200).optional(),
}).strict();

export const sourcePublisherSchema = z.enum([
  "govinfo",
  "office-federal-register",
  "ecfr",
  "federalregister-gov",
  "reginfo-oira",
  "regulations-gov",
  "va",
  "congress",
  "other-government",
  "other",
]);

export const sourceLegalEditionStatusSchema = z.enum([
  "official-legal-edition",
  "authoritative-unofficial",
  "informational-unofficial",
  "planning-review-metadata",
  "public-comment-docket",
  "agency-guidance",
  "unknown",
]);

export const sourceAuthenticitySchema = z.object({
  publisher: sourcePublisherSchema,
  legalEditionStatus: sourceLegalEditionStatusSchema,
  officialEditionVerified: z.boolean().default(false),
  officialEditionSource: z.enum(["govinfo", "official-cfr-annual", "statutes-at-large", "other-official"]).optional(),
  officialEditionUrl: z.string().url().optional(),
  verifiedOn: isoDateSchema.optional(),
  note: z.string().trim().min(1).max(1000).optional(),
}).strict().superRefine((source, ctx) => {
  if (source.publisher === "federalregister-gov" && source.legalEditionStatus === "official-legal-edition") {
    ctx.addIssue({ code: "custom", path: ["legalEditionStatus"], message: "FederalRegister.gov is not the official legal edition of the Federal Register." });
  }
  if (source.publisher === "ecfr" && source.legalEditionStatus === "official-legal-edition") {
    ctx.addIssue({ code: "custom", path: ["legalEditionStatus"], message: "The eCFR is authoritative and current but is not the official legal edition of the CFR." });
  }
  if (source.publisher === "reginfo-oira" && source.legalEditionStatus !== "planning-review-metadata") {
    ctx.addIssue({ code: "custom", path: ["legalEditionStatus"], message: "Reginfo/OIRA content must be treated as planning/review metadata, not binding legal authority." });
  }
  if (source.publisher === "federalregister-gov" && source.legalEditionStatus !== "informational-unofficial") {
    ctx.addIssue({ code: "custom", path: ["legalEditionStatus"], message: "FederalRegister.gov structured content must be labeled informational-unofficial." });
  }
  if (source.publisher === "ecfr" && source.legalEditionStatus !== "authoritative-unofficial") {
    ctx.addIssue({ code: "custom", path: ["legalEditionStatus"], message: "eCFR content must be labeled authoritative-unofficial." });
  }
  if (source.publisher === "regulations-gov" && source.legalEditionStatus !== "public-comment-docket") {
    ctx.addIssue({ code: "custom", path: ["legalEditionStatus"], message: "Regulations.gov content must be labeled public-comment-docket." });
  }
  if (source.publisher === "govinfo" && source.legalEditionStatus !== "official-legal-edition") {
    ctx.addIssue({ code: "custom", path: ["legalEditionStatus"], message: "GovInfo legal-edition records must be labeled official-legal-edition." });
  }
  if (source.officialEditionSource === "govinfo" && source.officialEditionUrl && !source.officialEditionUrl.toLowerCase().includes("govinfo.gov")) {
    ctx.addIssue({ code: "custom", path: ["officialEditionUrl"], message: "GovInfo verification must point to a govinfo.gov official-edition URL." });
  }
  if (source.officialEditionVerified && (!source.officialEditionSource || !source.officialEditionUrl || !source.verifiedOn)) {
    ctx.addIssue({ code: "custom", path: ["officialEditionVerified"], message: "Official-edition verification requires source, URL, and verification date." });
  }
});

export const publicParticipationSchema = z.object({
  docketIds: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  regulationsGovUrl: z.string().url().optional(),
  commentOpenOn: isoDateSchema.optional(),
  commentCloseOn: isoDateSchema.optional(),
  commentStatus: z.enum(["not-applicable", "not-open-yet", "open", "closed", "unknown"]).default("unknown"),
  commentInstructions: z.string().trim().min(1).max(2000).optional(),
}).strict().superRefine((participation, ctx) => {
  if (participation.commentOpenOn && participation.commentCloseOn && participation.commentOpenOn > participation.commentCloseOn) {
    ctx.addIssue({ code: "custom", path: ["commentCloseOn"], message: "Comment close date cannot precede comment open date." });
  }
});

export const federalRegisterDocumentSchema = z.object({
  documentNumber: z.string().trim().min(1).max(40),
  citation: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(1000),
  type: federalRegisterDocumentTypeSchema,
  publicationDate: isoDateSchema,
  effectiveDate: isoDateSchema.optional(),
  codifiedOn: isoDateSchema.optional(),
  applicability: z.array(applicabilityRuleSchema).max(12).default([]),
  legalStatus: federalRegisterLegalStatusSchema,
  rin: rinSchema.optional(),
  relatedRins: z.array(rinSchema).max(20).default([]),
  docketIds: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  cfrReferences: z.array(cfrReferenceSchema).max(30).default([]),
  federalRegisterUrl: z.string().url(),
  govinfoPdfUrl: z.string().url().optional(),
  fullTextXmlUrl: z.string().url().optional(),
  publicParticipation: publicParticipationSchema.optional(),
  authenticity: sourceAuthenticitySchema,
  correctsDocumentNumbers: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  supersedesDocumentNumbers: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  notes: z.array(z.string().trim().min(1).max(1000)).max(10).default([]),
}).strict().superRefine((document, ctx) => {
  const finalLike = document.type === "rule" || document.type === "interim-final-rule";
  const nonfinal = document.type === "proposed-rule" || document.type === "notice";
  if (nonfinal && ["effective", "published-not-effective"].includes(document.legalStatus)) {
    ctx.addIssue({ code: "custom", path: ["legalStatus"], message: "A proposed rule or ordinary notice cannot be marked as an effective binding rule." });
  }
  if (finalLike && document.legalStatus === "nonbinding-proposal") {
    ctx.addIssue({ code: "custom", path: ["legalStatus"], message: "A final/interim-final rule cannot be labeled a nonbinding proposal." });
  }
  if (document.legalStatus === "effective" && !document.effectiveDate) {
    ctx.addIssue({ code: "custom", path: ["effectiveDate"], message: "An effective Federal Register rule must record its effective date." });
  }
  const requiresOfficialLegalVerification = ["effective", "stayed", "delayed", "withdrawn", "superseded", "rescinded", "vacated"].includes(document.legalStatus);
  if (finalLike && requiresOfficialLegalVerification && document.authenticity.publisher === "federalregister-gov" && !document.authenticity.officialEditionVerified) {
    ctx.addIssue({ code: "custom", path: ["authenticity", "officialEditionVerified"], message: "Binding or legally dispositive Federal Register status should be verified against the official edition on GovInfo." });
  }
});

export const unifiedAgendaStatusSchema = z.object({
  publicationId: z.string().trim().min(1).max(40),
  edition: z.string().trim().min(1).max(80),
  stage: agendaStageSchema,
  rinStatus: z.string().trim().min(1).max(200).optional(),
  priority: z.string().trim().min(1).max(200).optional(),
  major: z.boolean().optional(),
  economicallySignificant: z.boolean().optional(),
  includedInRegulatoryPlan: z.boolean().default(false),
  plannedActions: z.array(z.object({
    action: z.string().trim().min(1).max(200),
    date: regulatoryDateSchema,
  }).strict()).max(20).default([]),
  sourceUrl: z.string().url(),
  authenticity: sourceAuthenticitySchema,
}).strict();

export const oiraReviewSchema = z.object({
  reviewId: z.string().trim().min(1).max(80),
  rin: rinSchema,
  status: z.enum(["pending", "concluded"]),
  stage: z.enum(["prerule", "proposed-rule", "interim-final-rule", "final-rule", "final-rule-no-material-change", "notice", "other"]),
  receivedOn: isoDateSchema,
  concludedOn: isoDateSchema.optional(),
  conclusion: z.string().trim().min(1).max(200).optional(),
  legalDeadline: z.enum(["judicial", "statutory", "none", "unknown"]).default("unknown"),
  economicallySignificant: z.boolean().optional(),
  major: z.boolean().optional(),
  regulatoryFlexibilityAnalysisRequired: z.enum(["yes", "no", "undetermined", "unknown"]).default("unknown"),
  sourceUrl: z.string().url(),
  authorityUse: z.literal("review-metadata-only").default("review-metadata-only"),
  authenticity: sourceAuthenticitySchema,
}).strict().superRefine((review, ctx) => {
  if (review.status === "concluded" && !review.concludedOn) {
    ctx.addIssue({ code: "custom", path: ["concludedOn"], message: "Concluded OIRA reviews require a concluded date." });
  }
  if (review.status === "pending" && review.concludedOn) {
    ctx.addIssue({ code: "custom", path: ["concludedOn"], message: "A pending OIRA review cannot already have a concluded date." });
  }
});

export const oiraMeetingMaterialSchema = z.object({
  title: z.string().trim().min(1).max(500),
  url: z.string().url().optional(),
  submittedBy: z.string().trim().min(1).max(300).optional(),
}).strict();

export const oiraMeetingSchema = z.object({
  meetingId: z.string().trim().min(1).max(100),
  rin: rinSchema,
  scheduledOn: isoDateSchema,
  status: z.enum(["scheduled", "completed", "canceled", "unknown"]),
  requester: z.string().trim().min(1).max(500).optional(),
  organizations: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  attendees: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  materials: z.array(oiraMeetingMaterialSchema).max(100).default([]),
  sourceUrl: z.string().url(),
  authorityUse: z.literal("policy-development-context-only").default("policy-development-context-only"),
  authenticity: sourceAuthenticitySchema,
}).strict();

export const oiraMeetingAvailabilitySchema = z.enum([
  "available",
  "unavailable-action-not-reviewed",
  "none-found",
  "unknown",
]);

export const regulatoryImpactSchema = z.object({
  currentLawChanged: z.boolean(),
  pendingChange: z.boolean(),
  affectedConditionIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(500).default([]),
  affectedClaimTheories: z.array(claimTheorySchema).max(20).default([]),
  affectedDiagnosticCodes: z.array(z.string().trim().min(1).max(40)).max(200).default([]),
  affectedPresumptions: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  affectedEffectiveDateRules: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  affectedCfrReferences: z.array(cfrReferenceSchema).max(100).default([]),
  summary: z.string().trim().min(1).max(3000),
  reviewedOn: isoDateSchema.optional(),
}).strict();

export const regulatoryActionSchema = z.object({
  rin: rinSchema,
  title: z.string().trim().min(1).max(1000),
  agency: z.object({
    department: z.string().trim().min(1).max(300),
    subagency: z.string().trim().min(1).max(300).optional(),
  }).strict(),
  relatedRins: z.array(rinSchema).max(50).default([]),
  cfrReferences: z.array(cfrReferenceSchema).max(100).default([]),
  legalAuthorities: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
  agenda: z.array(unifiedAgendaStatusSchema).max(50).default([]),
  oiraReviews: z.array(oiraReviewSchema).max(100).default([]),
  oiraMeetingAvailability: oiraMeetingAvailabilitySchema.default("unknown"),
  oiraMeetings: z.array(oiraMeetingSchema).max(500).default([]),
  federalRegisterDocuments: z.array(federalRegisterDocumentSchema).max(200).default([]),
  impact: regulatoryImpactSchema.optional(),
  manualLifecycleOverride: z.object({
    state: regulatoryLifecycleStateSchema,
    reason: z.string().trim().min(1).max(1500),
    sourceUrl: z.string().url(),
    reviewedOn: isoDateSchema,
  }).strict().optional(),
  sourceCheckedOn: isoDateSchema.optional(),
}).strict().superRefine((action, ctx) => {
  if (action.relatedRins.includes(action.rin)) {
    ctx.addIssue({ code: "custom", path: ["relatedRins"], message: "A regulatory action cannot list its own RIN as a related RIN." });
  }
  for (const [index, doc] of action.federalRegisterDocuments.entries()) {
    if (doc.rin && doc.rin !== action.rin && !action.relatedRins.includes(doc.rin)) {
      ctx.addIssue({ code: "custom", path: ["federalRegisterDocuments", index, "rin"], message: `Document RIN ${doc.rin} must match the action RIN or be listed in relatedRins.` });
    }
  }
});

export const regulatoryActionRegistrySchema = z.array(regulatoryActionSchema).superRefine((actions, ctx) => {
  const seen = new Set<string>();
  for (const [index, action] of actions.entries()) {
    if (seen.has(action.rin)) ctx.addIssue({ code: "custom", path: [index, "rin"], message: `Duplicate RIN ${action.rin}.` });
    seen.add(action.rin);
  }
});

export type RegulatoryDate = z.infer<typeof regulatoryDateSchema>;
export type AgendaStage = z.infer<typeof agendaStageSchema>;
export type RegulatoryLifecycleState = z.infer<typeof regulatoryLifecycleStateSchema>;
export type FederalRegisterDocument = z.infer<typeof federalRegisterDocumentSchema>;
export type FederalRegisterLegalStatus = z.infer<typeof federalRegisterLegalStatusSchema>;
export type UnifiedAgendaStatus = z.infer<typeof unifiedAgendaStatusSchema>;
export type OiraReview = z.infer<typeof oiraReviewSchema>;
export type OiraMeeting = z.infer<typeof oiraMeetingSchema>;
export type RegulatoryImpact = z.infer<typeof regulatoryImpactSchema>;
export type RegulatoryAction = z.infer<typeof regulatoryActionSchema>;
export type RegulatoryActionRegistry = z.infer<typeof regulatoryActionRegistrySchema>;
export type SourceAuthenticity = z.infer<typeof sourceAuthenticitySchema>;
