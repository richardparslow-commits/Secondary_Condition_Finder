/**
 * History-signal and intake-context extraction.
 *
 * Responsibility: normalize user-reported intake terms, expand canonical
 * history-signal aliases (e.g. "alcohol" → ["alcohol","drinking",…]), and
 * build advisory warnings that compare intake context to authored evidence
 * gaps/rationale. None of these helpers change ranking — they only surface
 * literal text overlap for clinician review.
 */

import { normalizeConditionName } from "@/lib/catalog/lookup";

import type {
  ClinicalFrictionWarning,
  ChronologyWarning,
  ContributingPrimary,
  Intake,
} from "./types";

const HISTORY_SIGNAL_ALIASES: Record<string, string[]> = {
  alcohol: ["alcohol", "alcohol use", "alcohol-related", "drinking"],
  smoking: ["smoking", "tobacco", "cigarette", "nicotine"],
  obesity: ["obesity", "overweight", "body mass index", "bmi"],
  "kidney-disease": ["kidney disease", "renal disease", "chronic kidney", "ckd"],
  "prior-trauma": ["prior trauma", "previous trauma", "injury", "traumatic"],
  "family-history": ["family history", "familial", "hereditary", "genetic"],
  "medication-effect": ["medication effect", "medication effects", "drug effect", "side effect"],
  diabetes: ["diabetes", "diabetic"],
  hypertension: ["hypertension", "high blood pressure"],
};

function normalizeHistoryTerm(value: string): string {
  return normalizeConditionName(value).replace(/[^a-z0-9 -]/g, "");
}

function canonicalHistorySignals(value: string): string[] {
  const normalized = normalizeHistoryTerm(value);
  return Object.entries(HISTORY_SIGNAL_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeHistoryTerm(alias))))
    .map(([signal]) => signal);
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function dedupeWarnings<T extends { code: string; primaryId: string; message: string }>(warnings: T[]): T[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.primaryId}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function timelineYear(intake: Intake, conditionId: string): number | undefined {
  const timeline = intake.conditionTimeline?.[conditionId];
  return timeline?.onsetYear ?? timeline?.diagnosisYear;
}

export function findAlternativeEtiologyWarnings(
  primary: { id: string; name: string },
  suggestion: {
    evidentiaryProfile: {
      alternativeEtiologiesToRuleOut: string[];
      alternativeEtiologyTags?: string[];
    };
  },
  intake: Intake,
): ClinicalFrictionWarning[] {
  const history = dedupe(
    (intake.history ?? [])
      .flatMap((term) => canonicalHistorySignals(term))
      .filter(Boolean),
  );
  const alternatives = suggestion.evidentiaryProfile.alternativeEtiologiesToRuleOut;
  const tags = (suggestion.evidentiaryProfile.alternativeEtiologyTags ?? []).map(normalizeHistoryTerm);
  const warnings: ClinicalFrictionWarning[] = [];

  for (const reported of history) {
    const matchingAlternative = alternatives.find((alternative) => {
      const alternativeSignals = canonicalHistorySignals(alternative);
      return alternativeSignals.includes(reported) || normalizeHistoryTerm(alternative).includes(reported);
    });
    const matchingTag = tags.find((tag) => tag === reported || tag.includes(reported) || reported.includes(tag));
    if (!matchingAlternative && !matchingTag) continue;

    warnings.push({
      code: "ALTERNATIVE_ETIOLOGY_OVERLAP",
      primaryId: primary.id,
      primaryName: primary.name,
      matchedHistory: reported,
      alternativeEtiology: matchingAlternative ?? matchingTag,
      message: `Reported history "${reported}" overlaps with an alternative etiology listed for this mapping. A qualified clinician should address whether it contributed to the diagnosed condition; this warning does not determine causation or defeat the relationship.`,
    });
  }

  return warnings;
}

export function findChronologyWarnings(
  primary: { id: string; name: string },
  targetConditionId: string,
  nexusClassification: string,
  intake: Intake,
): ChronologyWarning[] {
  const primaryYear = timelineYear(intake, primary.id);
  const secondaryYear = timelineYear(intake, targetConditionId);
  if (primaryYear === undefined || secondaryYear === undefined) return [];

  if (nexusClassification === "DIRECT_CAUSATION" && secondaryYear < primaryYear) {
    return [
      {
        code: "SECONDARY_PRECEDES_PRIMARY",
        primaryId: primary.id,
        primaryName: primary.name,
        primaryYear,
        secondaryYear,
        message: `The available approximate years place the diagnosed secondary condition (${secondaryYear}) before the service-connected primary condition (${primaryYear}). Review whether the dates reflect delayed diagnosis, a different onset, or an aggravation theory; this is a chronology flag, not a medical conclusion.`,
      },
    ];
  }

  if (nexusClassification === "AGGRAVATION" && secondaryYear >= primaryYear) {
    return [
      {
        code: "AGGRAVATION_BASELINE_CHRONOLOGY",
        primaryId: primary.id,
        primaryName: primary.name,
        primaryYear,
        secondaryYear,
        message: `The available approximate years do not show the secondary condition predating the service-connected primary condition. Review the documented baseline and whether the dates reflect delayed diagnosis or a different chronology; this is a chronology flag, not a medical conclusion.`,
      },
    ];
  }

  return [];
}

/**
 * Intake context is display-only. A term is surfaced only when its normalized
 * text literally overlaps authored recommendation content. It does not alter
 * ranking and does not infer drug classes, mechanisms, or individual causation.
 *
 * Authored pathway-intelligence fields are deliberately excluded so adding
 * richer Step 5 explanation cannot create new intake matches.
 */
export function matchIntakeContext(
  condition: string,
  contributingPrimaries: ContributingPrimary[],
  evidenceGaps: string[],
  intake: Intake,
): string[] {
  const terms = [
    ...intake.symptoms,
    ...intake.medications,
    ...(intake.treatments ?? []),
    ...intake.exposures,
  ];
  const authoredText = normalizeConditionName(
    [condition, ...contributingPrimaries.map((primary) => primary.rationale), ...evidenceGaps].join(" "),
  );

  return dedupe(
    terms.filter((term) => {
      const normalized = normalizeConditionName(term);
      return normalized.length >= 3 && authoredText.includes(normalized);
    }),
  );
}

// Re-exported for a single import surface; not part of the public engine API.
export { HISTORY_SIGNAL_ALIASES, normalizeHistoryTerm, dedupe, dedupeWarnings };
