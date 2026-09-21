import type { IntermediatePathway } from "@/lib/engine/types";
import { deriveCompositeNexusFromClassifications } from "@/lib/kb/utils";

/**
 * Client-safe view-model for the multi-hop evidence review.
 *
 * The canonical claim-pathway types live in the server-only knowledge-base
 * layer, and the composition audit enforces that client components never
 * import from the kb layer — not even for types. This module is the
 * sanctioned bridge: it owns the client-side projection types consumed by
 * `PathwayEvidenceTable` plus the server-side adapter functions that turn
 * the engine's rendered `IntermediatePathway` chains into those props. The
 * Step 6 server page calls the adapters when composing props; the client
 * never sees the kb layer.
 */

/** Legal nexus classification of one hop (mirrors the canonical enum). */
export type NexusClassificationView = "DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY";

/** Composite legal nexus of the whole chain (mirrors the canonical enum). */
export type CompositeNexusView = "DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY_CHAIN_BROKEN";

/** Client-side projection of one directed CRG hop. */
export interface PathwayHopView {
  /** 0-based position of this hop within the pathway. */
  stepIndex: number;
  edge: {
    sourceConditionId: string;
    targetConditionId: string;
    nexusClassification: NexusClassificationView;
  };
}

/** Client-side projection of a traversed 1–2 hop claim pathway. */
export interface ClaimPathwayView {
  /** Catalog condition ID where the traversal begins (the SC origin). */
  originConditionId: string;
  /** Catalog condition ID where the traversal ends (the claimed condition). */
  terminalConditionId: string;
  /** Exactly one hop (secondary) or two hops (tertiary). */
  hops: readonly [PathwayHopView] | readonly [PathwayHopView, PathwayHopView];
  /** Derived legal nexus of the whole chain. */
  compositeNexus: CompositeNexusView;
}

/**
 * Adapt one engine-rendered intermediate chain into the client view-model.
 *
 * Each edge becomes a hop carrying the catalog IDs and legal classification
 * exactly as the engine rendered them; the chain's composite nexus is the
 * classification-level reduction of the hop sequence — the same VA
 * proximate-cause precedence the schema layer applies to canonical pathways.
 *
 * @param pathway - A validated engine `IntermediatePathway` (two edges,
 *   target→source contiguous by construction).
 * @returns The pathway projection for `PathwayEvidenceTable` props.
 */
export function intermediatePathwayToView(pathway: IntermediatePathway): ClaimPathwayView {
  const [firstEdge, secondEdge] = pathway.edges;
  const hops: [PathwayHopView, PathwayHopView] = [
    {
      stepIndex: 0,
      edge: {
        sourceConditionId: firstEdge.conditionId,
        targetConditionId: firstEdge.targetConditionId,
        nexusClassification: firstEdge.nexusClassification,
      },
    },
    {
      stepIndex: 1,
      edge: {
        sourceConditionId: secondEdge.conditionId,
        targetConditionId: secondEdge.targetConditionId,
        nexusClassification: secondEdge.nexusClassification,
      },
    },
  ];

  return {
    originConditionId: pathway.primaryId,
    terminalConditionId: pathway.targetId,
    hops,
    compositeNexus: deriveViewCompositeNexus(hops),
  };
}

/** Adapt every intermediate chain of an engine recommendation. */
export function intermediatePathwaysToView(
  pathways: readonly IntermediatePathway[],
): ClaimPathwayView[] {
  return pathways.map(intermediatePathwayToView);
}

/**
 * Classification-level composite-nexus reduction for view-model hops.
 *
 * Delegates to the canonical reducer in `kb/utils` so the rendered pathway
 * summary can never drift from the schema's VA proximate-cause precedence —
 * view and schema layers share one implementation, not a mirrored one.
 * (`kb/utils` is a pure module — its kb import is type-only — so this stays
 * safe for client bundles even though the composition audit's client
 * boundary is expressed through this engine-layer module.)
 *
 * @param hops - The pathway's hops in traversal order.
 * @returns The composite nexus of the hop sequence.
 */
export function deriveViewCompositeNexus(
  hops: readonly { edge: { nexusClassification: NexusClassificationView } }[],
): CompositeNexusView {
  return deriveCompositeNexusFromClassifications(
    hops.map((hop) => hop.edge.nexusClassification),
  );
}
