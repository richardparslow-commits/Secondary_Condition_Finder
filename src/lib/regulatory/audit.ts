import { auditRegulatoryAuthenticity, type RegulatoryAuthenticityIssue } from "./authenticity";
import { deriveCommentStatus, deriveLifecycleState } from "./lifecycle";
import type { RegulatoryAction } from "./schema";

export type RegulatoryAuditIssue = RegulatoryAuthenticityIssue & { path?: string };

export const auditRegulatoryAction = (action: RegulatoryAction, asOf: string): RegulatoryAuditIssue[] => {
  const issues: RegulatoryAuditIssue[] = [...auditRegulatoryAuthenticity(action)];

  for (const [index, document] of action.federalRegisterDocuments.entries()) {
    const authored = document.publicParticipation?.commentStatus;
    if (authored && authored !== "unknown") {
      const derived = deriveCommentStatus(document.publicParticipation, asOf);
      if (derived !== authored && !["not-applicable", "unknown"].includes(derived)) {
        issues.push({
          severity: "warning",
          code: "COMMENT_STATUS_STALE",
          documentNumber: document.documentNumber,
          path: `federalRegisterDocuments[${index}].publicParticipation.commentStatus`,
          message: `Authored comment status '${authored}' differs from as-of-date status '${derived}'.`,
        });
      }
    }
  }

  if (action.impact) {
    const lifecycle = deriveLifecycleState(action, asOf);
    const currentStates = new Set(["effective", "codified", "corrected"]);
    const pendingStates = new Set([
      "agenda-planned",
      "prerule",
      "oira-review-proposed",
      "proposed-published",
      "comments-open",
      "comments-closed",
      "oira-review-final",
      "final-published",
      "long-term",
    ]);

    if (action.impact.currentLawChanged && !currentStates.has(lifecycle) && !action.impact.pendingChange) {
      issues.push({
        severity: "warning",
        code: "IMPACT_CURRENT_LAW_STATE_REVIEW",
        path: "impact.currentLawChanged",
        message: `Impact says current law changed while lifecycle state is '${lifecycle}'.`,
      });
    }
    if (action.impact.pendingChange && !pendingStates.has(lifecycle) && !action.impact.currentLawChanged) {
      issues.push({
        severity: "warning",
        code: "IMPACT_PENDING_STATE_REVIEW",
        path: "impact.pendingChange",
        message: `Impact says a change is pending while lifecycle state is '${lifecycle}'.`,
      });
    }
  }

  return issues;
};
