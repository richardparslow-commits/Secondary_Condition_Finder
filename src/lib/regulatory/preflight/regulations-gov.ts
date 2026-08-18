import { fetchJsonWithTimeout, type FetchLike } from "./http";
import type { RegulationsGovDocketDiscovery, RegulationsGovFetchResult } from "./types";

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
      const result = await fetchJsonWithTimeout<RegulationsGovDocketResponse>(fetchImpl, url, {
        timeoutMs: options.timeoutMs ?? 6_000,
        headers: { "X-Api-Key": options.apiKey },
        maxBytes: 2_000_000,
      });
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
