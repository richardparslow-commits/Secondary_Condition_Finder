import "server-only";

import { loadKbGraph } from "@/lib/kb/graph";
import type { ClaimPathway } from "@/lib/kb/schema";

import { generateClaimPathways } from "./pathway-generator";

/**
 * Graph-backed pathway entry point: the product-side data path for the
 * multi-hop CRG traversal.
 *
 * `loadKbGraph()` parses and validates every adjacency file (schema, filename
 * identity, duplicate nodeIds, catalog membership) and fails loud on invalid
 * data; `generateClaimPathways` then walks the validated graph with its
 * branch-set cycle guard and shared `MAX_PATHWAY_HOPS` cap. Both layers have
 * their own contract tests, and `tests/kb-graph-loader.test.ts` pins the
 * end-to-end path from a real on-disk node file to emitted pathways.
 *
 * Migration status: the graph carries its first real authored edge
 * (`liver-cancer` → `sarcopenia` at ASSOCIATION_ONLY, 2026-10-03) and its first
 * user-facing surface is the read-only `/pathways` explorer
 * (`./pathway-explorer.ts`, 2026-10-04); origins without an adjacency node still
 * yield an empty array. Surfaces that render graph pathways must treat this
 * entry point as additive, must not present empty output as a finding, and must
 * carry the association-only chain-break semantics rather than render the
 * pathway as an established nexus.
 *
 * @param originConditionId - Catalog ID of the service-connected origin.
 * @returns Every lawful 1–`MAX_PATHWAY_HOPS` pathway, or `[]` when the origin
 *   has no adjacency node or no outgoing edges.
 */
export function generateCatalogClaimPathways(originConditionId: string): ClaimPathway[] {
  return generateClaimPathways(originConditionId, loadKbGraph());
}
