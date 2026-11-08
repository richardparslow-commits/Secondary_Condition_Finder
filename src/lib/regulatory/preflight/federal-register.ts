import {
  normalizeFederalRegisterApiDocument,
  type FederalRegisterApiDocument,
} from "../adapters";
import type { FederalRegisterDocument } from "../schema";
import { fetchJsonWithTimeout, type FetchLike } from "./http";
import type {
  FederalRegisterDiscovery,
  FederalRegisterFetchResult,
  RegulatorySourceValidator,
} from "./types";

const FEDERAL_REGISTER_API = "https://www.federalregister.gov/api/v1/documents.json";
const VA_AGENCY_SLUG = "veterans-affairs-department";

interface FederalRegisterApiPage {
  count?: number;
  total_pages?: number;
  next_page_url?: string | null;
  results?: FederalRegisterPreflightPayload[];
}

interface FederalRegisterPreflightPayload extends FederalRegisterApiDocument {
  abstract?: string | null;
  agencies?: Array<{ name?: string; slug?: string }> | null;
}

const isoToday = (value: string): string => value.slice(0, 10);

const dispositionSignals = (payload: FederalRegisterPreflightPayload): string[] => {
  const text = `${payload.title ?? ""} ${payload.action ?? ""} ${payload.abstract ?? ""}`.toLowerCase();
  const signals: string[] = [];
  const add = (signal: string, pattern: RegExp) => { if (pattern.test(text)) signals.push(signal); };
  add("effective-date-delay", /delay(?:ing)?|postpon(?:e|ing|ement).*effective date|effective date.*(?:delay|postpon)/i);
  add("withdrawal", /withdraw(?:al|n|ing)?/i);
  add("rescission", /rescind|rescission|repeal/i);
  add("stay", /\bstay(?:ed|ing)?\b/i);
  add("correction", /\bcorrection\b|correcting amendment/i);
  add("supersession", /supersed|replace(?:ment|s|d)?/i);
  add("applicability-change", /applicability|applies to|application date/i);
  add("rating-schedule", /rating schedule|diagnostic code|38 cfr part 4/i);
  add("presumption", /presumpt|service connection/i);
  add("toxic-exposure", /toxic exposure|burn pit|particulate matter|pact act|tera\b/i);
  add("effective-date", /effective date/i);
  add("compensation", /disability compensation|compensation claim|veterans benefits|claimant/i);
  return [...new Set(signals)];
};

const finalLike = (type: FederalRegisterDocument["type"]): boolean =>
  type === "rule" || type === "interim-final-rule";

const requiresOfficialVerification = (
  document: FederalRegisterDocument,
  signals: string[],
): boolean => {
  if (document.type === "correction") return true;
  if (signals.some((signal) => ["effective-date-delay", "withdrawal", "rescission", "stay", "supersession"].includes(signal))) return true;
  // Verify every published final/interim-final rule when possible. A future final
  // may remain nonbinding if verification is temporarily unavailable, but an
  // effective or effective-date-unknown final must fail closed.
  return finalLike(document.type);
};

const isGovInfoUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "govinfo.gov" || url.hostname.endsWith(".govinfo.gov") || url.hostname === "www.govinfo.gov");
  } catch {
    return false;
  }
};

async function verifyGovInfoUrl(
  fetchImpl: FetchLike,
  url: string | undefined,
  timeoutMs: number,
): Promise<{ verified: boolean; message: string }> {
  if (!isGovInfoUrl(url)) return { verified: false, message: "No GovInfo official-edition PDF URL was supplied by the Federal Register record." };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/pdf", Range: "bytes=0-7" },
    });
    if (!response.ok) return { verified: false, message: `GovInfo verification returned HTTP ${response.status}.` };
    if (!isGovInfoUrl(response.url || url)) return { verified: false, message: "GovInfo verification redirected outside the official govinfo.gov domain." };
    let prefix = "";
    if (response.body) {
      const reader = response.body.getReader();
      const bytes: number[] = [];
      try {
        while (bytes.length < 5) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const byte of value ?? []) {
            bytes.push(byte);
            if (bytes.length === 5) break;
          }
        }
        await reader.cancel("pdf-signature-complete");
      } finally {
        reader.releaseLock();
      }
      prefix = new TextDecoder("ascii").decode(new Uint8Array(bytes));
    } else {
      prefix = new TextDecoder("ascii").decode(new Uint8Array(await response.arrayBuffer()).slice(0, 5));
    }
    if (prefix !== "%PDF-") return { verified: false, message: "GovInfo URL did not return a PDF signature." };
    return { verified: true, message: "GovInfo official-edition PDF signature verified." };
  } catch (error) {
    return { verified: false, message: `GovInfo verification failed: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildFederalRegisterVaSearchUrl(options: {
  since: string;
  page?: number;
  perPage?: number;
}): string {
  const url = new URL(FEDERAL_REGISTER_API);
  url.searchParams.append("conditions[agencies][]", VA_AGENCY_SLUG);
  url.searchParams.set("conditions[publication_date][gte]", options.since);
  for (const field of [
    "document_number",
    "citation",
    "title",
    "type",
    "action",
    "abstract",
    "publication_date",
    "effective_on",
    "comments_close_on",
    "html_url",
    "pdf_url",
    "full_text_xml_url",
    "regulation_id_numbers",
    "docket_ids",
    "cfr_references",
  ]) url.searchParams.append("fields[]", field);
  url.searchParams.set("order", "newest");
  url.searchParams.set("per_page", String(options.perPage ?? 100));
  url.searchParams.set("page", String(options.page ?? 1));
  return url.toString();
}

const safeNextFederalRegisterUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.federalregister.gov" || !url.pathname.startsWith("/api/v1/")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

export async function fetchFederalRegisterVaChanges(options: {
  fetchImpl?: FetchLike;
  since: string;
  asOfDate: string;
  checkedAt: string;
  validator?: RegulatorySourceValidator;
  timeoutMs?: number;
  maxPages?: number;
}): Promise<FederalRegisterFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  const discoveries: FederalRegisterDiscovery[] = [];
  let nextUrl: string | undefined = buildFederalRegisterVaSearchUrl({ since: options.since });
  let page = 0;
  let validator = options.validator;
  let responseValidator: RegulatorySourceValidator = {};

  try {
    while (nextUrl && page < (options.maxPages ?? 10)) {
      page += 1;
      const result = await fetchJsonWithTimeout<FederalRegisterApiPage>(fetchImpl, nextUrl, {
        timeoutMs: options.timeoutMs ?? 8_000,
        validator: page === 1 ? validator : undefined,
        maxBytes: 12_000_000,
      });
      responseValidator = { etag: result.etag ?? responseValidator.etag, lastModified: result.lastModified ?? responseValidator.lastModified };
      if (result.status === "not-modified") {
        return {
          sourceResult: {
            source: "federal-register",
            status: "not-modified",
            checkedAt: options.checkedAt,
            recordCount: 0,
            durationMs: Date.now() - started,
            ...responseValidator,
          },
          discoveries: [],
        };
      }

      const payloads = result.json?.results ?? [];
      for (const payload of payloads) {
        let preliminary: FederalRegisterDocument;
        try {
          preliminary = normalizeFederalRegisterApiDocument(payload, { asOf: options.asOfDate });
        } catch {
          continue;
        }
        const signals = dispositionSignals(payload);
        const verificationRequired = requiresOfficialVerification(preliminary, signals);
        let verified = false;
        let verificationMessage: string | undefined;
        let normalizedDocument: FederalRegisterDocument | undefined = preliminary;

        if (verificationRequired) {
          const verification = await verifyGovInfoUrl(fetchImpl, payload.pdf_url ?? undefined, Math.min(options.timeoutMs ?? 8_000, 5_000));
          verified = verification.verified;
          verificationMessage = verification.message;
          if (verified) {
            normalizedDocument = normalizeFederalRegisterApiDocument(payload, {
              asOf: options.asOfDate,
              officialEditionVerified: true,
              verifiedOn: isoToday(options.checkedAt),
            });
          } else {
            const dispositionCritical = preliminary.type === "correction"
              || signals.some((signal) => ["effective-date-delay", "withdrawal", "rescission", "stay", "supersession"].includes(signal));
            const finalCouldBeOperative = finalLike(preliminary.type)
              && (!preliminary.effectiveDate || preliminary.effectiveDate <= options.asOfDate);
            if (dispositionCritical || finalCouldBeOperative) {
              // Effective, effective-date-unknown, correction, and disposition records
              // do not enter authoritative registry state until official-edition
              // verification succeeds. Their discovery still triggers the fail-safe.
              normalizedDocument = undefined;
            }
          }
        } else {
          verified = preliminary.authenticity.officialEditionVerified;
        }

        discoveries.push({
          documentNumber: payload.document_number ?? preliminary.documentNumber,
          title: payload.title ?? preliminary.title,
          rin: preliminary.rin,
          relatedRins: preliminary.relatedRins,
          type: preliminary.type,
          publicationDate: preliminary.publicationDate,
          effectiveDate: preliminary.effectiveDate,
          rawAction: payload.action,
          abstract: payload.abstract ?? undefined,
          signals,
          normalizedDocument,
          officialEditionVerificationRequired: verificationRequired,
          officialEditionVerified: verified,
          verificationMessage,
        });
      }

      nextUrl = safeNextFederalRegisterUrl(result.json?.next_page_url);
      if (result.json?.next_page_url && !nextUrl) {
        throw new Error("Federal Register pagination returned an unsafe or invalid next-page URL; refresh is incomplete.");
      }
      validator = undefined;
    }

    return {
      sourceResult: {
        source: "federal-register",
        status: nextUrl ? "failed" : "success",
        checkedAt: options.checkedAt,
        recordCount: discoveries.length,
        durationMs: Date.now() - started,
        ...responseValidator,
        message: nextUrl ? `Stopped after safety limit of ${options.maxPages ?? 10} pages.` : undefined,
      },
      discoveries,
    };
  } catch (error) {
    return {
      sourceResult: {
        source: "federal-register",
        status: "failed",
        checkedAt: options.checkedAt,
        recordCount: 0,
        durationMs: Date.now() - started,
        message: error instanceof Error ? error.message : String(error),
        ...responseValidator,
      },
      discoveries: [],
    };
  }
}
