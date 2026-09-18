import "server-only";

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
  const cacheKey = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.serviceBranches,
    configuredEnvironment,
  );

  return withVaReferenceCache<ServiceBranchReferenceView>(
    cacheKey,
    async () => {
      const result = await fetcher();
      if (!result.success || !result.data || result.data.items.length === 0) {
        return {
          view: localFallback(
            "VA service-branch reference data is unavailable or disabled.",
          ),
          cacheable: false,
        };
      }

      const environment =
        result.environment ??
        (result.source === "va-production-api"
          ? "production"
          : configuredEnvironment);
      return {
        cacheable: true,
        view: {
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
        },
      };
    },
    {
      enabled: useSharedCache,
      decorateHit: (view) => ({ ...view, cacheStatus: "hit" }),
    },
  );
}

export function clearServiceBranchReferenceCache(): number {
  return clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.serviceBranches);
}
