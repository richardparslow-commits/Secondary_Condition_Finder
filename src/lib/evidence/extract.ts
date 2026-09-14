/**
 * Evidence text classification module.
 *
 * **Browser-only** — must never be imported from app pages, Server Actions,
 * or API routes. This module is part of the evidence-parser boundary
 * (see docs/evidence-parser-boundary.md). It runs entirely in the client
 * within LocalEvidenceAnalyzer and classifies extracted text segments by
 * clinical relevance (nexus-relevant, supporting, diagnosis, etc.).
 */
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
  /\bless likely than not\b/i,
  /\bmore likely (?:due|related) to\b/i,
  /\balternative (?:cause|etiology)\b/i,
];

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function conditionTermPattern(term: string): RegExp | null {
  const normalized = normalizeWhitespace(term);
  if (normalized.length < 3) return null;

  // Allow hyphens/spaces (including unicode dashes and non-breaking spaces) to
  // be flexible between words so common spellings match: "Post-Traumatic" and
  // "posttraumatic" both hit "Post Traumatic Stress Disorder"-style terms, and
  // "REM Sleep Behavior Disorder" matches when a source omits "sleep".
  const tokens = normalized
    .split(/[\s\u00a0\u2009\u2010-\u2015-]+/)
    .map(escapeRegExp)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const separator = String.raw`(?:[\s\u00a0\u2009\u2010-\u2015-]+)?`;
  const phrase = tokens.join(separator);
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function matchingTerms(text: string, terms: string[]): string[] {
  return terms.filter((term) => conditionTermPattern(term)?.test(text) === true);
}

function hasPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyCategory(text: string): EvidenceCategory | null {
  if (hasPattern(text, BOILERPLATE_PATTERNS)) return null;
  if (hasPattern(text, ALTERNATIVE_CAUSE_PATTERNS)) return "alternative-cause";
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
      if (sentence.length < 12 || sentence.length > 1200) continue;
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
