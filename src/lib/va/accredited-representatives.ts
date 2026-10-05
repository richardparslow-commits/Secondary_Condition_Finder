import "server-only";

import {
  resolveVaResultEnvironment,
  vaFallbackStatus,
  vaLiveStatus,
} from "./provenance";
import { type VaReferenceSourceStatus } from "./reference-cache";
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
  const normalized = `${params.zip}:${params.radiusMiles ?? 50}:${params.type ?? "any"}`;
  return vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.accreditedRepresentatives,
    environment,
    normalized,
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
      enabled: useSharedCache,
      decorateHit: (view) => ({ ...view, cacheStatus: "hit" }),
    },
  );
}

export function clearAccreditedRepresentativeCache(): number {
  return clearVaReferenceNamespace(
    VA_REFERENCE_NAMESPACES.accreditedRepresentatives,
  );
}
