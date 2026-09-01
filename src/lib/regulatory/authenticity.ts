import type {
  FederalRegisterDocument,
  RegulatoryAction,
  SourceAuthenticity,
} from "./schema";

export type RegulatoryAuthenticityIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  documentNumber?: string;
};

export const inferAuthenticityFromUrl = (url: string): Omit<SourceAuthenticity, "officialEditionVerified"> & { officialEditionVerified: false } => {
  const host = new URL(url).hostname.toLowerCase();
  if (host === "www.govinfo.gov" || host === "govinfo.gov") {
    return { publisher: "govinfo", legalEditionStatus: "official-legal-edition", officialEditionVerified: false };
  }
  if (host === "www.ecfr.gov" || host === "ecfr.gov") {
    return { publisher: "ecfr", legalEditionStatus: "authoritative-unofficial", officialEditionVerified: false };
  }
  if (host === "www.federalregister.gov" || host === "federalregister.gov") {
    return { publisher: "federalregister-gov", legalEditionStatus: "informational-unofficial", officialEditionVerified: false };
  }
  if (host === "www.reginfo.gov" || host === "reginfo.gov" || host === "mobile.reginfo.gov") {
    return { publisher: "reginfo-oira", legalEditionStatus: "planning-review-metadata", officialEditionVerified: false };
  }
  if (host === "www.regulations.gov" || host === "regulations.gov") {
    return { publisher: "regulations-gov", legalEditionStatus: "public-comment-docket", officialEditionVerified: false };
  }
  if (host.endsWith(".va.gov") || host === "va.gov") {
    return { publisher: "va", legalEditionStatus: "agency-guidance", officialEditionVerified: false };
  }
  if (host.endsWith("congress.gov") || host.endsWith("house.gov")) {
    return { publisher: "congress", legalEditionStatus: "official-legal-edition", officialEditionVerified: false };
  }
  if (host.endsWith(".gov")) {
    return { publisher: "other-government", legalEditionStatus: "unknown", officialEditionVerified: false };
  }
  return { publisher: "other", legalEditionStatus: "unknown", officialEditionVerified: false };
};

export const auditFederalRegisterAuthenticity = (document: FederalRegisterDocument): RegulatoryAuthenticityIssue[] => {
  const issues: RegulatoryAuthenticityIssue[] = [];
  const finalLike = document.type === "rule" || document.type === "interim-final-rule";
  const legallyDispositive = finalLike && ["effective", "stayed", "delayed", "withdrawn", "superseded", "rescinded", "vacated"].includes(document.legalStatus);

  if (document.authenticity.publisher === "federalregister-gov" && document.authenticity.legalEditionStatus === "official-legal-edition") {
    issues.push({ severity: "error", code: "FR_DOT_GOV_MARKED_OFFICIAL", documentNumber: document.documentNumber, message: "FederalRegister.gov must not be labeled the official legal edition." });
  }

  if (legallyDispositive && !document.authenticity.officialEditionVerified) {
    issues.push({ severity: "error", code: "BINDING_FR_NOT_OFFICIAL_VERIFIED", documentNumber: document.documentNumber, message: "Binding-rule reliance requires verification against an official Federal Register edition, normally GovInfo." });
  }

  if (document.authenticity.officialEditionVerified && document.authenticity.officialEditionSource === "govinfo" && !document.govinfoPdfUrl) {
    issues.push({ severity: "warning", code: "GOVINFO_VERIFIED_WITHOUT_DOCUMENT_LINK", documentNumber: document.documentNumber, message: "GovInfo verification is recorded but the normalized document does not preserve its GovInfo PDF URL." });
  }

  return issues;
};

export const auditRegulatoryAuthenticity = (action: RegulatoryAction): RegulatoryAuthenticityIssue[] => {
  const issues = action.federalRegisterDocuments.flatMap(auditFederalRegisterAuthenticity);

  for (const agenda of action.agenda) {
    if (agenda.authenticity.legalEditionStatus !== "planning-review-metadata") {
      issues.push({ severity: "error", code: "AGENDA_AUTHORITY_ESCALATION", message: `Unified Agenda record for ${action.rin} must remain planning/review metadata.` });
    }
  }

  for (const review of action.oiraReviews) {
    if (review.authorityUse !== "review-metadata-only" || review.authenticity.legalEditionStatus !== "planning-review-metadata") {
      issues.push({ severity: "error", code: "OIRA_REVIEW_AUTHORITY_ESCALATION", message: `OIRA review ${review.reviewId} cannot be elevated into substantive legal authority.` });
    }
  }

  for (const meeting of action.oiraMeetings) {
    if (meeting.authorityUse !== "policy-development-context-only") {
      issues.push({ severity: "error", code: "OIRA_MEETING_AUTHORITY_ESCALATION", message: `OIRA meeting ${meeting.meetingId} must remain policy-development context only.` });
    }
  }

  return issues;
};
