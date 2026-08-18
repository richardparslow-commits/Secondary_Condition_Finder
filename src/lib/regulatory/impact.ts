import { deriveLifecycleState } from "./lifecycle";
import type { RegulatoryAction } from "./schema";
import type { ClaimTheory } from "../kb/schema";

export type RegulatoryImpactMatch = {
  rin: string;
  title: string;
  lifecycleState: string;
  reasons: string[];
};

export type RegulatoryReviewQueueItem = {
  rin: string;
  title: string;
  lifecycleState: string;
  priority: "urgent-current-law" | "pending-change" | "context-review";
  affectedConditionIds: string[];
  summary?: string;
};

export const matchRegulatoryImpact = (
  action: RegulatoryAction,
  criteria: { conditionId?: string; claimTheory?: ClaimTheory; diagnosticCode?: string; cfrText?: string },
  asOf: string,
): RegulatoryImpactMatch | null => {
  const impact = action.impact;
  if (!impact) return null;
  const reasons: string[] = [];

  if (criteria.conditionId && impact.affectedConditionIds.includes(criteria.conditionId)) reasons.push(`condition:${criteria.conditionId}`);
  if (criteria.claimTheory && impact.affectedClaimTheories.includes(criteria.claimTheory)) reasons.push(`claim-theory:${criteria.claimTheory}`);
  if (criteria.diagnosticCode && impact.affectedDiagnosticCodes.includes(criteria.diagnosticCode)) reasons.push(`diagnostic-code:${criteria.diagnosticCode}`);
  if (criteria.cfrText && impact.affectedCfrReferences.some((reference) => (reference.text ?? "").includes(criteria.cfrText!))) reasons.push(`cfr:${criteria.cfrText}`);

  if (reasons.length === 0) return null;
  return { rin: action.rin, title: action.title, lifecycleState: deriveLifecycleState(action, asOf), reasons };
};

export const buildRegulatoryReviewQueue = (actions: RegulatoryAction[], asOf: string): RegulatoryReviewQueueItem[] =>
  actions
    .filter((action) => action.impact)
    .map((action) => {
      const state = deriveLifecycleState(action, asOf);
      const impact = action.impact!;
      const priority = impact.currentLawChanged
        ? "urgent-current-law" as const
        : impact.pendingChange
          ? "pending-change" as const
          : "context-review" as const;
      return {
        rin: action.rin,
        title: action.title,
        lifecycleState: state,
        priority,
        affectedConditionIds: impact.affectedConditionIds,
        summary: impact.summary,
      };
    })
    .sort((a, b) => {
      const rank = { "urgent-current-law": 0, "pending-change": 1, "context-review": 2 } as const;
      return rank[a.priority] - rank[b.priority] || a.rin.localeCompare(b.rin);
    });
