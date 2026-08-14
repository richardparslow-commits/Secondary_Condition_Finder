import "server-only";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  clearVaReferenceCache,
  readVaReferenceCache,
  type VaReferenceSourceStatus,
  writeVaReferenceCache,
} from "./reference-cache";
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
    source: "local-fallback",
    sourceLabel: "Local catalog fallback",
    notice:
      "VA reference data is unavailable or disabled. These names come from this app's local condition catalog, not from VA Benefits Reference Data. Do not treat this fallback as an official VA list.",
    live: false,
    environment: null,
    retrievedAt: null,
    cacheStatus: "miss",
  };
}

export async function loadDisabilityReference(
  fetcher: DisabilityFetcher = fetchVaDisabilityReference,
): Promise<DisabilityReferenceView> {
  const config = loadVaApiConfig();
  const configuredEnvironment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaDisabilityReference;
  const cacheKey = `disabilities:${configuredEnvironment}`;

  if (useSharedCache) {
    const cached = readVaReferenceCache<DisabilityReferenceView>(cacheKey);
    if (cached) return { ...cached, cacheStatus: "hit" };
  }

  const result = await fetcher();
  if (!result.success || !result.data) return localFallback();

  const currentItems = result.data.items
    .filter((item) => !item.endDateTime)
    .map((item) => ({ id: String(item.id), name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (currentItems.length === 0) return localFallback();

  const environment =
    result.environment ??
    (result.source === "va-production-api" ? "production" : configuredEnvironment);
  const view: DisabilityReferenceView = {
    items: currentItems,
    source: result.source,
    sourceLabel:
      environment === "production" ? "VA production reference" : "VA sandbox reference",
    notice:
      environment === "production"
        ? "These public reference values came from VA Benefits Reference Data. A matching name is not a diagnosis, eligibility decision, rating, or proof of service connection."
        : "These public reference values came from the VA Benefits Reference Data sandbox. Sandbox data is test data and may not be current. A matching name is not a diagnosis, eligibility decision, rating, or proof of service connection.",
    live: true,
    environment,
    retrievedAt: new Date().toISOString(),
    cacheStatus: "miss",
  };

  if (useSharedCache) writeVaReferenceCache(cacheKey, view);
  return view;
}

export function clearDisabilityReferenceCache(): void {
  clearVaReferenceCache("disabilities:");
}
