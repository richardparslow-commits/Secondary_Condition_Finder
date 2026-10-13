#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * CRG (Causal Relational Graph) structural audit — npm run audit:crg.
 *
 * The knowledge base is a directed graph (primary mapping -> suggested
 * condition). The engine bounds chains to two edges and never promotes a path
 * to a direct nexus finding, so cycles cannot loop the recommendation engine —
 * but composed reciprocal edges can still read as circular etiology to a
 * veteran, and an ASSOCIATION_ONLY edge composed into a chain would present a
 * hypothesized cascade as connectable. This audit makes that structural debt
 * visible instead of silent:
 *
 *  1. Self-loops and duplicate edges are hard violations.
 *  2. Directed cycles are enumerated exactly once each (Tiernan-style simple
 *     cycle enumeration). A cycle whose every edge is DIRECT_CAUSATION is a
 *     hard violation (pure circular causation is not a defensible etiology).
 *     Any other cycle is a review finding; cycles containing an
 *     ASSOCIATION_ONLY edge are flagged explicitly.
 *  3. Bidirectional pairs are legitimate when each direction is independently
 *     guarded (e.g., OSA <-> hypertension), so they are not auto-failed.
 *     Each published pair must carry a governanceNotes justification on BOTH
 *     mapping files — a missing note is a review finding (violation under
 *     --strict) so the manual review queue cannot be forgotten.
 *  4. Transitive redundancy (a direct A->C edge plus an authored A->B->C
 *     chain) is reported informationally: either the direct edge overstates or
 *     the chain is redundant, and only a qualified human can decide which.
 *
 * Severity model:
 *  - violations  -> status FAIL, exit 1 (always).
 *  - review      -> status REVIEW, exit 0 by default; --strict upgrades every
 *                   review finding, association cycles included, to a violation
 *                   for maintainer gates.
 *  - review and redundancy are human-decision backlogs, so they are ratcheted
 *    rather than zero-tolerance: exceeding CRG_REVIEW_BASELINE or
 *    CRG_REDUNDANCY_BASELINE is a CRG-STRUCTURAL-DEBT-RATCHET violation, which
 *    makes the backlog monotonic. Lower each pin as a qualified human resolves
 *    findings. Without the ratchet a gate that exits 0 on REVIEW could absorb
 *    unbounded new structural debt while still reporting green.
 *
 * The classification table above is stated a second time, in TypeScript, by
 * `src/lib/kb/graph-cycle-policy.ts` — the contract the runtime loader and the
 * adjacency gate import. This script runs over authored mappings rather than
 * adjacency files and cannot import that module under the CI Node runtime, so
 * `tests/crg-invariant-parity.test.ts` pins the two against each other on
 * synthetic shapes: a divergence between this audit's verdict and the runtime /
 * adjacency-gate verdict fails a test instead of shipping (audit A08).
 *
 * This audit is enforced by CI (.github/workflows/ci.yml, steps "Audit CRG
 * graph structure" and "Audit CRG adjacency graph"). Wiring is load-bearing:
 * an audit whose FAIL path no job executes cannot signal anything, no matter
 * how correct its analysis is.
 *
 * No writes are performed: this is an audit, not a mutator.
 */

const fs = require("fs");
const path = require("path");

const MAX_REPORTED_CYCLES = 100;
const MAX_REPORTED_REDUNDANCY = 50;
/**
 * Analysis bounds. Enumeration and redundancy counting are **complete** within
 * these budgets; exhausting a budget is a hard failure (`*_TRUNCATED`), never
 * a silent downgrade of the verdict. The previous implementation stopped
 * enumeration at MAX_REPORTED_CYCLES / MAX_CYCLE_LENGTH, so a cycle longer
 * than 12 nodes or a 101st cycle was never analyzed and `truncated` could
 * never become true.
 */
const MAX_ENUMERATION_STEPS = 2_000_000;
const MAX_ENUMERATED_CYCLES = 5_000;

/**
 * Human-decision backlog ratchets, pinned to the corpus as of 2026-09-25.
 *
 * Both backlogs require a qualified human to decide (author governance notes
 * on a bidirectional pair, or choose between a direct edge and the chain it
 * duplicates), so zero-tolerance would block every PR on legitimately queued
 * work. Ratcheting instead keeps the backlog from growing silently. Counted
 * independently of --strict so the pin means the same thing in both modes.
 */
const CRG_REVIEW_BASELINE = 13;  /* batch 63 (2026-09-26): +1 review-class finding - the nephritis->chronic-kidney-disease edge closes a new CRG-ASSOCIATION-CYCLE (chronic-kidney-disease -> congestive-heart-failure -> depressive-disorder -> sleep-apnea -> hypertension -> ischemic-heart-disease -> colorectal-cancer -> fecal-incontinence -> dermatitis -> impetigo -> nephritis -> chronic-kidney-disease) via the published impetigo->nephritis edge; composed ASSOCIATION_ONLY links with hypothesizedOnly:true on every hop, decision recorded in nephritis.json governance notes, deliberately re-pinned rather than resolved by dropping a defensible edge */
const CRG_REDUNDANCY_BASELINE = 29;  /* batch 92 (2026-09-29): +1 transitive redundancy, deliberately re-pinned rather than resolved by dropping a defensible edge (the batch-63 precedent): landing the held diabetes-mellitus-type-2->depressive-disorder edge (PMIDs 19033418, 11375373) completes the authored chain ptsd->diabetes-mellitus-type-2->depressive-disorder alongside the direct ptsd->depressive-disorder edge, so the conflict 'direct edge ptsd->depressive-disorder coexists with chain ptsd->diabetes-mellitus-type-2->depressive-disorder' joins the backlog. The direct edge rests on its own prospective anchors (the batch-80 adjudication) and the diabetes edge on its own bidirectional meta-analytic anchors with the weaker-half asymmetry and the standing-open-critique disclosures on its face; neither may be dropped without discarding defensible evidence, and the conflict is disclosed here and in the batch-92 ledger for qualified-human adjudication. */

/**
 * Enumerates every simple directed cycle exactly once, rooted at the
 * lowest-ordered node on the cycle (Tiernan-style canonical enumeration).
 *
 * There is deliberately **no cycle-length cap**: a 13-node pure-causation
 * cycle is exactly as invalid as a 3-node one, and the old
 * `MAX_CYCLE_LENGTH = 12` silently skipped it. The search is instead bounded
 * by a step budget and a cycle-count budget; exhausting either returns
 * `truncated: true`, which callers must surface as a hard failure rather than
 * treating the partial result as a clean verdict.
 */
function enumerateSimpleCycles(sortedNodes, nodeOrder, adjacency, options = {}) {
  const maxSteps = Number.isFinite(options.maxSteps) ? options.maxSteps : MAX_ENUMERATION_STEPS;
  const maxCycles = Number.isFinite(options.maxCycles) ? options.maxCycles : MAX_ENUMERATED_CYCLES;
  const cycles = [];
  let steps = 0;
  let truncated = false;

  outer: for (const start of sortedNodes) {
    const path = [start];
    const onPath = new Set([start]);
    const dfs = (current) => {
      for (const next of adjacency.get(current) || []) {
        steps += 1;
        if (steps > maxSteps || cycles.length >= maxCycles) {
          truncated = true;
          return;
        }
        if (next === start) {
          cycles.push([...path, start]);
          continue;
        }
        if (onPath.has(next)) continue;
        if ((nodeOrder.get(next) ?? 0) < (nodeOrder.get(start) ?? 0)) continue;
        onPath.add(next);
        path.push(next);
        dfs(next);
        path.pop();
        onPath.delete(next);
        if (truncated) return;
      }
    };
    dfs(start);
    if (truncated) break outer;
  }
  return { cycles, truncated };
}

/**
 * Pure graph analysis over parsed knowledge-base mappings.
 * Exported so tests can exercise it without touching the filesystem.
 *
 * reviewBaseline / redundancyBaseline exist so tests can exercise the ratchet
 * without fabricating a dozen cycles. They are deliberately NOT exposed as CLI
 * flags: the shipped pin can only be changed by editing this file, so a gate
 * run cannot loosen its own ratchet.
 */
function analyzeGraph(mappings, options = {}) {
  const strict = options.strict === true;
  const reviewBaseline = Number.isFinite(options.reviewBaseline)
    ? options.reviewBaseline
    : CRG_REVIEW_BASELINE;
  const redundancyBaseline = Number.isFinite(options.redundancyBaseline)
    ? options.redundancyBaseline
    : CRG_REDUNDANCY_BASELINE;
  const edges = [];
  const nodeIds = new Set();

  for (const mapping of mappings) {
    nodeIds.add(mapping.id);
    for (const suggestion of mapping.suggestions || []) {
      edges.push({
        from: mapping.id,
        to: suggestion.conditionId,
        classification: suggestion.nexusClaim?.nexusClassification ?? "UNKNOWN",
        draft: mapping.draft === true,
        file: mapping.id,
      });
    }
  }

  const edgeByKey = new Map(edges.map((edge) => [`${edge.from}->${edge.to}`, edge]));
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }

  const violations = [];
  const review = [];
  const redundancy = [];
  // Strict-independent tally of review-class findings, so the ratchet pins the
  // same backlog whether or not --strict moved those findings into violations.
  let reviewClassCount = 0;

  // --- Self-loops and duplicate edges ---
  const seenEdges = new Map();
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    if (edge.from === edge.to) {
      violations.push({ code: "CRG-SELF-LOOP", subject: edge.from, message: `mapping "${edge.from}" suggests itself.` });
      continue;
    }
    if (seenEdges.has(key)) {
      violations.push({
        code: "CRG-DUPLICATE-EDGE",
        subject: key,
        message: `duplicate edge ${key} authored in ${seenEdges.get(key)} and ${edge.file}.`,
      });
      continue;
    }
    seenEdges.set(key, edge.file);
  }

  // --- Directed cycles ---
  const sortedNodes = [...nodeIds].sort();
  const nodeOrder = new Map(sortedNodes.map((id, index) => [id, index]));
  const enumeration = enumerateSimpleCycles(sortedNodes, nodeOrder, adjacency, {
    maxSteps: Number.isFinite(options.enumerationBudget)
      ? options.enumerationBudget
      : undefined,
  });
  const rawCycles = enumeration.cycles;
  if (enumeration.truncated) {
    // The cycle verdict would be incomplete; fail closed instead of reporting
    // a partial enumeration as if it were the whole graph.
    violations.push({
      code: "CRG-CYCLE-ENUMERATION-TRUNCATED",
      subject: "cycle enumeration budget exhausted",
      message: `cycle enumeration exceeded its analysis budget after ${rawCycles.length} cycle(s); the structural verdict would be incomplete. Split the graph, resolve existing cycles, or deliberately raise MAX_ENUMERATION_STEPS in scripts/audit-crg-graph.js.`,
    });
  }

  const cycles = rawCycles
    .map((cycle) => {
      const nodes = cycle.slice(0, -1);
      const cycleEdges = [];
      for (let index = 0; index < nodes.length; index += 1) {
        const edge = edgeByKey.get(`${nodes[index]}->${nodes[(index + 1) % nodes.length]}`);
        if (edge) cycleEdges.push(edge);
      }
      return {
        path: cycle.join(" -> "),
        length: nodes.length,
        fullyPublished: cycleEdges.every((edge) => !edge.draft),
        allDirectCausation: cycleEdges.length > 0 && cycleEdges.every((edge) => edge.classification === "DIRECT_CAUSATION"),
        containsAssociationOnly: cycleEdges.some((edge) => edge.classification === "ASSOCIATION_ONLY"),
        edgeClassifications: cycleEdges.map((edge) => `${edge.from}->${edge.to} [${edge.classification}${edge.draft ? ", draft" : ""}]`),
      };
    })
    .sort((a, b) => a.length - b.length || a.path.localeCompare(b.path));

  for (const cycle of cycles) {
    if (cycle.allDirectCausation) {
      violations.push({
        code: "CRG-PURE-CAUSATION-CYCLE",
        subject: cycle.path,
        message: `cycle composed entirely of DIRECT_CAUSATION edges — circular causation is not a defensible etiology: ${cycle.path}`,
      });
      continue;
    }
    // A two-node cycle is exactly a bidirectional pair; it is governed by the
    // CRG-BIDIRECTIONAL-GOVERNANCE check below (notes on both files), so a
    // separate cycle review finding here would keep the pair in REVIEW even
    // after the required human justification is authored. Longer cycles are
    // not clearable by pair notes and remain review findings.
    if (cycle.length === 2) continue;
    const finding = {
      code: cycle.containsAssociationOnly ? "CRG-ASSOCIATION-CYCLE" : "CRG-CYCLE",
      subject: cycle.path,
      message: cycle.containsAssociationOnly
        ? `cycle contains an ASSOCIATION_ONLY edge — composed hypothesized links must not read as circular causation: ${cycle.path}`
        : `directed cycle present (each direction must be independently guarded): ${cycle.path}`,
      fullyPublished: cycle.fullyPublished,
    };
    reviewClassCount += 1;
    // --strict is documented as upgrading review findings to violations, and
    // that has to include cycles: otherwise a maintainer running the strict
    // gate believes association cycles are enforced while they stay advisory.
    if (strict) violations.push(finding);
    else review.push(finding);
  }

  // --- Bidirectional pairs and their governance notes ---
  const governanceNotes = new Map(mappings.map((mapping) => [mapping.id, mapping.governanceNotes || []]));
  const bidirectionalPairs = [];
  for (const key of edgeByKey.keys()) {
    const [a, b] = key.split("->");
    const reverse = `${b}->${a}`;
    if (!edgeByKey.has(reverse) || a >= b) continue;
    const forward = edgeByKey.get(key);
    const backward = edgeByKey.get(reverse);
    const notesForward = governanceNotes.get(a) || [];
    const notesBackward = governanceNotes.get(b) || [];
    const pair = {
      pair: `${a} <-> ${b}`,
      bothPublished: !forward.draft && !backward.draft,
      governanceNotesOnBoth: notesForward.length > 0 && notesBackward.length > 0,
    };
    bidirectionalPairs.push(pair);
    if (pair.bothPublished && !pair.governanceNotesOnBoth) {
      const finding = {
        code: "CRG-BIDIRECTIONAL-GOVERNANCE",
        subject: pair.pair,
        message: `bidirectional pair ${pair.pair} lacks a governanceNotes justification on both mapping files; each direction must be independently guarded for causation vs. aggravation before it is treated as reviewed.`,
      };
      reviewClassCount += 1;
      if (strict) violations.push(finding);
      else review.push(finding);
    }
  }

  // --- Transitive redundancy (informational) ---
  const publishedDirect = new Set(
    edges.filter((edge) => !edge.draft).map((edge) => `${edge.from}->${edge.to}`),
  );
  const publishedEdges = edges.filter((edge) => !edge.draft);
  // Count every conflict; cap only the display list. Counting used to stop at
  // MAX_REPORTED_REDUNDANCY, so the ratchet compared a capped 50 against the
  // baseline and `truncated.redundancy` could never fire.
  let redundancyCount = 0;
  for (const first of publishedEdges) {
    for (const second of publishedEdges) {
      if (second.from !== first.to) continue;
      const direct = `${first.from}->${second.to}`;
      if (first.to === first.from || !publishedDirect.has(direct)) continue;
      redundancyCount += 1;
      if (redundancy.length >= MAX_REPORTED_REDUNDANCY) continue;
      redundancy.push({
        direct,
        chain: `${first.from}->${first.to}->${second.to}`,
        message: `direct edge ${direct} coexists with authored chain ${first.from}->${first.to}->${second.to}; either the direct edge overstates the evidence or the chain is redundant — qualified-human decision required.`,
      });
    }
  }

  const associationEdgeCount = edges.filter((edge) => edge.classification === "ASSOCIATION_ONLY").length;

  // --- Structural-debt ratchet ---
  // Review and redundancy findings are informational by design, because each
  // needs a qualified-human decision. Nothing else bounds their growth, so
  // exceeding a pin is a hard violation: the backlog can only shrink.
  const reviewDebtExceeded = reviewClassCount > reviewBaseline;
  const redundancyDebtExceeded = redundancyCount > redundancyBaseline;
  if (reviewDebtExceeded) {
    violations.push({
      code: "CRG-STRUCTURAL-DEBT-RATCHET",
      subject: `review-class findings ${reviewClassCount} > baseline ${reviewBaseline}`,
      message: `review-class findings grew from the pinned baseline of ${reviewBaseline} to ${reviewClassCount}. Each new cycle or unguarded bidirectional pair needs a qualified-human decision recorded in the mapping's governanceNotes; resolve them or deliberately re-pin CRG_REVIEW_BASELINE in scripts/audit-crg-graph.js.`,
    });
  }
  if (redundancyDebtExceeded) {
    violations.push({
      code: "CRG-STRUCTURAL-DEBT-RATCHET",
      subject: `redundancy conflicts ${redundancyCount} > baseline ${redundancyBaseline}`,
      message: `transitive redundancy grew from the pinned baseline of ${redundancyBaseline} to ${redundancyCount}. Each conflict means a direct edge overstates the evidence or an authored chain is redundant, and only a qualified human can decide which; resolve them or deliberately re-pin CRG_REDUNDANCY_BASELINE in scripts/audit-crg-graph.js.`,
    });
  }

  const status = violations.length > 0 ? "FAIL" : reviewClassCount > 0 ? "REVIEW" : "PASS";

  return {
    status,
    strict,
    counts: {
      nodes: nodeIds.size,
      edges: edges.length,
      publishedEdges: publishedDirect.size,
      associationEdges: associationEdgeCount,
      cycles: cycles.length,
      bidirectionalPairs: bidirectionalPairs.length,
      redundancyConflicts: redundancyCount,
    },
    reviewDebt: {
      reviewClassCount,
      reviewBaseline,
      redundancyConflicts: redundancyCount,
      redundancyBaseline,
      exceeded: reviewDebtExceeded || redundancyDebtExceeded,
    },
    violations,
    review,
    cycles: cycles.slice(0, MAX_REPORTED_CYCLES),
    bidirectionalPairs,
    redundancy: redundancy.slice(0, MAX_REPORTED_REDUNDANCY),
    truncated: {
      // True when analysis or the derived report was cut short. Display-slice
      // truncation matters for the human queue; budget truncation is already a
      // hard violation above.
      cycles: enumeration.truncated || cycles.length > MAX_REPORTED_CYCLES,
      redundancy: redundancyCount > MAX_REPORTED_REDUNDANCY,
    },
  };
}

function readKnowledgeBaseMappings(kbDir) {
  return fs
    .readdirSync(kbDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8")));
}

/**
 * Read the live authored corpus and run the shipped analysis. This is the
 * single code path behind `npm run audit:crg` and every report generator built
 * on it (for example `scripts/report-crg-triage.js`), so a generator cannot
 * drift from the audit's own verdict by re-implementing the traversal.
 */
function buildReport(options = {}) {
  const kbDir = path.join(process.cwd(), "data", "knowledge-base");
  const mappings = readKnowledgeBaseMappings(kbDir);
  return analyzeGraph(mappings, options);
}

async function main() {
  const strict = process.argv.includes("--strict");
  const report = buildReport({ strict });

  console.log(JSON.stringify(report, null, 2));
  if (report.status === "FAIL") process.exitCode = 1;
  else if (report.strict && report.status === "REVIEW") process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", error: String(error) }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  analyzeGraph,
  buildReport,
  enumerateSimpleCycles,
  CRG_REVIEW_BASELINE,
  CRG_REDUNDANCY_BASELINE,
};
