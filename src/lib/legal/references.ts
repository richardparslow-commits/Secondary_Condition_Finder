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
  },
  // Presumptive references remain explicitly unverified until qualified review.
  {
    id: "38-usc-1116",
    citation: "38 U.S.C. § 1116",
    title: "Herbicide-Agent Presumptions",
    description: "Addresses presumptions of service connection for specified diseases associated with exposure to certain herbicide agents and covered service in specified locations.",
    sourceType: "Statute",
    verificationStatus: "unverified"
  },
  {
    id: "38-usc-1116b",
    citation: "38 U.S.C. § 1116B",
    title: "Korean DMZ Herbicide Presumption",
    description: "Addresses the presumption of herbicide exposure and specified disease service connection for qualifying veterans who served in or near the Korean Demilitarized Zone during the statutory period.",
    sourceType: "Statute",
    verificationStatus: "unverified"
  },
  {
    id: "38-usc-1117",
    citation: "38 U.S.C. § 1117",
    title: "Persian Gulf War Qualifying Chronic Disabilities",
    description: "Authorizes compensation for qualifying chronic disabilities in Persian Gulf veterans, including undiagnosed illness and specified medically unexplained chronic multisymptom illnesses.",
    sourceType: "Statute",
    verificationStatus: "unverified"
  },
  {
    id: "38-usc-1112-c",
    citation: "38 U.S.C. § 1112(c)",
    title: "Radiation-Exposed Veteran Presumptions",
    description: "Provides presumptions for specified diseases becoming manifest in a radiation-exposed veteran, subject to the statutory requirements.",
    sourceType: "Statute",
    verificationStatus: "unverified"
  },
  {
    id: "38-usc-1120",
    citation: "38 U.S.C. § 1120",
    title: "Burn Pit and Other Toxic-Exposure Presumptions",
    description: "Provides presumptions of service connection for specified diseases associated with exposure to burn pits and other toxins in covered veterans.",
    sourceType: "Statute",
    verificationStatus: "unverified"
  },
];