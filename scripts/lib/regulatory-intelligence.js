const RIN_PATTERN = /^\d{4}-[A-Z0-9]{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const AGENDA_STAGES = new Set(["prerule", "proposed-rule", "final-rule", "long-term", "completed"]);
const LIFECYCLE_TERMINALS = new Set(["withdrawn", "stayed", "delayed", "superseded", "rescinded", "vacated"]);
const FINAL_TYPES = new Set(["rule", "interim-final-rule"]);
const NONFINAL_TYPES = new Set(["proposed-rule", "notice"]);

function validateRin(rin) {
  return typeof rin === "string" && RIN_PATTERN.test(rin);
}

function regulatoryDateRange(date) {
  if (!date || typeof date !== "object") throw new Error("regulatory date must be an object");
  if (date.precision === "day") return { earliest: date.value, latest: date.value };
  if (date.precision === "year") return { earliest: `${date.value}-01-01`, latest: `${date.value}-12-31` };
  if (date.precision === "month") {
    const [yearText, monthText] = date.value.split("-");
    const finalDay = new Date(Date.UTC(Number(yearText), Number(monthText), 0)).getUTCDate();
    return { earliest: `${date.value}-01`, latest: `${date.value}-${String(finalDay).padStart(2, "0")}` };
  }
  throw new Error(`unsupported date precision '${date.precision}'`);
}

function deriveCommentStatus(participation, asOf) {
  if (!participation) return "not-applicable";
  if (participation.commentOpenOn && asOf < participation.commentOpenOn) return "not-open-yet";
  if (participation.commentCloseOn && asOf > participation.commentCloseOn) return "closed";
  if (participation.commentOpenOn && asOf >= participation.commentOpenOn) return "open";
  if (participation.commentCloseOn && asOf <= participation.commentCloseOn) return "open";
  return participation.commentStatus || "unknown";
}

function deriveLifecycleState(action, asOf) {
  if (action.manualLifecycleOverride && action.manualLifecycleOverride.reviewedOn <= asOf) return action.manualLifecycleOverride.state;
  const docs = (action.federalRegisterDocuments || []).filter(doc => doc.publicationDate <= asOf).sort((a, b) => b.publicationDate.localeCompare(a.publicationDate));
  const latestDoc = docs[0];
  const finalDoc = docs.find(doc => FINAL_TYPES.has(doc.type));
  if (latestDoc && LIFECYCLE_TERMINALS.has(latestDoc.legalStatus)) return latestDoc.legalStatus;
  if (latestDoc && latestDoc.type === "correction") return "corrected";
  if (finalDoc) {
    if (finalDoc.codifiedOn && finalDoc.codifiedOn <= asOf) return "codified";
    if (finalDoc.effectiveDate && finalDoc.effectiveDate <= asOf) return "effective";
    return "final-published";
  }
  const activeReview = (action.oiraReviews || []).filter(review => review.receivedOn <= asOf && (!review.concludedOn || review.concludedOn > asOf)).sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))[0];
  if (activeReview && ["final-rule", "interim-final-rule", "final-rule-no-material-change"].includes(activeReview.stage)) return "oira-review-final";
  const proposed = docs.find(doc => doc.type === "proposed-rule");
  if (proposed) {
    const status = deriveCommentStatus(proposed.publicParticipation, asOf);
    if (status === "open") return "comments-open";
    if (status === "closed") return "comments-closed";
    return "proposed-published";
  }
  if (activeReview && activeReview.stage === "proposed-rule") return "oira-review-proposed";
  const agenda = (action.agenda || []).at(-1);
  if (!agenda) return "agenda-planned";
  if (agenda.stage === "prerule") return "prerule";
  if (agenda.stage === "long-term") return "long-term";
  if (agenda.stage === "completed") return "completed";
  return "agenda-planned";
}

function authorityStatusAsOf(document, asOf) {
  if (document.publicationDate > asOf) return { status: "nonbinding", binding: false };
  if (LIFECYCLE_TERMINALS.has(document.legalStatus)) return { status: document.legalStatus, binding: false };
  if (document.legalStatus === "context-only") return { status: "context-only", binding: false };
  if (document.legalStatus === "nonbinding-proposal") return { status: "nonbinding", binding: false };
  if (!document.effectiveDate || asOf < document.effectiveDate) return { status: "not-yet-effective", binding: false };
  if ((document.applicability || []).some(rule => rule.requiresHumanInterpretation || rule.scope === "custom")) return { status: "operative-applicability-review", binding: true };
  return { status: "operative", binding: true };
}

function issue(severity, code, message, path) {
  return { severity, code, message, path };
}

function auditAuthenticity(authenticity, path, expected) {
  const issues = [];
  if (!authenticity || typeof authenticity !== "object") return [issue("error", "AUTHENTICITY_REQUIRED", "Source authenticity metadata is required.", path)];
  if (authenticity.publisher === "federalregister-gov" && authenticity.legalEditionStatus === "official-legal-edition") issues.push(issue("error", "FR_DOT_GOV_MARKED_OFFICIAL", "FederalRegister.gov is not the official legal edition.", path));
  if (authenticity.publisher === "ecfr" && authenticity.legalEditionStatus === "official-legal-edition") issues.push(issue("error", "ECFR_MARKED_OFFICIAL", "eCFR is authoritative and current but is not the official legal edition of the CFR.", path));
  if (authenticity.publisher === "reginfo-oira" && authenticity.legalEditionStatus !== "planning-review-metadata") issues.push(issue("error", "REGINFO_AUTHORITY_ESCALATION", "Reginfo/OIRA must remain planning/review metadata.", path));
  if (authenticity.publisher === "federalregister-gov" && authenticity.legalEditionStatus !== "informational-unofficial") issues.push(issue("error", "FR_DOT_GOV_STATUS_INVALID", "FederalRegister.gov must be labeled informational-unofficial.", path));
  if (authenticity.publisher === "ecfr" && authenticity.legalEditionStatus !== "authoritative-unofficial") issues.push(issue("error", "ECFR_STATUS_INVALID", "eCFR must be labeled authoritative-unofficial.", path));
  if (authenticity.publisher === "regulations-gov" && authenticity.legalEditionStatus !== "public-comment-docket") issues.push(issue("error", "REGULATIONS_GOV_STATUS_INVALID", "Regulations.gov must be labeled public-comment-docket.", path));
  if (authenticity.publisher === "govinfo" && authenticity.legalEditionStatus !== "official-legal-edition") issues.push(issue("error", "GOVINFO_STATUS_INVALID", "GovInfo legal-edition records must be labeled official-legal-edition.", path));
  if (expected === "planning-review-metadata" && authenticity.legalEditionStatus !== expected) issues.push(issue("error", "PLANNING_METADATA_AUTHORITY_ESCALATION", "Planning/review material cannot be treated as binding legal authority.", path));
  if (authenticity.officialEditionSource === "govinfo" && authenticity.officialEditionUrl && !String(authenticity.officialEditionUrl).toLowerCase().includes("govinfo.gov")) issues.push(issue("error", "GOVINFO_VERIFICATION_URL_INVALID", "GovInfo verification must point to govinfo.gov.", path));
  if (authenticity.officialEditionVerified && (!authenticity.officialEditionSource || !authenticity.officialEditionUrl || !authenticity.verifiedOn)) issues.push(issue("error", "OFFICIAL_VERIFICATION_INCOMPLETE", "Official-edition verification requires source, URL, and verification date.", path));
  return issues;
}

function auditAction(action, asOf) {
  const issues = [];
  if (!action || typeof action !== "object" || Array.isArray(action)) return [issue("error", "ACTION_OBJECT_REQUIRED", "Regulatory action must be an object.", "$")];
  if (!validateRin(action.rin)) issues.push(issue("error", "INVALID_RIN", `Invalid RIN '${action.rin}'.`, "rin"));
  if (!action.title || typeof action.title !== "string") issues.push(issue("error", "TITLE_REQUIRED", "Regulatory action title is required.", "title"));
  if (!action.agency || typeof action.agency.department !== "string") issues.push(issue("error", "AGENCY_REQUIRED", "Agency department is required.", "agency.department"));
  if ((action.relatedRins || []).includes(action.rin)) issues.push(issue("error", "SELF_RELATED_RIN", "Action cannot list its own RIN as related.", "relatedRins"));

  for (const [index, agenda] of (action.agenda || []).entries()) {
    const path = `agenda[${index}]`;
    if (!AGENDA_STAGES.has(agenda.stage)) issues.push(issue("error", "INVALID_AGENDA_STAGE", `Invalid Agenda stage '${agenda.stage}'.`, `${path}.stage`));
    issues.push(...auditAuthenticity(agenda.authenticity, `${path}.authenticity`, "planning-review-metadata"));
    for (const [actionIndex, planned] of (agenda.plannedActions || []).entries()) {
      try {
        const range = regulatoryDateRange(planned.date);
        if (planned.date.status !== "anticipated") issues.push(issue("warning", "AGENDA_DATE_NOT_ANTICIPATED", "Unified Agenda planned dates should normally be tagged anticipated.", `${path}.plannedActions[${actionIndex}].date.status`));
        if (planned.date.precision !== "day" && range.earliest === range.latest) issues.push(issue("error", "DATE_PRECISION_COLLAPSED", "Imprecise Agenda dates must not be converted to an invented exact day.", `${path}.plannedActions[${actionIndex}].date`));
      } catch (error) {
        issues.push(issue("error", "INVALID_AGENDA_DATE", error.message, `${path}.plannedActions[${actionIndex}].date`));
      }
    }
  }

  for (const [index, review] of (action.oiraReviews || []).entries()) {
    const path = `oiraReviews[${index}]`;
    if (review.rin !== action.rin) issues.push(issue("error", "OIRA_REVIEW_RIN_MISMATCH", `Review RIN ${review.rin} does not match action ${action.rin}.`, `${path}.rin`));
    if (review.authorityUse !== "review-metadata-only") issues.push(issue("error", "OIRA_REVIEW_AUTHORITY_ESCALATION", "OIRA review metadata cannot be treated as substantive legal authority.", `${path}.authorityUse`));
    if (review.status === "concluded" && !review.concludedOn) issues.push(issue("error", "OIRA_CONCLUSION_DATE_REQUIRED", "Concluded review requires concludedOn.", `${path}.concludedOn`));
    issues.push(...auditAuthenticity(review.authenticity, `${path}.authenticity`, "planning-review-metadata"));
  }

  for (const [index, meeting] of (action.oiraMeetings || []).entries()) {
    const path = `oiraMeetings[${index}]`;
    if (meeting.rin !== action.rin) issues.push(issue("error", "OIRA_MEETING_RIN_MISMATCH", `Meeting RIN ${meeting.rin} does not match action ${action.rin}.`, `${path}.rin`));
    if (meeting.authorityUse !== "policy-development-context-only") issues.push(issue("error", "OIRA_MEETING_AUTHORITY_ESCALATION", "OIRA stakeholder meetings are policy-development context only and are not public comments or legal authority.", `${path}.authorityUse`));
    issues.push(...auditAuthenticity(meeting.authenticity, `${path}.authenticity`, "planning-review-metadata"));
  }

  for (const [index, doc] of (action.federalRegisterDocuments || []).entries()) {
    const path = `federalRegisterDocuments[${index}]`;
    if (!doc.documentNumber || !doc.publicationDate || !ISO_DATE.test(doc.publicationDate)) issues.push(issue("error", "FR_IDENTITY_DATE_REQUIRED", "Federal Register document number and publication date are required.", path));
    if (doc.rin && doc.rin !== action.rin && !(action.relatedRins || []).includes(doc.rin)) issues.push(issue("error", "FR_RIN_MISMATCH", `Document RIN ${doc.rin} is not action RIN ${action.rin} or a declared related RIN.`, `${path}.rin`));
    if (NONFINAL_TYPES.has(doc.type) && ["effective", "published-not-effective"].includes(doc.legalStatus)) issues.push(issue("error", "FR_NONFINAL_MARKED_BINDING", "Proposed rules/notices cannot be marked effective binding rules.", `${path}.legalStatus`));
    if (FINAL_TYPES.has(doc.type) && doc.legalStatus === "effective" && !doc.effectiveDate) issues.push(issue("error", "FR_EFFECTIVE_DATE_REQUIRED", "Effective final rule must record effectiveDate.", `${path}.effectiveDate`));
    if (FINAL_TYPES.has(doc.type) && ["effective", "stayed", "delayed", "withdrawn", "superseded", "rescinded", "vacated"].includes(doc.legalStatus) && !doc.authenticity?.officialEditionVerified) issues.push(issue("error", "BINDING_FR_NOT_OFFICIAL_VERIFIED", "Binding or legally dispositive Federal Register status requires verification against an official edition, normally GovInfo.", `${path}.authenticity.officialEditionVerified`));
    issues.push(...auditAuthenticity(doc.authenticity, `${path}.authenticity`));
    if (doc.publicParticipation?.commentOpenOn && doc.publicParticipation?.commentCloseOn && doc.publicParticipation.commentOpenOn > doc.publicParticipation.commentCloseOn) issues.push(issue("error", "COMMENT_DATE_ORDER", "Comment close date cannot precede comment open date.", `${path}.publicParticipation`));
    if (doc.publicParticipation?.commentStatus && doc.publicParticipation.commentStatus !== "unknown") {
      const derivedCommentStatus = deriveCommentStatus(doc.publicParticipation, asOf);
      if (!["not-applicable", "unknown"].includes(derivedCommentStatus) && derivedCommentStatus !== doc.publicParticipation.commentStatus) issues.push(issue("warning", "COMMENT_STATUS_STALE", `Authored comment status '${doc.publicParticipation.commentStatus}' differs from as-of status '${derivedCommentStatus}'.`, `${path}.publicParticipation.commentStatus`));
    }
  }

  if (action.impact) {
    const state = deriveLifecycleState(action, asOf);
    const currentStates = new Set(["effective", "codified", "corrected"]);
    const pendingStates = new Set(["agenda-planned", "prerule", "oira-review-proposed", "proposed-published", "comments-open", "comments-closed", "oira-review-final", "final-published", "long-term"]);
    if (action.impact.currentLawChanged && !currentStates.has(state) && !action.impact.pendingChange) issues.push(issue("warning", "IMPACT_CURRENT_LAW_STATE_REVIEW", `Impact says current law changed while lifecycle state is '${state}'. Confirm the impact assessment.`, "impact.currentLawChanged"));
    if (action.impact.pendingChange && !pendingStates.has(state) && !action.impact.currentLawChanged) issues.push(issue("warning", "IMPACT_PENDING_STATE_REVIEW", `Impact says change is pending while lifecycle state is '${state}'. Confirm the impact assessment.`, "impact.pendingChange"));
  }

  return issues;
}

module.exports = {
  RIN_PATTERN,
  validateRin,
  regulatoryDateRange,
  deriveCommentStatus,
  deriveLifecycleState,
  authorityStatusAsOf,
  auditAction,
};
