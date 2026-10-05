import { describe, expect, it } from "vitest";

import { generateClaimPathways } from "@/lib/engine/pathway-generator";
import { MAX_PATHWAY_HOPS } from "@/lib/kb/pathway-depth";
import type { ClaimPathway, KbNodeMapping, NexusClassification } from "@/lib/kb/schema";
import { deriveCompositeNexus } from "@/lib/kb/utils";

import { edgeCount, graph, node, type NodeEdge } from "./helpers/pathway-fixtures";

/**
 * Property-based (seeded fuzz) coverage for the pathway generator.
 *
 * The corpus is generated without adding a dependency: a fixed-seed mulberry32
 * PRNG drives graph construction, so every run exercises the same corpus and a
 * counterexample printed in a failure message is reproducible by rerunning the
 * file (the seed is the only input). Random graphs include cycles by
 * construction — any non-self edge can close a loop — and deep chains, and
 * every node is exercised as the origin.
 *
 * The invariants asserted across the whole corpus are the generator's safety
 * contract:
 *
 *   1. bounded output — never more pathways than the graph has edges;
 *   2. cap compliance — 1..MAX_PATHWAY_HOPS hops per pathway;
 *   3. ancestor freedom — origin and hop targets are pairwise distinct;
 *   4. structural fidelity — contiguity, endpoints, nexus agreement, and
 *      association-only chain breaking;
 *   5. determinism — the same graph yields deep-equal pathways.
 *
 * Targeted deep-chain, cycle-ring, and hub-convergence shapes pin the exact
 * outputs the random corpus only samples statistically.
 */

/* ─── Seeded corpus ───────────────────────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function classificationFor(rand: () => number): NexusClassification {
  const roll = rand();
  if (roll < 0.72) return "DIRECT_CAUSATION";
  if (roll < 0.9) return "AGGRAVATION";
  return "ASSOCIATION_ONLY";
}

/**
 * Random adjacency list: 3–7 nodes, ~45% edge density, self-edges excluded
 * (the schema rejects them), cycles and deep chains allowed. No minimum
 * connectivity is imposed — isolated nodes are part of the corpus.
 */
function randomGraph(seed: number): {
  nodeIds: string[];
  adjacency: Map<string, KbNodeMapping>;
  edgeTotal: number;
} {
  const rand = mulberry32(seed);
  const size = 3 + Math.floor(rand() * 5);
  const nodeIds = Array.from({ length: size }, (_, index) => `n${index}`);
  const nodes = nodeIds.map((nodeId) => {
    const targets = nodeIds.filter((candidate) => candidate !== nodeId && rand() < 0.45);
    const outgoing: NodeEdge[] = targets.map((target, index) => [
      target,
      index + 1,
      classificationFor(rand),
    ]);
    return node(nodeId, ...outgoing);
  });
  const adjacency = graph(...nodes);
  return { nodeIds, adjacency, edgeTotal: edgeCount(adjacency) };
}

/** True when the adjacency list contains a 2-cycle (u→v and v→u). */
function hasMutualEdge(adjacency: Map<string, KbNodeMapping>): boolean {
  for (const [source, mapping] of adjacency) {
    for (const outgoing of mapping.outgoingEdges) {
      const reverse = adjacency.get(outgoing.targetConditionId);
      if (
        reverse?.outgoingEdges.some(
          (candidate) => candidate.targetConditionId === source,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

type CorpusEntry = { label: string; adjacency: Map<string, KbNodeMapping>; edgeTotal: number };

const FUZZ_SEEDS = 160;

const FUZZ_CORPUS: CorpusEntry[] = Array.from({ length: FUZZ_SEEDS }, (_, index) => {
  const seed = index + 1;
  const { nodeIds, adjacency, edgeTotal: edges } = randomGraph(seed);
  return { label: `seed ${seed} (${nodeIds.length} nodes)`, adjacency, edgeTotal: edges };
});

/** Every (graph, origin) pair with its generator output. */
function* corpusRuns(): Generator<{
  entry: CorpusEntry;
  origin: string;
  pathways: ClaimPathway[];
}> {
  for (const entry of FUZZ_CORPUS) {
    for (const origin of entry.adjacency.keys()) {
      yield { entry, origin, pathways: generateClaimPathways(origin, entry.adjacency) };
    }
  }
}

/* ─── Corpus invariants ───────────────────────────────────────────────────── */

describe("seeded fuzz: random cyclic and deep-chain graphs", () => {
  it("exercises cyclic and depth-2 shapes (corpus non-vacuity)", () => {
    // If graph generation ever stops producing cycles or depth-2 runs, the
    // suite's "cyclic and deep-chain" claim would be vacuous — fail loudly.
    expect(FUZZ_CORPUS.some((entry) => hasMutualEdge(entry.adjacency))).toBe(true);

    let total = 0;
    let depthTwo = 0;
    for (const { pathways } of corpusRuns()) {
      total += pathways.length;
      depthTwo += pathways.filter((pathway) => pathway.hops.length === 2).length;
    }
    expect(total).toBeGreaterThan(0);
    expect(depthTwo).toBeGreaterThan(0);
  });

  it("never emits more pathways than the graph has edges (bounded output)", () => {
    const violations: string[] = [];
    for (const { entry, origin, pathways } of corpusRuns()) {
      if (pathways.length > entry.edgeTotal) {
        violations.push(
          `${entry.label}, origin ${origin}: ${pathways.length} pathways > ${entry.edgeTotal} edges`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps every pathway within 1..MAX_PATHWAY_HOPS hops (cap compliance)", () => {
    const violations: string[] = [];
    for (const { entry, origin, pathways } of corpusRuns()) {
      for (const pathway of pathways) {
        if (pathway.hops.length < 1 || pathway.hops.length > MAX_PATHWAY_HOPS) {
          violations.push(
            `${entry.label}, origin ${origin}: ${pathway.hops.length} hops in a pathway`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("never revisits the origin or an earlier hop (ancestor-free chains)", () => {
    const violations: string[] = [];
    for (const { entry, origin, pathways } of corpusRuns()) {
      for (const pathway of pathways) {
        const visited = [origin, ...pathway.hops.map((hop) => hop.edge.targetConditionId)];
        if (new Set(visited).size !== visited.length) {
          violations.push(`${entry.label}, origin ${origin}: ${visited.join(" -> ")}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps contiguity, endpoints, nexus agreement, and chain breaking intact", () => {
    const violations: string[] = [];
    for (const { entry, origin, pathways } of corpusRuns()) {
      const prefix = `${entry.label}, origin ${origin}`;
      for (const pathway of pathways) {
        if (pathway.originConditionId !== origin) {
          violations.push(`${prefix}: origin mismatch`);
        }
        const hops = pathway.hops;
        if (hops[0]?.edge.sourceConditionId !== origin) {
          violations.push(`${prefix}: first hop departs from another condition`);
        }
        if (hops.at(-1)?.edge.targetConditionId !== pathway.terminalConditionId) {
          violations.push(`${prefix}: terminal mismatch`);
        }
        hops.forEach((hop, index) => {
          if (hop.stepIndex !== index) {
            violations.push(`${prefix}: stepIndex drift at ${index}`);
          }
          if (
            index > 0 &&
            hop.edge.sourceConditionId !== hops[index - 1]?.edge.targetConditionId
          ) {
            violations.push(`${prefix}: non-contiguous chain at ${index}`);
          }
        });
        const associationIndex = hops.findIndex(
          (hop) => hop.edge.nexusClaim.nexusClassification === "ASSOCIATION_ONLY",
        );
        if (associationIndex !== -1 && associationIndex !== hops.length - 1) {
          violations.push(`${prefix}: descends past an association-only hop`);
        }
        if (pathway.compositeNexus !== deriveCompositeNexus(hops)) {
          violations.push(`${prefix}: composite nexus drift`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("is deterministic: the same graph yields deep-equal pathways", () => {
    const violations: string[] = [];
    for (const { entry, origin, pathways } of corpusRuns()) {
      const again = generateClaimPathways(origin, entry.adjacency);
      if (JSON.stringify(again) !== JSON.stringify(pathways)) {
        violations.push(`${entry.label}, origin ${origin}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

/* ─── Targeted shapes ─────────────────────────────────────────────────────── */

describe("targeted shapes", () => {
  it("caps a deep chain at the shared depth and never reaches later nodes", () => {
    const length = 7;
    const ids = Array.from({ length }, (_, index) => `c${index}`);
    const adjacency = graph(
      ...ids.map((id, index) =>
        node(id, ...(index < length - 1 ? [[ids[index + 1], 1] as NodeEdge] : [])),
      ),
    );

    const pathways = generateClaimPathways(ids[0], adjacency);
    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual([
      ids[1],
      ids[2],
    ]);
    expect(pathways.every((pathway) => pathway.hops.length <= MAX_PATHWAY_HOPS)).toBe(true);
    // c3..c6 exist in the chain but are beyond the depth cap.
    expect(pathways.some((pathway) => pathway.terminalConditionId === ids[3])).toBe(false);
  });

  it("stays bounded on a pure cycle ring for every origin", () => {
    for (const size of [3, 4, 8]) {
      const ids = Array.from({ length: size }, (_, index) => `r${index}`);
      const adjacency = graph(
        ...ids.map((id, index) => node(id, [ids[(index + 1) % size], 1])),
      );

      for (const origin of ids) {
        const pathways = generateClaimPathways(origin, adjacency);
        // One edge out and one two-hop continuation; the closing ring edge is
        // only reachable at depth 3, so it can never be emitted.
        expect(pathways, `ring size ${size}, origin ${origin}`).toHaveLength(2);
        expect(new Set(pathways.map((pathway) => pathway.terminalConditionId)).size).toBe(2);
        expect(
          pathways.every((pathway) => pathway.originConditionId === origin),
        ).toBe(true);
      }
    }
  });

  it("keeps every convergent arm when many branches share a terminal", () => {
    const adjacency = graph(
      node("root", ["a", 1], ["b", 2], ["c", 3]),
      node("a", ["sink", 1]),
      node("b", ["sink", 1]),
      node("c", ["sink", 1]),
    );

    const pathways = generateClaimPathways("root", adjacency);
    expect(pathways).toHaveLength(6);

    const sinkPaths = pathways.filter((pathway) => pathway.terminalConditionId === "sink");
    expect(sinkPaths).toHaveLength(3);
    expect(
      sinkPaths.map((pathway) => pathway.hops[0].edge.targetConditionId).sort(),
    ).toEqual(["a", "b", "c"]);
  });
});
