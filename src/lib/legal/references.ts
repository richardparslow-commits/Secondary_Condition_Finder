// Canonical Source for Legal & Policy References

export const DISCLAIMERS = {
  nonDiagnostic: "This tool is for research and educational purposes only. It does not constitute medical or legal advice, cannot diagnose conditions, and does not replace a qualified medical nexus opinion.",
  noGuarantee: "Use of this tool does not guarantee VA claim approval or any specific rating outcome.",
  unverifiedCitations: "Citations marked as unverified have been programmatically mapped and await manual certification by a subject-matter expert."
};

export type LegalReference = {
  id: string;
  citation: string;
  title: string;
  description: string;
  sourceType: "CFR" | "M21-1" | "Statute";
  verificationStatus: "verified" | "unverified";
};

export const CANONICAL_REFERENCES: LegalReference[] = [
  {
    id: "38-cfr-3.310-a",
    citation: "38 CFR § 3.310(a)",
    title: "Direct Secondary Service Connection",
    description: "Establishes that a disability proximately due to or the result of a service-connected disease or injury shall be service-connected.",
    sourceType: "CFR",
    verificationStatus: "unverified"
  },
  {
    id: "38-cfr-3.310-b",
    citation: "38 CFR § 3.310(b)",
    title: "Service Connection by Aggravation",
    description: "Governs non-service-connected disabilities that are worsened or aggravated beyond natural progress by an established service-connected condition.",
    sourceType: "CFR",
    verificationStatus: "unverified"
  },
  {
    id: "m21-1-v-ii-2",
    citation: "VA Manual M21-1, Part V, Subpart ii, Chapter 2",
    title: "Evaluating Medical Nexus Evidence",
    description: "Provides rating veterans examiners guidelines for weighing medical nexus evidence, physician qualifications, and clinical rationale.",
    sourceType: "M21-1",
    verificationStatus: "unverified"
  }
];

/**
 * Track-distinction references for the two legal paths the app separates
 * (secondary vs. presumptive). Formerly lived in
 * `src/lib/legal/secondaryReferences.ts`; consolidated here so there is one
 * legal-references module.
 */
export interface TrackReference {
  id: string;
  label: string;
  citation: string;
  explanation: string;
  verified: false;
  sourceUrl?: string;
  sourceCheckedOn?: string;
  reviewNotes?: string[];
}

export const SECONDARY_LEGAL_REFERENCES: TrackReference[] = [
  {
    id: "secondary-basis",
    label: "Secondary service connection basis",
    citation: "38 CFR 3.310",
    explanation:
      "Secondary service connection addresses conditions that may be caused by, or aggravated by, an already service-connected condition.",
    verified: false,
    reviewNotes: ["TODO: Add source URL and sourceCheckedOn after qualified review."],
  },
  {
    id: "presumptive-distinction",
    label: "Presumptive distinction reference",
    citation: "38 CFR 3.307 and 3.309",
    explanation:
      "Presumptive service connection is a separate path based on qualifying service and exposure criteria.",
    verified: false,
    reviewNotes: ["TODO: Add source URL and sourceCheckedOn after qualified review."],
  },
];

export const SECONDARY_REFERENCE_BY_ID: Record<string, TrackReference> =
  Object.fromEntries(
    SECONDARY_LEGAL_REFERENCES.map((reference) => [reference.id, reference]),
  );
