import { authorityStatusAsOf } from "../lifecycle";
import type { RegulatoryAction } from "../schema";
import { actionIsReviewRelevant, federalRegisterDiscoveryIsReviewRelevant } from "./relevance";
import type {
  FederalRegisterDiscovery,
  RegulatoryChangeClassification,
  RegulatoryChangeImpact,
  RegulatoryPreflightChange,
} from "./types";

const emptyImpact = (): RegulatoryChangeImpact => ({
  affectedConditionIds: [],
  affectedClaimTheories: [],
  affectedDiagnosticCodes: [],
  affectedPresumptions: [],
  affectedEffectiveDateRules: [],
});

const impactForAction = (action: RegulatoryAction | undefined): RegulatoryChangeImpact => action?.impact ? {
  affectedConditionIds: [...action.impact.affectedConditionIds],
  affectedClaimTheories: [...action.impact.affectedClaimTheories],
  affectedDiagnosticCodes: [...action.impact.affectedDiagnosticCodes],
  affectedPresumptions: [...action.impact.affectedPresumptions],
  affectedEffectiveDateRules: [...action.impact.affectedEffectiveDateRules],
} : emptyImpact();

const stable = (value: unknown): string => JSON.stringify(value);

const classifyDocument = (
  discovery: FederalRegisterDiscovery,
  action: RegulatoryAction | undefined,
  asOfDate: string,
): { classification: RegulatoryChangeClassification; reason: string } => {
  const doc = discovery.normalizedDocument;
  if (!doc) {
    return {
      classification: "current-law-change",
      reason: `Federal Register detected a potentially operative or legally dispositive VA action, but official-edition verification is incomplete. ${discovery.verificationMessage ?? ""}`.trim(),
    };
  }
  if (doc.type === "proposed-rule") {
    return { classification: "pending-regulatory-change", reason: "A VA proposed rule was published; it is not current binding law." };
  }
  if (doc.type === "correction") {
    return discovery.officialEditionVerified
      ? { classification: "current-law-change", reason: "A Federal Register correction was published and verified against its GovInfo official-edition link." }
      : { classification: "regulatory-development-signal", reason: "A Federal Register correction was detected but has not been admitted as verified operative authority." };
  }
  if (doc.type === "rule" || doc.type === "interim-final-rule") {
    const status = authorityStatusAsOf(doc, asOfDate);
    if (status.binding) return { classification: "current-law-change", reason: status.reason };
    return { classification: "pending-regulatory-change", reason: status.reason };
  }
  if (discovery.signals.some((signal) => ["effective-date-delay", "withdrawal", "rescission", "stay", "supersession"].includes(signal))) {
    return discovery.officialEditionVerified
      ? { classification: "current-law-change", reason: `Federal Register document carries a legally significant disposition signal: ${discovery.signals.join(", ")}.` }
      : { classification: "regulatory-development-signal", reason: `Federal Register document may change operative status (${discovery.signals.join(", ")}); official-edition review is required before legal reliance.` };
  }
  if (action?.impact?.pendingChange) return { classification: "pending-regulatory-change", reason: action.impact.summary };
  return { classification: "regulatory-development-signal", reason: "New VA Federal Register activity was detected and retained for regulatory review." };
};

export function diffRegulatoryPreflight(options: {
  previousRegistry: RegulatoryAction[];
  nextRegistry: RegulatoryAction[];
  federalRegisterDiscoveries: FederalRegisterDiscovery[];
  detectedAt: string;
  asOfDate: string;
}): RegulatoryPreflightChange[] {
  const previous = new Map(options.previousRegistry.map((action) => [action.rin, action] as const));
  const next = new Map(options.nextRegistry.map((action) => [action.rin, action] as const));
  const changes: RegulatoryPreflightChange[] = [];
  const seen = new Set<string>();

  const add = (change: RegulatoryPreflightChange) => {
    if (seen.has(change.id)) return;
    seen.add(change.id);
    changes.push(change);
  };

  for (const discovery of options.federalRegisterDiscoveries) {
    if (!federalRegisterDiscoveryIsReviewRelevant(discovery)) continue;
    const rin = discovery.rin;
    const previousAction = rin ? previous.get(rin) : undefined;
    const previousDocument = previousAction?.federalRegisterDocuments.find((document) => document.documentNumber === discovery.documentNumber);
    if (previousDocument && discovery.normalizedDocument && stable(previousDocument) === stable(discovery.normalizedDocument)) continue;
    const action = rin ? next.get(rin) ?? previousAction : undefined;
    const classified = classifyDocument(discovery, action, options.asOfDate);
    add({
      id: `fr:${discovery.documentNumber}`,
      rin,
      title: discovery.title,
      classification: classified.classification,
      source: "federal-register",
      detectedAt: options.detectedAt,
      reason: classified.reason,
      documentNumbers: [discovery.documentNumber],
      requiresOfficialEditionVerification: discovery.officialEditionVerificationRequired,
      officialEditionVerified: discovery.officialEditionVerified,
      impact: impactForAction(action),
    });
  }

  for (const [rin, action] of next) {
    if (!actionIsReviewRelevant(action)) continue;
    const prior = previous.get(rin);
    const priorReviews = new Map((prior?.oiraReviews ?? []).map((review) => [review.reviewId, review] as const));
    for (const review of action.oiraReviews) {
      const before = priorReviews.get(review.reviewId);
      if (before && stable(before) === stable(review)) continue;
      add({
        id: `oira-review:${review.reviewId}`,
        rin,
        title: action.title,
        classification: "regulatory-development-signal",
        source: review.status === "pending" ? "oira-pending" : "oira-completed",
        detectedAt: options.detectedAt,
        reason: review.status === "pending"
          ? `VA action entered or changed OIRA review at the ${review.stage} stage. OIRA review status is not current law.`
          : `OIRA review concluded${review.conclusion ? ` as '${review.conclusion}'` : ""}. Conclusion of centralized review does not itself make the action effective.`,
        documentNumbers: [],
        requiresOfficialEditionVerification: false,
        officialEditionVerified: false,
        impact: impactForAction(action),
      });
    }

    const priorAgenda = new Map<string, RegulatoryAction["agenda"][number]>((prior?.agenda ?? []).map((status) => [`${status.publicationId}:${status.edition}`, status]));
    for (const status of action.agenda) {
      const key = `${status.publicationId}:${status.edition}`;
      const before = priorAgenda.get(key);
      if (before && stable(before) === stable(status)) continue;
      add({
        id: `agenda:${rin}:${key}`,
        rin,
        title: action.title,
        classification: "regulatory-development-signal",
        source: "unified-agenda",
        detectedAt: options.detectedAt,
        reason: `Unified Agenda metadata changed or was newly observed at '${status.stage}'. Agenda stages and planned dates describe agency plans, not operative law.`,
        documentNumbers: [],
        requiresOfficialEditionVerification: false,
        officialEditionVerified: false,
        impact: impactForAction(action),
      });
    }

    const priorMeetings = new Set((prior?.oiraMeetings ?? []).map((meeting) => meeting.meetingId));
    for (const meeting of action.oiraMeetings) {
      if (priorMeetings.has(meeting.meetingId)) continue;
      add({
        id: `oira-meeting:${meeting.meetingId}`,
        rin,
        title: action.title,
        classification: "regulatory-development-signal",
        source: "oira-meetings",
        detectedAt: options.detectedAt,
        reason: `New EO 12866 stakeholder-meeting activity was detected for ${rin}. Meeting activity is policy-development context only and is not legal authority.`,
        documentNumbers: [],
        requiresOfficialEditionVerification: false,
        officialEditionVerified: false,
        impact: impactForAction(action),
      });
    }
  }

  const rank: Record<RegulatoryChangeClassification, number> = {
    "current-law-change": 0,
    "pending-regulatory-change": 1,
    "regulatory-development-signal": 2,
  };
  return changes.sort((a, b) => rank[a.classification] - rank[b.classification] || a.id.localeCompare(b.id));
}
