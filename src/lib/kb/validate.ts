import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import { FORBIDDEN_PHRASES } from "@/lib/guardrails";

import type { KnowledgeBase } from "./schema";

/**
 * Fails fast when mappings drift from the catalog.
 *
 * Tests enforce the same invariant, but this guards every runtime path that
 * loads the knowledge base.
 */
export function validateKnowledgeBaseAgainstCatalog(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
): void {
  const byId = indexById(catalog);

  for (const mapping of kb) {
    if (!byId.has(mapping.id)) {
      throw new Error(
        `Mapping "${mapping.id}" has no matching condition in data/conditions.`,
      );
    }

    for (const suggestion of mapping.suggestions) {
      if (!byId.has(suggestion.conditionId)) {
        throw new Error(
          `Mapping "${mapping.id}" suggests unknown condition "${suggestion.conditionId}".`,
        );
      }
    }
  }
}

/**
 * Fail-closed copy guardrail: authored knowledge-base text must never contain
 * diagnostic or guarantee phrasing (e.g., "guaranteed VA rating"). Tests
 * enforce the same invariant over rendered pages; this guards the authored
 * data itself on every runtime path that loads the knowledge base.
 */
export function assertNoForbiddenPhrases(kb: KnowledgeBase): void {
  const violations: string[] = [];

  for (const mapping of kb) {
    for (const suggestion of mapping.suggestions) {
      const fields: Array<[string, string]> = [
        ["rationale", suggestion.rationale],
        ["evidenceGaps", suggestion.evidenceGaps.join(" ")],
      ];
      for (const phrase of FORBIDDEN_PHRASES) {
        const lower = phrase.toLowerCase();
        for (const [field, text] of fields) {
          if (text.toLowerCase().includes(lower)) {
            violations.push(
              `${mapping.id} -> ${suggestion.conditionId}: ${field} contains forbidden phrase "${phrase}".`,
            );
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Forbidden legal/medical phrasing in knowledge base:\n${violations.join("\n")}`,
    );
  }
}
