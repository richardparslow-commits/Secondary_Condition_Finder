import "server-only";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import { loadKbGraph } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";

import { projectGraphPathway } from "./graph-pathway-projection";
import { generateClaimPathways } from "./pathway-generator";
import type {
  GraphPathwayExplorerView,
  GraphPathwayOriginView,
  GraphPathwayView,
} from "./pathway-view";

/**
 * Read-only projection of the whole adjacency graph for the pathway explorer
 * surface (`src/app/pathways/page.tsx`) — the graph's first user-facing
 * consumer.
 *
 * The explorer renders the SAME validated traversal the engine uses
 * (`loadKbGraph` → `generateClaimPathways`), resolved to catalog display
 * names. It authors nothing, computes no new relationship, and never
 * recomputes a composite nexus: the derived value travels unchanged so the
 * surface can mark an association-only chain legally broken rather than
 * present a hypothesized link as an established nexus.
 *
 * Association-only pathways are included deliberately — the traversal yields
 * them for transparency, exactly as the engine documents — and nodes with
 * zero outgoing edges are included too, so their empty state renders
 * explicitly instead of vanishing (an absent route is not a finding).
 *
 * Citation anchors are a read-only join: for each hop the authored mapping of
 * the hop's source condition supplies the suggestion targeting the hop's
 * target condition, and its `sourceReferences` travel to the surface with
 * their authored `verified` flags so reviewers can triage unverified evidence
 * from the page itself. The join authors nothing, verifies nothing, and
 * changes no authored record.
 *
 * @returns Every adjacency node in sorted order with its pathways, plus the
 *   totals the surface uses to frame the view honestly.
 */
export function buildPathwayExplorerView(): GraphPathwayExplorerView {
  const graph = loadKbGraph();
  const byId = indexById(loadConditionCatalog());
  const mappingById = new Map(
    loadKnowledgeBase().map((mapping) => [mapping.id, mapping]),
  );
  const conditionName = (conditionId: string): string =>
    byId.get(conditionId)?.name ?? conditionId;

  const origins: GraphPathwayOriginView[] = [...graph.keys()]
    .sort()
    .map((originConditionId) => {
      const pathways: GraphPathwayView[] = generateClaimPathways(
        originConditionId,
        graph,
      ).map((pathway) => projectGraphPathway(pathway, conditionName, mappingById));

      return {
        originConditionId,
        originConditionName: conditionName(originConditionId),
        pathways,
      };
    });

  const allPathways = origins.flatMap((origin) => origin.pathways);
  const allAnchors = allPathways.flatMap((pathway) => pathway.hops).flatMap(
    (hop) => hop.anchors,
  );

  return {
    origins,
    totalPathways: allPathways.length,
    chainBrokenPathways: allPathways.filter(
      (pathway) => pathway.compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN",
    ).length,
    totalAnchors: allAnchors.length,
    unverifiedAnchors: allAnchors.filter((anchor) => !anchor.verified).length,
  };
}
