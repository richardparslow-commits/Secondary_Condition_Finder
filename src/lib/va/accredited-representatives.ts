import "server-only";

import { isTrustedCachedLiveView } from "./cached-view-guard";
import {
  resolveVaResultEnvironment,
  vaFallbackStatus,
  vaLiveStatus,
} from "./provenance";
import {
  hashedCacheKeySegment,
  type VaReferenceSourceStatus,
} from "./reference-cache";
import {
  clearVaReferenceNamespace,
  VA_REFERENCE_NAMESPACES,
  vaReferenceCacheKey,
  withVaReferenceCache,
} from "./reference-cache-access";
import {
  fetchVaAccreditedRepresentatives,
  loadVaApiConfig,
  type AccreditedRepresentativeSearchParams,
  type VaAccreditedRepresentative,
  type VaApiEnvironment,
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
  environment: VaApiEnvironment,
): string {
  // The ZIP (quasi-identifier) and radius/type are hashed rather than written
  // as raw key material; only the hashed prefix stays human-readable.
  const normalized = `${params.zip}:${params.radiusMiles ?? 50}:${params.type ?? "any"}`;
  return vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.accreditedRepresentatives,
    environment,
    hashedCacheKeySegment(normalized),
  );
}

function localFallback(
  params: AccreditedRepresentativeSearchParams,
): AccreditedRepresentativeView {
  return {
    params,
    items: [],
    ...vaFallbackStatus("accredited-representatives"),
  };
}

export async function loadAccreditedRepresentatives(
  params: AccreditedRepresentativeSearchParams,
  fetcher: AccreditedRepFetcher = fetchVaAccreditedRepresentatives,
): Promise<AccreditedRepresentativeView> {
  const config = loadVaApiConfig();
  const configuredEnvironment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaAccreditedRepresentatives;
  const cacheActive = useSharedCache && config.enabled;
  const cacheKey = cacheKeyFor(params, configuredEnvironment);

  return withVaReferenceCache<AccreditedRepresentativeView>(
    cacheKey,
    async () => {
      const result = await fetcher(params);
      if (!result.success || !result.data) {
        return { view: localFallback(params), cacheable: false };
      }

      const items = [...result.data.data].sort((a, b) => {
        const da = a.distanceMiles ?? Number.MAX_SAFE_INTEGER;
        const db = b.distanceMiles ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name);
      });

      const environment = resolveVaResultEnvironment(
        result,
        configuredEnvironment,
      );
      return {
        cacheable: true,
        view: {
          params,
          items,
          ...vaLiveStatus(
            "accredited-representatives",
            environment,
            result.source,
          ),
        },
      };
    },
    {
      // Activation first: a disabled integration must never serve a previously
      // cached live view, so the tiers are bypassed entirely when it is off.
      enabled: cacheActive,
      singleFlight: cacheActive,
      decorateHit: (view) => ({ ...view, cacheStatus: "hit" }),
      // Read-side guard: a shared value may only be served if it still carries
      // this deployment's provenance and only credential-free HTTPS links.
      acceptSharedCached: (view) =>
        isTrustedCachedLiveView(view, configuredEnvironment),
    },
  );
}

export function clearAccreditedRepresentativeCache(): number {
  return clearVaReferenceNamespace(
    VA_REFERENCE_NAMESPACES.accreditedRepresentatives,
  );
}
