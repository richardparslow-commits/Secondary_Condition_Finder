import {
  ClaimPathwaySchema,
  type ClaimPathway,
  type KbNodeMapping,
  type PathwayHop,
} from "@/lib/kb/schema";
import { deriveCompositeNexus } from "@/lib/kb/utils";

/**
 * Graph traversal engine — multi-hop claim-pathway generation.
 *
 * Walks the CRG adjacency list (see `@/lib/kb/schema`) outward from a
 * service-connected origin condition and emits every legally coherent
 * `ClaimPathway` reachable within two hops: the classic one-hop secondary
 * claim (Primary → Secondary) and the tertiary claim (Primary → Secondary →
 * Tertiary). Each emitted pathway carries a `compositeNexus` derived by
 * `deriveCompositeNexus` (VA proximate-cause logic: the chain is only as
 * strong as its weakest recognized link).
 *
 * ## Cycle detection
 *
 * `branchNodes` is a set of the condition IDs on the CURRENT path from the
 * origin (the recursion stack), not a global visited set. A global set would
 * wrongly suppress convergent pathways — e.g. A→B→D and A→C→D are distinct
 * legal claims and must both be emitted. Because the set mirrors the active
 * branch, an edge back into any ancestor (A aggravates B, B aggravates A) or
 * a self-edge is skipped before a hop is constructed, so a cyclic graph can
 * never loop: the branch set grows by at most one node per recursion level
 * and every ancestor is already in it. The set is maintained by strict
 * add-before-descend / delete-after-ascend pairing, so backtracking restores
 * exactly the caller's branch state.
 *
 * ## Recursion-depth limits
 *
 * Recursion is bounded structurally, not by a counter alone: `visit` refuses
 * to expand a node once `hops.length >= MAX_PATHWAY_HOPS` (2), so the call
 * stack depth is at most MAX_PATHWAY_HOPS + 1 frames. Combined with the
 * branch set, the traversal visits at most (out-degree of origin) ×
 * (out-degree of each mid-node) edges — linear in the depth-2 frontier, never
 * the whole graph.
 *
 * ## Chain breaking
 *
 * When `deriveCompositeNexus` reports `ASSOCIATION_ONLY_CHAIN_BROKEN`, the
 * pathway is still yielded (UI transparency: a veteran deserves to see the
 * association-strength lead), but the walk does not descend past it — an
 * association-only link cannot carry a downstream tertiary nexus, so any
 * continuation would be legally meaningless.
 *
 * ## Integrity gate
 *
 * Every constructed pathway is validated through `ClaimPathwaySchema` before
 * being emitted. This anchors the endpoints, hop contiguity, and
 * `compositeNexus` equivalence against the schema invariants, and fail-louds
 * on corrupt graph data (e.g. an unvalidated Map whose edges disagree with
 * their node file) rather than silently emitting a legally misrepresenting
 * pathway. Callers should pass a graph already parsed through
 * `KbNodeMappingSchema`; the per-pathway parse is then a cheap final gate.
 */

/** Hard cap on pathway depth (Primary → Secondary → Tertiary). */
export const MAX_PATHWAY_HOPS = 2;

/**
 * Generate every depth-1 and depth-2 claim pathway departing from
 * `originConditionId`.
 *
 * The traversal is depth-first, following each node's outgoing edges in
 * ascending `rank` order (authored priority, independent of array order).
 * Output is deterministic for a given graph.
 *
 * @param originConditionId - Catalog ID of the service-connected origin
 *   condition. Unknown origins yield an empty array (no outgoing mapping).
 * @param graph - Adjacency list keyed by catalog condition ID. Nodes should
 *   be validated `KbNodeMapping` files; edges departing a node must declare
 *   that node as their `sourceConditionId`.
 * @returns Every pathway of 1–2 hops, each with its derived
 *   `compositeNexus`. Pathways whose chain is broken by an association-only
 *   hop are included for transparency but are never extended.
 */
export function generateClaimPathways(originConditionId: string, graph: Map<string, KbNodeMapping>): ClaimPathway[] {
  const origin = graph.get(originConditionId);
  if (!origin) return [];

  const pathways: ClaimPathway[] = [];

  /** Condition IDs on the current origin→here path (see cycle detection). */
  const branchNodes = new Set<string>([originConditionId]);

  /** Hops accumulated on the current branch; `hops.length` IS the depth. */
  const hops: PathwayHop[] = [];

  const visit = (conditionId: string): void => {
    // Recursion-depth limit: refuse to expand beyond the two-hop cap. This
    // is the only place recursion is entered, so stack depth is bounded by
    // MAX_PATHWAY_HOPS + 1 regardless of graph shape.
    if (hops.length >= MAX_PATHWAY_HOPS) return;

    const node = graph.get(conditionId);
    if (!node) return;

    const outgoing = [...node.outgoingEdges].sort((a, b) => a.rank - b.rank);
    for (const edge of outgoing) {
      const target = edge.targetConditionId;

      // Cycle guard: an ancestor (including the origin) is already on this
      // branch; descending would build a loop, so the edge is skipped.
      if (branchNodes.has(target)) continue;

      hops.push({ stepIndex: hops.length, edge });
      const compositeNexus = deriveCompositeNexus(hops);

      pathways.push(
        ClaimPathwaySchema.parse({
          originConditionId,
          terminalConditionId: target,
          hops: [...hops],
          compositeNexus,
        }),
      );

      if (compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN") {
        // Chain broken: the pathway above is yielded for transparency, but
        // an association-only link cannot support a downstream tertiary
        // claim, so the walk stops descending here.
        hops.pop();
        continue;
      }

      branchNodes.add(target);
      visit(target);
      branchNodes.delete(target);
      hops.pop();
    }
  };

  visit(originConditionId);

  return pathways;
}
