import type {
  EvidenceAnalysis,
  EvidenceCategory,
} from "./extract";

export type GapCoverageStatus = "covered" | "evidence-found" | "uncovered";

export interface GapCoverageResult {
  status: GapCoverageStatus;
  sources: string[];
  requiredCategories: EvidenceCategory[] | null;
}

const CAUSAL_CATEGORIES: EvidenceCategory[] = [
  "causation",
  "aggravation",
  "alternative-cause",
];

function normalizeTerm(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

function excerptMatchesCondition(
  matchedTerms: string[],
  conditionTerms: string[],
): boolean {
  if (conditionTerms.length === 0) return false;
  const candidates = conditionTerms.map(normalizeTerm);
  return matchedTerms.some((term) => {
    const normalized = normalizeTerm(term);
    return normalized.length > 0 && candidates.includes(normalized);
  });
}

/**
 * Maps an authored evidence-gap sentence to the excerpt categories whose
 * presence would count as partial coverage. Returns null when the gap wording
 * does not map to a specific category (any matched supporting excerpt then
 * counts as weak "evidence found").
 */
export function requiredCategoriesForGap(gap: string): EvidenceCategory[] | null {
  const lower = gap.toLocaleLowerCase();
  if (/(?:nexus|medical opinion|caus(?:al|ation)|aggravat|secondary to|etiolog|contribution|proximate|as likely as not|link(?:ed|age)?\s|directly related)/.test(lower)) {
    return CAUSAL_CATEGORIES;
  }
  if (/diagnos|confirmed|impression|documented (?:as )?a/.test(lower)) {
    return ["diagnosis"];
  }
  if (/medicat|prescri|pharmaco/.test(lower)) {
    return ["medication"];
  }
  if (/treat(?:ment|ed)?|therap|management|cpap|surg/.test(lower)) {
    return ["treatment"];
  }
  if (/timeline|onset|chronolog|progression|when (?:it |did )?(?:began|started|begin|start)|first (?:began|started|begin|start)|began (?:in|after|at)|service treatment/.test(lower)) {
    return ["timeline"];
  }
  if (/alternative|rule out|other (?:cause|etiology)|not (?:due|caused)/.test(lower)) {
    return ["alternative-cause"];
  }
  return null;
}

function excerptCategoryCovered(
  category: EvidenceCategory,
  strength: string,
  clinicianAuthored: boolean,
  required: EvidenceCategory[],
): { covered: boolean; partial: boolean } {
  if (required === CAUSAL_CATEGORIES) {
    const causal = CAUSAL_CATEGORIES.includes(category);
    if (causal && strength === "nexus-relevant" && clinicianAuthored) {
      return { covered: true, partial: false };
    }
    return { covered: false, partial: causal };
  }
  if (required.includes(category)) {
    return { covered: true, partial: false };
  }
  return { covered: false, partial: false };
}

/**
 * Assesses whether the browser-local excerpts stored for the current review
 * already speak to a given authored evidence gap. This is a research cue only:
 * coverage means an excerpt in the relevant category mentions the condition,
 * not that the gap is legally satisfied. CAUSAL_CATEGORIES is compared by
 * identity intentionally so diagnosis-style gaps cannot reuse the causal
 * requirement branch.
 */
export function assessGapCoverage(
  gap: string,
  analyses: EvidenceAnalysis[],
  conditionTerms: string[],
): GapCoverageResult {
  const required = requiredCategoriesForGap(gap);
  const sources: string[] = [];
  let covered = false;
  let partial = false;

  for (const analysis of analyses) {
    for (const excerpt of analysis.excerpts) {
      if (!excerptMatchesCondition(excerpt.matchedTerms, conditionTerms)) continue;
      if (required === null) {
        // No mapped category: any matched supporting excerpt is weak evidence.
        sources.push(analysis.sourceName);
        partial = true;
        continue;
      }
      const result = excerptCategoryCovered(
        excerpt.category,
        excerpt.strength,
        excerpt.clinicianAuthored,
        required,
      );
      if (result.covered) {
        covered = true;
        sources.push(analysis.sourceName);
      } else if (result.partial && !covered) {
        partial = true;
        sources.push(analysis.sourceName);
      }
    }
  }

  const uniqueSources = [...new Set(sources)];
  return {
    status: covered ? "covered" : partial ? "evidence-found" : "uncovered",
    sources: uniqueSources,
    requiredCategories: required,
  };
}
