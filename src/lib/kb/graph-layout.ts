/**
 * Shared on-disk layout for the CRG adjacency graph.
 *
 * The multi-hop graph is stored as `KbNodeMapping` JSON files (one per root
 * condition) under `data/knowledge-base/graph/` — deliberately NOT in the
 * authored corpus root, because `data/knowledge-base/*.json` is the identity
 * layer with a frozen contract: exactly one `ConditionMapping` file per
 * catalog identity (819/819), pinned by the authoring/tracker scripts and a
 * dozen test files. Mixing adjacency files into that directory would corrupt
 * the identity count contract and force a coordinated pin migration for an
 * artifact that is not an identity.
 *
 * This module is dependency-free on purpose: `scripts/audit-crg.ts` runs
 * under Node's type stripping (where `server-only` imports throw), so the
 * script and the server-side loader must share the path through a module with
 * no runtime dependencies. The human-readable ledger of this layout decision
 * is `docs/crg-adjacency-migration-checklist.md`.
 */
export const KB_GRAPH_DIR_RELATIVE = "data/knowledge-base/graph";
