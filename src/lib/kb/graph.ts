import "server-only";

import fs from "node:fs";
import path from "node:path";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";

import { loadKnowledgeBase } from "./load";
import { KbNodeMappingSchema, type KbNodeMapping, type KnowledgeBase } from "./schema";
import { assertGraphEvidenceJoins } from "./graph-evidence-joins.mts";
import { assertNoQuarantinedPointerGraphNodes } from "./validate";

/**
 * Validated adjacency-graph loader — the runtime data path for the multi-hop
 * CRG traversal (`src/lib/engine/graph-pathways.ts`).
 *
 * Reads every `KbNodeMapping` file under `data/knowledge-base/graph/`
 * (see `./graph-layout` for why the graph lives in its own directory) and
 * fails loud on anything that would make a cycle verdict or a traversal
 * unsound:
 *
 *   - invalid JSON or a schema-invalid node mapping;
 *   - a file whose name does not equal its `nodeId`;
 *   - the same `nodeId` defined by two files;
 *   - a `nodeId` or edge `targetConditionId` that does not exist in the
 *     condition catalog;
 *   - a `nodeId` or edge target that is a quarantined pointer identity
 *     (canonical-identity reconciliation), so a multi-hop claim can never be
 *     filed under a record that exists only to preserve a retired ID;
 *   - an edge without an authored suggestion/citations or with a different
 *     nexus classification from that suggestion (ARCH-01).
 *
 * Failure messages are fixed and content-free: do not serialize authored data,
 * parser diagnostics, or identifiers into thrown errors or health responses.
 *
 * An absent or empty graph directory is a valid state — it yields an empty
 * map (the pre-migration default), not an error. Acyclicness is enforced
 * separately by `scripts/audit-crg.ts` in CI; the traversal itself is
 * cycle-safe regardless (see `pathway-generator.ts`).
 */

// Keep every segment literal so Turbopack scopes filesystem tracing to the
// graph directory, not the project root. tests/kb-graph-loader.test.ts pins
// this anchor against the shared, dependency-free graph-layout contract.
const KB_GRAPH_DIR = path.join(process.cwd(), "data", "knowledge-base", "graph");

/** `[file, nodeId]` for every JSON file, or `[]` when the directory is absent. */
function adjacencyFileNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function readNodeMapping(dir: string, file: string): KbNodeMapping {
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`[kb-graph] Invalid JSON in ${file}.`);
  }

  const parsed = KbNodeMappingSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`[kb-graph] Invalid node mapping in ${file}.`);
  }

  const expectedId = path.basename(file, ".json");
  if (parsed.data.nodeId !== expectedId) {
    throw new Error(`[kb-graph] Node id mismatch in ${file}.`);
  }
  return parsed.data;
}

function assertGraphInCatalog(nodes: readonly KbNodeMapping[]): void {
  const byId = indexById(loadConditionCatalog());
  for (const node of nodes) {
    if (!byId.has(node.nodeId)) {
      throw new Error("[kb-graph] A node has no matching condition in the catalog.");
    }
    for (const edge of node.outgoingEdges) {
      if (!byId.has(edge.targetConditionId)) {
        throw new Error("[kb-graph] An edge targets an unknown condition.");
      }
    }
  }
}

/**
 * Load a graph from an explicit directory (test/tooling seam, no caching).
 * The default-dir `loadKbGraph()` is the runtime path. Tooling validating
 * staged edges can pass its full authored KB; omission uses the live corpus.
 */
export function loadKbGraphFromDir(
  dir: string = KB_GRAPH_DIR,
  knowledgeBase?: KnowledgeBase,
): Map<string, KbNodeMapping> {
  const files = adjacencyFileNames(dir);
  const nodes: KbNodeMapping[] = [];
  const owners = new Map<string, string>();

  for (const file of files) {
    const node = readNodeMapping(dir, file);
    // Defense-in-depth: unreachable while the filename↔nodeId check above
    // holds (two files cannot both own one id), retained so a future relaxation
    // of that check cannot silently admit an ambiguous adjacency list.
    const existingOwner = owners.get(node.nodeId);
    if (existingOwner) {
      throw new Error(`[kb-graph] Duplicate node identity in ${file}.`);
    }
    owners.set(node.nodeId, file);
    nodes.push(node);
  }

  assertGraphInCatalog(nodes);
  // Fail-closed quarantine guard: refusal depends on the loaded knowledge
  // base, so a missing or unreadable KB fails the graph load rather than
  // skipping the check.
  const kb = knowledgeBase ?? loadKnowledgeBase();
  assertNoQuarantinedPointerGraphNodes(kb, nodes);
  assertGraphEvidenceJoins(kb, nodes);
  return new Map(nodes.map((node) => [node.nodeId, node]));
}

let cachedGraph: Map<string, KbNodeMapping> | null = null;

/**
 * The process-wide adjacency graph, parsed and validated once. An absent or
 * empty graph directory caches an empty map.
 */
export function loadKbGraph(): Map<string, KbNodeMapping> {
  if (cachedGraph) return cachedGraph;
  cachedGraph = loadKbGraphFromDir();
  return cachedGraph;
}

/** Test seam: clears the module-level graph cache. */
export function resetKbGraphCache(): void {
  cachedGraph = null;
}
