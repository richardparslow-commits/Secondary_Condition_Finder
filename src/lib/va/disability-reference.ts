import "server-only";

import { loadConditionCatalog } from "@/lib/catalog/load";

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
  fetchVaDisabilityReference,
  loadVaApiConfig,
  type VaApiResult,
} from "./sandbox";

export interface DisabilityReferenceItem {
  id: string;
  name: string;
}

export interface DisabilityReferenceView extends VaReferenceSourceStatus {
  items: DisabilityReferenceItem[];
}

type DisabilityFetcher = () => Promise<
  VaApiResult<{
    items: Array<{
      id: number;
      name: string;
      endDateTime?: string | null;
    }>;
  }>
>;

function localFallback(): DisabilityReferenceView {
  const items = loadConditionCatalog()
    .map((condition) => ({ id: condition.id, name: condition.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    items,
    ...vaFallbackStatus("disability-reference"),
  };
}

export async function loadDisabilityReference(
  fetcher: DisabilityFetcher = fetchVaDisabilityReference,
): Promise<DisabilityReferenceView> {
  const config = loadVaApiConfig();
  const configuredEnvironment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaDisabilityReference;
  const cacheKey = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.disabilityReference,
    configuredEnvironment,
  );

  return withVaReferenceCache<DisabilityReferenceView>(
    cacheKey,
    async () => {
      const result = await fetcher();
      if (!result.success || !result.data) {
        return { view: localFallback(), cacheable: false };
      }

      const currentItems = result.data.items
        .filter((item) => !item.endDateTime)
        .map((item) => ({ id: String(item.id), name: item.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (currentItems.length === 0) {
        return { view: localFallback(), cacheable: false };
      }

      const environment = resolveVaResultEnvironment(
        result,
        configuredEnvironment,
      );
      return {
        cacheable: true,
        view: {
          items: currentItems,
          ...vaLiveStatus("disability-reference", environment, result.source),
        },
      };
    },
    {
      enabled: useSharedCache,
      decorateHit: (view) => ({ ...view, cacheStatus: "hit" }),
    },
  );
}

export function clearDisabilityReferenceCache(): number {
  return clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.disabilityReference);
}
