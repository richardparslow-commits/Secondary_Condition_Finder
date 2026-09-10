import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

export interface ActionPlanEntry {
  rank: number;
  conditionId: string;
  conditionName: string;
  bodySystem: string;
  etiologicalConsensus: string;
  score: number;
  contributingPrimaryNames: string[];
  evidenceGapCount: number;
  nexusClassifications: string[];
}

const CONSENSUS_ORDER: Record<string, number> = {
  WELL_ESTABLISHED: 0,
  IATROGENIC_TREATMENT_EFFECT: 1,
  PROBABLE: 2,
  CONTESTED_REQUIRES_SPECIFIC_EVIDENCE: 3,
  NOT_ESTABLISHED: 4,
};

export function buildActionPlan(
  results: NonServiceConnectedConditionResult[],
): ActionPlanEntry[] {
  const withRec = results.filter((result) => result.recommendation !== null);
  const entries: ActionPlanEntry[] = withRec.map((result) => {
    const rec = result.recommendation!;
    return {
      rank: 0, // filled after sort
      conditionId: result.conditionId,
      conditionName: result.conditionName,
      bodySystem: result.bodySystem,
      etiologicalConsensus: rec.etiologicalConsensus,
      score: rec.score,
      contributingPrimaryNames: rec.contributingPrimaries.map((primary) => primary.name),
      evidenceGapCount: rec.evidenceGaps.length,
      nexusClassifications: [...new Set(rec.contributingPrimaries.map((primary) => primary.nexusClaim?.nexusClassification ?? "unknown"))],
    };
  });
  entries.sort((left, right) => {
    const consensusDiff = (CONSENSUS_ORDER[left.etiologicalConsensus] ?? 9) - (CONSENSUS_ORDER[right.etiologicalConsensus] ?? 9);
    if (consensusDiff !== 0) return consensusDiff;
    if (right.score !== left.score) return right.score - left.score;
    if (left.evidenceGapCount !== right.evidenceGapCount) return left.evidenceGapCount - right.evidenceGapCount;
    return left.conditionName.localeCompare(right.conditionName);
  });
  for (let index = 0; index < entries.length; index++) entries[index].rank = index + 1;
  return entries;
}

export interface ActionPlanStep {
  action: string;
  detail: string;
}

export function actionPlanSteps(entry: ActionPlanEntry): ActionPlanStep[] {
  return [
    {
      action: `Gather Checklist for ${entry.conditionName}`,
      detail: `Download the medical record checklist for this condition and request the listed records (diagnosis confirmation, testing, specialist notes, treatment history, chronology, nexus opinion).`,
    },
    {
      action: "Discuss Nexus With a Qualified Clinician",
      detail: `Share the research recommendations and records with a provider who can evaluate ${entry.contributingPrimaryNames.join(" / ")} → ${entry.conditionName} in your individual case (${entry.nexusClassifications.join(", ")}; ${entry.etiologicalConsensus}). A clinician's opinion is weighed separately from any tool output.`,
    },
    {
      action: "Choose the VA Form With an Accredited Representative",
      detail: "Your VSO or accredited representative will select the correct filing form (often VA Form 21-526EZ for new secondary claims) after reviewing the record. Forms depend on claim type and phase — confirm on VA.gov.",
    },
    {
      action: "File and Track on VA.gov",
      detail: "File through VA.gov or with your representative, upload supporting evidence, and track the claim status. Initial VA processing is commonly 3–5 months but varies by claim.",
    },
  ];
}

export function formatActionPlan(entries: ActionPlanEntry[]): string {
  const lines: string[] = [
    "YOUR NEXT STEPS — PERSONALIZED CLAIM ACTION PLAN",
    "Secondary Condition Finder — research prioritization (not VA filing instructions).",
    "=".repeat(64),
    "",
    "Priority order reflects authored evidence strength in the current review:",
    "WELL_ESTABLISHED / PROBABLE before CONTESTED / NOT_ESTABLISHED, then",
    "engine score, then fewer evidence gaps. It does not predict VA outcome.",
    "",
    "Suggested timeline (informational — actual processing varies):",
    "  Weeks 1–2:  Gather records using the checklist (per condition)",
    "  Weeks 2–4:  Clinician nexus review and DBQ or opinion, if appropriate",
    "  Week 4+:    File with your representative; upload evidence to VA.gov",
    "  Months 3–5: VA evidence review and examination scheduling (typical initial window)",
    "",
    "Prioritized conditions:",
    "",
  ];
  if (entries.length === 0) {
    lines.push("No diagnosed conditions with a published relationship in this review — no plan generated.");
  } else {
    for (const entry of entries) {
      lines.push(`#${entry.rank}  ${entry.conditionName} (${entry.bodySystem}) — ${entry.etiologicalConsensus} | score ${entry.score} | ${entry.evidenceGapCount} checklist items | via ${entry.contributingPrimaryNames.join(", ")}`);
      lines.push(`     Nexus: ${entry.nexusClassifications.join(", ")}`);
      for (const step of actionPlanSteps(entry)) {
        lines.push(`     → ${step.action}`);
        lines.push(`       ${step.detail}`);
      }
      lines.push("");
    }
    lines.push("Forms and where to find help:");
    lines.push("  • VA forms and filing: https://www.va.gov/find-forms/ and https://www.va.gov/disability/file-disability-claim-form-21-526ez/");
    lines.push("  • Find an accredited representative/VSO: https://www.va.gov/ogc/apps/accreditation/index.asp and https://www.va.gov/vso/");
    lines.push("  • Presumptive categories (if applicable): /presumptive in this app");
    lines.push("");
    lines.push("DISCLAIMER: This is a research-generated prioritization, not VA guidance.");
    lines.push("Verify current forms, criteria, and filing steps on VA.gov or with an");
    lines.push("accredited representative before relying. Ratings and eligibility are");
    lines.push("determined by VA from the documented findings and applicable law.");
  }
  return lines.join("\n");
}
