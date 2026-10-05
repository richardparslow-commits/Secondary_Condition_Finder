import "server-only";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import { loadKbGraph } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";

import { projectGraphPathway } from "./graph-pathway-projection";
import { generateClaimPathways } from "./pathway-generator";
import type {
  GraphPathwayMatchSectionView,
  GraphPathwayMatchView,
} from "./pathway-view";

/**
 * Results-UI entry point for the graph adjacency layer: the subset of the
 * validated multi-hop traversal that connects the conditions a Step 5 review
 * actually selected.
 *
 * The Step 5 recommendation results rest on the authored corpus's PUBLISHED
 * mappings only (`publishedMappings` in the engine), while the adjacency graph
 * additionally carries the signed design's draft-authored edges. This builder
 * is the sanctioned read of that layer for the results page: it renders the
 * same `loadKbGraph` → `generateClaimPathways` traversal as the `/pathways`
 * explorer, filtered to `origin ∈ service-connected selections` and
 * `terminal ∈ diagnosed non-service-connected selections`, with every
 * projection (display names, legal nexus, citation anchors) delegated to the
 * shared `graph-pathway-projection` module so the two surfaces can never
 * disagree about what a chain says or whether it is broken.
 *
 * It authors nothing, verifies nothing, changes no authored record, and
 * performs no traversal beyond the validated graph. Unknown origin IDs simply
 * yield no pathways — an empty match list is not a finding, and the surface
 * component decides how to frame it.
 *
 * @param originConditionIds - Catalog IDs of the review's service-connected
 *   conditions (the traversal starts here).
 * @param terminalConditionIds - Catalog IDs of the review's diagnosed
 *   non-service-connected conditions (the claimed conditions). Pathways that
 *   end anywhere else are dropped.
 * @returns Every lawful pathway from a selected origin to a selected
 *   terminal, in deterministic order, plus anchor totals.
 */
export function buildGraphPathwayMatchSectionView(
  originConditionIds: readonly string[],
  terminalConditionIds: readonly string[],
): GraphPathwayMatchSectionView {
  const graph = loadKbGraph();
  const byId = indexById(loadConditionCatalog());
  const mappingById = new Map(
    loadKnowledgeBase().map((mapping) => [mapping.id, mapping]),
  );
  const conditionName = (conditionId: string): string =>
    byId.get(conditionId)?.name ?? conditionId;

  const terminalSet = new Set(terminalConditionIds);
  const matches: GraphPathwayMatchView[] = [];

  for (const originConditionId of [...new Set(originConditionIds)].sort()) {
    for (const pathway of generateClaimPathways(originConditionId, graph)) {
      if (!terminalSet.has(pathway.terminalConditionId)) continue;
      matches.push({
        originConditionId,
        originConditionName: conditionName(originConditionId),
        ...projectGraphPathway(pathway, conditionName, mappingById),
      });
    }
  }

  matches.sort(
    (left, right) =>
      left.originConditionId.localeCompare(right.originConditionId) ||
      left.terminalConditionId.localeCompare(right.terminalConditionId) ||
      left.hops.length - right.hops.length,
  );

  const allAnchors = matches
    .flatMap((match) => match.hops)
    .flatMap((hop) => hop.anchors);

  return {
    matches,
    totalAnchors: allAnchors.length,
    unverifiedAnchors: allAnchors.filter((anchor) => !anchor.verified).length,
  };
}
