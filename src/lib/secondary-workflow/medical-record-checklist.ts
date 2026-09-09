import type { Recommendation } from "@/lib/engine/types";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

export type ChecklistCategory =
  | "diagnosis"
  | "specialist"
  | "imaging"
  | "treatment"
  | "chronology"
  | "nexus-opinion"
  | "other";

export interface ChecklistItem {
  gap: string;
  category: ChecklistCategory;
  why: string;
}

export interface ChecklistGroup {
  conditionId: string;
  conditionName: string;
  bodySystem: string;
  etiologicalConsensus: Recommendation["etiologicalConsensus"];
  contributingPrimaryNames: string[];
  items: ChecklistItem[];
}

/**
 * Heuristic category from gap text. Keyword-based, conservative, never
 * asserts a clinical finding — only groups existing authored gaps for
 * display.
 */
export function categorizeGap(gap: string): ChecklistCategory {
  const n = gap.toLowerCase();
  if (/(independent documentation|meeting .*criteria)/.test(n)) return "diagnosis";
  if (/(sleep study|polysomnograph|home sleep test|imaging|mri\b|ct scan|x-ray|ultrasound|biopsy|lab test|bloodwork|pulmonary function|spiromet|ecg|ekg|echocardiogram|string test|colonoscop)/.test(n)) return "imaging";
  if (/(nexus|medical opinion|dbq|qualified clinician|individual relationship|nexus opinion|competent medical)/.test(n)) return "nexus-opinion";
  if (/(specialist|neurolog|cardiolog|urolog|psychiatr|psycholog|orthoped|rheumatolog|dermatolog|ent |ophthalm|evaluation|consult|examination|sleep-medicine)/.test(n)) return "specialist";
  if (/(prescription|medication|pharmacy|dosage|treatment records|procedure|therapy|device|cpap|antidepressant|ssri|nsaid)/.test(n)) return "treatment";
  if (/(chronology|onset|timeline|dates?|year|history|duration|frequency|severity|log\b|trend|course)/.test(n)) return "chronology";
  if (/(diagnosis|diagnosed|confirm|criteria)/.test(n)) return "diagnosis";
  return "other";
}

const WHY_BY_CATEGORY: Record<ChecklistCategory, string> = {
  diagnosis: "Confirms the secondary diagnosis meets current criteria independently of the service-connected condition — needed before any nexus review.",
  specialist: "Specialist notes document current severity, phenotype, and response to treatment reviewed in nexus analysis.",
  imaging: "Objective testing provides measurable evidence beyond reported symptoms.",
  treatment: "Treatment and prescription records establish what was prescribed, when, and whether the condition was managed distinctly from the primary.",
  chronology: "Timeline evidence helps show whether the secondary condition began after or worsened alongside the service-connected condition.",
  "nexus-opinion": "A qualified clinician's nexus opinion links the individual record to the published medical relationship — VA weighs this separately from any tool output.",
  other: "Addresses competing causes and alternatives VA and examiners review before accepting a relationship.",
};

export function explainGap(gap: string): string {
  const category = categorizeGap(gap);
  return WHY_BY_CATEGORY[category];
}

export function buildMedicalRecordChecklist(
  results: NonServiceConnectedConditionResult[],
): ChecklistGroup[] {
  return results
    .filter((result) => result.recommendation !== null)
    .map((result) => {
      const rec = result.recommendation!;
      const items: ChecklistItem[] = rec.evidenceGaps.map((gap) => ({
        gap,
        category: categorizeGap(gap),
        why: explainGap(gap),
      }));
      return {
        conditionId: result.conditionId,
        conditionName: result.conditionName,
        bodySystem: result.bodySystem,
        etiologicalConsensus: rec.etiologicalConsensus,
        contributingPrimaryNames: rec.contributingPrimaries.map((p) => p.name),
        items,
      };
    })
    .sort((a, b) => a.conditionName.localeCompare(b.conditionName));
}

export function formatMedicalRecordChecklist(groups: ChecklistGroup[]): string {
  const lines: string[] = [
    "MEDICAL RECORD CHECKLIST — SECONDARY CONDITION FINDER",
    "Generated in this browser for research preparation (not a VA determination).",
    "=".repeat(64),
    "",
    "How to use: request or locate records that address each checklist item, then",
    "share them with a qualified clinician or accredited representative for nexus",
    "review. A checkmark here does not mean the evidence is sufficient or",
    "accepted by VA.",
    "",
  ];
  for (const group of groups) {
    lines.push(`Condition: ${group.conditionName} (${group.bodySystem})`);
    lines.push(`Consensus: ${group.etiologicalConsensus}; Primaries: ${group.contributingPrimaryNames.join(", ")}`);
    lines.push("-".repeat(48));
    for (const item of group.items) {
      lines.push(`[ ] ${item.gap}  [${item.category}]`);
      lines.push(`    Why: ${item.why}`);
    }
    lines.push("");
  }
  lines.push("DISCLAIMER: Research checklist only — not medical diagnosis, legal advice,");
  lines.push("or a VA rating prediction. Verify current VA guidance with a qualified");
  lines.push("provider or accredited representative.");
  return lines.join("\n");
}

export const CHECKLIST_CATEGORY_LABEL: Record<ChecklistCategory, string> = {
  diagnosis: "Diagnosis confirmation",
  specialist: "Specialist evaluation",
  imaging: "Testing / imaging",
  treatment: "Treatment records",
  chronology: "Timeline / chronology",
  "nexus-opinion": "Nexus opinion",
  other: "Alternative-cause review",
};
