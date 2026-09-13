import { fetchJsonWithTimeout, type FetchLike } from "./http";
import type { RegulationsGovDocketDiscovery, RegulationsGovFetchResult } from "./types";

const REGULATIONS_GOV_MAX_RETRIES = 2;
const REGULATIONS_GOV_RETRY_BASE_DELAY_MS = 100;
const REGULATIONS_GOV_RETRY_MAX_DELAY_MS = 400;

function regulationsGovRetryDelayMs(attempt: number): number {
  return Math.min(
    REGULATIONS_GOV_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    REGULATIONS_GOV_RETRY_MAX_DELAY_MS,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRegulationsGovDocketWithRetry<T>(
  fetchImpl: FetchLike,
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string>; maxBytes?: number },
): Promise<T> {
  for (let attempt = 1; attempt <= REGULATIONS_GOV_MAX_RETRIES + 1; attempt += 1) {
    try {
      const r = await fetchJsonWithTimeout<T>(fetchImpl, url, opts);
      return r as unknown as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes("503") || msg.includes("504") || msg.includes("timed out") || msg.includes("AbortError");
      if (attempt <= REGULATIONS_GOV_MAX_RETRIES && isTransient) {
        await sleep(regulationsGovRetryDelayMs(attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

const REGULATIONS_GOV_API = "https://api.regulations.gov/v4/dockets";

interface RegulationsGovDocketResponse {
  data?: {
    id?: string;
    attributes?: {
      title?: string;
      rin?: string;
      modifyDate?: string;
      lastModifiedDate?: string;
    };
  };
}

export async function fetchRegulationsGovDockets(options: {
  docketIds: string[];
  apiKey?: string;
  fetchImpl?: FetchLike;
  checkedAt: string;
  timeoutMs?: number;
  maxDockets?: number;
}): Promise<RegulationsGovFetchResult> {
  const started = Date.now();
  const uniqueDockets = [...new Set(options.docketIds.filter(Boolean))].slice(0, options.maxDockets ?? 20);
  if (!options.apiKey) {
    return {
      sourceResult: {
        source: "regulations-gov",
        status: "skipped",
        checkedAt: options.checkedAt,
        recordCount: 0,
        durationMs: Date.now() - started,
        message: "REGULATIONS_GOV_API_KEY is not configured. Federal Register docket/comment metadata remains available; Regulations.gov enrichment is optional.",
      },
      discoveries: [],
    };
  }
  if (uniqueDockets.length === 0) {
    return {
      sourceResult: {
        source: "regulations-gov",
        status: "skipped",
        checkedAt: options.checkedAt,
        recordCount: 0,
        durationMs: Date.now() - started,
        message: "No newly discovered docket IDs required Regulations.gov enrichment.",
      },
      discoveries: [],
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const discoveries: RegulationsGovDocketDiscovery[] = [];
  let failures = 0;
  for (const docketId of uniqueDockets) {
    const url = `${REGULATIONS_GOV_API}/${encodeURIComponent(docketId)}`;
    try {
      const result = await fetchRegulationsGovDocketWithRetry<{ json?: RegulationsGovDocketResponse }>(fetchImpl, url, {
        timeoutMs: options.timeoutMs ?? 6_000,
        headers: { "X-Api-Key": options.apiKey } as Record<string, string>,
        maxBytes: 2_000_000,
      }) as unknown as { json?: RegulationsGovDocketResponse };
      const data = result.json?.data;
      const id = data?.id ?? docketId;
      discoveries.push({
        docketId: id,
        title: data?.attributes?.title,
        rin: data?.attributes?.rin?.toUpperCase(),
        lastModifiedAt: data?.attributes?.lastModifiedDate ?? data?.attributes?.modifyDate,
        sourceUrl: `https://www.regulations.gov/docket/${encodeURIComponent(id)}`,
      });
    } catch {
      failures += 1;
    }
  }

  return {
    sourceResult: {
      source: "regulations-gov",
      status: failures === uniqueDockets.length ? "failed" : "success",
      checkedAt: options.checkedAt,
      recordCount: discoveries.length,
      durationMs: Date.now() - started,
      message: failures ? `${failures} of ${uniqueDockets.length} docket lookups failed.` : undefined,
    },
    discoveries,
  };
}
