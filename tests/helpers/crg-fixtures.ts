import type {
  CausalMechanism,
  EvidentiaryProfile,
  NexusClaim,
} from "@/lib/kb/schema";

/**
 * Shared CRG fixture builders for tests. The migration replaced the optional
 * `prevalence` label with mandatory nexus, mechanism, and evidence-profile
 * objects on every suggestion; synthetic KB fixtures used across the suite
 * must supply all three.
 *
 * `buildNexusClaim`, `buildCausalMechanism`, and `buildEvidentiaryProfile`
 * return full valid objects. `buildSuggestion` merges a caller's partial
 * suggestion with the required CRG trio.
 */

export function buildNexusClaim(overrides: Partial<Extract<NexusClaim, { nexusClassification: "ASSOCIATION_ONLY" }>> = {}): NexusClaim {
  return {
    nexusClassification: "ASSOCIATION_ONLY",
    associationBasis:
      "The published knowledge base includes this relationship as an association; the fixture edge documents a bounded co-occurrence for test purposes.",
    causationStatus:
      "Neither causation nor aggravation under 38 CFR § 3.310 is established by the fixture evidence; the mapping guard limits the claim to association.",
    ...overrides,
  } as NexusClaim;
}

export function buildCausalMechanism(overrides: Partial<CausalMechanism> = {}): CausalMechanism {
  return {
    mechanismCategory: "NOT_ESTABLISHED",
    primaryVector:
      "The fixture relationship is documented as a hypothesized association whose physiological cascade is not established; no causal pathway is asserted by this synthetic edge.",
    hypothesizedOnly: true,
    ...overrides,
  };
}

export function buildEvidentiaryProfile(overrides: Partial<EvidentiaryProfile> = {}): EvidentiaryProfile {
  return {
    etiologicalConsensus: "NOT_ESTABLISHED",
    vaNexusProbabilityAlignment: "NOT_ASSERTED",
    conservativeRationale:
      "This fixture edge is supported as an association only; it is not asserted that the primary caused or aggravated the secondary in any individual.",
    evidenceGaps: "Individual chronology and medical evidence are required before any nexus assertion.",
    alternativeEtiologiesToRuleOut: [
      "Other causes not yet identified in this fixture mapping",
    ],
    requiresSpecificDbqEvidence: false,
    ...overrides,
  };
}

export type { NexusClaim, CausalMechanism, EvidentiaryProfile };