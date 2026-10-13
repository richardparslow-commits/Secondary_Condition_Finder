import { MAX_PATHWAY_HOPS, MAX_PATHWAYS_PER_ORIGIN } from "@/lib/kb/pathway-depth";
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
 * to expand a node once `hops.length >= MAX_PATHWAY_HOPS` (the shared cap in
 * `@/lib/kb/pathway-depth`), so the call stack depth is at most
 * MAX_PATHWAY_HOPS + 1 frames. Combined with the branch set, the traversal
 * visits at most (out-degree of origin) × (out-degree of each mid-node)
 * edges — linear in the depth-2 frontier, never the whole graph.
 *
 * ## Total-output bound
 *
 * Depth is not output: a dense frontier makes one origin's output grow with
 * its depth-2 neighbourhood, so the traversal also stops at
 * `MAX_PATHWAYS_PER_ORIGIN` (audit A08) and reports that it stopped
 * (`generateClaimPathwaysBounded().capped`). The bound exists so a future
 * dense graph cannot hold a tab or a request open emitting pathways; the
 * reporting exists so a bounded prefix is never rendered as the whole graph.
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
 *
 * ## Wiring status
 *
 * Consumed through `src/lib/engine/graph-pathways.ts`, which loads the
 * validated adjacency graph (`src/lib/kb/graph.ts`, files under
 * `data/knowledge-base/graph/`) and runs this traversal. The graph now carries
 * its first real authored edge (`liver-cancer` → `sarcopenia`, 2026-10-03) and
 * its first user-facing surface is the read-only `/pathways` explorer
 * (`src/lib/engine/pathway-explorer.ts`, 2026-10-04), which carries the
 * association-only chain-break semantics; health reports the validated graph
 * counts, and the CI gate (`scripts/audit-crg.ts`) runs hard over live graph
 * data. See `docs/crg-adjacency-migration-checklist.md` for the per-node
 * acceptance bar and the open edge-migration decisions.
 */

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
export function generateClaimPathways(originConditionId: string, graph: ReadonlyMap<string, KbNodeMapping>): ClaimPathway[] {
  return generateClaimPathwaysBounded(originConditionId, graph).pathways;
}

/**
 * The traversal plus its truncation signal: `capped` is true when the origin's
 * output reached `MAX_PATHWAYS_PER_ORIGIN` and the walk stopped early, so a
 * surface can disclose a bounded prefix instead of presenting it as complete.
 * `generateClaimPathways` is the same traversal without the signal.
 */
export function generateClaimPathwaysBounded(
  originConditionId: string,
  graph: ReadonlyMap<string, KbNodeMapping>,
): { pathways: ClaimPathway[]; capped: boolean } {
  const origin = graph.get(originConditionId);
  if (!origin) return { pathways: [], capped: false };

  const pathways: ClaimPathway[] = [];
  /** Set when the walk stopped at the total-output bound (audit A08). */
  let capped = false;

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
      // Total-output bound: stop before emitting past the cap. `capped` is set
      // only when output actually ran into the bound, so an ordinary graph
      // never reports truncation.
      if (pathways.length >= MAX_PATHWAYS_PER_ORIGIN) {
        capped = true;
        return;
      }
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

  return { pathways, capped };
}
