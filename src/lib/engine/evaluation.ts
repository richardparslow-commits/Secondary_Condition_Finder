import type { Recommendation } from "./types";

export interface EvidenceEvaluation {
  conditionId: string;
  satisfiedGaps: string[];
  remainingGaps: string[];
}

interface GapIndicatorRule {
  pattern: RegExp;
  acceptedIndicators: string[];
}

const GAP_INDICATOR_RULES: GapIndicatorRule[] = [
  {
    pattern: /\bcurrent diagnosis records?\b/i,
    acceptedIndicators: ["current-diagnosis-records"],
  },
  {
    pattern: /\bdiagnosis\b/i,
    acceptedIndicators: ["current-diagnosis", "diagnosis-confirmed"],
  },
  {
    pattern: /\brecords?\b/i,
    acceptedIndicators: ["medical-records", "treatment-records"],
  },
  {
    pattern: /\bnexus\b|\bmedical opinion\b/i,
    acceptedIndicators: ["nexus-letter", "medical-opinion"],
  },
];

function isGapSatisfied(gap: string, derivedIndicators: Set<string>): boolean {
  const matchedRule = GAP_INDICATOR_RULES.find((rule) => rule.pattern.test(gap));

  if (!matchedRule) {
    return false;
  }

  return matchedRule.acceptedIndicators.some((indicator) =>
    derivedIndicators.has(indicator),
  );
}

/**
 * Evaluates recommendations against uploaded evidence metadata indicators.
 * Provides checklist tracking without performing medical diagnostics or PII storage.
 */
export function evaluateEvidence(
  recommendations: Recommendation[],
  derivedIndicators: string[]
): EvidenceEvaluation[] {
  const normalizedIndicators = new Set(
    derivedIndicators.map((indicator) => indicator.trim().toLowerCase()),
  );

  return recommendations.map((rec) => {
    const satisfied: string[] = [];
    const remaining: string[] = [];

    for (const gap of rec.evidenceGaps) {
      if (isGapSatisfied(gap, normalizedIndicators)) {
        satisfied.push(gap);
      } else {
        remaining.push(gap);
      }
    }

    return {
      conditionId: rec.conditionId,
      satisfiedGaps: satisfied,
      remainingGaps: remaining,
    };
  });
}
