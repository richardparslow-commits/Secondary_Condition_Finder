const AUTHORITY_CATEGORIES = new Set([
  "statutory-authority",
  "current-regulatory-authority",
  "federal-register-final-rule",
  "federal-register-proposed-or-notice",
  "va-adjudication-guidance",
  "medical-scientific-evidence",
  "individual-evidence",
]);

const PROPOSITION_ROLES = new Set([
  "legal-framework",
  "legal-presumption",
  "regulatory-history",
  "effective-date-applicability",
  "rating-criteria",
  "procedural-guidance",
  "clinical-evidence",
  "individual-fact",
]);

const FEDERAL_REGISTER_TYPES = new Set([
  "final-rule",
  "interim-final-rule",
  "proposed-rule",
  "notice",
  "correction",
  "other",
]);

const BINDING_STATUSES = new Set(["binding", "nonbinding", "context-only"]);
const CLAIM_THEORIES = new Set([
  "direct",
  "presumptive",
  "secondary-causation",
  "secondary-aggravation",
  "tera",
  "gulf-war-mucmi",
  "increased-rating",
  "rating-change",
  "effective-date",
]);
const NEXUS_REQUIREMENTS = new Set([
  "individual-medical-opinion",
  "legally-presumed",
  "theory-dependent",
  "not-applicable",
]);

const FINAL_FR_TYPES = new Set(["final-rule", "interim-final-rule"]);
const NONFINAL_FR_TYPES = new Set(["proposed-rule", "notice"]);
const NONCLINICAL_CATEGORIES = new Set([
  "statutory-authority",
  "current-regulatory-authority",
  "federal-register-final-rule",
  "federal-register-proposed-or-notice",
  "va-adjudication-guidance",
]);

const textOf = source => [source.citation || "", source.note || "", source.sourceUrl || ""].join(" ").toLowerCase();
const hasAny = (value, needles) => needles.some(needle => value.includes(needle));

function classifyFederalRegister(source, normalized) {
  if (source.federalRegisterType && FINAL_FR_TYPES.has(source.federalRegisterType)) {
    return { authorityCategory: "federal-register-final-rule", confidence: "high", reason: `Federal Register document type is ${source.federalRegisterType}.` };
  }
  if (source.federalRegisterType && NONFINAL_FR_TYPES.has(source.federalRegisterType)) {
    return { authorityCategory: "federal-register-proposed-or-notice", confidence: "high", reason: `Federal Register document type is ${source.federalRegisterType}.` };
  }
  if (/\b(interim final rule|final rule)\b/.test(normalized)) {
    return { authorityCategory: "federal-register-final-rule", confidence: "medium", reason: "Federal Register text identifies a final or interim final rule." };
  }
  if (/\b(proposed rule|notice of proposed rulemaking|notice)\b/.test(normalized)) {
    return { authorityCategory: "federal-register-proposed-or-notice", confidence: "medium", reason: "Federal Register text identifies a proposed rule or notice." };
  }
  return { confidence: "unknown", reason: "Federal Register source detected, but document type is not sufficiently identified." };
}

function classifySource(source) {
  if (source.authorityCategory) {
    if (AUTHORITY_CATEGORIES.has(source.authorityCategory)) {
      return { authorityCategory: source.authorityCategory, confidence: "explicit", reason: "authorityCategory is explicitly authored." };
    }
    return { confidence: "unknown", reason: `Invalid explicit authorityCategory '${source.authorityCategory}'.` };
  }

  const normalized = textOf(source);
  const url = (source.sourceUrl || "").toLowerCase();
  const citation = source.citation || "";

  if (url.includes("federalregister.gov") || /\b\d+\s+fed\.?\s*reg\.?\s+\d+\b/i.test(citation)) {
    return classifyFederalRegister(source, normalized);
  }
  if (url.includes("ecfr.gov") || /\b38\s+c\.?f\.?r\.?\b/i.test(citation) || /\bcode of federal regulations\b/i.test(normalized)) {
    return { authorityCategory: "current-regulatory-authority", confidence: "high", reason: "Source identifies the current Code of Federal Regulations/eCFR." };
  }
  if (
    /\b38\s+u\.?s\.?c\.?\b/i.test(citation) ||
    url.includes("uscode.house.gov") ||
    (url.includes("govinfo.gov") && hasAny(normalized, ["u.s.c.", "united states code", "public law"])) ||
    (url.includes("congress.gov") && hasAny(normalized, ["public law", "u.s.c.", "united states code"]))
  ) {
    return { authorityCategory: "statutory-authority", confidence: "high", reason: "Source identifies the United States Code or enacted public law." };
  }
  if (url.includes("knowva.ebenefits.va.gov") || url.includes("benefits.va.gov/warms") || /\bm21-?1\b/i.test(normalized) || /\badjudication procedures manual\b/i.test(normalized)) {
    return { authorityCategory: "va-adjudication-guidance", confidence: "high", reason: "Source identifies VA adjudication/procedural guidance." };
  }
  if (url.includes("pubmed.ncbi.nlm.nih.gov") || url.includes("pmc.ncbi.nlm.nih.gov") || url.includes("doi.org") || /\bdoi:\s*10\.\d{4,9}\//i.test(citation) || /\bpmid:?\s*\d+\b/i.test(citation)) {
    return { authorityCategory: "medical-scientific-evidence", confidence: "high", reason: "Source identifies peer-reviewed/biomedical literature via PubMed, PMC, DOI, or PMID." };
  }
  if (/\b(dbq|c&p|compensation and pension|medical record|treatment record|service treatment record|service treatment records|nexus opinion|medical opinion|lay statement|buddy statement)\b/i.test(normalized)) {
    return { authorityCategory: "individual-evidence", confidence: "medium", reason: "Source text identifies individualized claim evidence." };
  }
  return { confidence: "unknown", reason: "No reliable source-type signal was detected." };
}

function recommendedRole(category) {
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
    default:
      return undefined;
  }
}

function effectiveRole(source) {
  if (source.propositionRole) return source.propositionRole;
  if (source.verificationScope === "clinical-evidence") return "clinical-evidence";
  if (source.verificationScope === "procedural-guidance") return "procedural-guidance";
  return undefined;
}

function auditSource(source, context = {}) {
  const issues = [];
  for (const metadataError of validateExplicitMetadata(source)) {
    issues.push({ severity: "error", code: "INVALID_EXPLICIT_METADATA", message: metadataError });
  }
  const classification = classifySource(source);
  const category = classification.authorityCategory;
  const role = effectiveRole(source);

  const explicitNonfinalFR = source.authorityCategory === "federal-register-proposed-or-notice" || source.federalRegisterType === "proposed-rule" || source.federalRegisterType === "notice";
  if (explicitNonfinalFR && source.bindingStatus === "binding") {
    issues.push({ severity: "error", code: "FR_NONFINAL_MARKED_BINDING", message: "Federal Register proposed rules/notices cannot be treated as binding authority." });
  }

  if (category && NONCLINICAL_CATEGORIES.has(category) && (role === "clinical-evidence" || source.verificationScope === "clinical-evidence")) {
    const explicitConflict = source.authorityCategory !== undefined || source.propositionRole !== undefined;
    issues.push({ severity: explicitConflict ? "error" : "warning", code: "NONCLINICAL_SOURCE_AS_CLINICAL_PROOF", message: "A statute, regulation, Federal Register document, or VA procedural source cannot prove an ordinary clinical-causation proposition." });
  }

  if (source.authorityCategory === "federal-register-proposed-or-notice" && source.propositionRole === "legal-framework") {
    issues.push({ severity: "warning", code: "FR_NONFINAL_LEGAL_ROLE_REVIEW", message: "A proposed rule/notice should normally be tagged regulatory-history rather than legal-framework." });
  }

  const federalRegisterDetected = (source.sourceUrl || "").toLowerCase().includes("federalregister.gov") || /\b\d+\s+fed\.?\s*reg\.?\s+\d+\b/i.test(source.citation || "");
  if (federalRegisterDetected && !source.federalRegisterType && classification.confidence === "unknown") {
    issues.push({ severity: "warning", code: "FR_TYPE_REQUIRED_FOR_CLASSIFICATION", message: "Federal Register source needs a document type before it can be classified as final/binding or nonfinal/contextual." });
  }

  if (!category) issues.push({ severity: "warning", code: "SOURCE_CATEGORY_UNKNOWN", message: classification.reason });

  const theories = new Set(context.claimTheories || []);
  if (theories.has("presumptive") && context.nexusRequirement === "individual-medical-opinion" && theories.size === 1) {
    issues.push({ severity: "warning", code: "PRESUMPTIVE_NEXUS_REQUIREMENT_REVIEW", message: "Purely presumptive mapping still requires an individualized nexus opinion; confirm the legal element is not already presumed." });
  }

  if (category === "federal-register-final-rule" && (theories.has("rating-change") || theories.has("effective-date"))) {
    if (!source.effectiveDate) issues.push({ severity: "warning", code: "FR_EFFECTIVE_DATE_MISSING", message: "Rating-change/effective-date use of a final Federal Register rule should record its effective date." });
    if (!source.applicability) issues.push({ severity: "warning", code: "FR_APPLICABILITY_MISSING", message: "Rating-change/effective-date use of a final Federal Register rule should record applicability/pending-claim language when available." });
  }

  if (category && !source.propositionRole) issues.push({ severity: "info", code: "PROPOSITION_ROLE_NOT_AUTHORED", message: `Recommended proposition role: ${recommendedRole(category)}.` });
  return issues;
}

function validateExplicitMetadata(source) {
  const errors = [];
  if (source.authorityCategory !== undefined && !AUTHORITY_CATEGORIES.has(source.authorityCategory)) errors.push(`invalid authorityCategory '${source.authorityCategory}'`);
  if (source.propositionRole !== undefined && !PROPOSITION_ROLES.has(source.propositionRole)) errors.push(`invalid propositionRole '${source.propositionRole}'`);
  if (source.federalRegisterType !== undefined && !FEDERAL_REGISTER_TYPES.has(source.federalRegisterType)) errors.push(`invalid federalRegisterType '${source.federalRegisterType}'`);
  if (source.bindingStatus !== undefined && !BINDING_STATUSES.has(source.bindingStatus)) errors.push(`invalid bindingStatus '${source.bindingStatus}'`);
  return errors;
}

function validateSuggestionMetadata(suggestion) {
  const errors = [];
  if (suggestion.regulatoryActionRefs !== undefined) {
    if (!Array.isArray(suggestion.regulatoryActionRefs) || suggestion.regulatoryActionRefs.length > 10) {
      errors.push("regulatoryActionRefs must be an array with no more than 10 entries");
    } else {
      const allowedRelations = new Set(["legal-framework", "pending-change", "presumption-change", "rating-schedule-change", "effective-date-applicability", "procedural-context"]);
      const seenRins = new Set();
      for (const ref of suggestion.regulatoryActionRefs) {
        if (!ref || typeof ref !== "object" || Array.isArray(ref)) { errors.push("regulatoryActionRefs entries must be objects"); continue; }
        if (typeof ref.rin !== "string" || !/^\d{4}-[A-Z0-9]{4}$/.test(ref.rin)) errors.push(`invalid regulatory action RIN '${ref.rin}'`);
        if (!allowedRelations.has(ref.relation)) errors.push(`invalid regulatory action relation '${ref.relation}'`);
        const key = `${ref.rin}:${ref.relation}`;
        if (seenRins.has(key)) errors.push(`duplicate regulatory action reference '${key}'`);
        seenRins.add(key);
      }
    }
  }
  if (suggestion.claimTheories !== undefined) {
    if (!Array.isArray(suggestion.claimTheories) || suggestion.claimTheories.length === 0 || suggestion.claimTheories.length > 4) {
      errors.push("claimTheories must be an array with 1 to 4 entries");
    } else {
      for (const theory of suggestion.claimTheories) if (!CLAIM_THEORIES.has(theory)) errors.push(`invalid claim theory '${theory}'`);
      if (new Set(suggestion.claimTheories).size !== suggestion.claimTheories.length) errors.push("claimTheories must be unique");
    }
  }
  if (suggestion.nexusRequirement !== undefined && !NEXUS_REQUIREMENTS.has(suggestion.nexusRequirement)) errors.push(`invalid nexusRequirement '${suggestion.nexusRequirement}'`);
  if (suggestion.nexusRequirement === "legally-presumed" && Array.isArray(suggestion.claimTheories) && !suggestion.claimTheories.includes("presumptive")) {
    errors.push("legally-presumed nexusRequirement requires presumptive in claimTheories");
  }
  return errors;
}

module.exports = {
  AUTHORITY_CATEGORIES,
  PROPOSITION_ROLES,
  FEDERAL_REGISTER_TYPES,
  BINDING_STATUSES,
  CLAIM_THEORIES,
  NEXUS_REQUIREMENTS,
  classifySource,
  recommendedRole,
  auditSource,
  validateExplicitMetadata,
  validateSuggestionMetadata,
};
