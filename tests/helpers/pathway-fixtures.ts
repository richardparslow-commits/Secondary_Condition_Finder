import {
  KbEdgeSchema,
  KbNodeMappingSchema,
  type KbNodeMapping,
  type NexusClassification,
  type PathwayHop,
} from "@/lib/kb/schema";

/**
 * Shared, schema-valid graph fixtures for pathway traversal tests.
 *
 * Every edge and node a test builds here is parsed through `KbEdgeSchema` /
 * `KbNodeMappingSchema`, so traversal tests exercise graph shapes the runtime
 * loader would accept. The one deliberate escape hatch is `edgeInput`, which
 * returns the raw input object unparsed so a test can prove schema rejections
 * (or probe traversal behavior with an intentionally invalid graph).
 */

/** Raw edge input, unparsed — for schema-rejection contracts. */
export function edgeInput(
  sourceConditionId: string,
  targetConditionId: string,
  rank: number,
  classification: NexusClassification = "DIRECT_CAUSATION",
) {
  const associationOnly = classification === "ASSOCIATION_ONLY";
  return {
    sourceConditionId,
    targetConditionId,
    rank,
    nexusClaim: { nexusClassification: classification },
    causalMechanism: {
      mechanismCategory: associationOnly ? ("NOT_ESTABLISHED" as const) : ("PSYCHOPHYSIOLOGICAL" as const),
      primaryVector: "Synthetic fixture vector describing the physiological cascade under test.",
      hypothesizedOnly: associationOnly,
    },
    evidentiaryProfile: {
      etiologicalConsensus: associationOnly ? ("NOT_ESTABLISHED" as const) : ("PROBABLE" as const),
      vaNexusProbabilityAlignment: "AT_LEAST_AS_LIKELY_AS_NOT" as const,
      conservativeRationale: "Synthetic fixture rationale used only to exercise traversal behavior.",
      evidenceGaps: "Synthetic fixture gap.",
      alternativeEtiologiesToRuleOut: ["Synthetic alternative etiology"],
      requiresSpecificDbqEvidence: false,
    },
    rationale: "Synthetic fixture edge used only to exercise traversal behavior.",
    evidenceGaps: ["Synthetic fixture development target."],
  };
}

/** Parsed canonical edge. */
export function edge(
  source: string,
  target: string,
  rank: number,
  classification: NexusClassification = "DIRECT_CAUSATION",
) {
  return KbEdgeSchema.parse(edgeInput(source, target, rank, classification));
}

/** `[target, rank, classification?]` tuple accepted by `node()`. */
export type NodeEdge = [target: string, rank: number, classification?: NexusClassification];

/** Parsed adjacency-file node; ranks are supplied by the caller. */
export function node(nodeId: string, ...outgoing: NodeEdge[]): KbNodeMapping {
  return KbNodeMappingSchema.parse({
    nodeId,
    outgoingEdges: outgoing.map(([target, rank, classification]) =>
      edge(nodeId, target, rank, classification),
    ),
  });
}

/** Adjacency map from parsed nodes, keyed by nodeId. */
export function graph(...nodes: KbNodeMapping[]): Map<string, KbNodeMapping> {
  return new Map(nodes.map((entry) => [entry.nodeId, entry]));
}

/** Parsed pathway hop at `stepIndex`. */
export function hop(
  stepIndex: number,
  source: string,
  target: string,
  classification: NexusClassification = "DIRECT_CAUSATION",
): PathwayHop {
  return { stepIndex, edge: edge(source, target, 1, classification) };
}

/** Sum of outgoing edges across an adjacency map — the fuzz bound helper. */
export function edgeCount(adjacency: Map<string, KbNodeMapping>): number {
  let total = 0;
  for (const entry of adjacency.values()) total += entry.outgoingEdges.length;
  return total;
}
