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

/**
 * Reviewed-disposition ledger for the graph's non-causation cycles and
 * bidirectional pairs (audit A08) — the record that lets a legitimate review
 * shape land instead of being deleted to satisfy a blanket DAG check.
 *
 * It is deliberately NOT `data/knowledge-base/graph/*.json` (the loader and the
 * CI gate parse every `.json` there as a `KbNodeMapping`, so a ledger in that
 * directory would be read as graph data) and NOT `data/knowledge-base/*.json`
 * (the identity layer's one-file-per-catalog-identity contract, enforced by
 * `kb:validate` and the authoring tracker, counts every `.json` there as a
 * mapping). It sits with the repository's other machine-read ledgers
 * (`docs/mapping-coverage-ledger.json`) and next to the policy it records in
 * `docs/crg-adjacency-migration-checklist.md`.
 */
export const KB_GRAPH_GOVERNANCE_RELATIVE = "docs/crg-adjacency-governance-ledger.json";
