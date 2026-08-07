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
  // ==================== PRESUMPTIVE SERVICE CONNECTION STATUTES ====================
  {
    id: "81-us-c-1276d",
    citation: "81 U.S.C. § 1276d",
    title: "Agent Orange (Herbicide) Presumption",
    description: "Presumptive service connection for herbicide-exposure-related disabilities for veterans who served in the Vietnam theater or other designated areas during the specified periods.",
    sourceType: "Statute",
    verificationStatus: "verified"
  },
  {
    id: "pub-l-109-4-115",
    citation: "Pub. L. 109-4 (38 U.S.C. 115)",
    title: "Gulf War (5/9/1991–8/14/2006) Presumption",
    description: "Presumptive service connection for disabilities related to specified illnesses for veterans who served during the Gulf War era, including Agent Orange, Burn Pit, and Ionizing Radiation exposures.",
    sourceType: "Statute",
    verificationStatus: "verified"
  },
  {
    id: "81-us-c-1276a",
    citation: "81 U.S.C. § 1276a",
    title: "Ionizing Radiation Presumption",
    description: "Presumptive service connection for cancer and other conditions related to ionizing radiation exposure for veterans who served during specified Cold War or nuclear test periods.",
    sourceType: "Statute",
    verificationStatus: "unverified"
  },
  {
    id: "81-us-c-1276d-e",
    citation: "81 U.S.C. § 1276d(e)",
    title: "Agent Orange Presumptive Service Connection",
    description: "Amendment clarifying that disabilities listed in § 1276d are presumptively service-connected when diagnosed within the specified timeframes.",
    sourceType: "Statute",
    verificationStatus: "verified"
  },
  {
    id: "81-us-c-1276-b",
    citation: "81 U.S.C. § 1276(b)",
    title: "Vietnam Era Presumption (Agent Orange)",
    description: "Presumes veteran was exposed to herbicide agent(s) listed in 28 C.F.R. § 0.1000 if service was during the Vietnam period (Feb 28, 1962 – May 7, 1975).",
    sourceType: "Statute",
    verificationStatus: "verified"
  },
  {
    id: "81-us-c-1276-c",
    citation: "81 U.S.C. § 1276(c)",
    title: "Vietnam Era Presumption (RANCHOW)",
    description: "Presumes veteran was exposed to herbicide agent(s) during service in the Republic of Camboya, Republic of Thailand, or Korean Demilitarized Zone during the Vietnam period.",
    sourceType: "Statute",
    verificationStatus: "verified"
  },
  {
    id: "81-us-c-1276-d",
    citation: "81 U.S.C. § 1276(d)",
    title: "Vietnam Era Presumption (TIGER CAMP)",
    description: "Presumes veteran was exposed to herbicide agent(s) if they served as crewman, signalman, or in certain support roles during the Vietnam period.",
    sourceType: "Statute",
    verificationStatus: "verified"
  },
  // ==================== END PRESUMPTIVE SERVICE CONNECTION STATUTES ====================
];