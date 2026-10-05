#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { KB_GRAPH_DIR_RELATIVE } from "../src/lib/kb/graph-layout.ts";
import { conditionMappingSchema, KbNodeMappingSchema } from "../src/lib/kb/schema.ts";

/**
 * CRG graph integrity audit (CI gate).
 *
 * The multi-hop Causal Relational Graph is stored as an adjacency list: one
 * JSON file per condition under data/knowledge-base/graph/ (the layout is
 * owned by src/lib/kb/graph-layout.ts; graph files live outside the authored
 * corpus root so they cannot disturb the one-mapping-per-identity contract).
 * Each file parses into `KbNodeMapping` ({ nodeId, outgoingEdges }). A
 * directional authoring mistake that no single-file validation can see —
 * A → B → C → A — would make the recommendation engine's depth-2 traversal
 * revisit conditions and fabricate a self-reinforcing nexus chain. This
 * script builds the master adjacency list across all files and runs a
 * 3-color DFS to prove the graph is acyclic before CI allows a merge.
 *
 * Exit codes: 0 = acyclic (or an explicitly tolerated empty state),
 * 1 = parse failure, malformed graph, or at least one detected cycle.
 *
 * Usage: node scripts/audit-crg.ts [--kb-dir=<path>]
 * CI runs with the default graph directory; --kb-dir exists so fixture
 * directories can exercise the DFS in tests without touching the real graph.
 */

/** Node color states for the 3-color DFS (see section 2 below). */
type NodeColor = "UNVISITED" | "VISITING" | "VISITED";

/** Concise single-line summary of a Zod parse failure for CI logs. */
function summarizeParseError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) {
    return error.issues
      .map((issue) => `${Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

const KB_DIR = process.argv.find((arg) => arg.startsWith("--kb-dir="))?.split("=")[1] ?? KB_GRAPH_DIR_RELATIVE;

/* ─── 1. Load and parse the adjacency list ────────────────────────────────
 * Every .json file must parse as a KbNodeMapping. Any parse failure or
 * duplicate nodeId is a hard error: an ambiguous adjacency list would make
 * any cycle verdict meaningless.
 * ────────────────────────────────────────────────────────────────────────── */

/** Master adjacency list: nodeId → its distinct outgoing target IDs. */
const graph = new Map<string, string[]>();
// An absent directory is the same transitional state as an empty one: the
// graph has not been migrated (or all files were withdrawn) yet.
const fileNames = existsSync(KB_DIR)
  ? readdirSync(KB_DIR).filter((name) => name.endsWith(".json")).sort()
  : [];

if (fileNames.length === 0) {
  // Tolerated transitional state: no adjacency files exist yet. Fail loudly
  // once migration starts so a broken directory layout can't pass CI.
  console.log(`audit-crg: no .json files found in ${KB_DIR}/ — graph not migrated yet; treating as acyclic.`);
  process.exit(0);
}

const parseFailures: string[] = [];
/** Files whose JSON carries adjacency-file keys but fails the schema. */
const claimedAdjacencyFailures: string[] = [];
/** Files whose JSON does not parse at all — corruption, never a migration state. */
const corruptJsonFailures: string[] = [];
/** Valid JSON objects that are neither adjacency files nor authored mappings. */
const unrecognizedFailures: string[] = [];

function looksLikeAdjacencyFile(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const record = raw as Record<string, unknown>;
  return "nodeId" in record || "outgoingEdges" in record;
}

for (const name of fileNames) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(KB_DIR, name), "utf8")) as unknown;
  } catch (error) {
    // A syntax error is corruption, not a migration state. Report it as a
    // parse failure instead of letting the exception escape as a stack trace.
    corruptJsonFailures.push(`${name}: invalid JSON — ${summarizeParseError(error)}`);
    continue;
  }
  let node: import("../src/lib/kb/schema.ts").KbNodeMapping;
  try {
    node = KbNodeMappingSchema.parse(raw); // precise issue paths on malformed data
  } catch (error) {
    parseFailures.push(`${name}: ${summarizeParseError(error)}`);
    if (looksLikeAdjacencyFile(raw)) {
      claimedAdjacencyFailures.push(name);
      continue;
    }
    // Not an adjacency file. It must still parse as a recognized authored
    // condition mapping; an arbitrary/malformed JSON object is corruption, not
    // a legitimate pre-migration file.
    try {
      conditionMappingSchema.parse(raw);
    } catch {
      unrecognizedFailures.push(name);
    }
    continue;
  }
  if (graph.has(node.nodeId)) {
    console.error(`audit-crg: duplicate nodeId "${node.nodeId}" (in ${name}) — adjacency list would be ambiguous.`);
    process.exit(1);
  }
  graph.set(
    node.nodeId,
    [...new Set(node.outgoingEdges.map((edge) => edge.targetConditionId))],
  );
}

// Corrupt JSON always fails, in every migration state.
if (corruptJsonFailures.length > 0) {
  console.error(
    `audit-crg: FAIL — ${corruptJsonFailures.length} file(s) in ${KB_DIR}/ are not valid JSON:`,
  );
  for (const failure of corruptJsonFailures) console.error(`  - ${failure}`);
  process.exit(1);
}

// Self-tightening gate: while the KB still holds only authored (pre-graph)
// mapping files, zero parsed nodes is the expected transitional state and the
// audit is vacuous. The moment the FIRST adjacency file lands, the gate goes
// strict — any file that fails to parse is then a hard CI failure, so a
// half-migrated or corrupted directory can never pass.
//
// A file carrying adjacency keys (nodeId/outgoingEdges) but failing the schema
// is NEVER a legitimate pre-migration state: someone attempted the migration
// and produced invalid data. That fails hard even when nothing else parsed.
if (claimedAdjacencyFailures.length > 0) {
  console.error(
    `audit-crg: FAIL — ${claimedAdjacencyFailures.length} file(s) carry adjacency-file keys but are not valid KbNodeMapping data:`,
  );
  for (const name of claimedAdjacencyFailures) console.error(`  - ${name}`);
  process.exit(1);
}
if (graph.size === 0) {
  if (unrecognizedFailures.length > 0) {
    console.error(
      `audit-crg: FAIL — ${unrecognizedFailures.length} file(s) in ${KB_DIR}/ are neither KbNodeMapping adjacency files nor valid authored condition mappings:`,
    );
    for (const name of unrecognizedFailures) console.error(`  - ${name}`);
    process.exit(1);
  }
  console.warn(
    `audit-crg: VACUOUS PASS — ${fileNames.length} JSON file(s) in ${KB_DIR}/, none are KbNodeMapping adjacency files. ` +
      "Graph not migrated yet; cycle audit is vacuous and passes. This becomes a hard gate with the first adjacency file.",
  );
  process.exit(0);
}
if (parseFailures.length > 0) {
  console.error(`audit-crg: FAIL — ${parseFailures.length} file(s) are not valid KbNodeMapping adjacency files:
`);
  for (const failure of parseFailures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`audit-crg: loaded ${graph.size} nodes from ${graph.size === fileNames.length ? `${fileNames.length} files` : `a subset of ${fileNames.length} files`} without parse failures.`);

/* ─── 2. 3-color DFS cycle detection ──────────────────────────────────────
 * Each node carries one of three colors:
 *   - UNVISITED: not reached yet.
 *   - VISITING:  on the current recursion stack (its subtree is being
 *                explored). The recursion stack IS `path`.
 *   - VISITED:   fully processed and proven cycle-free — never re-entered,
 *                which keeps the whole scan O(V + E).
 * A back-edge to a VISITING node closes a directed cycle. Because `path`
 * mirrors the recursion stack, the loop is exactly the slice of `path` from
 * that node's position to the top, closed by the current edge.
 * ────────────────────────────────────────────────────────────────────────── */

const color = new Map<string, NodeColor>([...graph.keys()].map((id) => [id, "UNVISITED" as const]));
const cycles: string[][] = [];

/** Node IDs on the current recursion stack, in visit order. */
const path: string[] = [];

function dfs(nodeId: string): void {
  color.set(nodeId, "VISITING");
  path.push(nodeId);

  for (const target of graph.get(nodeId) ?? []) {
    const targetColor = color.get(target) ?? "UNVISITED";
    if (targetColor === "VISITING") {
      // Back-edge: the loop runs from target's stack position through the
      // current node, and the current edge closes it.
      const start = path.indexOf(target);
      cycles.push([...path.slice(start), target]);
    } else if (targetColor === "UNVISITED") {
      dfs(target);
    }
    // VISITED: subtree already proven acyclic — skip.
  }

  path.pop();
  color.set(nodeId, "VISITED");
}

// Iterate over sorted roots so cycle reporting is deterministic across runs
// (the same SCC always yields the same rotated representation).
for (const root of [...graph.keys()].sort()) {
  if (color.get(root) === "UNVISITED") dfs(root);
}

/* ─── 3. Report and enforce ──────────────────────────────────────────────── */

if (cycles.length > 0) {
  console.error(`audit-crg: FAIL — ${cycles.length} multi-hop circular ${cycles.length === 1 ? "dependency" : "dependencies"} detected in the CRG:\n`);
  for (const [index, cycle] of cycles.entries()) {
    console.error(`  ${index + 1}. ${cycle.join(" → ")}`);
  }
  console.error(`\naudit-crg: every cycle must be resolved (re-rank, re-parent, or remove an edge) before merge.`);
  process.exit(1);
}

console.log("audit-crg: PASS — CRG adjacency list is acyclic (no multi-hop circular dependencies).");
