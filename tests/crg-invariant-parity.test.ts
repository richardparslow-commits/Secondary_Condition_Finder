import { describe, expect, it } from "vitest";

import {
  assertNoCausationCycle,
  bidirectionalPairs,
  canonicalPairKey,
  enumerateAdjacencyCycles,
  GRAPH_GOVERNANCE_VERSION,
  isGovernedCycleFinding,
  reconcileGovernance,
} from "@/lib/kb/graph-cycle-policy";
import type { KbNodeMapping } from "@/lib/kb/schema";

import { analyzeGraph } from "../scripts/audit-crg-graph";
import { node } from "./helpers/pathway-fixtures";

/**
 * Invariant parity across the three enforcement points (audit A08).
 *
 * The A08 finding was not that the cycle rule was wrong — it was that the rule
 * lived in three places and disagreed. `src/lib/kb/graph-cycle-policy.ts` is
 * now the one contract imported by the runtime loader (`src/lib/kb/graph.ts`)
 * and the adjacency gate (`scripts/audit-crg.ts`), but the corpus audit
 * (`scripts/audit-crg-graph.js`) runs over authored mappings rather than
 * adjacency files and cannot import that module under the CI Node runtime, so
 * its rule table is necessarily a second statement of the same policy.
 *
 * This suite is the guard against those two statements drifting apart. Each
 * shape is built ONCE as adjacency nodes and the authored-mapping view is
 * derived from those same nodes, so the two representations cannot describe
 * different graphs by accident; then all three points are asked about it and
 * the answers must agree:
 *
 *   - `enumerateAdjacencyCycles` / `classifyCycle` (the shared policy, which
 *     the runtime loader's `assertNoCausationCycle` and the adjacency gate
 *     both consume);
 *   - `assertNoCausationCycle` itself (what the loader calls at load time);
 *   - `analyzeGraph` (the corpus audit's structural verdict).
 *
 * A divergence fails here instead of shipping as "CI is green while production
 * rejects" or the reverse, which is exactly what the audit found.
 */

/* ─── Shape builders ───────────────────────────────────────────────────── */

/** Authored-mapping view of an adjacency graph — derived, never hand-written. */
function asAuthoredMappings(
  nodes: readonly KbNodeMapping[],
  options: { draft?: boolean; governanceNotes?: Record<string, string[]> } = {},
) {
  return nodes.map((entry) => ({
    id: entry.nodeId,
    draft: options.draft ?? false,
    todo: [] as string[],
    governanceNotes: options.governanceNotes?.[entry.nodeId],
    suggestions: entry.outgoingEdges.map((edge) => ({
      conditionId: edge.targetConditionId,
      rank: edge.rank,
      nexusClaim: { nexusClassification: edge.nexusClaim.nexusClassification },
    })),
  }));
}

const ALL_CAUSATION_RING = [
  node("a", ["b", 1]),
  node("b", ["c", 1]),
  node("c", ["a", 1]),
];

const ASSOCIATION_BEARING_RING = [
  node("a", ["b", 1, "ASSOCIATION_ONLY"]),
  node("b", ["c", 1]),
  node("c", ["a", 1]),
];

const AGGRAVATION_RING = [
  node("a", ["b", 1, "AGGRAVATION"]),
  node("b", ["c", 1, "AGGRAVATION"]),
  node("c", ["a", 1, "AGGRAVATION"]),
];

const RECIPROCAL_CAUSATION_PAIR = [
  node("a", ["b", 1]),
  node("b", ["a", 1]),
];

const RECIPROCAL_ASSOCIATION_PAIR = [
  node("a", ["b", 1, "ASSOCIATION_ONLY"]),
  node("b", ["a", 1, "ASSOCIATION_ONLY"]),
];

const RECIPROCAL_ASSOCIATION_CAUSATION_PAIR = [
  node("a", ["b", 1, "ASSOCIATION_ONLY"]),
  node("b", ["a", 1]),
];

const CLEAN_FORWARD_GRAPH = [
  node("a", ["b", 1]),
  node("b", ["c", 1, "AGGRAVATION"]),
];

const classifier = (nodes: readonly KbNodeMapping[]) =>
  enumerateAdjacencyCycles(nodes).cycles.map((cycle) => ({
    severity: cycle.severity,
    code: cycle.code,
    nodeIds: cycle.nodeIds,
  }));

const runtimeRejects = (nodes: readonly KbNodeMapping[]): boolean => {
  try {
    assertNoCausationCycle(nodes);
    return false;
  } catch {
    return true;
  }
};

const violationCodes = (nodes: readonly KbNodeMapping[]): string[] =>
  analyzeGraph(asAuthoredMappings(nodes)).violations.map((finding) => finding.code);

/* ─── The agreement contract ───────────────────────────────────────────── */

describe("CRG cycle invariants agree across runtime, adjacency gate and corpus audit (A08)", () => {
  const violationShapes = [
    { name: "a three-node all-causation cycle", nodes: ALL_CAUSATION_RING },
    { name: "a reciprocal causation pair", nodes: RECIPROCAL_CAUSATION_PAIR },
  ] as const;

  it.each(violationShapes)("$name is a violation everywhere", ({ nodes }) => {
    const classified = classifier(nodes);
    expect(classified.length).toBeGreaterThan(0);
    expect(classified.every((cycle) => cycle.severity === "violation")).toBe(true);
    expect(classified.every((cycle) => cycle.code === "CRG-PURE-CAUSATION-CYCLE")).toBe(true);

    // The runtime loader's own check refuses the same shapes …
    expect(runtimeRejects(nodes)).toBe(true);

    // … and the corpus audit reports them as hard violations, never as review.
    const report = analyzeGraph(asAuthoredMappings(nodes));
    expect(report.status).toBe("FAIL");
    expect(report.violations.some((finding) => finding.code === "CRG-PURE-CAUSATION-CYCLE")).toBe(true);
    expect(report.review.some((finding) => finding.code === "CRG-PURE-CAUSATION-CYCLE")).toBe(false);
  });

  const reviewShapes = [
    { name: "a cycle with one association hop", nodes: ASSOCIATION_BEARING_RING, code: "CRG-ASSOCIATION-CYCLE" },
    { name: "an aggravation cycle", nodes: AGGRAVATION_RING, code: "CRG-CYCLE" },
    { name: "a reciprocal association/causation pair", nodes: RECIPROCAL_ASSOCIATION_CAUSATION_PAIR, code: "CRG-ASSOCIATION-CYCLE" },
    { name: "a reciprocal association-only pair", nodes: RECIPROCAL_ASSOCIATION_PAIR, code: "CRG-ASSOCIATION-CYCLE" },
  ] as const;

  it.each(reviewShapes)("$name is review-class in every point, never a load-time rejection", ({ nodes, code }) => {
    const classified = classifier(nodes);
    expect(classified.length).toBeGreaterThan(0);
    expect(classified.some((cycle) => cycle.severity === "review" && cycle.code === code)).toBe(true);

    // Medically legitimate directions are not deleted to make a DAG check pass:
    // the runtime admits the shape (an association hop breaks the legal chain,
    // an aggravation loop is a clinical-review question).
    expect(runtimeRejects(nodes)).toBe(false);

    // The corpus audit keeps it out of violations in its default mode …
    const report = analyzeGraph(asAuthoredMappings(nodes));
    expect(report.status).toBe("REVIEW");
    expect(report.violations).toEqual([]);

    // … and its --strict maintainer gate upgrades every review finding, so a
    // strict run is stricter than the runtime in exactly one direction. A
    // review shape must never be *silently* absent from both lists.
    const strict = analyzeGraph(asAuthoredMappings(nodes), { strict: true });
    expect(strict.status).toBe("FAIL");
    expect(strict.review).toEqual([]);
    expect(strict.violations.length).toBeGreaterThan(0);
  });

  it("agrees that a clean forward graph is clean everywhere", () => {
    expect(classifier(CLEAN_FORWARD_GRAPH)).toEqual([]);
    expect(runtimeRejects(CLEAN_FORWARD_GRAPH)).toBe(false);
    expect(violationCodes(CLEAN_FORWARD_GRAPH)).toEqual([]);
  });
});

/* ─── Reciprocal relationships are governed once ───────────────────────── */

describe("reciprocal relationships are governed once, as a pair (A08)", () => {
  it("books a two-node cycle as its pair, not as a second cycle finding", () => {
    const twoNodeCycle = classifier(RECIPROCAL_ASSOCIATION_PAIR)[0];
    expect(twoNodeCycle?.nodeIds).toHaveLength(2);
    // The pair entry is the record; a separate cycle entry would keep the pair
    // in REVIEW even after the required justification was authored, which is
    // why the corpus audit skips two-node cycles and this policy does too.
    const classified = enumerateAdjacencyCycles(RECIPROCAL_ASSOCIATION_PAIR).cycles;
    expect(classified.filter(isGovernedCycleFinding)).toEqual([]);

    const pairs = bidirectionalPairs(RECIPROCAL_ASSOCIATION_PAIR);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.key).toBe(canonicalPairKey("a", "b"));
    // Association in both directions means neither side claims a nexus, but
    // each direction is still a separately guarded authored claim.
    expect(pairs[0]?.requiresGovernance).toBe(false);
  });

  it("flags a pair whose direction claims causation or aggravation for its own justification", () => {
    const pairs = bidirectionalPairs(RECIPROCAL_ASSOCIATION_CAUSATION_PAIR);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.aToB).toBe("ASSOCIATION_ONLY");
    expect(pairs[0]?.bToA).toBe("DIRECT_CAUSATION");
    expect(pairs[0]?.requiresGovernance).toBe(true);
  });

  it("requires the corpus audit's governance notes on BOTH mapping files for a published pair", () => {
    const withoutNotes = asAuthoredMappings(RECIPROCAL_ASSOCIATION_PAIR);
    const ungoverned = analyzeGraph(withoutNotes);
    expect(ungoverned.review.some((finding) => finding.code === "CRG-BIDIRECTIONAL-GOVERNANCE")).toBe(true);
    // The cycle itself is deliberately not reported as a second finding.
    expect(
      ungoverned.review.some((finding) => finding.code === "CRG-ASSOCIATION-CYCLE" || finding.code === "CRG-CYCLE"),
    ).toBe(false);

    const withNotes = asAuthoredMappings(RECIPROCAL_ASSOCIATION_PAIR, {
      governanceNotes: {
        a: ["Reciprocal pair reviewed; each direction independently guarded."],
        b: ["Reciprocal pair reviewed with condition-specific citations."],
      },
    });
    const governed = analyzeGraph(withNotes);
    expect(governed.status).toBe("PASS");
    expect(governed.review.some((finding) => finding.code === "CRG-BIDIRECTIONAL-GOVERNANCE")).toBe(false);
    expect(governed.bidirectionalPairs[0]?.governanceNotesOnBoth).toBe(true);
  });

  it("reconciles the adjacency ledger in both directions", () => {
    const cycles = enumerateAdjacencyCycles(ASSOCIATION_BEARING_RING).cycles;
    const pairs = bidirectionalPairs(RECIPROCAL_ASSOCIATION_CAUSATION_PAIR);
    const cycleNodes = cycles.filter(isGovernedCycleFinding)[0]!.nodeIds;
    const pairKey = pairs[0]!.key;
    const [pairA, pairB] = pairKey.split("<->") as [string, string];

    const empty = { version: GRAPH_GOVERNANCE_VERSION, reviewedCycles: [], reviewedBidirectionalPairs: [] };
    const ungovernedResult = reconcileGovernance(cycles, pairs, empty);
    expect(ungovernedResult.ungoverned).toHaveLength(1);
    expect(ungovernedResult.ungovernedPairs).toHaveLength(1);
    expect(ungovernedResult.staleCycles).toEqual([]);
    expect(ungovernedResult.stalePairs).toEqual([]);

    const governed = {
      version: GRAPH_GOVERNANCE_VERSION,
      reviewedCycles: [{ nodes: cycleNodes, disposition: "recorded decision" }],
      reviewedBidirectionalPairs: [{ pair: [pairA, pairB] as [string, string], disposition: "recorded decision" }],
    };
    expect(reconcileGovernance(cycles, pairs, governed)).toMatchObject({
      ungoverned: [],
      ungovernedPairs: [],
      staleCycles: [],
      stalePairs: [],
    });

    // A ledger that describes a graph that no longer exists fails the gate: the
    // record must keep describing what it governs.
    const stale = {
      version: GRAPH_GOVERNANCE_VERSION,
      reviewedCycles: [{ nodes: ["gone-a", "gone-b", "gone-c"], disposition: "recorded decision" }],
      reviewedBidirectionalPairs: [],
    };
    const staleResult = reconcileGovernance(cycles, pairs, stale);
    expect(staleResult.staleCycles).toEqual(["gone-a->gone-b->gone-c"]);
    expect(staleResult.stalePairs).toEqual([]);
    // The live pair is still ungoverned; a stale entry elsewhere cannot stand
    // in for the disposition this shape needs.
    expect(staleResult.ungovernedPairs).toHaveLength(1);
  });

  it("cannot clear a reciprocal pair with a cycle entry", () => {
    // The pair entry is the only record that can clear a pair, so a reviewer
    // cannot satisfy the gate by booking the two-node cycle instead — and the
    // adjacency gate rejects such an entry outright when it parses the ledger.
    const pairs = bidirectionalPairs(RECIPROCAL_ASSOCIATION_PAIR);
    const ledger = {
      version: GRAPH_GOVERNANCE_VERSION,
      reviewedCycles: [{ nodes: ["b", "a"], disposition: "recorded decision" }],
      reviewedBidirectionalPairs: [],
    };
    const result = reconcileGovernance(
      enumerateAdjacencyCycles(RECIPROCAL_ASSOCIATION_PAIR).cycles,
      pairs,
      ledger,
    );
    expect(result.ungovernedPairs).toHaveLength(1);
    // Canonicalized to the lowest-ordered rotation, and stale: no governed
    // cycle can have two nodes.
    expect(result.staleCycles).toEqual(["a->b"]);
  });
});
