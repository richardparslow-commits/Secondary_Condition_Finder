/**
 * The single directed-cycle contract for the CRG adjacency layer (audit A08).
 *
 * One policy, four enforcement points. Before this module, the runtime loader
 * rejected only cycles composed entirely of `DIRECT_CAUSATION` edges while the
 * CI adjacency gate (`scripts/audit-crg.ts`) rejected **every** cycle it found
 * — so a medically legitimate association-only bidirectional pair would load
 * in production and fail CI, and the gate's "the adjacency list is acyclic"
 * message was a blanket-DAG claim no reviewer could reconcile with the policy
 * the product actually enforced. The corpus-level audit
 * (`scripts/audit-crg-graph.js`) implemented the intended policy separately
 * again, in a third place.
 *
 * The intended policy, now stated once and imported by every point:
 *
 *   - a cycle whose every edge is `DIRECT_CAUSATION` is a **violation**
 *     everywhere: a closed proximate-cause loop is not a defensible etiology
 *     and is rejected at load (fail-closed) as well as in CI;
 *   - a cycle containing an `ASSOCIATION_ONLY` edge, an aggravation cycle, and
 *     a bidirectional pair are **review** findings: medically legitimate
 *     shapes whose directions must be independently guarded. The runtime
 *     loader admits them (an association hop breaks the legal chain by
 *     construction, and the traversal is cycle-safe regardless), and CI admits
 *     them only when a recorded disposition exists in
 *     `docs/crg-adjacency-governance-ledger.json`. Deleting a defensible
 *     direction to make a blanket DAG check pass is explicitly not the fix.
 *
 * The same table is stated a third time, in JavaScript, by the corpus audit
 * (`scripts/audit-crg-graph.js`), which runs over authored mappings rather
 * than adjacency files and therefore cannot import this module under the CI
 * Node runtime. `tests/crg-invariant-parity.test.ts` pins the two against each
 * other on synthetic shapes, so a divergence between the runtime, the
 * adjacency gate and the corpus audit fails a test instead of shipping.
 *
 * This module is **dependency-free** (no zod, no `server-only`, no Node APIs)
 * on purpose: the server loader, the Node-run CI scripts (which run under type
 * stripping, where `server-only` imports throw) and the tests all share it, so
 * the classification table cannot drift between enforcement points. Types are
 * structural so a parsed `KbNodeMapping` satisfies them without an import.
 */

/** The three legal nexus classifications, mirrored structurally. */
export type NexusClassificationName =
  | "DIRECT_CAUSATION"
  | "AGGRAVATION"
  | "ASSOCIATION_ONLY";

/** Structural edge shape: anything with a target and a legal classification. */
export interface AdjacencyEdgeLike {
  targetConditionId: string;
  nexusClaim: { nexusClassification: NexusClassificationName };
}

/** Structural node shape: a root id plus the edges departing it. */
export interface AdjacencyNodeLike {
  nodeId: string;
  outgoingEdges: readonly AdjacencyEdgeLike[];
}

export type CycleFindingCode =
  | "CRG-PURE-CAUSATION-CYCLE"
  | "CRG-ASSOCIATION-CYCLE"
  | "CRG-CYCLE";

/**
 * `violation` is rejected everywhere (load and CI). `review` is admitted only
 * with a recorded disposition at the CI boundary; the runtime loader admits it
 * unconditionally because these shapes are legitimate and the traversal is
 * cycle-safe by construction.
 */
export type CycleSeverity = "violation" | "review";

export interface ClassifiedCycle {
  /** Node ids in traversal order, without the repeated closing node. */
  nodeIds: string[];
  /** Canonical display path, `a -> b -> c -> a`. */
  path: string;
  code: CycleFindingCode;
  severity: CycleSeverity;
  /** Per-edge classification, in traversal order. */
  classifications: NexusClassificationName[];
}

/**
 * Classify one cycle from the classifications of its edges.
 *
 * The rule is a property of the edge set, not of cycle length or of which
 * direction a reviewer happens to have authored first, so the runtime and CI
 * verdicts are identical by construction.
 */
export function classifyCycle(
  classifications: readonly NexusClassificationName[],
): { code: CycleFindingCode; severity: CycleSeverity } {
  if (
    classifications.length > 0 &&
    classifications.every((value) => value === "DIRECT_CAUSATION")
  ) {
    return { code: "CRG-PURE-CAUSATION-CYCLE", severity: "violation" };
  }
  if (classifications.includes("ASSOCIATION_ONLY")) {
    return { code: "CRG-ASSOCIATION-CYCLE", severity: "review" };
  }
  // Mixed causation/aggravation or aggravation-only: a clinical-review
  // question, never a structural impossibility.
  return { code: "CRG-CYCLE", severity: "review" };
}

/** True when this finding must be rejected everywhere. */
export function isViolationCycle(cycle: ClassifiedCycle): boolean {
  return cycle.severity === "violation";
}

/**
 * Rotation-independent canonical key for a **directed** cycle.
 *
 * The same loop always canonicalizes to the same string, whichever node the
 * enumerator started from, so a governance entry written by a human and the
 * gate's live finding compare equal. The direction is significant (reversing a
 * cycle is a different claim), so rotation is normalized and reversal is not.
 * A caller may pass the closed form (`a, b, a`) used for display.
 */
export function canonicalCycleKey(nodeIds: readonly string[]): string {
  const open = [...nodeIds];
  if (open.length > 1 && open[0] === open[open.length - 1]) open.pop();
  if (open.length === 0) return "";
  let pivot = 0;
  for (let index = 1; index < open.length; index += 1) {
    if (open[index]! < open[pivot]!) pivot = index;
  }
  return [...open.slice(pivot), ...open.slice(0, pivot)].join("->");
}

/** Order-independent canonical key for an undirected bidirectional pair. */
export function canonicalPairKey(a: string, b: string): string {
  return a <= b ? `${a}<->${b}` : `${b}<->${a}`;
}

/**
 * Minimal step/cycle budgets. Exhausting either is reported as `truncated` so
 * a caller must fail closed instead of treating a partial enumeration as the
 * whole graph.
 */
export const CYCLE_ENUMERATION_MAX_STEPS = 500_000;
export const CYCLE_ENUMERATION_MAX_CYCLES = 2_000;

/**
 * Enumerate every simple directed cycle exactly once, classified.
 *
 * Canonical roots (Tiernan-style): a cycle is emitted only from its
 * lowest-ordered node, so each loop appears once and the output is
 * deterministic. There is deliberately no cycle-length cap — a 13-node
 * pure-causation cycle is exactly as invalid as a 3-node one.
 */
export function enumerateAdjacencyCycles(
  nodes: readonly AdjacencyNodeLike[],
  options: { maxSteps?: number; maxCycles?: number } = {},
): { cycles: ClassifiedCycle[]; truncated: boolean } {
  const maxSteps = options.maxSteps ?? CYCLE_ENUMERATION_MAX_STEPS;
  const maxCycles = options.maxCycles ?? CYCLE_ENUMERATION_MAX_CYCLES;

  const ids = nodes.map((node) => node.nodeId);
  const order = new Map([...ids].sort().map((id, index) => [id, index]));
  const adjacency = new Map<string, AdjacencyEdgeLike[]>();
  for (const node of nodes) {
    const existing = adjacency.get(node.nodeId) ?? [];
    adjacency.set(node.nodeId, [...existing, ...node.outgoingEdges]);
  }

  const cycles: ClassifiedCycle[] = [];
  let steps = 0;
  let truncated = false;

  for (const start of [...ids].sort()) {
    const pathNodes: string[] = [start];
    const pathEdges: AdjacencyEdgeLike[] = [];
    const onPath = new Set<string>([start]);

    const visit = (current: string): void => {
      for (const edge of adjacency.get(current) ?? []) {
        steps += 1;
        if (steps > maxSteps || cycles.length >= maxCycles) {
          truncated = true;
          return;
        }
        const target = edge.targetConditionId;
        if (target === start) {
          const classifications = [...pathEdges, edge].map(
            (hop) => hop.nexusClaim.nexusClassification,
          );
          const { code, severity } = classifyCycle(classifications);
          cycles.push({
            nodeIds: [...pathNodes],
            path: [...pathNodes, start].join(" -> "),
            code,
            severity,
            classifications,
          });
          continue;
        }
        // Only nodes present in this graph can continue a cycle, and a cycle is
        // emitted once from its lowest-ordered node.
        if (!adjacency.has(target) || onPath.has(target)) continue;
        if ((order.get(target) ?? 0) < (order.get(start) ?? 0)) continue;
        onPath.add(target);
        pathNodes.push(target);
        pathEdges.push(edge);
        visit(target);
        pathEdges.pop();
        pathNodes.pop();
        onPath.delete(target);
        if (truncated) return;
      }
    };

    visit(start);
    if (truncated) break;
  }

  cycles.sort(
    (left, right) =>
      left.nodeIds.length - right.nodeIds.length || left.path.localeCompare(right.path),
  );
  return { cycles, truncated };
}

/**
 * The runtime fail-closed check: does the graph contain a directed cycle of
 * only `DIRECT_CAUSATION` edges?
 *
 * Iterative 3-color DFS over the causation-only subgraph: WHITE unvisited,
 * GRAY on the current path (a causation edge into a GRAY node closes the loop),
 * BLACK proven cycle-free. Linear in the causation subgraph, so the loader
 * pays nothing for the review-class shapes it admits. Self-loops cannot be
 * authored (the edge schema rejects self-reference) but are handled the same
 * way as any other one-node cycle.
 */
export function assertNoCausationCycle(nodes: readonly AdjacencyNodeLike[]): void {
  const causationTargets = new Map<string, string[]>();
  for (const node of nodes) {
    const targets: string[] = [];
    for (const edge of node.outgoingEdges) {
      if (edge.nexusClaim.nexusClassification === "DIRECT_CAUSATION") {
        targets.push(edge.targetConditionId);
      }
    }
    causationTargets.set(node.nodeId, targets);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: Array<{ id: string; next: number }> = [];

  for (const root of causationTargets.keys()) {
    if ((color.get(root) ?? WHITE) !== WHITE) continue;
    stack.push({ id: root, next: 0 });
    color.set(root, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const targets = causationTargets.get(frame.id) ?? [];
      if (frame.next >= targets.length) {
        color.set(frame.id, BLACK);
        stack.pop();
        continue;
      }
      const target = targets[frame.next]!;
      frame.next += 1;
      // Targets outside this graph are leaves: only nodes in the graph can
      // continue a cycle.
      if (!causationTargets.has(target)) continue;
      const targetColor = color.get(target) ?? WHITE;
      if (targetColor === GRAY) {
        throw new Error("[kb-graph] Causation cycle detected.");
      }
      if (targetColor === WHITE) {
        color.set(target, GRAY);
        stack.push({ id: target, next: 0 });
      }
    }
  }
}

export interface BidirectionalPair {
  a: string;
  b: string;
  /** Canonical `min<->max` display key. */
  key: string;
  /** Classification of `a -> b`. */
  aToB: NexusClassificationName;
  /** Classification of `b -> a`. */
  bToA: NexusClassificationName;
  /**
   * True when either direction asserts causation or aggravation. A pair that
   * claims a nexus in one direction and an association in the other is exactly
   * the shape the audit requires to be independently guarded, so it needs a
   * recorded disposition just like a review-class cycle.
   */
  requiresGovernance: boolean;
}

/**
 * Every bidirectional pair in the adjacency graph.
 *
 * A pair is legitimate when each direction is independently guarded (the
 * corpus policy for OSA ↔ hypertension and similar shapes), so this is never
 * an automatic failure — it is the list CI reconciles against the governance
 * ledger so a new reciprocal direction cannot land without a recorded
 * disposition.
 */
export function bidirectionalPairs(
  nodes: readonly AdjacencyNodeLike[],
): BidirectionalPair[] {
  const classificationOf = new Map<string, NexusClassificationName>();
  for (const node of nodes) {
    for (const edge of node.outgoingEdges) {
      classificationOf.set(
        `${node.nodeId}->${edge.targetConditionId}`,
        edge.nexusClaim.nexusClassification,
      );
    }
  }

  const pairs: BidirectionalPair[] = [];
  for (const [key, aToB] of classificationOf) {
    const [a, b] = key.split("->") as [string, string];
    // Emit each unordered pair once, from the lexicographically smaller side.
    if (a >= b) continue;
    const bToA = classificationOf.get(`${b}->${a}`);
    if (!bToA) continue;
    pairs.push({
      a,
      b,
      key: canonicalPairKey(a, b),
      aToB,
      bToA,
      requiresGovernance: [aToB, bToA].some(
        (value) => value === "DIRECT_CAUSATION" || value === "AGGRAVATION",
      ),
    });
  }
  pairs.sort((left, right) => left.key.localeCompare(right.key));
  return pairs;
}

/**
 * The shortest cycle that needs its OWN ledger entry.
 *
 * A two-node cycle is exactly a bidirectional pair, so the corpus audit
 * (`scripts/audit-crg-graph.js`) deliberately skips it there rather than count
 * the same shape twice — otherwise a reviewed pair would stay in REVIEW even
 * after the required justification was authored. This policy does the same: a
 * reciprocal relationship is governed through the pair entry, and a longer
 * review cycle (which has no pair representation) needs its own. A two-node
 * cycle is still enumerated and classified, so a reciprocal *causation* pair
 * remains a violation; only the review-class bookkeeping is shared.
 */
export const MIN_GOVERNED_CYCLE_LENGTH = 3;

/**
 * True when a review-class cycle needs its own ledger entry: not a violation
 * (those are rejected everywhere and no disposition buys them admission) and
 * not a two-node cycle (governed by its pair entry).
 */
export function isGovernedCycleFinding(cycle: ClassifiedCycle): boolean {
  return cycle.severity === "review" && cycle.nodeIds.length >= MIN_GOVERNED_CYCLE_LENGTH;
}

/**
 * The reviewed-disposition ledger for non-causation cycles and bidirectional
 * pairs (`docs/crg-adjacency-governance-ledger.json`).
 *
 * Entries are authored by a qualified human; the gate only reads them. Both
 * directions of reconciliation are enforced: every live finding must have an
 * entry (otherwise a legitimate-but-unreviewed shape lands silently) and every
 * entry must match a live finding (otherwise the ledger claims a review of
 * something that no longer exists, and the record stops describing the graph).
 */
export interface GraphGovernanceLedger {
  version: number;
  note?: string;
  reviewedCycles: Array<{ nodes: string[]; disposition: string }>;
  reviewedBidirectionalPairs: Array<{ pair: [string, string]; disposition: string }>;
}

export const GRAPH_GOVERNANCE_VERSION = 1;

export interface GovernanceReconciliation {
  /** Live review-class findings with no recorded disposition. */
  ungoverned: ClassifiedCycle[];
  /** Live bidirectional pairs with no recorded disposition. */
  ungovernedPairs: BidirectionalPair[];
  /** Ledger entries that match no live finding. */
  staleCycles: string[];
  stalePairs: string[];
}

/**
 * Reconcile live review-class findings against the ledger, both directions.
 *
 * Violation-severity cycles are deliberately absent from the input contract:
 * they are rejected everywhere and a disposition cannot buy them admission.
 * Two-node cycles are absent too: they are the bidirectional pairs, which are
 * reconciled through `reviewedBidirectionalPairs` (see
 * `isGovernedCycleFinding`), so one shape is never booked twice.
 */
export function reconcileGovernance(
  cycles: readonly ClassifiedCycle[],
  pairs: readonly BidirectionalPair[],
  ledger: GraphGovernanceLedger,
): GovernanceReconciliation {
  const reviewCycles = cycles.filter(isGovernedCycleFinding);

  const governedCycles = new Set(
    ledger.reviewedCycles.map((entry) => canonicalCycleKey(entry.nodes)),
  );
  const liveCycleKeys = new Set(reviewCycles.map((cycle) => canonicalCycleKey(cycle.nodeIds)));

  const governedPairs = new Set(
    ledger.reviewedBidirectionalPairs.map((entry) => canonicalPairKey(...entry.pair)),
  );
  const livePairKeys = new Set(pairs.map((pair) => pair.key));

  return {
    ungoverned: reviewCycles.filter(
      (cycle) => !governedCycles.has(canonicalCycleKey(cycle.nodeIds)),
    ),
    ungovernedPairs: pairs.filter((pair) => !governedPairs.has(pair.key)),
    staleCycles: [...governedCycles].filter((key) => !liveCycleKeys.has(key)).sort(),
    stalePairs: [...governedPairs].filter((key) => !livePairKeys.has(key)).sort(),
  };
}
