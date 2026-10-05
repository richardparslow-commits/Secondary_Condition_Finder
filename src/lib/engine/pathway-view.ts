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

/* ─── Graph adjacency explorer projection ─────────────────────────────────
 *
 * The pathway explorer (`src/app/pathways/page.tsx`) is the graph's first
 * user-facing consumer. It renders the SAME validated traversal the engine
 * uses — resolved to catalog display names — so the projections below carry
 * the classification and composite nexus verbatim; the surface can therefore
 * never disagree with the schema's proximate-cause precedence about whether a
 * chain is broken. Like `ClaimPathwayView`, these are plain data shapes the
 * client-safe presentation layer can consume without importing the kb layer.
 */

/**
 * One citation anchor of a graph hop, projected for reviewer triage.
 *
 * Anchors are read-only joins from the authored mapping's suggestion for this
 * hop's source→target pair (registered in lockstep with the graph edge); the
 * authored `verified` flag travels verbatim so the surface can show which
 * evidence a qualified human has confirmed without deriving or recomputing
 * anything. The surface itself verifies nothing.
 */
export interface GraphPathwayAnchorView {
  /** Short triage label: "PMID <id>" for PubMed records, otherwise the source host. */
  label: string;
  /** Canonical source URL when the authored reference records one. */
  sourceUrl?: string;
  /** True only when a qualified human has verified the source against the bounded proposition. */
  verified: boolean;
}

/** One hop of a graph adjacency pathway, resolved for display. */
export interface GraphPathwayHopView {
  /** 0-based position of this hop within the pathway. */
  stepIndex: number;
  sourceConditionId: string;
  sourceConditionName: string;
  targetConditionId: string;
  targetConditionName: string;
  nexusClassification: NexusClassificationView;
  /**
   * Citation anchors for this hop, joined from the authored corpus. Empty when
   * the hop's source mapping records no registered suggestion for this pair.
   */
  anchors: GraphPathwayAnchorView[];
}

/** One traversed graph pathway, resolved for display. */
export interface GraphPathwayView {
  terminalConditionId: string;
  terminalConditionName: string;
  /** Derived legal nexus of the whole chain — never recomputed in the UI. */
  compositeNexus: CompositeNexusView;
  hops: GraphPathwayHopView[];
}

/**
 * One origin node of the adjacency graph and its outgoing pathways. Origins
 * with zero authored edges are included deliberately so their empty state
 * renders explicitly instead of vanishing.
 */
export interface GraphPathwayOriginView {
  originConditionId: string;
  originConditionName: string;
  pathways: GraphPathwayView[];
}

/** Read-only projection of the whole adjacency graph for the explorer surface. */
export interface GraphPathwayExplorerView {
  origins: GraphPathwayOriginView[];
  totalPathways: number;
  /** Pathways whose composite nexus is `ASSOCIATION_ONLY_CHAIN_BROKEN`. */
  chainBrokenPathways: number;
  /** Citation anchors across every hop on the page. */
  totalAnchors: number;
  /** Anchors still awaiting qualified-human citation verification. */
  unverifiedAnchors: number;
}

/* ─── Results-UI match projection ─────────────────────────────────────────
 *
 * The Step 5 results section (`src/components/secondary/GraphPathwayReview.tsx`)
 * surfaces the subset of the same validated traversal that connects the
 * conditions a review actually selected — service-connected origins to the
 * diagnosed non-service-connected conditions. Matches carry the composite
 * nexus verbatim from the traversal, so the results surface can mark an
 * association-only chain legally broken exactly as the explorer does and can
 * never present a hypothesized route as an established nexus.
 */

/**
 * One resolved graph pathway connecting two of a review's selected
 * conditions: a service-connected origin to a diagnosed terminal condition.
 * `hops` carry any intermediate steps; the composite nexus is the derived
 * legal nexus of the whole chain, never recomputed in the UI.
 */
export interface GraphPathwayMatchView extends GraphPathwayView {
  originConditionId: string;
  originConditionName: string;
}

/**
 * A results-UI section's worth of graph-pathway matches, plus the anchor
 * totals the surface uses to frame the view honestly.
 */
export interface GraphPathwayMatchSectionView {
  matches: GraphPathwayMatchView[];
  /** Citation anchors across every hop of every match. */
  totalAnchors: number;
  /** Anchors still awaiting qualified-human citation verification. */
  unverifiedAnchors: number;
}
