import "server-only";

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

      const environment =
        result.environment ??
        (result.source === "va-production-api"
          ? "production"
          : configuredEnvironment);
      return {
        cacheable: true,
        view: {
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
