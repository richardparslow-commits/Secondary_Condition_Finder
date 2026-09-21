import type { CatalogCondition } from "@/lib/catalog/schema";

function normalizeTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the exact-match regex for a condition term as it is matched inside
 * the evidence classifier. Token separators flex across spaces, unicode
 * dashes, and non-breaking spaces so common spellings match ("Post-Traumatic"
 * and "posttraumatic" both hit "Post Traumatic Stress Disorder"-style terms).
 *
 * The floor is two characters — down from the classifier's historical three —
 * which is what allows guarded clinical acronyms (MI, PE, RA, OA, MS) to match
 * at all. Callers must pair two-character terms with their context guard
 * (see conditionTermGuardFor); an unguarded two-letter pattern would match
 * arbitrary chart scaffolding. Returns null for empty terms.
 */
export function conditionTermPatternFor(term: string): RegExp | null {
  const normalized = normalizeTerm(term);
  if (normalized.length < 2) return null;

  const tokens = normalized
    .split(/[\s\u00a0\u2009\u2010-\u2015-]+/)
    .map(escapeRegExp)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const separator = String.raw`(?:[\s\u00a0\u2009\u2010-\u2015-]+)?`;
  const phrase = tokens.join(separator);
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

/**
 * Context guards for polysemous short aliases.
 *
 * Two-letter clinical acronyms are the highest-value shorthand in VA records
 * ("s/p MI", "RA with joint erosion") but also the most dangerous to match
 * bare, because the same letters are standard chart punctuation for other
 * things entirely: "PE:" heads physical-exam lines, "MS" is morphine sulfate
 * on medication lists, "r/o MI" rules a myocardial infarction OUT. A bare
 * acronym match therefore fabricates evidence matches from chart scaffolding.
 *
 * Each guard requires the sentence to carry at least one clinical co-occurring
 * signal (a longer name, a test, a treatment, a finding) before the acronym
 * may count as a condition match. Three-plus-character acronyms (OSA, PTSD,
 * GERD, TBI) are unambiguous enough to stay unguarded.
 */
const CONDITION_TERM_GUARDS: Record<string, RegExp> = {
  ms: /\b(?:multiple\s+sclerosis|relapsing[- ]remitting|primary\s+progressive|demyelinat(?:ing|ion)|mri|neurologist)\b/i,
  pe: /\b(?:pulmonary\s+(?:embol(?:ism|us)|thromboembol\w*)|ct\s+(?:pulmonary\s+)?angiog(?:ram|raphy)|d[- ]?dimer|v\/q\s+scan|thromboembol\w*|anticoagul\w*|embolus|deep[- ]vein\s+thrombosis)\b/i,
  mi: /\b(?:myocardial\s+infarction|heart\s+attack|st[- ]?elevation|st\s+segment\s+elevation|troponin|cath\s+lab|angioplasty|infarct(?:ion)?)\b/i,
  cad: /\b(?:coronary\s+artery|ischemic\s+heart|myocardial\s+infarction|heart\s+attack|angioplasty|stent|cardiac\s+cath)\b/i,
  ra: /\b(?:rheumatoid\s+arthritis|rheumatoid\s+factor|\bra\s+factor\b|anti[- ]?ccp|methotrexate|hydroxychloroquine|sulfasalazine|etanercept|adalimumab|joint\s+(?:erosion|destruction))\b/i,
  oa: /\b(?:osteoarthritis|degenerative\s+(?:arthritis|joint\s+disease)|joint\s+space\s+narrowing|osteophyt\w*|cartilage\s+(?:loss|wear)|djd)\b/i,
};

/**
 * Returns the match-time context guard for a condition term, or null for
 * terms that need no guard (three-plus characters, or non-polysemous short
 * forms). Lookup is by exact lowercase key so "PE" and "pe" share a guard.
 */
export function conditionTermGuardFor(term: string): RegExp | null {
  return CONDITION_TERM_GUARDS[normalizeTerm(term).toLocaleLowerCase()] ?? null;
}

/**
 * Builds the exact condition terms the browser-local evidence classifier may
 * match. Catalog aliases are identity/search metadata only; including them here
 * does not establish a medical relationship or change recommendation logic.
 *
 * Two-character terms are admitted only when a context guard exists for them
 * (see CONDITION_TERM_GUARDS); everything shorter is chart noise, and an
 * unguarded two-letter acronym would match arbitrary chart text. The guard is
 * additionally enforced at match time by the classifier, so a term can never
 * slip through an unguarded call path.
 */
export function buildEvidenceConditionTerms(
  conditions: readonly CatalogCondition[],
): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const condition of conditions) {
    for (const candidate of [condition.name, ...condition.aliases]) {
      const term = normalizeTerm(candidate);
      if (term.length < 2) continue;
      if (term.length < 3 && !conditionTermGuardFor(term)) continue;

      const key = term.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push(term);
    }
  }

  return terms;
}
