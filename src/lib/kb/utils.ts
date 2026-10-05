import { isWithinPathwayDepth, MAX_PATHWAY_HOPS } from "./pathway-depth";
import type { CompositeNexus, NexusClassification, PathwayHop } from "./schema";

/**
 * Multi-hop composite-nexus derivation (VA proximate-cause logic).
 *
 * A pathway's legal strength is determined by its weakest hop, mirroring how
 * VA adjudicates chained secondary service connection under 38 CFR
 * § 3.310: the nexus between the service-connected origin and the terminal
 * condition is only as strong as the weakest legally recognized link in the
 * chain.
 *
 * Derivation rules (in precedence order):
 *
 *   1. Any ASSOCIATION_ONLY hop breaks the chain. Association is not a
 *      statutory nexus theory, so the origin → terminal relationship is not
 *      legally established end-to-end — even if every other hop is a
 *      textbook DIRECT_CAUSATION.
 *   2. Otherwise, any AGGRAVATION hop dominates. Under Spicer v. McDonough's
 *      "but for" framing, a claim whose weakest recognized link is an
 *      aggravation must be presented (and evidenced) as an aggravation claim;
 *      a direct-causation hop elsewhere in the chain cannot upgrade it.
 *   3. Only a chain of all DIRECT_CAUSATION hops yields DIRECT_CAUSATION.
 *
 * Input invariants (stepIndex contiguity and target→source chaining) are
 * enforced fail-fast: a silently mislabeled composite nexus is a legal
 * misrepresentation, so a malformed hop array is a programmer error, not a
 * degraded result. Pathways built through `ClaimPathwaySchema` (which mirrors
 * these rules at parse time) never trip these guards.
 */

/**
 * Reduce a hop chain to its composite legal nexus.
 *
 * @param hops - The pathway's hops in traversal order (1–`MAX_PATHWAY_HOPS`
 *   hops; the shared cap in `./pathway-depth`). Each hop's `stepIndex` must
 *   equal its array position, and each hop's `edge.sourceConditionId` must
 *   equal the previous hop's `edge.targetConditionId`.
 * @returns The composite nexus: `"ASSOCIATION_ONLY_CHAIN_BROKEN"` if any hop
 *   is association-only, `"AGGRAVATION"` if any recognized hop is an
 *   aggravation, otherwise `"DIRECT_CAUSATION"`.
 * @throws TypeError when the hop array is empty, exceeds `MAX_PATHWAY_HOPS`,
 *   or is not a contiguous chain — inputs must come from a validated
 *   `ClaimPathwaySchema` traversal.
 */
export function deriveCompositeNexus(hops: readonly PathwayHop[]): CompositeNexus {
  if (hops.length < 1) {
    throw new TypeError("deriveCompositeNexus requires at least one pathway hop.");
  }
  if (!isWithinPathwayDepth(hops.length)) {
    throw new TypeError(
      `deriveCompositeNexus received ${hops.length} hops, exceeding the shared pathway-depth cap of ${MAX_PATHWAY_HOPS}.`,
    );
  }
  for (const [index, hop] of hops.entries()) {
    if (hop.stepIndex !== index) {
      throw new TypeError(
        `Hops must be contiguous: expected stepIndex ${index} at array position ${index}, received ${hop.stepIndex}.`,
      );
    }
    const next = hops[index + 1];
    if (next && next.edge.sourceConditionId !== hop.edge.targetConditionId) {
      throw new TypeError(
        `Hops must form a contiguous chain: hop ${index} targets "${hop.edge.targetConditionId}" but hop ${index + 1} departs from "${next.edge.sourceConditionId}".`,
      );
    }
  }

  return deriveCompositeNexusFromClassifications(
    hops.map((hop) => hop.edge.nexusClaim.nexusClassification),
  );
}

/**
 * Composite-nexus derivation over a bare classification sequence.
 *
 * `deriveCompositeNexus` is the fail-fast authority for validated hop arrays;
 * this variant applies the same VA proximate-cause precedence to hops that
 * carry their classification at the presentation layer (the engine's
 * `IntermediatePathway` edges expose `nexusClassification` directly, without a
 * full `NexusClaim` payload). Sharing the reducer guarantees the rendered
 * pathway summary can never disagree with the schema's parse-time mirror of
 * the same rules.
 *
 * @param classifications - Hop classifications in traversal order (1–
 *   `MAX_PATHWAY_HOPS` hops; the shared cap in `./pathway-depth`). Empty
 *   chains are treated as `"DIRECT_CAUSATION"` by contract: a chain with no
 *   asserted hops asserts no aggravation and no association break.
 * @returns The composite nexus: `"ASSOCIATION_ONLY_CHAIN_BROKEN"` if any hop
 *   is association-only, `"AGGRAVATION"` if any recognized hop is an
 *   aggravation, otherwise `"DIRECT_CAUSATION"`.
 * @throws TypeError when the classification sequence exceeds
 *   `MAX_PATHWAY_HOPS` — an over-depth chain must fail fast, never be
 *   silently mislabeled as a weaker or stronger nexus.
 */
export function deriveCompositeNexusFromClassifications(
  classifications: readonly NexusClassification[],
): CompositeNexus {
  if (!isWithinPathwayDepth(classifications.length)) {
    throw new TypeError(
      `deriveCompositeNexusFromClassifications received ${classifications.length} classifications, exceeding the shared pathway-depth cap of ${MAX_PATHWAY_HOPS}.`,
    );
  }
  return classifications.reduce<CompositeNexus>((composite, classification) => {
    if (composite === "ASSOCIATION_ONLY_CHAIN_BROKEN") return composite;
    switch (classification) {
      case "ASSOCIATION_ONLY":
        return "ASSOCIATION_ONLY_CHAIN_BROKEN";
      case "AGGRAVATION":
        return "AGGRAVATION";
      case "DIRECT_CAUSATION":
        return composite;
    }
  }, "DIRECT_CAUSATION");
}
