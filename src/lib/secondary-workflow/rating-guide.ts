import type { CatalogCondition } from "@/lib/catalog/schema";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

export interface RatingGuideEntry {
  conditionId: string;
  conditionName: string;
  bodySystem: string;
  etiologicalConsensus: string;
  score: number;
  contributingPrimaryNames: string[];
  ratingSchedule: CatalogCondition["ratingSchedule"];
  reviewNotes: CatalogCondition["reviewNotes"];
  evidenceGapCount: number;
  citationCount: number;
}

export function buildRatingGuide(
  results: NonServiceConnectedConditionResult[],
  catalogById: Map<string, CatalogCondition>,
): RatingGuideEntry[] {
  return results
    .filter((result) => result.recommendation !== null)
    .map((result) => {
      const rec = result.recommendation!;
      const catalogEntry = catalogById.get(result.conditionId);
      return {
        conditionId: result.conditionId,
        conditionName: result.conditionName,
        bodySystem: result.bodySystem,
        etiologicalConsensus: rec.etiologicalConsensus,
        score: rec.score,
        contributingPrimaryNames: rec.contributingPrimaries.map((primary) => primary.name),
        ratingSchedule: catalogEntry?.ratingSchedule ?? [],
        reviewNotes: catalogEntry?.reviewNotes ?? [],
        evidenceGapCount: rec.evidenceGaps.length,
        citationCount: rec.sourceReferences.length,
      };
    })
    .sort((left, right) => left.conditionName.localeCompare(right.conditionName));
}

export const GENERIC_RATING_SCALE = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export const RATING_SCALE_NOTE =
  "VA disability ratings run from 0% to 100% in 10% increments (some diagnostic codes use a subset such as 0/10/30/50/70/100 for mental disorders). The actual levels available for a diagnosis depend on its rating criteria under 38 CFR Part 4. This scale is educational — it does not calculate or predict a rating.";

export const GENERIC_FUNCTIONAL_PROMPTS: readonly string[] = [
  "Difficulty completing occupational or daily tasks",
  "Sleep disturbance or non-restorative sleep",
  "Pain, stiffness, or limited range of motion",
  "Fatigue or reduced stamina",
  "Concentration, memory, or mood effects",
  "Need for assistive device, medication, or ongoing treatment",
  "Flares or worsening with activity",
  "Impact on social or family activities",
] as const;

export function formatRatingGuide(entries: RatingGuideEntry[]): string {
  const lines: string[] = [
    "VA RATING SCHEDULE GUIDE — SECONDARY CONDITION FINDER",
    "Research reference only — not a VA rating determination or medical assessment.",
    "=".repeat(64),
    "",
    RATING_SCALE_NOTE,
    "",
    "How to use: review the rating schedule citations recorded for each diagnosed",
    "condition, note functional limitations you experience to discuss with a",
    "qualified clinician, and confirm current VA rating criteria on VA.gov or",
    "with an accredited representative. Checking a prompt does not assign a",
    "percentage — it creates notes for your appointment.",
    "",
  ];
  if (entries.length === 0) {
    lines.push("No diagnosed conditions with a published relationship in this review.");
    return lines.join("\n");
  }
  for (const entry of entries) {
    lines.push(`Condition: ${entry.conditionName} (${entry.bodySystem}) — ${entry.etiologicalConsensus}`);
    lines.push(`Primaries: ${entry.contributingPrimaryNames.join(", ")} | Gaps: ${entry.evidenceGapCount} | Citations: ${entry.citationCount}`);
    if (entry.ratingSchedule.length === 0) {
      lines.push("Rating schedule: Refer to VA schedule — no single diagnostic code asserted for this identity.");
    } else {
      for (const ref of entry.ratingSchedule) {
        lines.push(`Rating schedule: ${ref.citation} — ${ref.note} [${ref.verified ? "VERIFIED" : "UNVERIFIED — confirm before relying"}]`);
      }
    }
    if (entry.reviewNotes.length > 0) {
      lines.push("Review notes:");
      for (const note of entry.reviewNotes) lines.push(`  - ${note}`);
    }
    lines.push("-".repeat(48));
  }
  lines.push("");
  lines.push("Generic VA scale (educational ticks): " + GENERIC_RATING_SCALE.map((value) => `${value}%`).join("  "));
  lines.push("");
  lines.push("Functional limitations to discuss (check any that apply — notes only):");
  for (const prompt of GENERIC_FUNCTIONAL_PROMPTS) lines.push(`  [ ] ${prompt}`);
  lines.push("");
  lines.push("DISCLAIMER: Rating framework text is informational and not a nexus or rating");
  lines.push("determination. VA determines the diagnostic code and percentage from the");
  lines.push("documented findings and applicable 38 CFR Part 4 criteria. Verify current");
  lines.push("criteria on VA.gov or with an accredited representative before relying.");
  return lines.join("\n");
}
