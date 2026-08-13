import "server-only";

import {
  loadServiceBranchReference,
  type ServiceBranchReferenceView,
} from "./service-branches";

interface CacheEntry {
  value: ServiceBranchReferenceView;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1_000;
let cache: CacheEntry | null = null;

export async function loadCachedServiceBranchReference(): Promise<
  ServiceBranchReferenceView & { cacheStatus: "hit" | "miss"; retrievedAt: string | null }
> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return {
      ...cache.value,
      cacheStatus: "hit",
      retrievedAt: cache.value.live ? new Date(cache.expiresAt - CACHE_TTL_MS).toISOString() : null,
    };
  }

  const value = await loadServiceBranchReference();
  if (value.live) {
    cache = { value, expiresAt: now + CACHE_TTL_MS };
  }

  return {
    ...value,
    cacheStatus: "miss",
    retrievedAt: value.live ? new Date(now).toISOString() : null,
  };
}

export function clearServiceBranchCache(): void {
  cache = null;
}
