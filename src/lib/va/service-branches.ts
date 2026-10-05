import "server-only";

import { isTrustedCachedLiveView } from "./cached-view-guard";
import {
  acquireVaSharedFetchLease,
  awaitVaSharedFetchOutcome,
  releaseVaSharedFetchLease,
} from "./shared-single-flight";
import {
  clearVaReferenceCache,
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
  fetchVaServiceBranches,
  loadVaApiConfig,
  type VaApiResult,
} from "./sandbox";

export interface ServiceBranchReferenceItem {
  code: string;
  description: string;
}

export interface ServiceBranchReferenceView extends VaReferenceSourceStatus {
  items: ServiceBranchReferenceItem[];
}

type ServiceBranchFetcher = () => Promise<
  VaApiResult<{ items: ServiceBranchReferenceItem[] }>
>;

const LOCAL_BRANCHES: ServiceBranchReferenceItem[] = [
  { code: "ARMY", description: "Army" },
  { code: "NAVY", description: "Navy" },
  { code: "AIR_FORCE", description: "Air Force" },
  { code: "MARINE_CORPS", description: "Marine Corps" },
  { code: "COAST_GUARD", description: "Coast Guard" },
  { code: "SPACE_FORCE", description: "Space Force" },
];

function localFallback(notice: string): ServiceBranchReferenceView {
  return {
    items: LOCAL_BRANCHES,
    source: "local-fallback",
    sourceLabel: "Local branch fallback",
    notice,
    live: false,
    environment: null,
    retrievedAt: null,
    cacheStatus: "miss",
  };
}

export async function loadServiceBranchReference(
  fetcher: ServiceBranchFetcher = fetchVaServiceBranches,
): Promise<ServiceBranchReferenceView> {
  const config = loadVaApiConfig();
  const configuredEnvironment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaServiceBranches;
  const cacheKey = `service-branches:${configuredEnvironment}`;

  // Activation first: a disabled integration must never serve a previously
  // cached live view (see form-reference.ts for the full rationale).
  if (useSharedCache && config.enabled) {
    const cached = readVaReferenceCache<ServiceBranchReferenceView>(cacheKey);
    if (cached) return { ...cached, cacheStatus: "hit" };
    const sharedCached = await readVaSharedReferenceCache<ServiceBranchReferenceView>(cacheKey);
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
    const published = await awaitVaSharedFetchOutcome<ServiceBranchReferenceView>(cacheKey);
    if (published && isTrustedCachedLiveView(published, configuredEnvironment)) {
      writeVaReferenceCache(cacheKey, published);
      return { ...published, cacheStatus: "hit" };
    }
  }

  try {
    const result = await fetcher();
    if (!result.success || !result.data || result.data.items.length === 0) {
      return localFallback("VA service-branch reference data is unavailable or disabled.");
    }

    const environment =
      result.environment ??
      (result.source === "va-production-api" ? "production" : configuredEnvironment);
    const view: ServiceBranchReferenceView = {
      items: [...result.data.items].sort((a, b) =>
        a.description.localeCompare(b.description),
      ),
      source: result.source,
      sourceLabel:
        environment === "production"
          ? "VA service-branch production reference"
          : "VA service-branch sandbox reference",
      notice:
        environment === "production"
          ? "These standardized branch names came from VA Benefits Reference Data and are used only as administrative reference context."
          : "These standardized branch names came from VA sandbox reference data and may not be current. They are used only as administrative reference context.",
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

export function clearServiceBranchReferenceCache(): void {
  clearVaReferenceCache("service-branches:");
}
