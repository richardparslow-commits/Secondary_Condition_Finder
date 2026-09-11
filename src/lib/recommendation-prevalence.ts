import type { Recommendation } from "@/lib/engine/types";

export type EtiologicalConsensus = Recommendation["etiologicalConsensus"];

export const CONSENSUS_LABEL: Record<EtiologicalConsensus, string> = {
  WELL_ESTABLISHED: "Well established",
  IATROGENIC_TREATMENT_EFFECT: "Iatrogenic treatment effect",
  PROBABLE: "Probable",
  CONTESTED_REQUIRES_SPECIFIC_EVIDENCE: "Contested — requires specific evidence",
  NOT_ESTABLISHED: "Not established",
};

export const CONSENSUS_EXPLANATION: Record<EtiologicalConsensus, string> = {
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
 * Qualitative evidence-strength tone for a consensus tier. Deliberately
 * ordinal-free: tones communicate support strength, never a probability,
 * percentage, or VA outcome.
 */
export type ConsensusTone = "strong" | "moderate" | "contested" | "not-established";

/**
 * Single source of truth mapping a consensus tier to its visual tone:
 * strong (green), moderate (amber), contested (orange), not-established (gray).
 * Iatrogenic treatment effects are supported by the treating relationship
 * itself, so they group with moderate rather than contested.
 */
export function consensusTone(consensus: EtiologicalConsensus): ConsensusTone {
  if (consensus === "WELL_ESTABLISHED") return "strong";
  if (consensus === "PROBABLE" || consensus === "IATROGENIC_TREATMENT_EFFECT") return "moderate";
  if (consensus === "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE") return "contested";
  return "not-established";
}

/**
 * Tailwind classes for the shared evidence-strength badge. Colors are
 * chosen to remain distinguishable without relying on color alone: each tone
 * pairs with the label text and tooltip explanation.
 */
export const CONSENSUS_BADGE_CLASS: Record<ConsensusTone, string> = {
  strong: "border-emerald-300 bg-emerald-50 text-emerald-900",
  moderate: "border-amber-300 bg-amber-50 text-amber-900",
  contested: "border-orange-300 bg-orange-50 text-orange-900",
  "not-established": "border-slate-300 bg-slate-100 text-slate-700",
};

/**
 * Condition-specific one-sentence literature implication for the detailed
 * suggestion view. Research framing only: it characterizes the state of the
 * authored literature tier, never the veteran's individual claim.
 */
export function consensusLiteratureSentence(
  condition: string,
  secondary: string,
  consensus: EtiologicalConsensus,
): string {
  const c = condition.trim() || "the service-connected condition";
  const s = secondary.trim() || "the secondary condition";
  switch (consensus) {
    case "WELL_ESTABLISHED":
      return `The medical literature on ${c} leading to ${s} is well established, which means broad clinical consensus supports evaluating this pathway — strong documentation still matters.`;
    case "IATROGENIC_TREATMENT_EFFECT":
      return `The medical literature on ${c} treatment leading to ${s} describes an established treatment effect, which means records of the treatment itself are central evidence for this pathway.`;
    case "PROBABLE":
      return `The medical literature on ${c} leading to ${s} is probable but individual-dependent, which means your personal clinical evidence carries the most weight here.`;
    case "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE":
      return `The medical literature on ${c} leading to ${s} is contested, which means medical experts disagree and specific, high-quality nexus evidence is essential.`;
    case "NOT_ESTABLISHED":
      return `The medical literature on ${c} causing ${s} is not established as causal, which means the pathway rests on association and the Spicer but-for / treatment-interference standards rather than accepted medical consensus.`;
  }
}