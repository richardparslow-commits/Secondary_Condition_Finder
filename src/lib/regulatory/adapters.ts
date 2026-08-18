import type {
  FederalRegisterDocument,
  OiraMeeting,
  OiraReview,
  RegulatoryDate,
  UnifiedAgendaStatus,
} from "./schema";

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  if (/^yes$/i.test(value.trim())) return true;
  if (/^no$/i.test(value.trim())) return false;
  return undefined;
};

export const parseAgendaPlannedDate = (raw: string, status: RegulatoryDate["status"] = "anticipated"): RegulatoryDate => {
  const value = raw.trim();
  if (/^\d{4}$/.test(value)) return { value, precision: "year", status };
  if (/^\d{4}-\d{2}$/.test(value)) return { value, precision: "month", status };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { value, precision: "day", status };

  const slash = value.match(/^(\d{1,2}|00)\/(\d{1,2}|00)\/(\d{4})$/);
  if (slash) {
    const [, monthRaw, dayRaw, year] = slash;
    if (monthRaw === "00") return { value: year, precision: "year", status, note: `Source supplied imprecise date '${raw}'.` };
    const month = monthRaw.padStart(2, "0");
    if (dayRaw === "00") return { value: `${year}-${month}`, precision: "month", status, note: `Source supplied imprecise date '${raw}'.` };
    return { value: `${year}-${month}-${dayRaw.padStart(2, "0")}`, precision: "day", status };
  }

  const monthYear = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYear) return { value: `${monthYear[2]}-${monthYear[1].padStart(2, "0")}`, precision: "month", status };
  throw new Error(`Unsupported regulatory date '${raw}'. Refusing to invent date precision.`);
};

const mapFrType = (payload: FederalRegisterApiDocument): FederalRegisterDocument["type"] => {
  const rawType = (payload.type ?? "").trim().toUpperCase();
  const normalized = `${payload.type ?? ""} ${payload.title ?? ""} ${payload.action ?? ""}`.toLowerCase();
  if (normalized.includes("interim final rule")) return "interim-final-rule";
  if (rawType === "PRORULE" || rawType === "PROPOSED RULE" || normalized.startsWith("proposed rule ")) return "proposed-rule";
  if (rawType === "RULE" || rawType === "FINAL RULE") return "rule";
  if (rawType === "NOTICE") return normalized.includes("correction") ? "correction" : "notice";
  if (rawType === "PRESDOCU" || rawType === "PRESIDENTIAL DOCUMENT") return "presidential-document";
  return normalized.includes("correction") ? "correction" : "other";
};

export type FederalRegisterApiDocument = {
  document_number?: string;
  citation?: string;
  title?: string;
  type?: string;
  action?: string;
  publication_date?: string;
  effective_on?: string | null;
  comments_close_on?: string | null;
  html_url?: string;
  pdf_url?: string | null;
  full_text_xml_url?: string | null;
  regulation_id_numbers?: string[] | null;
  docket_ids?: string[] | null;
  cfr_references?: Array<{ title?: number | string; part?: number | string }> | null;
};

export const normalizeFederalRegisterApiDocument = (
  payload: FederalRegisterApiDocument,
  options: {
    asOf: string;
    officialEditionVerified?: boolean;
    verifiedOn?: string;
    applicabilityText?: string;
  },
): FederalRegisterDocument => {
  if (!payload.document_number || !payload.title || !payload.publication_date || !payload.html_url) {
    throw new Error("Federal Register API document is missing required identity/publication fields.");
  }
  const type = mapFrType(payload);
  const finalLike = type === "rule" || type === "interim-final-rule";
  const proposed = type === "proposed-rule";
  const effective = Boolean(finalLike && payload.effective_on && payload.effective_on <= options.asOf);
  const rIns = (payload.regulation_id_numbers ?? []).map((rin) => rin.toUpperCase());
  const pdfUrl = payload.pdf_url ?? undefined;
  const verified = Boolean(options.officialEditionVerified && pdfUrl?.includes("govinfo.gov"));

  return {
    documentNumber: payload.document_number,
    citation: payload.citation || undefined,
    title: payload.title,
    type,
    publicationDate: payload.publication_date,
    effectiveDate: payload.effective_on || undefined,
    applicability: options.applicabilityText
      ? [{ scope: "custom", text: options.applicabilityText, requiresHumanInterpretation: true }]
      : [],
    legalStatus: proposed ? "nonbinding-proposal" : finalLike ? (effective ? "effective" : "published-not-effective") : "context-only",
    rin: rIns[0],
    relatedRins: rIns.slice(1),
    docketIds: payload.docket_ids ?? [],
    cfrReferences: (payload.cfr_references ?? []).flatMap((reference) => {
      const title = Number(reference.title);
      const part = reference.part === undefined ? undefined : Number(reference.part);
      if (!Number.isInteger(title) || title <= 0 || (part !== undefined && !Number.isInteger(part))) return [];
      return [{ title, part }];
    }),
    federalRegisterUrl: payload.html_url,
    govinfoPdfUrl: pdfUrl?.includes("govinfo.gov") ? pdfUrl : undefined,
    fullTextXmlUrl: payload.full_text_xml_url || undefined,
    publicParticipation: proposed || payload.comments_close_on
      ? {
          docketIds: payload.docket_ids ?? [],
          commentCloseOn: payload.comments_close_on || undefined,
          commentStatus: payload.comments_close_on ? (payload.comments_close_on < options.asOf ? "closed" : "open") : "unknown",
        }
      : undefined,
    authenticity: {
      publisher: "federalregister-gov",
      legalEditionStatus: "informational-unofficial",
      officialEditionVerified: verified,
      officialEditionSource: verified ? "govinfo" : undefined,
      officialEditionUrl: verified ? pdfUrl : undefined,
      verifiedOn: verified ? options.verifiedOn : undefined,
      note: "FederalRegister.gov is used for structured metadata; binding legal reliance must be verified against the official Federal Register edition.",
    },
    correctsDocumentNumbers: [],
    supersedesDocumentNumbers: [],
    notes: [],
  };
};

export type ReginfoAgendaRecord = {
  rin: string;
  publicationId: string;
  edition: string;
  stage: string;
  rinStatus?: string;
  priority?: string;
  major?: boolean | string;
  economicallySignificant?: boolean | string;
  includedInRegulatoryPlan?: boolean;
  plannedActions?: Array<{ action: string; date: string }>;
  sourceUrl: string;
};

const mapAgendaStage = (stage: string): UnifiedAgendaStatus["stage"] => {
  const normalized = stage.toLowerCase();
  if (normalized.includes("prerule") || normalized.includes("pre-rule")) return "prerule";
  if (normalized.includes("proposed")) return "proposed-rule";
  if (normalized.includes("final")) return "final-rule";
  if (normalized.includes("long-term") || normalized.includes("long term")) return "long-term";
  if (normalized.includes("completed")) return "completed";
  throw new Error(`Unrecognized Unified Agenda stage '${stage}'.`);
};

export const normalizeReginfoAgendaRecord = (record: ReginfoAgendaRecord): UnifiedAgendaStatus => ({
  publicationId: record.publicationId,
  edition: record.edition,
  stage: mapAgendaStage(record.stage),
  rinStatus: record.rinStatus,
  priority: record.priority,
  major: toBoolean(record.major),
  economicallySignificant: toBoolean(record.economicallySignificant),
  includedInRegulatoryPlan: record.includedInRegulatoryPlan ?? false,
  plannedActions: (record.plannedActions ?? []).map((action) => ({ action: action.action, date: parseAgendaPlannedDate(action.date) })),
  sourceUrl: record.sourceUrl,
  authenticity: {
    publisher: "reginfo-oira",
    legalEditionStatus: "planning-review-metadata",
    officialEditionVerified: false,
    note: "Unified Agenda dates describe planned or anticipated agency activity and are not themselves effective dates.",
  },
});

export type ReginfoOiraReviewRecord = {
  reviewId: string;
  rin: string;
  status: "pending" | "concluded";
  stage: string;
  receivedOn: string;
  concludedOn?: string;
  conclusion?: string;
  legalDeadline?: string;
  economicallySignificant?: boolean | string;
  major?: boolean | string;
  regulatoryFlexibilityAnalysisRequired?: string;
  sourceUrl: string;
};

const mapReviewStage = (stage: string): OiraReview["stage"] => {
  const value = stage.toLowerCase();
  if (value.includes("no material change")) return "final-rule-no-material-change";
  if (value.includes("interim final")) return "interim-final-rule";
  if (value.includes("proposed")) return "proposed-rule";
  if (value.includes("final")) return "final-rule";
  if (value.includes("prerule") || value.includes("pre-rule")) return "prerule";
  if (value.includes("notice")) return "notice";
  return "other";
};

export const normalizeOiraReviewRecord = (record: ReginfoOiraReviewRecord): OiraReview => ({
  reviewId: record.reviewId,
  rin: record.rin.toUpperCase(),
  status: record.status,
  stage: mapReviewStage(record.stage),
  receivedOn: record.receivedOn,
  concludedOn: record.concludedOn,
  conclusion: record.conclusion,
  legalDeadline: /judicial/i.test(record.legalDeadline ?? "") ? "judicial" : /statutory/i.test(record.legalDeadline ?? "") ? "statutory" : /none/i.test(record.legalDeadline ?? "") ? "none" : "unknown",
  economicallySignificant: toBoolean(record.economicallySignificant),
  major: toBoolean(record.major),
  regulatoryFlexibilityAnalysisRequired: /yes/i.test(record.regulatoryFlexibilityAnalysisRequired ?? "") ? "yes" : /no/i.test(record.regulatoryFlexibilityAnalysisRequired ?? "") ? "no" : /undetermined/i.test(record.regulatoryFlexibilityAnalysisRequired ?? "") ? "undetermined" : "unknown",
  sourceUrl: record.sourceUrl,
  authorityUse: "review-metadata-only",
  authenticity: {
    publisher: "reginfo-oira",
    legalEditionStatus: "planning-review-metadata",
    officialEditionVerified: false,
    note: "OIRA review status and conclusions describe centralized review history; they do not establish that a rule is effective or binding.",
  },
});

export type ReginfoOiraMeetingRecord = {
  meetingId: string;
  rin: string;
  scheduledOn: string;
  status?: string;
  requester?: string;
  organizations?: string[];
  attendees?: string[];
  materials?: Array<{ title: string; url?: string; submittedBy?: string }>;
  sourceUrl: string;
};

export const normalizeOiraMeetingRecord = (record: ReginfoOiraMeetingRecord): OiraMeeting => ({
  meetingId: record.meetingId,
  rin: record.rin.toUpperCase(),
  scheduledOn: record.scheduledOn,
  status: /complete/i.test(record.status ?? "") ? "completed" : /cancel/i.test(record.status ?? "") ? "canceled" : /schedule/i.test(record.status ?? "") ? "scheduled" : "unknown",
  requester: record.requester,
  organizations: record.organizations ?? [],
  attendees: record.attendees ?? [],
  materials: record.materials ?? [],
  sourceUrl: record.sourceUrl,
  authorityUse: "policy-development-context-only",
  authenticity: {
    publisher: "reginfo-oira",
    legalEditionStatus: "planning-review-metadata",
    officialEditionVerified: false,
    note: "EO 12866 meeting records are stakeholder/policy-development context and are not a substitute for formal public comments or legal authority.",
  },
});
