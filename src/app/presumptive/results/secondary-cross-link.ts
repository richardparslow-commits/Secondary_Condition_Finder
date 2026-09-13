import type { ConditionCatalog } from "@/lib/catalog/schema";
import { secondaryTargetIndex } from "@/lib/kb/lookup";
import type { KnowledgeBase } from "@/lib/kb/schema";
import type { PresumptiveCondition } from "@/lib/presumptive/schema";

/**
 * App-layer (display-only) helper for the presumptive × secondary research
 * cue. Lives under src/app/ deliberately: the TRACK-SEPARATION composition
 * rules bind only src/lib/secondary-workflow/ and src/lib/presumptive/, so
 * an app page may read both track libraries. This module imports types from
 * all three and runs no logic of its own beyond set intersection.
 *
 * Privacy posture matches the rest of the results page: condition ids and
 * catalog display names only — no session state, no selections, nothing
 * user-supplied is transferred between tracks. The rendered cue is a
 * navigation aid, never a determination.
 */

export interface SecondaryCrossLink {
  /** Catalog display name of the presumptive condition. */
  name: string;
  /** Sorted published primary-condition ids that list this condition as a secondary target. */
  primaryIds: string[];
  /** Catalog display names for those primaries, same order. */
  primaryNames: string[];
}

/**
 * Intersects matched presumptive conditions with the KB secondary-target
 * index. Unknown catalog ids degrade to the raw id rather than throwing —
 * a display aid must never break the results page.
 */
export function buildSecondaryCrossLinks(
  conditions: PresumptiveCondition[],
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
): SecondaryCrossLink[] {
  const secondaryTargets = secondaryTargetIndex(kb);

  const nameById = new Map(catalog.map((condition) => [condition.id, condition.name]));

  const links: SecondaryCrossLink[] = [];
  const seen = new Set<string>();
  for (const condition of conditions) {
    const primaryIds = secondaryTargets.get(condition.conditionId);
    if (!primaryIds || primaryIds.length === 0) continue;
    if (seen.has(condition.conditionId)) continue;
    seen.add(condition.conditionId);
    links.push({
      name: nameById.get(condition.conditionId) ?? condition.conditionId,
      primaryIds,
      primaryNames: primaryIds.map((id) => nameById.get(id) ?? id),
    });
  }
  return links;
}
