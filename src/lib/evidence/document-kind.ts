import type { EvidenceTextSegment } from "./extract";

export type EvidenceDocumentKindHint =
  | "va-decision-letter"
  | "clinical-note"
  | "unclear";

const DECISION_SIGNALS = [
  /\bservice connection\b/i,
  /\brating decision\b/i,
  /\b38 (?:CFR|C\.F\.R\.)\b/i,
  /\bduty to assist\b/i,
  /\bdisability benefits\b/i,
  /\bentitlement\b/i,
  /\bgranted\b/i,
  /\bdenied\b/i,
  /\bdeferred\b/i,
];

const CLINICAL_SIGNALS = [
  /\bprogress note\b/i,
  /\bclinical note\b/i,
  /\bclinic visit\b/i,
  /\bpatient (?:presents|reports|states|endorses)\b/i,
  /\bassessment\s*:/i,
  /\bimpression\s*:/i,
  /\bdiagnosis\s*:/i,
  /\bchief complaint\b/i,
  /\bvital signs\b/i,
  /\bmedications?\s*:/i,
  /\btreatment plan\b/i,
  /\b(?:review|plan|exam(?:ination)?)\b/i,
];

const SAMPLE_CHARS = 60_000;

/**
 * Heuristic label for a document's apparent kind, used only to warn users when
 * the author credential they chose may conflict with the document type (for
 * example, adjudication language in a VA decision letter being counted as a
 * clinician-authored nexus statement). This is advisory only and never
 * overrides the user's author selection.
 */
export function detectDocumentKindHint(
  segments: readonly EvidenceTextSegment[],
): EvidenceDocumentKindHint {
  let sample = "";
  for (const segment of segments) {
    sample += `${segment.text}\n`;
    if (sample.length >= SAMPLE_CHARS) break;
  }
  if (sample.length === 0) return "unclear";

  let decisionHits = 0;
  for (const signal of DECISION_SIGNALS) {
    if (signal.test(sample)) decisionHits += 1;
  }
  let clinicalHits = 0;
  for (const signal of CLINICAL_SIGNALS) {
    if (signal.test(sample)) clinicalHits += 1;
  }

  // "Granted" appears in both decision letters and clinical notes rarely; the
  // combination with decision-only markers is what matters.
  const decisionStrength = decisionHits;
  const clinicalStrength = clinicalHits;

  if (decisionStrength >= 2 && decisionStrength > clinicalStrength) {
    return "va-decision-letter";
  }
  if (clinicalStrength >= 2 && clinicalStrength > decisionStrength) {
    return "clinical-note";
  }
  return "unclear";
}

/** Clinician credential values that would make nexus classification apply. */
export function isClinicianCredential(credential: string): boolean {
  return (
    credential === "physician" ||
    credential === "psychologist" ||
    credential === "np-pa" ||
    credential === "other-licensed-clinician"
  );
}
