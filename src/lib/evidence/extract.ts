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
];

const AGGRAVATION_PATTERNS = [
  /\baggravat(?:e|ed|es|ing|ion)\b/i,
  /\bworsen(?:ed|ing|s)?\b/i,
  /\bmade worse\b/i,
  /\bbeyond (?:its |the )?natural progression\b/i,
  /\bincrease(?:d)? in severity\b/i,
];

const DIAGNOSIS_PATTERNS = [
  /\bdiagnos(?:is|ed|es)\b/i,
  /\bassessment\b/i,
  /\bimpression\b/i,
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitIntoQuotedUnits(text: string): Array<{ line: number; text: string }> {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const units: Array<{ line: number; text: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) continue;

    const sentences = line
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(normalizeWhitespace)
      .filter(Boolean);

    if (sentences.length === 0) units.push({ line: index + 1, text: line });
    else sentences.forEach((sentence) => units.push({ line: index + 1, text: sentence }));
  }

  return units;
}

function matchingTerms(text: string, terms: string[]): string[] {
  const lowered = text.toLocaleLowerCase();
  return terms.filter((term) => {
    const normalized = normalizeWhitespace(term).toLocaleLowerCase();
    return normalized.length >= 3 && lowered.includes(normalized);
  });
}

function hasPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyCategory(text: string): EvidenceCategory | null {
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

  for (const unit of splitIntoQuotedUnits(text)) {
    if (unit.text.length < 12 || unit.text.length > 1200) continue;
    const category = classifyCategory(unit.text);
    if (!category) continue;

    const matched = matchingTerms(unit.text, conditionTerms);
    const nexusRelevant = isNexusCategory(category) && clinicianAuthored && matched.length > 0;

    // For nexus excerpts, require a clinician-authored source and at least one
    // selected-condition term. Other clinical statements may still be useful
    // as supporting evidence but are never labeled nexus evidence by this tool.
    const strength: EvidenceStrength = nexusRelevant ? "nexus-relevant" : "supporting";
    const key = `${category}:${unit.text.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    excerpts.push({
      sourceName: metadata.sourceName,
      locator: `${metadata.locatorPrefix ? `${metadata.locatorPrefix}, ` : ""}line ${unit.line}`,
      quote: unit.text,
      category,
      strength,
      clinicianAuthored,
      matchedTerms: matched,
    });
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
