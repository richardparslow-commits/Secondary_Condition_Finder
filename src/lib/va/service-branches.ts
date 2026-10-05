import "server-only";

import { isTrustedCachedLiveView } from "./cached-view-guard";
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
        cacheable: true,
        view: {
          items: [...result.data.items].sort((a, b) =>
            a.description.localeCompare(b.description),
          ),
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
      // Read-side guard: a shared value may only be served if it still carries
      // this deployment's provenance and only credential-free HTTPS links.
      acceptSharedCached: (view) =>
        isTrustedCachedLiveView(view, configuredEnvironment),
    },
  );
}

export function clearServiceBranchReferenceCache(): number {
  return clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.serviceBranches);
}
