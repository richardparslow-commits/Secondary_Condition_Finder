import type { ConditionCatalog } from "@/lib/catalog/schema";
import { secondaryTargetIndex } from "@/lib/kb/lookup";
import type { KnowledgeBase } from "@/lib/kb/schema";
import type { PresumptiveCrossLinkIndex } from "@/lib/presumptive/cross-link";

/**
 * App-layer (display-only) helper for the presumptive × secondary research
 * cue. Lives under src/app/ deliberately: the TRACK-SEPARATION composition
 * rules bind only src/lib/secondary-workflow/ and src/lib/presumptive/, so an
 * app page may read both track libraries. This module imports types from all
 * three and runs no logic of its own beyond building the published index.
 *
 * Since the presumptive results view became browser-local (2026-10-08), the
 * *intersection* runs in the client over this index: the matched presumptive
 * conditions are browser-resident, so sending them back to a server to compute
 * the cue would reintroduce exactly the flow this track removed. The index
 * itself is authored public content — no session state, no selections, nothing
 * user-supplied crosses the boundary, and the rendered cue is a navigation
 * aid, never a determination.
 */

/**
 * Builds the public index the browser-local results view needs: which primary
 * conditions list each condition as a secondary target, plus the catalog
 * display names for the ids the index can reference.
 */
export function buildSecondaryCrossLinkIndex(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
): PresumptiveCrossLinkIndex {
  const namesById: Record<string, string> = {};
  for (const condition of catalog) namesById[condition.id] = condition.name;

  const byTargetConditionId: Record<string, string[]> = {};
  for (const [conditionId, primaryIds] of secondaryTargetIndex(kb)) {
    byTargetConditionId[conditionId] = [...primaryIds];
  }

  return { byTargetConditionId, namesById };
}
