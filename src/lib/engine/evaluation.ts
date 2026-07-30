import type { Recommendation } from "./types";

export interface EvidenceEvaluation {
  conditionId: string;
  satisfiedGaps: string[];
  remainingGaps: string[];
}

/**
 * Evaluates recommendations against uploaded evidence metadata indicators.
 * Provides checklist tracking without performing medical diagnostics or PII storage.
 */
export function evaluateEvidence(
  recommendations: Recommendation[],
  derivedIndicators: string[]
): EvidenceEvaluation[] {
  return recommendations.map((rec) => {
    const satisfied: string[] = [];
    const remaining: string[] = [];

    for (const gap of rec.evidenceGaps) {
      if (derivedIndicators.length > 0 && (gap.toLowerCase().includes("diagnosis") || gap.toLowerCase().includes("record"))) {
        satisfied.push(gap);
      } else {
        remaining.push(gap);
      }
    }

    return {
      conditionId: rec.conditionId,
      satisfiedGaps: satisfied,
      remainingGaps: remaining.length > 0 ? remaining : rec.evidenceGaps
    };
  });
}
