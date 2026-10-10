import "server-only";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKbGraph } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";

import { buildGraphPathwayMatchSectionViewFromData } from "./graph-pathway-matches-core";
import type { GraphPathwayMatchSectionView } from "./pathway-view";

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
  return buildGraphPathwayMatchSectionViewFromData(
    loadConditionCatalog(),
    loadKnowledgeBase(),
    loadKbGraph(),
    originConditionIds,
    terminalConditionIds,
  );
}
