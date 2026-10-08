import type { ClaimPathway, ConditionMapping, SourceReference } from "@/lib/kb/schema";

import type {
  GraphPathwayAnchorView,
  GraphPathwayHopView,
  GraphPathwayView,
} from "./pathway-view";

/**
 * Shared projection helpers for the graph-pathway surfaces.
 *
 * The `/pathways` explorer (`./pathway-explorer.ts`) and the Step 5 results
 * section (`./graph-pathway-matches.ts`) render the same validated traversal
 * through the same view types, and both build their rows here so their
 * projections can never drift: display names, the hop's legal classification,
 * and the citation anchors are joined exactly once, in one place. A surface
 * that needs a different projection changes this module, and every surface
 * moves together.
 *
 * Pure functions only: no data loading, no derivation beyond the label join
 * and the read-only anchor lookup. The composite nexus is carried verbatim
 * from the traversed pathway, and the anchors travel with the authored
 * corpus's own `verified` flag. Nothing here verifies, authors, or
 * reinterprets an anchor — the surface renders the flag it was handed.
 */

const PUBMED_URL_PATTERN = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i;

/**
 * Short reviewer-triage label for one authored anchor: the PMID when the URL
 * is a PubMed record, the source host otherwise, and "Citation" as the last
 * resort. Deliberately not the full citation text — the label is an index
 * handle; the authored corpus carries the citation detail.
 */
export function anchorLabel(reference: Pick<SourceReference, "sourceUrl">): string {
  const pmid = reference.sourceUrl?.match(PUBMED_URL_PATTERN)?.[1];
  if (pmid) return `PMID ${pmid}`;
  if (reference.sourceUrl) {
    try {
      return new URL(reference.sourceUrl).hostname;
    } catch {
      // Fall through to the generic label for an unparsable URL.
    }
  }
  return "Citation";
}

/**
 * The hop's authored anchors, joined by (source mapping, target condition).
 * The graph edge and the authored suggestion are registered in lockstep, so a
 * missing suggestion simply yields no anchors — the surface never invents one.
 */
export function anchorsForHop(
  mappingById: ReadonlyMap<string, ConditionMapping>,
  primaryId: string,
  targetId: string,
): GraphPathwayAnchorView[] {
  const suggestion = mappingById
    .get(primaryId)
    ?.suggestions.find((candidate) => candidate.conditionId === targetId);
  return (suggestion?.sourceReferences ?? []).map((reference) => ({
    label: anchorLabel(reference),
    sourceUrl: reference.sourceUrl,
    verified: reference.verified,
  }));
}

/**
 * Anchor resolver for one hop. Server callers join against the authored
 * corpus via `mappingAnchorResolver`; the browser supplies the public anchor
 * index derived from the client corpus (PRIV-01 stage 2) — same view shape,
 * same fallback (no anchor data means no anchors, never an invented one).
 */
export type HopAnchorResolver = (
  sourceConditionId: string,
  targetConditionId: string,
) => GraphPathwayAnchorView[];

export function mappingAnchorResolver(
  mappingById: ReadonlyMap<string, ConditionMapping>,
): HopAnchorResolver {
  return (sourceConditionId, targetConditionId) =>
    anchorsForHop(mappingById, sourceConditionId, targetConditionId);
}

/**
 * Project one traversed pathway into the client-safe view shape: terminal
 * display name, the derived composite nexus verbatim, and one labelled hop
 * per edge with its resolved anchors.
 *
 * @param pathway - A validated `ClaimPathway` from the graph traversal.
 * @param conditionName - Catalog ID → display name; missing IDs fall back to
 *   the ID, exactly as the surfaces render them.
 * @param resolveAnchors - Hop anchor resolver (authored-corpus join on the
 *   server, public client-corpus anchor index in the browser).
 */
export function projectGraphPathway(
  pathway: ClaimPathway,
  conditionName: (conditionId: string) => string,
  resolveAnchors: HopAnchorResolver,
): GraphPathwayView {
  return {
    terminalConditionId: pathway.terminalConditionId,
    terminalConditionName: conditionName(pathway.terminalConditionId),
    compositeNexus: pathway.compositeNexus,
    hops: pathway.hops.map<GraphPathwayHopView>((hop) => ({
      stepIndex: hop.stepIndex,
      sourceConditionId: hop.edge.sourceConditionId,
      sourceConditionName: conditionName(hop.edge.sourceConditionId),
      targetConditionId: hop.edge.targetConditionId,
      targetConditionName: conditionName(hop.edge.targetConditionId),
      nexusClassification: hop.edge.nexusClaim.nexusClassification,
      anchors: resolveAnchors(
        hop.edge.sourceConditionId,
        hop.edge.targetConditionId,
      ),
    })),
  };
}
