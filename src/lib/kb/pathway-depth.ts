/**
 * The single shared pathway traversal-depth contract.
 *
 * `MAX_PATHWAY_HOPS` bounds every multi-hop CRG surface:
 *
 *   - the adjacency traversal (`src/lib/engine/pathway-generator.ts`), whose
 *     recursion guard refuses to expand a node at the cap;
 *   - the two-edge research-path composer (`src/lib/engine/pathways.ts`),
 *     which may only emit a chain within the cap;
 *   - the composite-nexus reducers (`src/lib/kb/utils.ts`), which fail fast on
 *     an over-depth chain rather than mislabeling it;
 *   - the canonical schema (`ClaimPathwaySchema`'s `hops` bound in
 *     `./schema.ts`).
 *
 * It lives in this dependency-free module — rather than in `./schema.ts` —
 * because `kb/utils.ts` is reachable from client bundles through the engine
 * view-model bridge and must keep its kb imports type-only; importing
 * `./schema` for a value would drag Zod and the full graph schema into the
 * client graph.
 *
 * Lowering the cap here lowers it everywhere. Raising it is a deliberate
 * contract change: the schema bound, the traversal guard, the composer guard,
 * and their tests all consume this value, so no traversal can silently exceed
 * the published depth.
 */
export const MAX_PATHWAY_HOPS = 2;

/**
 * True when a hop chain of `length` edges fits the pathway-depth cap.
 *
 * Zero-length chains are within any non-negative cap; callers that require at
 * least one hop enforce that separately (`deriveCompositeNexus`, for example,
 * rejects empty chains before consulting this predicate).
 */
export function isWithinPathwayDepth(length: number): boolean {
  return length <= MAX_PATHWAY_HOPS;
}

/**
 * Total-output bound per traversal origin (audit A08).
 *
 * `MAX_PATHWAY_HOPS` bounds the DEPTH of one pathway; it does not bound how
 * many pathways one origin can emit, because output grows with the depth-2
 * frontier (out-degree × out-degree). The authored corpus today yields a
 * handful of routes per origin, so the traversal had no independent total cap
 * — a future dense frontier could emit thousands of legally-coherent pathways
 * from one node and hold a browser tab (or a request) open doing it.
 *
 * The cap is deliberately far above any current origin's output: it exists to
 * bound work, not to trim normal results. When it is reached the traversal
 * stops and REPORTS that it was reached (`pathwaysCapped` on the origin view),
 * so a bounded prefix is never presented as the whole graph.
 */
export const MAX_PATHWAYS_PER_ORIGIN = 256;
