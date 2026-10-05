import "server-only";

import { isTrustedCachedLiveView } from "./cached-view-guard";
import {
  acquireVaSharedFetchLease,
  awaitVaSharedFetchOutcome,
  releaseVaSharedFetchLease,
} from "./shared-single-flight";
import {
  clearVaReferenceCache,
  hashedCacheKeySegment,
  readVaReferenceCache,
  VA_REFERENCE_CACHE_TTL_MS,
  type VaReferenceSourceStatus,
  writeVaReferenceCache,
} from "./reference-cache";
import {
  readVaSharedReferenceCache,
  writeVaSharedReferenceCache,
} from "./reference-shared-cache";
import {
  fetchVaAccreditedRepresentatives,
  loadVaApiConfig,
  type AccreditedRepresentativeSearchParams,
  type VaAccreditedRepresentative,
  type VaApiResult,
} from "./sandbox";

export type AccreditedRepType = "VSO" | "agent" | "attorney";

export type AccreditedRepresentativeItem = VaAccreditedRepresentative;

export interface AccreditedRepresentativeView extends VaReferenceSourceStatus {
  params: AccreditedRepresentativeSearchParams;
  items: AccreditedRepresentativeItem[];
}

type AccreditedRepFetcher = (
  params: AccreditedRepresentativeSearchParams,
) => Promise<VaApiResult<{ data: VaAccreditedRepresentative[] }>>;

function cacheKeyFor(
  params: AccreditedRepresentativeSearchParams,
  environment: string,
): string {
  // The ZIP (quasi-identifier) and radius/type are hashed rather than written
  // as raw key material; only the hashed prefix stays human-readable.
  const normalized = `${params.zip}:${params.radiusMiles ?? 50}:${params.type ?? "any"}`;
  return `accredited-rep:${environment}:${hashedCacheKeySegment(normalized)}`;
}

function localFallback(
  params: AccreditedRepresentativeSearchParams,
): AccreditedRepresentativeView {
  return {
    params,
    items: [],
    source: "local-fallback",
    sourceLabel: "Local directory fallback",
    notice:
      "Accredited-representative directory is unavailable or disabled. Search VA's OGC directory on va.gov/ogc/apps/accreditation.",
    live: false,
    environment: null,
    retrievedAt: null,
    cacheStatus: "miss",
  };
}

export async function loadAccreditedRepresentatives(
  params: AccreditedRepresentativeSearchParams,
  fetcher: AccreditedRepFetcher = fetchVaAccreditedRepresentatives,
): Promise<AccreditedRepresentativeView> {
  const config = loadVaApiConfig();
  const configuredEnvironment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaAccreditedRepresentatives;
  const cacheKey = cacheKeyFor(params, configuredEnvironment);

  // Activation first: a disabled integration must never serve a previously
  // cached live view (see form-reference.ts for the full rationale).
  if (useSharedCache && config.enabled) {
    const cached = readVaReferenceCache<AccreditedRepresentativeView>(cacheKey);
    if (cached) return { ...cached, cacheStatus: "hit" };
    const sharedCached = await readVaSharedReferenceCache<AccreditedRepresentativeView>(cacheKey);
    // Read-side guard: only serve a shared value that still carries this
    // deployment's provenance and credential-free HTTPS links.
    if (sharedCached && isTrustedCachedLiveView(sharedCached, configuredEnvironment)) {
      writeVaReferenceCache(cacheKey, sharedCached);
      return { ...sharedCached, cacheStatus: "hit" };
    }
  }

  // Single-flight: one instance fetches a cold/expired key; others wait a
  // bounded window for it to publish instead of duplicating the request. An
  // unavailable coordinator just means the normal fetch path (the distributed
  // consumer budget still gates every attempt).
  const lease =
    useSharedCache && config.enabled ? await acquireVaSharedFetchLease(cacheKey) : null;
  if (lease?.status === "contended") {
    const published = await awaitVaSharedFetchOutcome<AccreditedRepresentativeView>(cacheKey);
    if (published && isTrustedCachedLiveView(published, configuredEnvironment)) {
      writeVaReferenceCache(cacheKey, published);
      return { ...published, cacheStatus: "hit" };
    }
  }

  try {
    const result = await fetcher(params);
    if (!result.success || !result.data) return localFallback(params);

    const items = [...result.data.data].sort((a, b) => {
      const da = a.distanceMiles ?? Number.MAX_SAFE_INTEGER;
      const db = b.distanceMiles ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });

    const environment =
      result.environment ??
      (result.source === "va-production-api" ? "production" : configuredEnvironment);
    const view: AccreditedRepresentativeView = {
      params,
      items,
      source: result.source,
      sourceLabel:
        environment === "production"
          ? "VA accredited-representative production directory"
          : "VA accredited-representative sandbox directory",
      notice:
        environment === "production"
          ? "Results came from VA's accredited-representative directory. Verify accreditation on va.gov/ogc/apps/accreditation before sharing personal information."
          : "Results came from the VA accredited-representative sandbox. Sandbox data is test data and may not be current; verify on va.gov/ogc/apps/accreditation.",
      live: true,
      environment,
      retrievedAt: new Date().toISOString(),
      cacheStatus: "miss",
    };

    if (useSharedCache && config.enabled) {
      writeVaReferenceCache(cacheKey, view);
      // Awaited so the write cannot be torn down with the request (see
      // forms-finder.ts); the shared-cache deadline bounds the added latency.
      await writeVaSharedReferenceCache(cacheKey, view, VA_REFERENCE_CACHE_TTL_MS);
    }
    return view;
  } finally {
    if (lease?.status === "acquired") {
      await releaseVaSharedFetchLease(cacheKey, lease.token);
    }
  }
}

export function clearAccreditedRepresentativeCache(): void {
  clearVaReferenceCache("accredited-rep:");
}
