#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  assertNoCausationCycle,
  bidirectionalPairs,
  canonicalCycleKey,
  canonicalPairKey,
  enumerateAdjacencyCycles,
  GRAPH_GOVERNANCE_VERSION,
  isGovernedCycleFinding,
  reconcileGovernance,
  type GraphGovernanceLedger,
} from "../src/lib/kb/graph-cycle-policy.ts";
import { assertGraphEvidenceJoins } from "../src/lib/kb/graph-evidence-joins.mts";
import { KB_GRAPH_DIR_RELATIVE, KB_GRAPH_GOVERNANCE_RELATIVE } from "../src/lib/kb/graph-layout.ts";
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
 * It also enforces the ARCH-01 evidence join, so this gate refuses an edge that
 * has no authored suggestion/citations behind it or whose nexus classification
 * disagrees with the authored suggestion for the same (source, target) pair.
 * Structural acyclicity and evidence agreement are different failures, and a
 * graph can be perfectly acyclic while claiming a relationship no authored
 * record supports — which is why both run here and not only in the runtime
 * loader, where the first request pays for the discovery.
 *
 * The cycle verdict is **classified**, not blanket (audit A08). This gate used
 * to reject every cycle it found while the runtime loader rejected only
 * all-DIRECT_CAUSATION cycles, so a medically legitimate association-only
 * bidirectional pair would load in production and fail CI. It now consumes the
 * one shared contract in `src/lib/kb/graph-cycle-policy.ts`, which the runtime
 * loader imports too:
 *
 *   - an all-DIRECT_CAUSATION cycle is a violation and fails the gate (the
 *     loader also runs `assertNoCausationCycle` directly, so the runtime and CI
 *     verdicts come from the same function rather than from two similar
 *     re-implementations);
 *   - an association-only, mixed, or aggravation cycle, and any bidirectional
 *     pair, are review findings that are admitted only when a recorded
 *     disposition exists in the governance ledger
 *     (`docs/crg-adjacency-governance-ledger.json`, or --governance=<path>).
 *     A two-node cycle is the pair, not a separate finding, so it is booked
 *     once — through the pair entry — exactly as the corpus audit does.
 *     The ledger must match the live graph in BOTH directions: an ungoverned
 *     finding fails (`CRG-ADJACENCY-REVIEW-UNGOVERNED`) and a stale entry that
 *     no longer describes anything fails (`CRG-ADJACENCY-GOVERNANCE-STALE`).
 * Deleting a defensible direction to make a blanket DAG check pass is
 * explicitly not the remedy, which is why the ledger exists instead.
 *
 * Exit codes: 0 = no violation cycles, every review-class finding governed,
 * every edge backed by authored evidence (or an explicitly tolerated empty
 * state); 1 = parse failure, malformed graph, an all-causation cycle, an
 * ungoverned or stale review finding, a missing/unreadable governance ledger,
 * or an edge whose authored evidence is missing or differently classified.
 *
 * Usage: node scripts/audit-crg.ts [--kb-dir=<path>] [--kb-root=<path>]
 *                                  [--governance=<path>]
 * CI runs with the default graph directory; --kb-dir exists so fixture
 * directories can exercise the DFS in tests without touching the real graph.
 * The authored corpus is read from the graph directory's parent (the layout
 * `data/knowledge-base/graph/` mirrors the staging layout `staged/graph/`),
 * or from --kb-root when that parent is not a directory inside this project.
 */

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

/**
 * Where the authored condition mappings live, for the ARCH-01 evidence join.
 *
 * Default: the graph directory's parent, which is correct for the real layout
 * (`data/knowledge-base/graph/` → `data/knowledge-base/`). A fixture graph
 * directory outside the project is never used as a search root — reading an
 * arbitrary parent directory is not a safe default — so it must pass
 * --kb-root explicitly, and a graph with edges and no locatable corpus fails
 * closed. `--kb-root` also accepts a `.json` file holding an array of
 * mappings, which is how the packet converter writes a candidate corpus
 * (`authored-mappings.json`) before any of it lands in the live directory.
 */
const KB_ROOT_ARG = process.argv.find((arg) => arg.startsWith("--kb-root="))?.split("=")[1];

/**
 * The reviewed-disposition ledger. Default: the shared layout constant, so the
 * gate and any future tooling read one path. A fixture graph passes its own
 * path so the gate can be exercised against synthetic review-class shapes.
 */
const GOVERNANCE_PATH_ARG = process.argv
  .find((arg) => arg.startsWith("--governance="))
  ?.split("=")[1];
const GOVERNANCE_PATH = GOVERNANCE_PATH_ARG ?? KB_GRAPH_GOVERNANCE_RELATIVE;

function isInsideProject(candidate: string): boolean {
  const relativePath = relative(process.cwd(), candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !relativePath.startsWith("/");
}

const derivedKbRoot = dirname(KB_DIR);
const KB_ROOT = KB_ROOT_ARG ?? (isInsideProject(derivedKbRoot) ? derivedKbRoot : null);

/* ─── 1. Load and parse the adjacency list ────────────────────────────────
 * Every .json file must parse as a KbNodeMapping. Any parse failure or
 * duplicate nodeId is a hard error: an ambiguous adjacency list would make
 * any cycle verdict meaningless.
 * ────────────────────────────────────────────────────────────────────────── */

/** Master adjacency list: nodeId → its distinct outgoing target IDs. */
const graph = new Map<string, string[]>();
/** The same nodes, unsummarized, for the ARCH-01 evidence join. */
const parsedNodes: import("../src/lib/kb/schema.ts").KbNodeMapping[] = [];
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
    parsedNodes.push(node);
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

/* ─── 2. Classified cycle detection (shared policy) ───────────────────────
 * The classification table, the enumerator and the causation-only DFS all come
 * from `src/lib/kb/graph-cycle-policy.ts`, the same module the runtime loader
 * imports, so this gate cannot drift from what production enforces. The
 * enumerator reports every simple cycle once, classified; the DFS is run too,
 * and a disagreement between the two would fail the gate loudly rather than
 * silently choosing one verdict.
 * ────────────────────────────────────────────────────────────────────────── */

const enumeration = enumerateAdjacencyCycles(parsedNodes);
if (enumeration.truncated) {
  console.error(
    "audit-crg: FAIL — cycle enumeration exceeded its analysis budget, so the structural verdict would be incomplete. " +
      "Split the graph, resolve existing cycles, or deliberately raise CYCLE_ENUMERATION_MAX_STEPS/MAX_CYCLES in src/lib/kb/graph-cycle-policy.ts.",
  );
  process.exit(1);
}

const violationCycles = enumeration.cycles.filter((cycle) => cycle.severity === "violation");
// A two-node cycle IS a bidirectional pair, so it is governed by its pair entry
// rather than by a cycle entry — the same split the corpus audit uses, so one
// shape is never booked twice (`isGovernedCycleFinding`).
const reviewCycles = enumeration.cycles.filter(isGovernedCycleFinding);
const pairCoveredCycles = enumeration.cycles.filter(
  (cycle) => cycle.severity === "review" && !isGovernedCycleFinding(cycle),
);
const pairs = bidirectionalPairs(parsedNodes);

if (violationCycles.length > 0) {
  // Run the runtime assertion as well: if the enumerator and the loader's DFS
  // ever disagreed about a causation cycle, CI would be certifying a graph the
  // loader refuses (or the reverse). Agreement is the point of the shared module.
  let runtimeAgrees = false;
  try {
    assertNoCausationCycle(parsedNodes);
  } catch {
    runtimeAgrees = true;
  }
  if (!runtimeAgrees) {
    console.error(
      "audit-crg: FAIL — the enumerator and the runtime causation-cycle check disagree; the shared policy in src/lib/kb/graph-cycle-policy.ts is inconsistent.",
    );
    process.exit(1);
  }
  console.error(
    `audit-crg: FAIL — ${violationCycles.length} multi-hop circular ${violationCycles.length === 1 ? "dependency" : "dependencies"} detected in the CRG:\n`,
  );
  for (const [index, cycle] of violationCycles.entries()) {
    console.error(`  ${index + 1}. ${cycle.path}  [${cycle.code}]`);
  }
  console.error(
    "\naudit-crg: a cycle of only DIRECT_CAUSATION edges is never a defensible etiology; re-rank, re-parent, or remove an edge before merge.",
  );
  process.exit(1);
}

/* ─── 3. Governance ledger reconciliation ─────────────────────────────────
 * Review-class shapes (association/mixed/aggravation cycles and bidirectional
 * pairs) are legitimate, so they are admitted — but only with a recorded
 * disposition. Both directions are enforced: an ungoverned live finding fails,
 * and a ledger entry that no longer matches anything fails, so the record
 * cannot rot into a claim about a graph that no longer exists.
 * ────────────────────────────────────────────────────────────────────────── */

function failGovernance(message: string): never {
  console.error(`audit-crg: FAIL — ${message}`);
  process.exit(1);
}

function parseGovernanceLedger(raw: unknown, origin: string): GraphGovernanceLedger {
  const fail = (detail: string): never =>
    failGovernance(
      `governance ledger ${origin} is not a valid reviewed-disposition record — ${detail}. ` +
        `Expected { version: ${GRAPH_GOVERNANCE_VERSION}, reviewedCycles: [{ nodes, disposition }], reviewedBidirectionalPairs: [{ pair, disposition }] }.`,
    );
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("not a JSON object");
  const record = raw as Record<string, unknown>;
  if (record.version !== GRAPH_GOVERNANCE_VERSION) {
    return fail(`unsupported version ${String(record.version)}`);
  }
  const cyclesRaw = record.reviewedCycles;
  const pairsRaw = record.reviewedBidirectionalPairs;
  if (!Array.isArray(cyclesRaw)) return fail("reviewedCycles must be an array");
  if (!Array.isArray(pairsRaw)) return fail("reviewedBidirectionalPairs must be an array");

  const reviewedCycles: GraphGovernanceLedger["reviewedCycles"] = [];
  for (const [index, entry] of cyclesRaw.entries()) {
    if (!entry || typeof entry !== "object") return fail(`reviewedCycles[${index}] is not an object`);
    const { nodes, disposition } = entry as { nodes?: unknown; disposition?: unknown };
    if (!Array.isArray(nodes) || nodes.length < 2 || nodes.some((id) => typeof id !== "string" || id.length === 0)) {
      return fail(`reviewedCycles[${index}].nodes must be at least two non-empty condition ids`);
    }
    if (nodes.length === 2) {
      // Fail closed on the double-bookkeeping shape instead of accepting an
      // entry that can only ever be reported stale: a two-node cycle is the
      // pair, and pairs are recorded under reviewedBidirectionalPairs.
      return fail(
        `reviewedCycles[${index}] describes a two-node cycle (${nodes.join(" -> ")}), which is a bidirectional pair — record it in reviewedBidirectionalPairs so the same relationship is not governed twice`,
      );
    }
    if (typeof disposition !== "string" || disposition.trim().length === 0) {
      return fail(`reviewedCycles[${index}].disposition must be a non-empty reference to the recorded decision`);
    }
    reviewedCycles.push({ nodes: [...(nodes as string[])], disposition });
  }

  const reviewedBidirectionalPairs: GraphGovernanceLedger["reviewedBidirectionalPairs"] = [];
  for (const [index, entry] of pairsRaw.entries()) {
    if (!entry || typeof entry !== "object") return fail(`reviewedBidirectionalPairs[${index}] is not an object`);
    const { pair, disposition } = entry as { pair?: unknown; disposition?: unknown };
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      pair.some((id) => typeof id !== "string" || id.length === 0) ||
      pair[0] === pair[1]
    ) {
      return fail(`reviewedBidirectionalPairs[${index}].pair must be two distinct condition ids`);
    }
    if (typeof disposition !== "string" || disposition.trim().length === 0) {
      return fail(`reviewedBidirectionalPairs[${index}].disposition must be a non-empty reference to the recorded decision`);
    }
    reviewedBidirectionalPairs.push({ pair: [pair[0], pair[1]], disposition });
  }

  return { version: GRAPH_GOVERNANCE_VERSION, reviewedCycles, reviewedBidirectionalPairs };
}

const ledgerExists = existsSync(GOVERNANCE_PATH);
if (reviewCycles.length === 0 && pairs.length === 0 && !ledgerExists) {
  console.log(
    "audit-crg: PASS — CRG adjacency list is acyclic: no multi-hop circular dependency and no review-class shape; no governance ledger is present and none is needed.",
  );
} else {
  if (!ledgerExists) {
    failGovernance(
      `${reviewCycles.length} review-class cycle(s) and ${pairs.length} bidirectional pair(s) need a reviewed disposition, but ${GOVERNANCE_PATH} does not exist. ` +
        "Create the ledger and record the qualified-human decision for each finding (a direction may not be deleted merely to make this gate pass).",
    );
  }
  let ledgerRaw: unknown;
  try {
    ledgerRaw = JSON.parse(readFileSync(GOVERNANCE_PATH, "utf8")) as unknown;
  } catch (error) {
    failGovernance(`governance ledger ${GOVERNANCE_PATH} is not readable JSON — ${summarizeParseError(error)}`);
  }
  const ledger = parseGovernanceLedger(ledgerRaw, GOVERNANCE_PATH);
  const reconciliation = reconcileGovernance(enumeration.cycles, pairs, ledger);

  if (reconciliation.ungoverned.length > 0 || reconciliation.ungovernedPairs.length > 0) {
    console.error("audit-crg: FAIL — CRG-ADJACENCY-REVIEW-UNGOVERNED: review-class findings with no recorded disposition:\n");
    for (const cycle of reconciliation.ungoverned) {
      console.error(`  cycle ${cycle.path}  [${cycle.code}]`);
    }
    for (const pair of reconciliation.ungovernedPairs) {
      console.error(
        `  pair ${pair.key}  [${pair.aToB} / ${pair.bToA}]${
          pair.requiresGovernance
            ? " — a direction here claims causation or aggravation, so each direction needs its own justification"
            : " — association-only in both directions"
        }`,
      );
    }
    console.error(
      `\naudit-crg: each of these is a legitimate review shape, not an automatic failure — record the qualified-human decision in ${GOVERNANCE_PATH} (reviewedCycles / reviewedBidirectionalPairs) with a disposition reference. Deleting a defensible direction is not the remedy.`,
    );
    process.exit(1);
  }

  if (reconciliation.staleCycles.length > 0 || reconciliation.stalePairs.length > 0) {
    console.error("audit-crg: FAIL — CRG-ADJACENCY-GOVERNANCE-STALE: ledger entries that match no live finding:\n");
    for (const key of reconciliation.staleCycles) console.error(`  cycle ${key}`);
    for (const key of reconciliation.stalePairs) console.error(`  pair ${key}`);
    console.error(
      `\naudit-crg: remove the resolved entr${reconciliation.staleCycles.length + reconciliation.stalePairs.length === 1 ? "y" : "ies"} from ${GOVERNANCE_PATH} so the ledger keeps describing the graph it governs (a canonical cycle key rotates to start at its lowest-ordered node).`,
    );
    process.exit(1);
  }

  // The ledger is reconciled whenever it exists, even against a currently
  // clean graph: otherwise the last resolved finding's entry would linger
  // unexamined, and the record would stop describing the graph it governs.
  console.log(
    reviewCycles.length === 0 && pairs.length === 0
      ? `audit-crg: PASS — CRG adjacency list is acyclic: no multi-hop circular dependency and no review-class shape; ${GOVERNANCE_PATH} describes no live finding.`
      : `audit-crg: PASS — no causation cycle; ${reviewCycles.length} review-class cycle(s) and ${pairs.length} bidirectional pair(s) all carry a recorded disposition in ${GOVERNANCE_PATH}.`,
  );
  for (const cycle of reviewCycles) {
    console.log(`  reviewed cycle ${canonicalCycleKey(cycle.nodeIds)}  [${cycle.code}]`);
  }
  for (const pair of pairs) {
    console.log(`  reviewed pair ${canonicalPairKey(pair.a, pair.b)}  [${pair.aToB} / ${pair.bToA}]`);
  }
  for (const cycle of pairCoveredCycles) {
    console.log(
      `  review-class cycle ${canonicalCycleKey(cycle.nodeIds)}  [${cycle.code}] is a two-node cycle: governed by its pair entry above.`,
    );
  }
}

/* ─── 4. ARCH-01 authored-evidence join ────────────────────────────────────
 * Acyclicity says nothing about whether an edge is *supported*. Every edge
 * must reference an authored suggestion with at least one citation and the
 * same nexus classification, or the traversal would present a multi-hop claim
 * whose evidence says something else (or nothing at all). The same guard runs
 * in the runtime loader, both corpus builders and the pathway projection; it
 * runs here too so CI attributes the failure to the named structural gate
 * instead of to whichever test happens to load the graph first.
 * ────────────────────────────────────────────────────────────────────────── */

if (KB_ROOT === null) {
  console.error(
    `audit-crg: FAIL — ${parsedNodes.length} adjacency node(s) but no authored corpus directory was found. ` +
      `Pass --kb-root=<path> to the directory holding the condition mappings (the graph directory's parent by default).`,
  );
  process.exit(1);
}

const authoredMappings: import("../src/lib/kb/schema.ts").ConditionMapping[] = [];

/** Read one candidate mapping object, or fail on an unreadable record. */
function addMapping(raw: unknown, origin: string): void {
  const parsed = conditionMappingSchema.safeParse(raw);
  if (parsed.success) {
    authoredMappings.push(parsed.data);
    return;
  }
  // A record that claims to be a mapping (`id`) but fails the schema is
  // corruption, not something to skip: skipping it would quietly shrink the
  // corpus the join runs over, and a malformed evidence record is exactly what
  // the join must not be allowed to overlook. Non-mapping JSON in a corpus
  // directory is kb:validate's business and is ignored here.
  if (raw && typeof raw === "object" && "id" in (raw as Record<string, unknown>)) {
    console.error(
      `audit-crg: FAIL — ${origin} is not a valid condition mapping — ${summarizeParseError(parsed.error)}`,
    );
    process.exit(1);
  }
}

if (KB_ROOT.endsWith(".json")) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(KB_ROOT, "utf8")) as unknown;
  } catch (error) {
    console.error(`audit-crg: FAIL — candidate corpus ${KB_ROOT} is not readable JSON — ${summarizeParseError(error)}`);
    process.exit(1);
  }
  if (!Array.isArray(raw)) {
    console.error(`audit-crg: FAIL — candidate corpus ${KB_ROOT} must be a JSON array of condition mappings.`);
    process.exit(1);
  }
  for (const [index, entry] of raw.entries()) addMapping(entry, `${KB_ROOT}[${index}]`);
} else {
  const mappingFileNames = existsSync(KB_ROOT)
    ? readdirSync(KB_ROOT).filter((name) => name.endsWith(".json")).sort()
    : [];
  for (const name of mappingFileNames) {
    // `graph/` is a subdirectory, not a file, so the mapping walk never sees
    // the adjacency files.
    const full = join(KB_ROOT, name);
    if (!existsSync(full)) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(full, "utf8")) as unknown;
    } catch (error) {
      console.error(`audit-crg: FAIL — authored corpus file ${name} is not valid JSON — ${summarizeParseError(error)}`);
      process.exit(1);
    }
    addMapping(raw, `authored corpus file ${name}`);
  }
}

if (authoredMappings.length === 0) {
  console.error(
    `audit-crg: FAIL — ${parsedNodes.length} adjacency node(s) but no authored condition mappings in ${KB_ROOT}. ` +
      "An edge cannot be shown to have authored evidence, so the gate fails closed.",
  );
  process.exit(1);
}

try {
  assertGraphEvidenceJoins(authoredMappings, parsedNodes);
} catch (error) {
  console.error(`audit-crg: FAIL — ${error instanceof Error ? error.message : String(error)}`);
  console.error("audit-crg: every edge needs an authored suggestion with citations and the same nexus classification before merge.");
  process.exit(1);
}

console.log(
  `audit-crg: PASS — ARCH-01: all ${parsedNodes.reduce((sum, node) => sum + node.outgoingEdges.length, 0)} edge(s) reference authored evidence with matching nexus classifications.`,
);
