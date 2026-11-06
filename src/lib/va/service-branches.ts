import "server-only";

import { serviceBranchCacheDto } from "./cached-view-guard";
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
  fetchVaServiceBranches,
  loadVaApiConfig,
  type VaApiResult,
  type VaServiceBranchReference,
} from "./sandbox";

export interface ServiceBranchReferenceItem {
  code: string;
  description: string;
}

export interface ServiceBranchReferenceView extends VaReferenceSourceStatus {
  items: ServiceBranchReferenceItem[];
  /** True when a later VA page failed or the page cap was reached. */
  incomplete?: boolean;
}

type ServiceBranchFetcher = () => Promise<VaApiResult<VaServiceBranchReference>>;

const LOCAL_BRANCHES: ServiceBranchReferenceItem[] = [
  { code: "ARMY", description: "Army" },
  { code: "NAVY", description: "Navy" },
  { code: "AIR_FORCE", description: "Air Force" },
  { code: "MARINE_CORPS", description: "Marine Corps" },
  { code: "COAST_GUARD", description: "Coast Guard" },
  { code: "SPACE_FORCE", description: "Space Force" },
];

function localFallback(): ServiceBranchReferenceView {
  return {
    items: LOCAL_BRANCHES,
    ...vaFallbackStatus("service-branches"),
  };
}

export async function loadServiceBranchReference(
  fetcher: ServiceBranchFetcher = fetchVaServiceBranches,
): Promise<ServiceBranchReferenceView> {
  const config = loadVaApiConfig();
  const configuredEnvironment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaServiceBranches;
  const cacheActive = useSharedCache && config.enabled;
  const cacheKey = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.serviceBranches,
    configuredEnvironment,
  );

  const cacheDto = serviceBranchCacheDto(configuredEnvironment);
  return withVaReferenceCache<ServiceBranchReferenceView>(
    cacheKey,
    async () => {
      const result = await fetcher();
      if (!result.success || !result.data || result.data.items.length === 0) {
        return { view: localFallback(), cacheable: false };
      }

      const environment = resolveVaResultEnvironment(
        result,
        configuredEnvironment,
      );
      return {
        // A partial page set is useful to show, but caching it would keep the
        // missing branches hidden for the full TTL after VA recovers.
        cacheable: result.incomplete !== true,
        view: {
          items: result.data.items
            .map(({ code, description }) => ({ code, description }))
            .sort((a, b) => a.description.localeCompare(b.description)),
          ...(result.incomplete === true ? { incomplete: true } : {}),
          ...vaLiveStatus("service-branches", environment, result.source),
        },
      };
    },
    {
      // Activation first: a disabled integration must never serve a previously
      // cached live view, so the tiers are bypassed entirely when it is off.
      enabled: cacheActive,
      singleFlight: cacheActive,
      decorateHit: (view) => ({ ...view, cacheStatus: "hit" }),
      // A04: bounded branch records, applied at every tier.
      cacheTrust: {
        accepts: (view) => cacheDto.safeParse(view).success,
        degradedView: () => localFallback(),
      },
    },
  );
}

export function clearServiceBranchReferenceCache(): number {
  return clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.serviceBranches);
}
