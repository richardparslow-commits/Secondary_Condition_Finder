import type {
  AuthorityCategory,
  ClaimTheory,
  FederalRegisterType,
  NexusRequirement,
  PropositionRole,
  SourceReference,
} from "./schema";

export type ClassificationConfidence = "explicit" | "high" | "medium" | "unknown";
export type EvidenceArchitectureSeverity = "error" | "warning" | "info";

export type SourceClassification = {
  authorityCategory?: AuthorityCategory;
  confidence: ClassificationConfidence;
  reasons: string[];
};

export type EvidenceArchitectureIssue = {
  severity: EvidenceArchitectureSeverity;
  code: string;
  message: string;
};

export type EvidenceArchitectureContext = {
  claimTheories?: ClaimTheory[];
  nexusRequirement?: NexusRequirement;
};

const legalOrProceduralCategories = new Set<AuthorityCategory>([
  "statutory-authority",
  "current-regulatory-authority",
  "federal-register-final-rule",
  "federal-register-proposed-or-notice",
  "va-adjudication-guidance",
]);

const finalFederalRegisterTypes = new Set<FederalRegisterType>(["final-rule", "interim-final-rule"]);
const nonfinalFederalRegisterTypes = new Set<FederalRegisterType>(["proposed-rule", "notice"]);

const normalize = (reference: Pick<SourceReference, "citation" | "note" | "sourceUrl">) =>
  [reference.citation, reference.note, reference.sourceUrl ?? ""].join(" ").toLowerCase();

const hasAny = (value: string, needles: string[]) => needles.some((needle) => value.includes(needle));

const classifyFederalRegister = (reference: SourceReference, normalized: string): SourceClassification => {
  if (reference.federalRegisterType && finalFederalRegisterTypes.has(reference.federalRegisterType)) {
    return {
      authorityCategory: "federal-register-final-rule",
      confidence: "high",
      reasons: [`Federal Register document type is ${reference.federalRegisterType}.`],
    };
  }

  if (reference.federalRegisterType && nonfinalFederalRegisterTypes.has(reference.federalRegisterType)) {
    return {
      authorityCategory: "federal-register-proposed-or-notice",
      confidence: "high",
      reasons: [`Federal Register document type is ${reference.federalRegisterType}.`],
    };
  }

  if (/\b(interim final rule|final rule)\b/.test(normalized)) {
    return {
      authorityCategory: "federal-register-final-rule",
      confidence: "medium",
      reasons: ["Federal Register text identifies a final or interim final rule."],
    };
  }

  if (/\b(proposed rule|notice of proposed rulemaking|notice)\b/.test(normalized)) {
    return {
      authorityCategory: "federal-register-proposed-or-notice",
      confidence: "medium",
      reasons: ["Federal Register text identifies a proposed rule or notice."],
    };
  }

  return {
    confidence: "unknown",
    reasons: ["Federal Register source detected, but document type is not sufficiently identified."],
  };
};

export const classifySourceReference = (reference: SourceReference): SourceClassification => {
  if (reference.authorityCategory) {
    return {
      authorityCategory: reference.authorityCategory,
      confidence: "explicit",
      reasons: ["authorityCategory is explicitly authored."],
    };
  }

  const normalized = normalize(reference);
  const url = reference.sourceUrl?.toLowerCase() ?? "";

  if (url.includes("federalregister.gov") || /\b\d+\s+fed\.?\s*reg\.?\s+\d+\b/i.test(reference.citation)) {
    return classifyFederalRegister(reference, normalized);
  }

  if (
    url.includes("ecfr.gov") ||
    /\b38\s+c\.?f\.?r\.?\b/i.test(reference.citation) ||
    /\bcode of federal regulations\b/i.test(normalized)
  ) {
    return {
      authorityCategory: "current-regulatory-authority",
      confidence: "high",
      reasons: ["Source identifies the current Code of Federal Regulations/eCFR."],
    };
  }

  if (
    /\b38\s+u\.?s\.?c\.?\b/i.test(reference.citation) ||
    url.includes("uscode.house.gov") ||
    (url.includes("govinfo.gov") && hasAny(normalized, ["u.s.c.", "united states code", "public law"])) ||
    (url.includes("congress.gov") && hasAny(normalized, ["public law", "u.s.c.", "united states code"]))
  ) {
    return {
      authorityCategory: "statutory-authority",
      confidence: "high",
      reasons: ["Source identifies the United States Code or enacted public law."],
    };
  }

  if (
    url.includes("knowva.ebenefits.va.gov") ||
    url.includes("benefits.va.gov/warms") ||
    /\bm21-?1\b/i.test(normalized) ||
    /\badjudication procedures manual\b/i.test(normalized)
  ) {
    return {
      authorityCategory: "va-adjudication-guidance",
      confidence: "high",
      reasons: ["Source identifies VA adjudication/procedural guidance."],
    };
  }

  if (
    url.includes("pubmed.ncbi.nlm.nih.gov") ||
    url.includes("pmc.ncbi.nlm.nih.gov") ||
    url.includes("doi.org") ||
    /\bdoi:\s*10\.\d{4,9}\//i.test(reference.citation) ||
    /\bpmid:?\s*\d+\b/i.test(reference.citation)
  ) {
    return {
      authorityCategory: "medical-scientific-evidence",
      confidence: "high",
      reasons: ["Source identifies peer-reviewed/biomedical literature via PubMed, PMC, DOI, or PMID."],
    };
  }

  if (
    /\b(dbq|c&p|compensation and pension|medical record|treatment record|service treatment record|service treatment records|nexus opinion|medical opinion|lay statement|buddy statement)\b/i.test(
      normalized,
    )
  ) {
    return {
      authorityCategory: "individual-evidence",
      confidence: "medium",
      reasons: ["Source text identifies individualized claim evidence."],
    };
  }

  return { confidence: "unknown", reasons: ["No reliable source-type signal was detected."] };
};

export const recommendedPropositionRole = (category: AuthorityCategory): PropositionRole => {
  switch (category) {
    case "statutory-authority":
    case "current-regulatory-authority":
    case "federal-register-final-rule":
      return "legal-framework";
    case "federal-register-proposed-or-notice":
      return "regulatory-history";
    case "va-adjudication-guidance":
      return "procedural-guidance";
    case "medical-scientific-evidence":
      return "clinical-evidence";
    case "individual-evidence":
      return "individual-fact";
  }
};

const effectiveRole = (reference: SourceReference): PropositionRole | undefined => {
  if (reference.propositionRole) return reference.propositionRole;
  if (reference.verificationScope === "clinical-evidence") return "clinical-evidence";
  if (reference.verificationScope === "procedural-guidance") return "procedural-guidance";
  return undefined;
};

export const auditSourceReference = (
  reference: SourceReference,
  context: EvidenceArchitectureContext = {},
): EvidenceArchitectureIssue[] => {
  const issues: EvidenceArchitectureIssue[] = [];
  const classification = classifySourceReference(reference);
  const category = classification.authorityCategory;
  const role = effectiveRole(reference);

  const explicitNonfinalFederalRegister =
    reference.authorityCategory === "federal-register-proposed-or-notice" ||
    reference.federalRegisterType === "proposed-rule" ||
    reference.federalRegisterType === "notice";

  if (explicitNonfinalFederalRegister && reference.bindingStatus === "binding") {
    issues.push({
      severity: "error",
      code: "FR_NONFINAL_MARKED_BINDING",
      message: "Federal Register proposed rules/notices cannot be treated as binding authority.",
    });
  }

  if (
    category &&
    legalOrProceduralCategories.has(category) &&
    (role === "clinical-evidence" || reference.verificationScope === "clinical-evidence")
  ) {
    const explicitConflict = reference.authorityCategory !== undefined || reference.propositionRole !== undefined;
    issues.push({
      severity: explicitConflict ? "error" : "warning",
      code: "NONCLINICAL_SOURCE_AS_CLINICAL_PROOF",
      message:
        "A statute, regulation, Federal Register document, or VA procedural source cannot prove an ordinary clinical-causation proposition. Use medical/scientific or individualized medical evidence for that proposition.",
    });
  }

  if (
    reference.authorityCategory === "federal-register-proposed-or-notice" &&
    reference.propositionRole === "legal-framework"
  ) {
    issues.push({
      severity: "warning",
      code: "FR_NONFINAL_LEGAL_ROLE_REVIEW",
      message: "A proposed rule/notice should normally be tagged regulatory-history rather than legal-framework.",
    });
  }

  const federalRegisterDetected =
    reference.sourceUrl?.toLowerCase().includes("federalregister.gov") ||
    /\b\d+\s+fed\.?\s*reg\.?\s+\d+\b/i.test(reference.citation);

  if (federalRegisterDetected && !reference.federalRegisterType && classification.confidence === "unknown") {
    issues.push({
      severity: "warning",
      code: "FR_TYPE_REQUIRED_FOR_CLASSIFICATION",
      message: "Federal Register source needs a document type before it can be classified as final/binding or nonfinal/contextual.",
    });
  }

  if (!category) {
    issues.push({
      severity: "warning",
      code: "SOURCE_CATEGORY_UNKNOWN",
      message: classification.reasons[0] ?? "Source category could not be inferred.",
    });
  }

  const theories = new Set(context.claimTheories ?? []);
  if (
    theories.has("presumptive") &&
    context.nexusRequirement === "individual-medical-opinion" &&
    theories.size === 1
  ) {
    issues.push({
      severity: "warning",
      code: "PRESUMPTIVE_NEXUS_REQUIREMENT_REVIEW",
      message:
        "This mapping is purely presumptive but still requires an individualized nexus opinion. Confirm that the claimed legal element is not already presumed.",
    });
  }

  if (
    category === "federal-register-final-rule" &&
    (theories.has("rating-change") || theories.has("effective-date"))
  ) {
    if (!reference.effectiveDate) {
      issues.push({
        severity: "warning",
        code: "FR_EFFECTIVE_DATE_MISSING",
        message: "Rating-change/effective-date use of a final Federal Register rule should record its effective date.",
      });
    }
    if (!reference.applicability) {
      issues.push({
        severity: "warning",
        code: "FR_APPLICABILITY_MISSING",
        message: "Rating-change/effective-date use of a final Federal Register rule should record applicability/pending-claim language when available.",
      });
    }
  }

  if (category && !reference.propositionRole) {
    issues.push({
      severity: "info",
      code: "PROPOSITION_ROLE_NOT_AUTHORED",
      message: `Recommended proposition role: ${recommendedPropositionRole(category)}.`,
    });
  }

  return issues;
};

export const auditSuggestionEvidence = (suggestion: {
  claimTheories?: ClaimTheory[];
  nexusRequirement?: NexusRequirement;
  sourceReferences: SourceReference[];
}): EvidenceArchitectureIssue[] =>
  suggestion.sourceReferences.flatMap((reference) =>
    auditSourceReference(reference, {
      claimTheories: suggestion.claimTheories,
      nexusRequirement: suggestion.nexusRequirement,
    }),
  );
