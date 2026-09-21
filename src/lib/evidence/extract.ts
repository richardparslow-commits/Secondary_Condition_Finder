/**
 * Evidence text classification module.
 *
 * **Browser-only** — must never be imported from app pages, Server Actions,
 * or API routes. This module is part of the evidence-parser boundary
 * (see docs/evidence-parser-boundary.md). It runs entirely in the client
 * within LocalEvidenceAnalyzer and classifies extracted text segments by
 * clinical relevance (nexus-relevant, supporting, diagnosis, etc.).
 */
import {
  conditionTermGuardFor,
  conditionTermPatternFor,
} from "@/lib/evidence/condition-terms";
export type EvidenceCategory =
  | "diagnosis"
  | "causation"
  | "aggravation"
  | "treatment"
  | "medication"
  | "timeline"
  | "alternative-cause";

export type EvidenceStrength = "nexus-relevant" | "supporting";

export type ClinicianCredential =
  | "physician"
  | "psychologist"
  | "np-pa"
  | "other-licensed-clinician"
  | "unknown"
  | "non-clinician";

export interface EvidenceSourceMetadata {
  sourceName: string;
  credential: ClinicianCredential;
  locatorPrefix?: string;
}

export interface EvidenceTextSegment {
  text: string;
  locatorPrefix: string;
}

export interface EvidenceExcerpt {
  sourceName: string;
  locator: string;
  quote: string;
  category: EvidenceCategory;
  strength: EvidenceStrength;
  clinicianAuthored: boolean;
  matchedTerms: string[];
}

export interface EvidenceAnalysis {
  version: 1;
  sourceName: string;
  excerpts: EvidenceExcerpt[];
  nexusRelevantCount: number;
  supportingCount: number;
}

const CLINICIAN_CREDENTIALS = new Set<ClinicianCredential>([
  "physician",
  "psychologist",
  "np-pa",
  "other-licensed-clinician",
]);

const CAUSATION_PATTERNS = [
  /\bproximately due to\b/i,
  /\bcaused by\b/i,
  /\bsecondary to\b/i,
  /\bas a result of\b/i,
  /\bresult(?:ed|ing)? from\b/i,
  /\battributable to\b/i,
  /\bdue to\b/i,
  // Spicer/M21-1 May 2026: "but for" causation language.
  /\bbut for\b/i,
  /\bwould not have occurred\b/i,
  // Favorable nexus-opinion language: the VA "at least as likely as not"
  // standard as clinicians phrase it in DBQs and nexus letters. Without this,
  // the strongest nexus sentence a veteran owns (an IMO conclusion) classified
  // as nothing at all.
  /\bmore likely than not\b/i,
  /\bat least as likely as not\b/i,
  // VA/medical shorthand "2/2" = "secondary to" (e.g. "Insomnia may be 2/2 OSA").
  /\b2\/2(?!\d|\/)\b/i,
];

const AGGRAVATION_PATTERNS = [
  /\baggravat(?:e|ed|es|ing|ion)\b/i,
  /\bworsen(?:ed|ing|s)?\b/i,
  /\bmade worse\b/i,
  /\bbeyond (?:its |the )?natural progression\b/i,
  /\bincrease(?:d)? in severity\b/i,
  // Spicer/M21-1 May 2026: treatment-interference pathway.
  /\binterfered with.*treatment\b/i,
  /\bimpeded.*treatment\b/i,
  /\bdelayed.*treatment\b/i,
  /\bprevented.*treatment\b/i,
  // VA notes use "exacerbation"/"flare-up" for aggravation of a pre-existing
  // condition. Only with-cause forms are captured so bare problem-list entries
  // ("asthma exacerbation") do not read as nexus statements.
  /\bexacerbated by\b/i,
  /\bexacerbations? of\b/i,
  /\bexacerbations? (?:are|were|is|was)? ?(?:caused|triggered|provoked|precipitated) by\b/i,
  /\b(?:flare|flare-up)s? (?:are|were|is|was)? ?(?:caused|triggered|provoked|precipitated) by\b/i,
];

const DIAGNOSIS_PATTERNS = [
  /\bdiagnos(?:is|ed|es)\b/i,
  /\bassessment\b/i,
  /\bimpression\b/i,
  // "dx" / "working dx" / "rule out" are standard clinical shorthand for
  // diagnosis and differential diagnosis ("working dx of REM sleep behavior
  // disorder", "rule out narcolepsy").
  /\b(?:working\s+)?dx\b(?!\w)/i,
  /\brule out\b/i,
];

const TREATMENT_PATTERNS = [
  /\btreat(?:ed|ment|ing)\b/i,
  /\btherapy\b/i,
  /\bprocedure\b/i,
  /\bsurgery\b/i,
];

const MEDICATION_PATTERNS = [
  /\bmedicat(?:ion|ions)\b/i,
  /\bprescrib(?:e|ed|ing)\b/i,
  /\badverse (?:effect|reaction)\b/i,
  /\bside effect\b/i,
];

const TIMELINE_PATTERNS = [
  /\bonset\b/i,
  /\bsince\b/i,
  /\bprogress(?:ed|ion|ing)\b/i,
  /\bchronic\b/i,
];

const ALTERNATIVE_CAUSE_PATTERNS = [
  /\bnot caused by\b/i,
  /\bnot due to\b/i,
  /\bnot aggravat(?:ed|ing|ion)\b/i,
  /\bless likely than not\b/i,
  // Unfavorable nexus phrasings must surface as alternative-cause context,
  // never as positive evidence for the claim.
  /\bnot more likely than not\b/i,
  /\bnot at least as likely as not\b/i,
  /\bmore likely (?:due|related) to\b/i,
  /\balternative (?:cause|etiology)\b/i,
];

/**
 * Sentence-initial negation openers. A negated sentence is not positive
 * evidence: "no evidence that the OSA was caused by PTSD" or "denies a
 * diagnosis of PTSD" must not count toward the evidence-gap checklist, or gaps
 * are falsely reported as addressed. Explicit adversarial phrasings ("not
 * caused by", "not aggravated", "ruled out") are evaluated earlier as
 * alternative-cause evidence so unfavorable opinions stay visible.
 */
const NEGATION_PREFIX_PATTERN =
  /^\s*(?:no|not|without|denies|denied|negative for|never had|free of|ruled out)\b/i;

/**
 * Regulatory/adjudication boilerplate that describes general VA rules rather
 * than the individual's evidence. Such sentences are not veteran-specific
 * statements, so they are excluded entirely rather than counted as supporting
 * or (when they name a selected condition) promoted toward nexus.
 */
const BOILERPLATE_PATTERNS = [
  /\b38 (?:C\.F\.R\.|CFR|U\.S\.C\.|USC)\b/i,
  /\bwillful misconduct\b/i,
  /\bmay be granted\b/i,
  /\bconsidered to have been caused\b/i,
  /\bline[- ]of[- ]duty\b/i,
  /\badjudicat(?:ion|ive)\b/i,
];

/**
 * Section headers used by clinical notes. Lines that follow one of these
 * headers are treated as a diagnosis/assessment list, so one-condition-per-line
 * entries are captured as supporting diagnosis context even without an inline
 * keyword such as "diagnosis".
 */
const DIAGNOSIS_SECTION_HEADERS = [
  /^(?:diagnosis|diagnoses|assessment|impression|impressions|active problems|problem list|medical diagnoses?)\s*:?\s*$/i,
];

function isSectionResetLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // "TREATMENT PLAN:" style labeled headers and most short all-caps headers
  // begin a new section; a bare colon-suffixed header is the common form.
  if (/:\s*$/.test(trimmed)) return true;
  if (trimmed.length >= 3 && trimmed === trimmed.toUpperCase()) return true;
  return false;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Condition terms matched in a sentence. A term counts only when its exact
 * pattern matches AND — for guarded two-letter acronyms (MI, PE, RA, OA, MS;
 * see conditionTermGuardFor) — the sentence carries at least one clinical
 * co-signal. The match-time guard is the second layer behind the terms
 * builder's admission check, so a guarded acronym can never cover an evidence
 * gap from chart scaffolding alone ("PE: alert, oriented x3", "MS 4mg IV")
 * regardless of how the terms list was constructed.
 */
function matchingTerms(text: string, terms: string[]): string[] {
  const matched: string[] = [];
  for (const term of terms) {
    if (conditionTermPatternFor(term)?.test(text) !== true) continue;
    const guard = conditionTermGuardFor(term);
    if (guard && !guard.test(text)) continue;
    matched.push(term);
  }
  return matched;
}

function hasPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyCategory(text: string): EvidenceCategory | null {
  if (hasPattern(text, BOILERPLATE_PATTERNS)) return null;
  if (hasPattern(text, ALTERNATIVE_CAUSE_PATTERNS)) return "alternative-cause";
  // Negated findings are not positive evidence (see NEGATION_PREFIX_PATTERN).
  // Alternative-cause phrasing above is deliberately evaluated first so
  // explicit unfavorable opinions stay visible.
  if (NEGATION_PREFIX_PATTERN.test(text)) return null;
  if (hasPattern(text, AGGRAVATION_PATTERNS)) return "aggravation";
  if (hasPattern(text, CAUSATION_PATTERNS)) return "causation";
  if (hasPattern(text, DIAGNOSIS_PATTERNS)) return "diagnosis";
  if (hasPattern(text, MEDICATION_PATTERNS)) return "medication";
  if (hasPattern(text, TREATMENT_PATTERNS)) return "treatment";
  if (hasPattern(text, TIMELINE_PATTERNS)) return "timeline";
  return null;
}

function isNexusCategory(category: EvidenceCategory): boolean {
  return category === "causation" || category === "aggravation" || category === "alternative-cause";
}

export function analyzeEvidenceText(
  text: string,
  metadata: EvidenceSourceMetadata,
  conditionTerms: string[],
): EvidenceAnalysis {
  const clinicianAuthored = CLINICIAN_CREDENTIALS.has(metadata.credential);
  const excerpts: EvidenceExcerpt[] = [];
  const seen = new Set<string>();
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let diagnosisList = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      diagnosisList = false;
      continue;
    }

    if (DIAGNOSIS_SECTION_HEADERS.some((header) => header.test(trimmed))) {
      diagnosisList = true;
    } else if (isSectionResetLine(trimmed)) {
      diagnosisList = false;
    }

    const line = normalizeWhitespace(rawLine);
    const sentences = line
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(normalizeWhitespace)
      .filter(Boolean);
    const candidateSentences = sentences.length === 0 ? [line] : sentences;

    for (const sentence of candidateSentences) {
      // The floor must stay low enough for standalone clinical-shorthand lines
      // ("2/2 OSA", "dx PTSD", "s/p CVA") to reach the classifier; anything
      // shorter is noise. Nexus relevance is still gated on a matched
      // selected-condition term, so short non-condition lines stay inert.
      if (sentence.length < 6 || sentence.length > 1200) continue;
      let category = classifyCategory(sentence);
      const matched = matchingTerms(sentence, conditionTerms);
      // Under a Diagnosis:/Assessment: header, a line naming a selected
      // condition is diagnosis context even without an inline keyword. "Timeline"
      // hits here are usually list modifiers ("chronic sinusitis") rather than
      // onset statements, so they defer to the diagnosis context.
      if (diagnosisList && matched.length > 0 && (category === null || category === "timeline")) {
        category = "diagnosis";
      }
      if (!category) continue;

      const nexusRelevant = isNexusCategory(category) && clinicianAuthored && matched.length > 0;
      const strength: EvidenceStrength = nexusRelevant ? "nexus-relevant" : "supporting";
      const key = `${category}:${sentence.toLocaleLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      excerpts.push({
        sourceName: metadata.sourceName,
        locator: `${metadata.locatorPrefix ? `${metadata.locatorPrefix}, ` : ""}line ${index + 1}`,
        quote: sentence,
        category,
        strength,
        clinicianAuthored,
        matchedTerms: matched,
      });
    }
  }

  return {
    version: 1,
    sourceName: metadata.sourceName,
    excerpts,
    nexusRelevantCount: excerpts.filter((excerpt) => excerpt.strength === "nexus-relevant").length,
    supportingCount: excerpts.filter((excerpt) => excerpt.strength === "supporting").length,
  };
}

export function analyzeEvidenceSegments(
  segments: EvidenceTextSegment[],
  metadata: Omit<EvidenceSourceMetadata, "locatorPrefix">,
  conditionTerms: string[],
): EvidenceAnalysis {
  const excerpts: EvidenceExcerpt[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const analysis = analyzeEvidenceText(
      segment.text,
      { ...metadata, locatorPrefix: segment.locatorPrefix },
      conditionTerms,
    );

    for (const excerpt of analysis.excerpts) {
      const key = `${excerpt.category}:${excerpt.quote.toLocaleLowerCase()}:${excerpt.locator}`;
      if (seen.has(key)) continue;
      seen.add(key);
      excerpts.push(excerpt);
    }
  }

  return {
    version: 1,
    sourceName: metadata.sourceName,
    excerpts,
    nexusRelevantCount: excerpts.filter((excerpt) => excerpt.strength === "nexus-relevant").length,
    supportingCount: excerpts.filter((excerpt) => excerpt.strength === "supporting").length,
  };
}

export const evidenceAnalysisStorageKey = "secondary-condition-finder:evidence-analysis:v1";
