/**
 * Consensus ranking — orders etiological-consensus tiers and converts
 * per-suggestion `rank` into a score weight.
 *
 * Responsibility: map `etiologicalConsensus` strings to an ordinal
 * (lower = stronger evidence) and expose `rankWeight` for multi-primary
 * accumulation. Never shown to users as a number; used only for deterministic
 * ordering of `Recommendation[]`.
 */

export const CONSENSUS_ORDER = {
  WELL_ESTABLISHED: 0,
  IATROGENIC_TREATMENT_EFFECT: 1,
  PROBABLE: 2,
  CONTESTED_REQUIRES_SPECIFIC_EVIDENCE: 3,
  NOT_ESTABLISHED: 4,
} as const;

export const CONSENSUS_BY_RANK = [
  "WELL_ESTABLISHED",
  "IATROGENIC_TREATMENT_EFFECT",
  "PROBABLE",
  "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE",
  "NOT_ESTABLISHED",
] as const;

export type ConsensusTier = (typeof CONSENSUS_BY_RANK)[number];

/**
 * Rank 1 contributes 1.0, rank 2 contributes 0.5, and so on. When several
 * primary conditions point at the same secondary, the contributions add, so a
 * suggestion supported by two primaries outranks one supported by a single
 * primary at the same rank. Ordering heuristic only — never displayed.
 */
export function rankWeight(rank: number): number {
  return 1 / rank;
}
