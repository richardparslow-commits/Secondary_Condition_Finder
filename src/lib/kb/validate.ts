import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";

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
