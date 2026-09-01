import {
  normalizeOiraMeetingRecord,
  normalizeOiraReviewRecord,
  normalizeReginfoAgendaRecord,
} from "../adapters";
import { fetchTextWithTimeout, type FetchLike } from "./http";
import type {
  AgendaDiscovery,
  AgendaFetchResult,
  OiraMeetingDiscovery,
  OiraMeetingFetchResult,
  OiraReviewDiscovery,
  OiraReviewFetchResult,
  RegulatorySourceValidator,
} from "./types";
import {
  allDescendantTexts,
  firstDescendantText,
  htmlText,
  nodeText,
  parseXml,
  walkXml,
  type XmlNode,
} from "./xml";

const OIRA_PENDING_XML = "https://www.reginfo.gov/public/do/XMLViewFileAction?f=EO_RULES_UNDER_REVIEW.xml";
const OIRA_COMPLETED_XML = "https://www.reginfo.gov/public/do/XMLViewFileAction?f=EO_RULE_COMPLETED_30_DAYS.xml";
const AGENDA_XML_INDEX = "https://mobile.reginfo.gov/public/do/eAgendaXmlReport";
const OIRA_MEETING_SEARCH = "https://www.reginfo.gov/public/do/eom12866SearchResults";

const RIN_TAGS = ["RIN", "REGULATION_ID_NUMBER", "REGULATIONIDNUMBER", "REGULATORY_IDENTIFICATION_NUMBER"];
const TITLE_TAGS = ["TITLE", "RULE_TITLE", "RIN_TITLE", "ACTION_TITLE"];
const AGENCY_TAGS = ["AGENCY", "AGENCY_NAME", "DEPARTMENT", "DEPARTMENT_NAME", "AGENCY_SUBAGENCY"];
const SUBAGENCY_TAGS = ["SUBAGENCY", "SUB_AGENCY", "SUBAGENCY_NAME"];
const STAGE_TAGS = ["STAGE", "RULE_STAGE", "STAGE_OF_RULEMAKING", "RULEMAKING_STAGE"];

const nonblank = (value: string | undefined): string | undefined => {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned && !/^(none|n\/a|null|unknown)$/i.test(cleaned) ? cleaned : undefined;
};

const toIsoDate = (value: string | undefined): string | undefined => {
  const cleaned = nonblank(value);
  if (!cleaned) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const us = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const long = Date.parse(cleaned);
  if (!Number.isNaN(long)) return new Date(long).toISOString().slice(0, 10);
  return undefined;
};

const splitAgency = (agencyRaw: string | undefined, subagencyRaw?: string | undefined): { department: string; subagency?: string } => {
  const agency = nonblank(agencyRaw) ?? "Department of Veterans Affairs";
  const explicitSubagency = nonblank(subagencyRaw);
  if (explicitSubagency) return { department: agency, subagency: explicitSubagency };
  const slash = agency.split(/\s*\/\s*/).map((value) => value.trim()).filter(Boolean);
  if (slash.length >= 2) return { department: slash[0], subagency: slash.slice(1).join("/") };
  return { department: agency };
};

const field = (node: XmlNode, aliases: readonly string[]): string | undefined => nonblank(firstDescendantText(node, aliases));

const findRecords = (root: XmlNode, semanticGroups: readonly (readonly string[])[], minimumGroups = 3): XmlNode[] => {
  const hasRin = (node: XmlNode): boolean => Boolean(field(node, RIN_TAGS));
  const score = (node: XmlNode): number => semanticGroups.reduce((total, group) => total + (field(node, group) ? 1 : 0), 0);
  const result: XmlNode[] = [];
  walkXml(root, (node) => {
    if (node === root || !hasRin(node) || score(node) < minimumGroups) return;
    const nested = node.children.some((child) => hasRin(child) && score(child) >= minimumGroups);
    if (!nested) result.push(node);
  });
  return result;
};

const isVaRecord = (rin: string, agency: string | undefined): boolean =>
  rin.startsWith("2900-") || /veterans affairs|department of veterans|\bva\b/i.test(agency ?? "");

const sourceResultFailure = (
  source: "oira-pending" | "oira-completed" | "unified-agenda" | "oira-meetings",
  checkedAt: string,
  started: number,
  error: unknown,
  validator: RegulatorySourceValidator = {},
) => ({
  source,
  status: "failed" as const,
  checkedAt,
  recordCount: 0,
  durationMs: Date.now() - started,
  message: error instanceof Error ? error.message : String(error),
  ...validator,
});

function parseOiraReviewXml(xml: string, status: "pending" | "concluded", sourceUrl: string): OiraReviewDiscovery[] {
  const root = parseXml(xml);
  const records = findRecords(root, [TITLE_TAGS, STAGE_TAGS, ["RECEIVED_DATE", "DATE_RECEIVED", "RECEIVED"], ["CONCLUDED_DATE", "DATE_CONCLUDED", "CONCLUSION_DATE"]], 2);
  const discoveries: OiraReviewDiscovery[] = [];

  for (const record of records) {
    const rin = field(record, RIN_TAGS)?.toUpperCase();
    if (!rin || !/^\d{4}-[A-Z0-9]{4}$/.test(rin)) continue;
    const title = field(record, TITLE_TAGS) ?? `OIRA regulatory review ${rin}`;
    const agencyRaw = field(record, AGENCY_TAGS);
    if (!isVaRecord(rin, agencyRaw)) continue;
    const stage = field(record, STAGE_TAGS) ?? "Other";
    const receivedOn = toIsoDate(field(record, ["RECEIVED_DATE", "DATE_RECEIVED", "RECEIVED"]));
    if (!receivedOn) continue;
    const concludedOn = toIsoDate(field(record, ["CONCLUDED_DATE", "DATE_CONCLUDED", "CONCLUSION_DATE"]));
    if (status === "concluded" && !concludedOn) continue;
    const reviewId = field(record, ["REVIEW_ID", "EO_ID", "EO_REVIEW_ID", "RRID", "ID"])
      ?? `${rin}-${receivedOn}-${stage.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    const agency = splitAgency(agencyRaw, field(record, SUBAGENCY_TAGS));
    const detailUrl = /^\d+$/.test(reviewId)
      ? `https://www.reginfo.gov/public/do/eoDetails?rrid=${encodeURIComponent(reviewId)}`
      : sourceUrl;

    try {
      const review = normalizeOiraReviewRecord({
        reviewId,
        rin,
        status,
        stage,
        receivedOn,
        concludedOn,
        conclusion: field(record, ["CONCLUSION", "CONCLUDED_ACTION", "CONCLUSION_ACTION", "RESULT"]),
        legalDeadline: field(record, ["LEGAL_DEADLINE", "DEADLINE_TYPE", "LEGAL_DEADLINE_TYPE"]),
        economicallySignificant: field(record, ["ECONOMICALLY_SIGNIFICANT", "ECON_SIGNIFICANT"]),
        major: field(record, ["MAJOR", "MAJOR_RULE"]),
        regulatoryFlexibilityAnalysisRequired: field(record, ["REGULATORY_FLEXIBILITY_ANALYSIS_REQUIRED", "RFA_REQUIRED"]),
        sourceUrl: detailUrl,
      });
      discoveries.push({ rin, title, agencyDepartment: agency.department, agencySubagency: agency.subagency, review });
    } catch {
      // Ignore malformed upstream records individually; source-level parsing still succeeds.
    }
  }
  return discoveries;
}

export async function fetchOiraReviews(options: {
  kind: "pending" | "completed";
  fetchImpl?: FetchLike;
  checkedAt: string;
  validator?: RegulatorySourceValidator;
  timeoutMs?: number;
}): Promise<OiraReviewFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  const source = options.kind === "pending" ? "oira-pending" as const : "oira-completed" as const;
  const url = options.kind === "pending" ? OIRA_PENDING_XML : OIRA_COMPLETED_XML;
  try {
    const result = await fetchTextWithTimeout(fetchImpl, url, {
      timeoutMs: options.timeoutMs ?? 8_000,
      validator: options.validator,
      headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
      maxBytes: 20_000_000,
    });
    const validator = { etag: result.etag, lastModified: result.lastModified };
    if (result.status === "not-modified") {
      return {
        sourceResult: { source, status: "not-modified", checkedAt: options.checkedAt, recordCount: 0, durationMs: Date.now() - started, ...validator },
        discoveries: [],
      };
    }
    const discoveries = parseOiraReviewXml(result.text ?? "", options.kind === "pending" ? "pending" : "concluded", url);
    return {
      sourceResult: { source, status: "success", checkedAt: options.checkedAt, recordCount: discoveries.length, durationMs: Date.now() - started, ...validator },
      discoveries,
    };
  } catch (error) {
    return { sourceResult: sourceResultFailure(source, options.checkedAt, started, error), discoveries: [] };
  }
}

const discoverAgendaXml = (html: string): { url: string; edition: string; publicationId: string } => {
  const anchorPattern = /<a\b[^>]*href=["']([^"']*XMLViewFileAction\?f=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const label = htmlText(match[2]);
    if (!/data/i.test(label)) continue;
    const decodedHref = match[1].replace(/&amp;/g, "&");
    const candidate = new URL(decodedHref, AGENDA_XML_INDEX);
    if (candidate.protocol !== "https:" || !["mobile.reginfo.gov", "www.reginfo.gov"].includes(candidate.hostname) || !candidate.pathname.includes("XMLViewFileAction")) continue;
    const url = candidate.toString();
    const year = label.match(/\b(20\d{2})\b/)?.[1] ?? new Date().getUTCFullYear().toString();
    const filePublication = decodedHref.match(/REGINFO_RIN_DATA_([A-Z0-9]+)\.xml/i)?.[1];
    return { url, edition: label, publicationId: filePublication ?? year };
  }
  throw new Error("Could not discover the current Unified Agenda XML download URL from Reginfo.");
};

const collectPlannedActions = (record: XmlNode): Array<{ action: string; date: string }> => {
  const actionNames = ["ACTION", "ACTION_NAME", "NEXT_ACTION", "TIMETABLE_ACTION"];
  const dateNames = ["DATE", "ACTION_DATE", "NEXT_ACTION_DATE", "TIMETABLE_DATE"];
  const pairs: Array<{ action: string; date: string }> = [];
  walkXml(record, (node) => {
    const action = field(node, actionNames);
    const date = field(node, dateNames);
    if (!action || !date || !/\d{4}/.test(date)) return;
    if (!pairs.some((pair) => pair.action === action && pair.date === date)) pairs.push({ action, date });
  });
  if (pairs.length > 0) return pairs.slice(0, 20);

  const dates = allDescendantTexts(record, ["NEXT_ACTION_DATE", "ACTION_DATE", "TIMETABLE_DATE"]).filter((value) => /\d{4}/.test(value));
  return dates.slice(0, 20).map((date, index) => ({ action: `Planned action ${index + 1}`, date }));
};

function parseAgendaXml(xml: string, metadata: { url: string; edition: string; publicationId: string }): AgendaDiscovery[] {
  const root = parseXml(xml);
  const records = findRecords(root, [TITLE_TAGS, STAGE_TAGS, AGENCY_TAGS, ["PRIORITY"]], 2);
  const discoveries: AgendaDiscovery[] = [];
  for (const record of records) {
    const rin = field(record, RIN_TAGS)?.toUpperCase();
    if (!rin || !/^\d{4}-[A-Z0-9]{4}$/.test(rin)) continue;
    const agencyRaw = field(record, AGENCY_TAGS);
    if (!isVaRecord(rin, agencyRaw)) continue;
    const title = field(record, TITLE_TAGS) ?? `Unified Agenda action ${rin}`;
    const stage = field(record, STAGE_TAGS) ?? "Proposed Rule Stage";
    const agency = splitAgency(agencyRaw, field(record, SUBAGENCY_TAGS));
    try {
      const status = normalizeReginfoAgendaRecord({
        rin,
        publicationId: metadata.publicationId,
        edition: metadata.edition,
        stage,
        rinStatus: field(record, ["RIN_STATUS", "STATUS"]),
        priority: field(record, ["PRIORITY"]),
        major: field(record, ["MAJOR", "MAJOR_RULE"]),
        economicallySignificant: field(record, ["ECONOMICALLY_SIGNIFICANT", "ECON_SIGNIFICANT"]),
        includedInRegulatoryPlan: /yes|true|1/i.test(field(record, ["REGULATORY_PLAN", "INCLUDED_IN_REGULATORY_PLAN"]) ?? ""),
        plannedActions: collectPlannedActions(record),
        sourceUrl: `https://www.reginfo.gov/public/do/eAgendaViewRule?RIN=${encodeURIComponent(rin)}&pubId=${encodeURIComponent(metadata.publicationId)}`,
      });
      discoveries.push({ rin, title, agencyDepartment: agency.department, agencySubagency: agency.subagency, status });
    } catch {
      // Refuse to invent unsupported stage/date semantics; individual malformed rows stay out.
    }
  }
  return discoveries;
}

export async function fetchCurrentUnifiedAgenda(options: {
  fetchImpl?: FetchLike;
  checkedAt: string;
  validator?: RegulatorySourceValidator;
  timeoutMs?: number;
}): Promise<AgendaFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  try {
    const indexResult = await fetchTextWithTimeout(fetchImpl, AGENDA_XML_INDEX, { timeoutMs: options.timeoutMs ?? 8_000, maxBytes: 2_000_000 });
    if (indexResult.status !== "success" || !indexResult.text) throw new Error("Unified Agenda XML index returned no content.");
    const metadata = discoverAgendaXml(indexResult.text);
    const result = await fetchTextWithTimeout(fetchImpl, metadata.url, {
      timeoutMs: options.timeoutMs ?? 12_000,
      validator: options.validator,
      headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
      maxBytes: 30_000_000,
    });
    const validator = { etag: result.etag, lastModified: result.lastModified };
    if (result.status === "not-modified") {
      return {
        sourceResult: { source: "unified-agenda", status: "not-modified", checkedAt: options.checkedAt, recordCount: 0, durationMs: Date.now() - started, ...validator, message: metadata.edition },
        discoveries: [],
      };
    }
    const discoveries = parseAgendaXml(result.text ?? "", metadata);
    return {
      sourceResult: { source: "unified-agenda", status: "success", checkedAt: options.checkedAt, recordCount: discoveries.length, durationMs: Date.now() - started, ...validator, message: metadata.edition },
      discoveries,
    };
  } catch (error) {
    return { sourceResult: sourceResultFailure("unified-agenda", options.checkedAt, started, error), discoveries: [] };
  }
}

const parseMeetingDate = (text: string): string | undefined => toIsoDate(text);

const parseMeetingRows = (html: string, rin: string, title?: string): OiraMeetingDiscovery[] => {
  const discoveries: OiraMeetingDiscovery[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']*viewEO12866Meeting[^"']*meetingId=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const scheduledOn = parseMeetingDate(htmlText(match[3]));
    if (!scheduledOn) continue;
    const sourceCandidate = new URL(match[1].replace(/&amp;/g, "&"), OIRA_MEETING_SEARCH);
    if (sourceCandidate.protocol !== "https:" || sourceCandidate.hostname !== "www.reginfo.gov" || !sourceCandidate.pathname.includes("viewEO12866Meeting")) continue;
    const sourceUrl = sourceCandidate.toString();
    const nearby = htmlText(html.slice(match.index ?? 0, (match.index ?? 0) + 1000));
    const status = /\bcompleted\b/i.test(nearby) ? "Completed" : /\bcancel(?:ed|led)\b/i.test(nearby) ? "Canceled" : /\bscheduled\b/i.test(nearby) ? "Scheduled" : "Unknown";
    try {
      const meeting = normalizeOiraMeetingRecord({
        meetingId: match[2],
        rin,
        scheduledOn,
        status,
        sourceUrl,
      });
      discoveries.push({ rin, title, meeting });
    } catch {
      // Individual HTML rows are non-authoritative context; ignore malformed rows.
    }
  }
  return discoveries;
};

export async function fetchOiraMeetingSignals(options: {
  rins: Array<{ rin: string; title?: string }>;
  fetchImpl?: FetchLike;
  checkedAt: string;
  timeoutMs?: number;
  maxRins?: number;
  concurrency?: number;
}): Promise<OiraMeetingFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  const targets = options.rins.slice(0, options.maxRins ?? 8);
  if (targets.length === 0) {
    return {
      sourceResult: { source: "oira-meetings", status: "skipped", checkedAt: options.checkedAt, recordCount: 0, durationMs: 0, message: "No OIRA-reviewed VA RINs required a stakeholder-meeting check." },
      discoveries: [],
    };
  }

  const discoveries: OiraMeetingDiscovery[] = [];
  let failures = 0;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 4));
  for (let offset = 0; offset < targets.length; offset += concurrency) {
    const batch = targets.slice(offset, offset + concurrency);
    const results = await Promise.allSettled(batch.map(async (target) => {
      const url = new URL(OIRA_MEETING_SEARCH);
      url.searchParams.set("pubId", "");
      url.searchParams.set("rin", target.rin);
      url.searchParams.set("viewRule", "true");
      const result = await fetchTextWithTimeout(fetchImpl, url.toString(), { timeoutMs: options.timeoutMs ?? 5_000, maxBytes: 3_000_000 });
      return result.status === "success" && result.text ? parseMeetingRows(result.text, target.rin, target.title) : [];
    }));
    for (const result of results) {
      if (result.status === "fulfilled") discoveries.push(...result.value);
      else failures += 1;
    }
  }

  return {
    sourceResult: {
      source: "oira-meetings",
      status: failures === targets.length ? "failed" : "success",
      checkedAt: options.checkedAt,
      recordCount: discoveries.length,
      durationMs: Date.now() - started,
      message: failures ? `${failures} of ${targets.length} meeting searches failed; meeting data is non-authoritative context and does not control legal freshness.` : undefined,
    },
    discoveries,
  };
}

export const __oiraParserTestSeams = {
  parseOiraReviewXml,
  parseAgendaXml,
  discoverAgendaXml,
  parseMeetingRows,
  nodeText,
};
