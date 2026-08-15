import type { CatalogCondition } from "@/lib/catalog/schema";

function normalizeTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Builds the exact condition terms the browser-local evidence classifier may
 * match. Catalog aliases are identity/search metadata only; including them here
 * does not establish a medical relationship or change recommendation logic.
 */
export function buildEvidenceConditionTerms(
  conditions: readonly CatalogCondition[],
): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const condition of conditions) {
    for (const candidate of [condition.name, ...condition.aliases]) {
      const term = normalizeTerm(candidate);
      if (term.length < 3) continue;

      const key = term.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push(term);
    }
  }

  return terms;
}
