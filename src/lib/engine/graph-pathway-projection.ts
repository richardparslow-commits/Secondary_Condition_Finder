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
 * The validated graph requires an authored evidence join. Refuse a missing
 * suggestion or empty citations instead of presenting an unsupported hop.
 */
export function anchorsForHop(
  mappingById: ReadonlyMap<string, ConditionMapping>,
  primaryId: string,
  targetId: string,
): GraphPathwayAnchorView[] {
  const suggestion = mappingById
    .get(primaryId)
    ?.suggestions.find((candidate) => candidate.conditionId === targetId);
  if (!suggestion || suggestion.sourceReferences.length === 0) {
    throw new Error(`[kb-graph] Missing authored evidence for ${primaryId} -> ${targetId}`);
  }
  return suggestion.sourceReferences.map((reference) => ({
    label: anchorLabel(reference),
    sourceUrl: reference.sourceUrl,
    verified: reference.verified,
  }));
}

/**
 * Anchor resolver for one hop. Server callers join against the authored
 * corpus via `mappingAnchorResolver`; the browser supplies the public anchor
 * index derived from the client corpus (PRIV-01 stage 2) — same view shape,
 * same fail-closed projection (missing anchor data is an integrity error).
 */
export type HopAnchorResolver = (
  sourceConditionId: string,
  targetConditionId: string,
) => GraphPathwayAnchorView[];

/**
 * Publication/provenance resolver for one hop (audit A08): true when the hop's
 * authored backing is a DRAFT mapping. It is a REQUIRED parameter of the
 * projection so a new surface cannot silently render a research route without
 * its provenance.
 *
 * The two representations are deliberately different layers, and this is the
 * fact that makes the difference visible instead of implicit:
 *
 *   - the **authored corpus** is the publication layer. Its `draft` flag gates
 *     recommendation output (`publishedMappings` / `recommend()`), so a draft
 *     mapping cannot reach a published result.
 *   - the **adjacency graph** is a research layer. It may cite draft-authored
 *     evidence — that is the point of the signed design's research routes — so
 *     a graph pathway can rest on evidence that is not published.
 *
 * Rather than pretend the two are in parity, every graph surface derives this
 * flag and discloses it, and `tests/graph-pathway-provenance.test.ts` pins that
 * a draft-backed route stays out of the published/recommendation layer while
 * being labelled as draft-backed where it is shown.
 */
export type HopProvenanceResolver = (sourceConditionId: string) => boolean;

/**
 * Provenance resolver over a corpus map: absent ⇒ draft-backed.
 *
 * The server passes the FULL authored corpus, so the authored `draft` flag is
 * authoritative. The browser passes the published-only corpus (PRIV-01), where
 * a mapping absent from the map means the edge is backed by a draft — the
 * client cannot see the draft, so it must not report it as published.
 */
export function mappingProvenanceResolver(
  mappingById: ReadonlyMap<string, ConditionMapping>,
): HopProvenanceResolver {
  return (sourceConditionId: string): boolean => {
    const mapping = mappingById.get(sourceConditionId);
    return mapping ? mapping.draft === true : true;
  };
}

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
 * @param resolveProvenance - Hop publication resolver; the projection is
 *   required to state, per hop and per pathway, whether the route rests on
 *   draft-authored evidence (audit A08).
 */
export function projectGraphPathway(
  pathway: ClaimPathway,
  conditionName: (conditionId: string) => string,
  resolveAnchors: HopAnchorResolver,
  resolveProvenance: HopProvenanceResolver,
): GraphPathwayView {
  const hops = pathway.hops.map<GraphPathwayHopView>((hop) => {
    const anchors = resolveAnchors(hop.edge.sourceConditionId, hop.edge.targetConditionId);
    if (anchors.length === 0) {
      throw new Error(`[kb-graph] Missing authored evidence for ${hop.edge.sourceConditionId} -> ${hop.edge.targetConditionId}`);
    }
    return {
      stepIndex: hop.stepIndex,
      sourceConditionId: hop.edge.sourceConditionId,
      sourceConditionName: conditionName(hop.edge.sourceConditionId),
      targetConditionId: hop.edge.targetConditionId,
      targetConditionName: conditionName(hop.edge.targetConditionId),
      nexusClassification: hop.edge.nexusClaim.nexusClassification,
      authoredDraft: resolveProvenance(hop.edge.sourceConditionId),
      anchors,
    };
  });

  return {
    terminalConditionId: pathway.terminalConditionId,
    terminalConditionName: conditionName(pathway.terminalConditionId),
    compositeNexus: pathway.compositeNexus,
    hops,
    includesDraftAuthoredEvidence: hops.some((hop) => hop.authoredDraft),
  };
}
