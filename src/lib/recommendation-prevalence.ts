import type { Recommendation } from "@/lib/engine/types";

export const CONSENSUS_LABEL: Record<Recommendation["etiologicalConsensus"], string> = {
  WELL_ESTABLISHED: "Well established",
  IATROGENIC_TREATMENT_EFFECT: "Iatrogenic treatment effect",
  PROBABLE: "Probable",
  CONTESTED_REQUIRES_SPECIFIC_EVIDENCE: "Contested — requires specific evidence",
  NOT_ESTABLISHED: "Not established",
};

export const CONSENSUS_EXPLANATION: Record<Recommendation["etiologicalConsensus"], string> = {
  WELL_ESTABLISHED:
    "Well established means broad medical consensus supports the etiological link (for example, diabetes to peripheral neuropathy).",
  IATROGENIC_TREATMENT_EFFECT:
    "Iatrogenic treatment effect means the secondary condition is attributed to required treatment of the primary condition.",
  PROBABLE:
    "Probable means strong literature support exists, but the link depends on the individual's specific presentation and evidence.",
  CONTESTED_REQUIRES_SPECIFIC_EVIDENCE:
    "Contested means the literature is mixed or debated; specific DBQ evidence and alternative etiologies must be addressed.",
  NOT_ESTABLISHED:
    "Not established means the current evidence supports association only, not causation or aggravation under 38 CFR § 3.310. After the Spicer update (May 2026), a veteran may still establish service connection by showing the condition would not have occurred but for the SC disability, or that the SC disability interfered with treatment.",
};

/**
 * @deprecated Replaced by CONSENSUS_LABEL / CONSENSUS_EXPLANATION. Prevalence
 * described how commonly a relationship appears in the knowledge base, which is
 * not probative of a VA nexus. Kept as a re-export shim for any legacy imports.
 */
export const PREVALENCE_LABEL = CONSENSUS_LABEL;
export const PREVALENCE_EXPLANATION = CONSENSUS_EXPLANATION;