import "server-only";

import { loadConditionCatalog } from "@/lib/catalog/load";

import {
  disabilityReferenceCacheDto,
  VA_CACHE_DTO_MAX_ITEMS,
  VA_REPORTED_TOTAL_MAX,
} from "./cached-view-guard";
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
  /**
   * How many current terms VA reports publishing in total. Always at least the
   * number shown; greater when this view carries only a bounded prefix.
   */
  totalAvailable: number;
  /** True when a later VA page failed; the list below is a usable partial result. */
  incomplete?: boolean;
}

type DisabilityFetcher = () => Promise<
  VaApiResult<{
    items: Array<{
      id: number;
      name: string;
      endDateTime?: string | null;
    }>;
    totalItems?: number;
    totalPages?: number;
  }>
>;

function localFallback(): DisabilityReferenceView {
  const items = loadConditionCatalog()
    .map((condition) => ({ id: condition.id, name: condition.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    items,
    totalAvailable: items.length,
    ...vaFallbackStatus("disability-reference"),
  };
}

export async function loadDisabilityReference(
  fetcher: DisabilityFetcher = fetchVaDisabilityReference,
): Promise<DisabilityReferenceView> {
  const config = loadVaApiConfig();
  const configuredEnvironment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaDisabilityReference;
  const cacheActive = useSharedCache && config.enabled;
  const cacheKey = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.disabilityReference,
    configuredEnvironment,
  );

  const cacheDto = disabilityReferenceCacheDto(configuredEnvironment);
  return withVaReferenceCache<DisabilityReferenceView>(
    cacheKey,
    async () => {
      const result = await fetcher();
      if (!result.success || !result.data) {
        return { view: localFallback(), cacheable: false };
      }

      // A term with an end date is current until that date passes; treating
      // every end-dated term as retired hid future effective-end records (Heal
      // s3-future-end-date-term-hidden-1). An unreadable end date is not
      // evidence the term is current, so it is still dropped.
      const now = Date.now();
      const currentItems = result.data.items
        .filter((item) => {
          if (!item.endDateTime) return true;
          const endsAt = Date.parse(item.endDateTime);
          return Number.isFinite(endsAt) && endsAt > now;
        })
        .map((item) => ({ id: String(item.id), name: item.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (currentItems.length === 0) {
        return { view: localFallback(), cacheable: false };
      }

      // Keep the readable part of a long VA list instead of rejecting the whole
      // live view for exceeding the cache DTO's item bound (which replaced it
      // with the local catalog and told the reader VA was unavailable). The
      // DTO ceiling is the display bound; VA's reported total travels with the
      // view so the explorer can disclose anything it did not load.
      const items = currentItems.slice(0, VA_CACHE_DTO_MAX_ITEMS);
      // VA's totalItems counts end-dated terms, but the matching set only carries
      // current terms. Subtract the retired terms actually read so a complete
      // current list is not reported as a partial load (Heal
      // s9-retired-term-shown-as-partial-load-1).
      const retiredCount = result.data.items.length - currentItems.length;
      const totalAvailable = Math.max(
        items.length,
        Math.min(
          (result.data.totalItems ?? result.data.items.length) - retiredCount,
          VA_REPORTED_TOTAL_MAX,
        ),
      );

      const environment = resolveVaResultEnvironment(
        result,
        configuredEnvironment,
      );
      return {
        // A partial page set is still useful to show, but caching it would keep
        // the missing terms hidden for the full TTL after VA recovers.
        cacheable: result.incomplete !== true,
        view: {
          items,
          totalAvailable,
          ...(result.incomplete === true ? { incomplete: true } : {}),
          ...vaLiveStatus("disability-reference", environment, result.source),
        },
      };
    },
    {
      // Activation first: a disabled integration must never serve a previously
      // cached live view, so the tiers are bypassed entirely when it is off.
      enabled: cacheActive,
      singleFlight: cacheActive,
      decorateHit: (view) => ({ ...view, cacheStatus: "hit" }),
      // A04: bounded condition records, applied at every tier.
      cacheTrust: {
        accepts: (view) => cacheDto.safeParse(view).success,
        degradedView: () => localFallback(),
      },
    },
  );
}

export function clearDisabilityReferenceCache(): number {
  return clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.disabilityReference);
}
