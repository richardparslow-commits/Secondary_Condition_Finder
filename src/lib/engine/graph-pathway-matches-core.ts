import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import type { KbNodeMapping, KnowledgeBase } from "@/lib/kb/schema";

import {
  mappingAnchorResolver,
  projectGraphPathway,
  type HopAnchorResolver,
} from "./graph-pathway-projection";
import { generateClaimPathways } from "./pathway-generator";
import type {
  GraphPathwayAnchorView,
  GraphPathwayMatchSectionView,
  GraphPathwayMatchView,
} from "./pathway-view";

/**
 * Data-in core for the graph adjacency results surface (PRIV-01 stage 2).
 *
 * Identical traversal to `graph-pathway-matches.ts` but with the public
 * catalog, published mappings and graph passed in, so the browser can run it
 * over the client corpus without importing any server loader. The server
 * wrapper loads the same data through `loadConditionCatalog`,
 * `loadKnowledgeBase` and `loadKbGraph` and delegates here, keeping both
 * surfaces on one implementation.
 */
export function buildGraphPathwayMatchSectionViewFromData(
  catalog: ConditionCatalog,
  knowledgeBase: KnowledgeBase,
  graph: ReadonlyMap<string, KbNodeMapping>,
  originConditionIds: readonly string[],
  terminalConditionIds: readonly string[],
  /** Public anchor index keyed `source->target` (client corpus). Without it the
   * builder falls back to the authored-corpus join, matching the server path. */
  anchorIndex?: ReadonlyMap<string, GraphPathwayAnchorView[]>,
): GraphPathwayMatchSectionView {
  const byId = indexById(catalog);
  const mappingById = new Map(
    knowledgeBase.map((mapping) => [mapping.id, mapping]),
  );
  const resolveAnchors: HopAnchorResolver = anchorIndex
    ? (sourceConditionId, targetConditionId) =>
        anchorIndex.get(`${sourceConditionId}->${targetConditionId}`) ?? []
    : mappingAnchorResolver(mappingById);
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
        ...projectGraphPathway(pathway, conditionName, resolveAnchors),
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
