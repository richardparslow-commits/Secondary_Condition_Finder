import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

export type CombinationRelation = "synergistic" | "independent" | "conflicting";

export interface CombinationInsight {
  conditionA: { id: string; name: string; bodySystem: string };
  conditionB: { id: string; name: string; bodySystem: string };
  relation: CombinationRelation;
  reason: string;
  evidence: string;
  recommendation: string;
  riskNote?: string;
}

function sharePrimary(
  left: NonServiceConnectedConditionResult,
  right: NonServiceConnectedConditionResult,
): string | null {
  if (!left.recommendation || !right.recommendation) return null;
  const leftIds = new Set(left.recommendation.contributingPrimaries.map((p) => p.id));
  for (const primary of right.recommendation.contributingPrimaries) {
    if (leftIds.has(primary.id)) return primary.name;
  }
  return null;
}

export function analyzeCombinationInsights(
  results: NonServiceConnectedConditionResult[],
  limit = 5,
): CombinationInsight[] {
  const withRec = results.filter((r) => r.recommendation !== null).slice(0, limit);
  if (withRec.length < 2) return [];

  const insights: CombinationInsight[] = [];
  for (let i = 0; i < withRec.length; i++) {
    for (let j = i + 1; j < withRec.length; j++) {
      const left = withRec[i];
      const right = withRec[j];
      const sharedPrimary = sharePrimary(left, right);
      const sameBodySystem = left.bodySystem === right.bodySystem;

      if (sharedPrimary) {
        insights.push({
          conditionA: { id: left.conditionId, name: left.conditionName, bodySystem: left.bodySystem },
          conditionB: { id: right.conditionId, name: right.conditionName, bodySystem: right.bodySystem },
          relation: "synergistic",
          reason: `Both share service-connected condition ${sharedPrimary}.`,
          evidence: `${left.conditionName} and ${right.conditionName} each reference ${sharedPrimary} in authored published mappings, so the same primary nexus record supports evaluating both secondaries.`,
          recommendation: `Consider filing ${left.conditionName} and ${right.conditionName} together; they reinforce each other through ${sharedPrimary}. Share the same nexus evidence packet and have the clinician address each secondary separately.`,
        });
        continue;
      }

      if (sameBodySystem) {
        insights.push({
          conditionA: { id: left.conditionId, name: left.conditionName, bodySystem: left.bodySystem },
          conditionB: { id: right.conditionId, name: right.conditionName, bodySystem: right.bodySystem },
          relation: "conflicting",
          reason: `Both affect the same body system (${left.bodySystem}), which may trigger diagnostic-overlap review.`,
          evidence: `${left.bodySystem} conditions often share examination findings and rating criteria, so VA may review whether they are distinct diagnoses or overlapping manifestations.`,
          recommendation: `File the strongest-supported condition first. If the first is granted, ${right.conditionName} can follow as a distinct secondary with separately documented findings.`,
          riskNote: "Multiple musculoskeletal or same-system conditions filed together may receive additional scrutiny for pyramiding or overlapping symptoms.",
        });
        continue;
      }

      insights.push({
        conditionA: { id: left.conditionId, name: left.conditionName, bodySystem: left.bodySystem },
        conditionB: { id: right.conditionId, name: right.conditionName, bodySystem: right.bodySystem },
        relation: "independent",
        reason: "Different body systems with no shared primary — each stands on its own authored mapping.",
        evidence: `${left.conditionName} (${left.bodySystem}) and ${right.conditionName} (${right.bodySystem}) rely on separate contributing primaries and do not overlap in system-level review.`,
        recommendation: `Each can be filed on its own timeline. Sequence by evidence readiness rather than by interaction — gather the checklist for each separately.`,
      });
    }
  }

  // Cap to at most 10 pairwise insights for 5 items (chooses first pairs)
  return insights.slice(0, 10);
}

export function combinationRelationLabel(relation: CombinationRelation): string {
  if (relation === "synergistic") return "Synergistic";
  if (relation === "conflicting") return "Conflicting / same-system review";
  return "Independent";
}

export function formatCombinationInsights(insights: CombinationInsight[]): string {
  const lines: string[] = [
    "CONDITION COMBINATION INSIGHTS — SECONDARY CONDITION FINDER",
    "Research cues only — not medical or VA rating advice.",
    "=".repeat(64),
    "",
  ];
  for (const insight of insights) {
    lines.push(`${insight.conditionA.name} + ${insight.conditionB.name} — ${combinationRelationLabel(insight.relation).toUpperCase()}`);
    lines.push(`Reason: ${insight.reason}`);
    lines.push(`Evidence: ${insight.evidence}`);
    lines.push(`Strategy: ${insight.recommendation}`);
    if (insight.riskNote) lines.push(`Risk: ${insight.riskNote}`);
    lines.push("");
  }
  lines.push("DISCLAIMER: Combination analysis is informational; VA makes final determinations.");
  return lines.join("\n");
}
