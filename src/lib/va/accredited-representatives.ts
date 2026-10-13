import "server-only";

import { accreditedRepresentativeCacheDto } from "./cached-view-guard";
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
  // A05: the effective flag is global AND service-specific. A disabled
  // directory shows no live data — bypassing the cache tiers alone is not
  // enough, because a previously cached live view would still be served
  // while the service flag is off (and an injected fetcher below does not
  // know the flag). The privacy page promises a clearly labeled local
  // fallback with no directory results when disabled, and the finder UI
  // renders whatever view it is given, so the loader returns the fallback
  // here and every tier, wait path, and transport below only runs enabled.
  if (!config.enabled || !config.accreditedRepEnabled) {
    return localFallback(params);
  }
  const useSharedCache = fetcher === fetchVaAccreditedRepresentatives;
  const cacheActive = useSharedCache && config.enabled;
  const cacheKey = cacheKeyFor(params, configuredEnvironment);

  // A01 cache-value slice: the ZIP is a quasi-identifier and the key already
  // stores only its hash, so the cached *value* carries a redacted params
  // shape. The request's params are re-attached after the cache tiers for
  // display/prefill only — a shared-KV dump cannot replay the lookup ZIP.
  // Fallbacks already carry params and are never cached (cacheable: false).
  const redactedParams: AccreditedRepresentativeSearchParams = {
    zip: "",
    radiusMiles: params.radiusMiles ?? 50,
    type: params.type,
  };
  const cacheDto = accreditedRepresentativeCacheDto(configuredEnvironment, cacheKey, params);
  const cached = await withVaReferenceCache<AccreditedRepresentativeView>(
    cacheKey,
    async () => {
      const result = await fetcher(params);
      if (!result.success || !result.data) {
        return { view: localFallback(params), cacheable: false };
      }

      // The upstream schema allows extra provider fields; cache only our DTO.
      const items = result.data.data.map((item) => ({
        id: item.id,
        name: item.name,
        organization: item.organization,
        accreditationType: item.accreditationType,
        specializations: item.specializations,
        phone: item.phone,
        website: item.website,
        address: item.address,
        zip: item.zip,
        distanceMiles: item.distanceMiles,
      })).sort((a, b) => {
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
          lookupKey: cacheKey,
          params: redactedParams,
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
      // A04: exact ZIP-hash/radius/type binding and bounded directory records,
      // applied at every tier. A representative's `website` keeps the
      // credential-free-HTTPS rule rather than the VA-host rule: a VSO or
      // attorney site is legitimately outside va.gov.
      cacheTrust: {
        accepts: (view) => cacheDto.safeParse(view).success,
        degradedView: () => localFallback(params),
      },
    },
  );

  if (!cached.live) return cached;
  return { ...cached, params };
}

export function clearAccreditedRepresentativeCache(): number {
  return clearVaReferenceNamespace(
    VA_REFERENCE_NAMESPACES.accreditedRepresentatives,
  );
}
