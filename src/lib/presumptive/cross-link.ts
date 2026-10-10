import type { PresumptiveCondition } from "./schema";

/**
 * Public published-mapping index for the display-only presumptive × secondary
 * research cue, plus the pure intersection that consumes it.
 *
 * The server shell builds the index from the published knowledge base and hands
 * it to the browser-local results view, where the intersection runs (the
 * matched presumptive conditions are browser-resident). Both sides share this
 * module: it imports no knowledge-base code, so a `"use client"` file may
 * import it without pulling `@/lib/kb` into the browser bundle. The data is
 * authored public content — identical for every visitor, derived from no
 * selections — so passing it to the client transfers no veteran context.
 */
export interface PresumptiveCrossLinkIndex {
  /** Presumptive condition id → ids of primary conditions that list it as a secondary target. */
  byTargetConditionId: Record<string, string[]>;
  /** Catalog id → display name, for every id the index can reference. */
  namesById: Record<string, string>;
}

export interface PresumptiveCrossLink {
  /** Catalog display name of the presumptive condition. */
  name: string;
  /** Catalog display names for the primaries that list it, in index order. */
  primaryNames: string[];
}

/**
 * Intersects matched presumptive conditions with the published index. Unknown
 * catalog ids degrade to the raw id rather than throwing — a display aid must
 * never break the results page.
 */
export function buildPresumptiveCrossLinks(
  conditions: PresumptiveCondition[],
  index: PresumptiveCrossLinkIndex,
): PresumptiveCrossLink[] {
  const links: PresumptiveCrossLink[] = [];
  const seen = new Set<string>();

  for (const condition of conditions) {
    const primaryIds = index.byTargetConditionId[condition.conditionId];
    if (!primaryIds || primaryIds.length === 0) continue;
    if (seen.has(condition.conditionId)) continue;
    seen.add(condition.conditionId);

    links.push({
      name: index.namesById[condition.conditionId] ?? condition.conditionId,
      primaryNames: primaryIds.map((id) => index.namesById[id] ?? id),
    });
  }

  return links;
}
