import type {
  FederalRegisterDocument,
  RegulatoryAction,
  RegulatoryDate,
  RegulatoryLifecycleState,
} from "./schema";

export type AuthorityAsOfStatus =
  | "operative"
  | "operative-applicability-review"
  | "not-yet-effective"
  | "nonbinding"
  | "stayed"
  | "delayed"
  | "withdrawn"
  | "superseded"
  | "rescinded"
  | "vacated"
  | "context-only";

export type AuthorityAsOfResult = {
  documentNumber: string;
  status: AuthorityAsOfStatus;
  binding: boolean;
  reason: string;
};

const compareIso = (left: string, right: string) => left.localeCompare(right);
const onOrBefore = (date: string | undefined, asOf: string) => Boolean(date && compareIso(date, asOf) <= 0);

export const regulatoryDateRange = (date: RegulatoryDate): { earliest: string; latest: string } => {
  if (date.precision === "day") return { earliest: date.value, latest: date.value };
  if (date.precision === "year") return { earliest: `${date.value}-01-01`, latest: `${date.value}-12-31` };

  const [yearText, monthText] = date.value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    earliest: `${date.value}-01`,
    latest: `${date.value}-${String(finalDay).padStart(2, "0")}`,
  };
};

export const deriveCommentStatus = (
  participation: FederalRegisterDocument["publicParticipation"],
  asOf: string,
): "not-applicable" | "not-open-yet" | "open" | "closed" | "unknown" => {
  if (!participation) return "not-applicable";
  if (participation.commentOpenOn && compareIso(asOf, participation.commentOpenOn) < 0) return "not-open-yet";
  if (participation.commentCloseOn && compareIso(asOf, participation.commentCloseOn) > 0) return "closed";
  if (participation.commentOpenOn && onOrBefore(participation.commentOpenOn, asOf)) return "open";
  if (participation.commentCloseOn && compareIso(asOf, participation.commentCloseOn) <= 0) return "open";
  return participation.commentStatus;
};

const activeOiraReview = (action: RegulatoryAction, asOf: string) =>
  action.oiraReviews
    .filter((review) => onOrBefore(review.receivedOn, asOf) && (!review.concludedOn || compareIso(review.concludedOn, asOf) > 0))
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))[0];

const publishedDocumentsAsOf = (action: RegulatoryAction, asOf: string) =>
  action.federalRegisterDocuments
    .filter((document) => onOrBefore(document.publicationDate, asOf))
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate));

const latestAgendaAsOf = (action: RegulatoryAction, asOf: string) => {
  const candidates = action.agenda.filter((agenda) =>
    agenda.plannedActions.length === 0 || agenda.plannedActions.some(({ date }) => regulatoryDateRange(date).earliest <= asOf),
  );
  return candidates.at(-1) ?? action.agenda.at(-1);
};

export const deriveLifecycleState = (action: RegulatoryAction, asOf: string): RegulatoryLifecycleState => {
  if (action.manualLifecycleOverride && action.manualLifecycleOverride.reviewedOn <= asOf) {
    return action.manualLifecycleOverride.state;
  }

  const documents = publishedDocumentsAsOf(action, asOf);
  const latestDocument = documents[0];
  const latestFinal = documents.find((document) => document.type === "rule" || document.type === "interim-final-rule");

  if (latestDocument) {
    switch (latestDocument.legalStatus) {
      case "vacated": return "vacated";
      case "rescinded": return "rescinded";
      case "withdrawn": return "withdrawn";
      case "superseded": return "superseded";
      case "stayed": return "stayed";
      case "delayed": return "delayed";
      default: break;
    }
  }

  if (latestDocument?.type === "correction") return "corrected";

  if (latestFinal) {
    if (latestFinal.codifiedOn && onOrBefore(latestFinal.codifiedOn, asOf)) return "codified";
    if (latestFinal.effectiveDate && onOrBefore(latestFinal.effectiveDate, asOf)) return "effective";
    return "final-published";
  }

  const review = activeOiraReview(action, asOf);
  if (review && ["final-rule", "interim-final-rule", "final-rule-no-material-change"].includes(review.stage)) {
    return "oira-review-final";
  }

  const proposed = documents.find((document) => document.type === "proposed-rule");
  if (proposed) {
    const commentStatus = deriveCommentStatus(proposed.publicParticipation, asOf);
    if (commentStatus === "open") return "comments-open";
    if (commentStatus === "closed") return "comments-closed";
    return "proposed-published";
  }

  if (review && review.stage === "proposed-rule") return "oira-review-proposed";

  const agenda = latestAgendaAsOf(action, asOf);
  if (!agenda) return "agenda-planned";
  switch (agenda.stage) {
    case "prerule": return "prerule";
    case "proposed-rule": return "agenda-planned";
    case "final-rule": return "agenda-planned";
    case "long-term": return "long-term";
    case "completed": return "completed";
  }
};

export const authorityStatusAsOf = (document: FederalRegisterDocument, asOf: string): AuthorityAsOfResult => {
  if (compareIso(document.publicationDate, asOf) > 0) {
    return { documentNumber: document.documentNumber, status: "nonbinding", binding: false, reason: "Document had not yet been published as of the requested date." };
  }

  switch (document.legalStatus) {
    case "stayed": return { documentNumber: document.documentNumber, status: "stayed", binding: false, reason: "Rule is marked stayed." };
    case "delayed": return { documentNumber: document.documentNumber, status: "delayed", binding: false, reason: "Rule effective date or operation is marked delayed." };
    case "withdrawn": return { documentNumber: document.documentNumber, status: "withdrawn", binding: false, reason: "Regulatory action is marked withdrawn." };
    case "superseded": return { documentNumber: document.documentNumber, status: "superseded", binding: false, reason: "Document is marked superseded by later authority." };
    case "rescinded": return { documentNumber: document.documentNumber, status: "rescinded", binding: false, reason: "Rule is marked rescinded." };
    case "vacated": return { documentNumber: document.documentNumber, status: "vacated", binding: false, reason: "Rule is marked vacated." };
    case "context-only": return { documentNumber: document.documentNumber, status: "context-only", binding: false, reason: "Document is retained for regulatory context only." };
    case "nonbinding-proposal": return { documentNumber: document.documentNumber, status: "nonbinding", binding: false, reason: "Proposed rules do not establish current binding regulatory requirements." };
    default: break;
  }

  if (!document.effectiveDate || compareIso(asOf, document.effectiveDate) < 0) {
    return { documentNumber: document.documentNumber, status: "not-yet-effective", binding: false, reason: "Final rule is published but its effective date has not arrived." };
  }

  if (document.applicability.some((rule) => rule.requiresHumanInterpretation || rule.scope === "custom")) {
    return {
      documentNumber: document.documentNumber,
      status: "operative-applicability-review",
      binding: true,
      reason: "Rule is effective, but claimant-specific applicability requires review of the authored applicability language.",
    };
  }

  return { documentNumber: document.documentNumber, status: "operative", binding: true, reason: "Rule is published, effective, and not marked stayed, delayed, withdrawn, superseded, rescinded, or vacated." };
};

export const operativeAuthorityAsOf = (action: RegulatoryAction, asOf: string): AuthorityAsOfResult[] =>
  action.federalRegisterDocuments.map((document) => authorityStatusAsOf(document, asOf));
