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
