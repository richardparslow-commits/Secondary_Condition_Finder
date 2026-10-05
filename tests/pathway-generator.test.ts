import { describe, expect, it } from "vitest";

import { generateClaimPathways } from "@/lib/engine/pathway-generator";
import { isWithinPathwayDepth, MAX_PATHWAY_HOPS } from "@/lib/kb/pathway-depth";
import {
  ClaimPathwaySchema,
  KbEdgeSchema,
  type KbNodeMapping,
} from "@/lib/kb/schema";
import { deriveCompositeNexus } from "@/lib/kb/utils";

import { edgeInput, graph, hop, node } from "./helpers/pathway-fixtures";

/**
 * Contract coverage for the multi-hop pathway generator and the shared
 * pathway-depth cap.
 *
 * The generator previously had no executable coverage at all: its termination
 * guarantees (cycle guard, depth cap) and its convergence guarantee (a branch
 * set, not a global visited set) existed only as module documentation. These
 * tests pin:
 *
 *   - the shared `MAX_PATHWAY_HOPS` cap and its consumers (schema bound,
 *     composite reducer, generator),
 *   - cycle termination on a schema-valid cyclic graph plus an unvalidated
 *     self-edge that cannot loop even if it bypasses the schema,
 *   - convergent pathways through distinct intermediates both surviving,
 *   - association-only chain breaking, terminal ordering, and endpoint
 *     integrity.
 *
 * Fixtures come from `./helpers/pathway-fixtures`, which parses every edge and
 * node through `KbEdgeSchema`/`KbNodeMappingSchema` — so a test cannot pass
 * against a graph shape the runtime loader would reject. The seeded fuzz suite
 * in `./pathway-generator-fuzz.test.ts` generalizes these contracts over
 * generated cyclic and deep-chain graphs.
 */

/* ─── Shared depth contract ───────────────────────────────────────────────── */

describe("shared pathway-depth contract", () => {
  it("pins the cap to the published secondary/tertiary contract", () => {
    // Primary → Secondary → Tertiary is the deepest lawful pathway the
    // product presents; changing this is a contract change, not a tweak.
    expect(MAX_PATHWAY_HOPS).toBe(2);
    expect(isWithinPathwayDepth(0)).toBe(true);
    expect(isWithinPathwayDepth(MAX_PATHWAY_HOPS)).toBe(true);
    expect(isWithinPathwayDepth(MAX_PATHWAY_HOPS + 1)).toBe(false);
  });

  it("bounds the schema's hop chain to the shared cap", () => {
    const threeHops = [
      hop(0, "alpha", "beta"),
      hop(1, "beta", "gamma"),
      hop(2, "gamma", "delta"),
    ];
    const overDepth = ClaimPathwaySchema.safeParse({
      originConditionId: "alpha",
      terminalConditionId: "delta",
      hops: threeHops,
      compositeNexus: "DIRECT_CAUSATION",
    });
    expect(overDepth.success).toBe(false);

    // Same fixtures, one hop fewer: the rejection above is the cap, not a
    // malformed fixture.
    const withinDepth = ClaimPathwaySchema.safeParse({
      originConditionId: "alpha",
      terminalConditionId: "gamma",
      hops: threeHops.slice(0, MAX_PATHWAY_HOPS),
      compositeNexus: "DIRECT_CAUSATION",
    });
    expect(withinDepth.success).toBe(true);
  });

  it("makes the composite reducer fail fast on an over-depth chain", () => {
    const threeHops = [
      hop(0, "alpha", "beta"),
      hop(1, "beta", "gamma"),
      hop(2, "gamma", "delta"),
    ];
    expect(() => deriveCompositeNexus(threeHops)).toThrowError(
      /shared pathway-depth cap/,
    );
    expect(deriveCompositeNexus(threeHops.slice(0, MAX_PATHWAY_HOPS))).toBe(
      "DIRECT_CAUSATION",
    );
  });
});

/* ─── Traversal behavior ──────────────────────────────────────────────────── */

describe("generateClaimPathways", () => {
  it("emits every lawful depth-1 and depth-2 pathway and stops at the cap", () => {
    const pathways = generateClaimPathways(
      "alpha",
      graph(
        node("alpha", ["beta", 1]),
        node("beta", ["gamma", 1]),
        node("gamma", ["delta", 1]),
      ),
    );

    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual([
      "beta",
      "gamma",
    ]);
    expect(pathways.map((pathway) => pathway.hops.length)).toEqual([1, 2]);
    expect(pathways.every((pathway) => pathway.hops.length <= MAX_PATHWAY_HOPS)).toBe(true);
    // The three-hop terminal exists in the graph but must never be reached.
    expect(pathways.some((pathway) => pathway.terminalConditionId === "delta")).toBe(false);
  });

  it("follows authored rank order regardless of array order", () => {
    const pathways = generateClaimPathways(
      "alpha",
      graph(
        // Array order deliberately contradicts rank order.
        node("alpha", ["beta", 2], ["gamma", 1]),
      ),
    );

    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual([
      "gamma",
      "beta",
    ]);
  });

  it("keeps convergent pathways through distinct intermediates", () => {
    // A→B→D and A→C→D are distinct lawful claims; a global visited set would
    // wrongly suppress one of them.
    const pathways = generateClaimPathways(
      "alpha",
      graph(
        node("alpha", ["beta", 1], ["gamma", 2]),
        node("beta", ["delta", 1]),
        node("gamma", ["delta", 1]),
      ),
    );

    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual([
      "beta",
      "delta",
      "gamma",
      "delta",
    ]);

    const deltaPaths = pathways.filter((pathway) => pathway.terminalConditionId === "delta");
    expect(deltaPaths).toHaveLength(2);
    expect(
      deltaPaths.map((pathway) => pathway.hops[0].edge.targetConditionId).sort(),
    ).toEqual(["beta", "gamma"]);
    expect(deltaPaths.every((pathway) => pathway.compositeNexus === "DIRECT_CAUSATION")).toBe(true);
  });

  it("terminates on a valid cyclic graph and never revisits an ancestor", () => {
    // alpha → beta → alpha is schema-valid (only self-edges are rejected at
    // the edge level), so the traversal guard is the only thing preventing a
    // loop here.
    const pathways = generateClaimPathways(
      "alpha",
      graph(
        node("alpha", ["beta", 1]),
        node("beta", ["alpha", 1], ["gamma", 2]),
      ),
    );

    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual([
      "beta",
      "gamma",
    ]);
    expect(pathways.some((pathway) => pathway.terminalConditionId === "alpha")).toBe(false);
    for (const pathway of pathways) {
      const visited = pathway.hops.map((entry) => entry.edge.targetConditionId);
      expect(new Set(visited).size).toBe(visited.length);
      expect(visited).not.toContain(pathway.originConditionId);
    }
  });

  it("stops descending past an association-only hop but still yields it", () => {
    const pathways = generateClaimPathways(
      "alpha",
      graph(
        node("alpha", ["beta", 1]),
        node("beta", ["gamma", 1, "ASSOCIATION_ONLY"]),
        node("gamma", ["delta", 1]),
      ),
    );

    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual([
      "beta",
      "gamma",
    ]);
    const brokenChain = pathways.find((pathway) => pathway.terminalConditionId === "gamma");
    expect(brokenChain?.compositeNexus).toBe("ASSOCIATION_ONLY_CHAIN_BROKEN");
    // An association-only link cannot carry a downstream tertiary nexus.
    expect(pathways.some((pathway) => pathway.terminalConditionId === "delta")).toBe(false);
  });

  it("derives AGGRAVATION when the weakest recognized hop is an aggravation", () => {
    const pathways = generateClaimPathways(
      "alpha",
      graph(
        node("alpha", ["beta", 1]),
        node("beta", ["gamma", 1, "AGGRAVATION"]),
      ),
    );

    expect(pathways.find((pathway) => pathway.hops.length === 1)?.compositeNexus).toBe(
      "DIRECT_CAUSATION",
    );
    expect(pathways.find((pathway) => pathway.hops.length === 2)?.compositeNexus).toBe(
      "AGGRAVATION",
    );
  });

  it("returns no pathways when the origin has no mapping", () => {
    expect(generateClaimPathways("ghost", graph(node("alpha", ["beta", 1])))).toEqual([]);
  });

  it("cannot loop through an unvalidated self-edge", () => {
    const validated = KbEdgeSchema.safeParse(edgeInput("alpha", "beta", 1));
    expect(validated.success).toBe(true);
    const selfEdge = { ...validated.data!, targetConditionId: "alpha" };
    // The schema rejects self-edges outright …
    expect(KbEdgeSchema.safeParse(selfEdge).success).toBe(false);

    // … and even a hand-built graph that smuggles one past the schema cannot
    // loop: the origin is always on the branch set.
    const unvalidatedGraph = new Map<string, KbNodeMapping>([
      ["alpha", { nodeId: "alpha", outgoingEdges: [selfEdge] }],
    ]);
    expect(generateClaimPathways("alpha", unvalidatedGraph)).toEqual([]);
  });

  it("keeps endpoints and hop contiguity consistent on every emitted pathway", () => {
    const pathways = generateClaimPathways(
      "alpha",
      graph(
        node("alpha", ["beta", 1]),
        node("beta", ["gamma", 1], ["delta", 2]),
        node("gamma", ["epsilon", 1]),
      ),
    );

    expect(pathways.length).toBeGreaterThan(0);
    for (const pathway of pathways) {
      expect(pathway.originConditionId).toBe("alpha");
      expect(pathway.hops[0].edge.sourceConditionId).toBe("alpha");
      expect(pathway.hops.at(-1)?.edge.targetConditionId).toBe(pathway.terminalConditionId);
      if (pathway.hops.length === 2) {
        expect(pathway.hops[1].edge.sourceConditionId).toBe(
          pathway.hops[0].edge.targetConditionId,
        );
      }
    }
  });
});
