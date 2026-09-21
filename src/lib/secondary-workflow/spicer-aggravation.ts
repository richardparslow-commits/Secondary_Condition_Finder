import type { SecondaryPathwayType } from "@/lib/kb/schema";

/**
 * Spicer treatment-interference aggravation — presentation-layer guidance.
 *
 * The May 2026 M21-1 update (implementing Spicer v. McDonough) recognizes
 * interference with treatment as a distinct aggravation pathway under
 * 38 CFR § 3.310(b). The authored knowledge base marks this variant on a
 * mapping's `pathwayIntelligence.pathways` with the `care-obstacle` and/or
 * `treatment-complication` pathway types on an `AGGRAVATION` nexus claim.
 *
 * Why a separate card: an ordinary aggravation theory is carried by baseline
 * severity plus documented worsening (the § 3.310(b) before/after comparison),
 * while the Spicer variant is carried by *treatment records* — evidence that
 * the service-connected condition interfered with treating the secondary
 * condition (missed appointments, halted therapy, medication conflicts) and
 * that the condition worsened as a result. Veterans gather different records
 * and discuss a different theory with their clinician, so the two variants
 * must never present identically.
 *
 * This module is copy/records projection only, derived from authored KB
 * output. It never determines eligibility, never predicts outcomes, and does
 * not itself establish that the Spicer pathway applies to any individual.
 * "Eligible", "approved", and "guarantee" language is test-forbidden, matching
 * the repo's FORBIDDEN_PHRASES guard posture.
 */

/** Authored pathway types that mark the Spicer treatment-interference variant. */
export const SPICER_PATHWAY_TYPES: readonly SecondaryPathwayType[] = [
  "care-obstacle",
  "treatment-complication",
];

export const SPICER_PATHWAY_HEADING =
  "Spicer treatment-interference aggravation — different proof, different records";

export interface SpicerAggravationInput {
  /** Authored nexus classification for this primary → secondary mapping. */
  nexusClassification?: string | null;
  /** Authored pathway types for this mapping (`pathwayIntelligence.pathways`). */
  pathwayTypes?: readonly string[] | null;
  /** The non-service-connected (secondary) condition's name, for tailored record kinds. */
  conditionName: string;
}

export interface SpicerAggravationGuidance {
  active: boolean;
  heading: string;
  explanation: string;
  /** What stays the same legally and what changes evidentially. */
  burdenLine: string;
  /** Concrete treatment-record kinds this theory is carried by. */
  recordKinds: string[];
}

const INACTIVE_GUIDANCE: SpicerAggravationGuidance = {
  active: false,
  heading: "",
  explanation: "",
  burdenLine: "",
  recordKinds: [],
};

const CARE_OBSTACLE_RECORD_KINDS = [
  "Provider or VA notes documenting missed, delayed, or cancelled appointments",
  "Therapy or rehabilitation notes showing halted or interrupted treatment",
  "Records showing why treatment stopped or changed — symptom burden, access, transportation, or the service-connected condition itself",
];

const TREATMENT_COMPLICATION_RECORD_KINDS = [
  "Medication lists and pharmacy fill history showing stopped, changed, or conflicted medications",
  "Prescriber notes documenting medication interactions or treatment conflicts",
  "Follow-up notes showing the treatment plan changed because of the service-connected condition",
];

function recordKindsForPathways(
  pathwayTypes: readonly string[],
): string[] {
  const kinds: string[] = [];
  if (pathwayTypes.includes("care-obstacle")) {
    kinds.push(...CARE_OBSTACLE_RECORD_KINDS);
  }
  if (pathwayTypes.includes("treatment-complication")) {
    kinds.push(...TREATMENT_COMPLICATION_RECORD_KINDS);
  }
  // The card's own explanation names the secondary condition, so these stay
  // as generic record kinds — no fragile string surgery.
  return [...new Set(kinds)];
}

/**
 * Detects the Spicer treatment-interference aggravation variant and returns
 * the distinct presentation guidance. Active only when the authored mapping
 * carries BOTH the AGGRAVATION nexus classification and at least one of the
 * Spicer pathway types — an ordinary aggravation theory must never render
 * this card, and a Spicer pathway type on a non-aggravation theory must not
 * claim § 3.310(b) treatment-interference semantics.
 */
export function getSpicerAggravationGuidance(
  input: SpicerAggravationInput,
): SpicerAggravationGuidance {
  const pathwayTypes = input.pathwayTypes ?? [];
  const spicerTypes = SPICER_PATHWAY_TYPES.filter((type) =>
    pathwayTypes.includes(type),
  );
  if (input.nexusClassification !== "AGGRAVATION" || spicerTypes.length === 0) {
    return INACTIVE_GUIDANCE;
  }

  return {
    active: true,
    heading: SPICER_PATHWAY_HEADING,
    explanation:
      `M21-1 (May 2026), implementing Spicer v. McDonough, recognizes interference with treatment as an aggravation pathway under 38 CFR § 3.310(b). ` +
      `For this pathway, the question a reviewer weighs is whether your service-connected condition interfered with treatment of ${input.conditionName} — ` +
      `missed appointments, stopped therapy, or medication conflicts — and whether ${input.conditionName} worsened as a result, beyond its own course.`,
    burdenLine:
      `The legal standard stays the same — at least as likely as not — but the evidence that carries this theory is different: ` +
      `treatment-interference records instead of (or alongside) the before-and-after severity comparison of an ordinary aggravation claim. ` +
      `This is a research aid, not a determination that the Spicer pathway applies to you.`,
    recordKinds: recordKindsForPathways(spicerTypes),
  };
}
