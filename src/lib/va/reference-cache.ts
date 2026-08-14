import "server-only";

import type { VaApiEnvironment, VaApiSource } from "./sandbox";

export type VaReferenceCacheStatus = "hit" | "miss";

export interface VaReferenceSourceStatus {
  source: VaApiSource;
  sourceLabel: string;
  notice: string;
  live: boolean;
  environment: VaApiEnvironment | null;
  retrievedAt: string | null;
  cacheStatus: VaReferenceCacheStatus;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export const VA_REFERENCE_CACHE_TTL_MS = 5 * 60 * 1_000;

const referenceCache = new Map<string, CacheEntry<unknown>>();

export function readVaReferenceCache<T>(
  key: string,
  now = Date.now(),
): T | null {
  const cached = referenceCache.get(key) as CacheEntry<T> | undefined;
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    referenceCache.delete(key);
    return null;
  }
  return cached.value;
}

export function writeVaReferenceCache<T>(
  key: string,
  value: T,
  now = Date.now(),
  ttlMs = VA_REFERENCE_CACHE_TTL_MS,
): void {
  referenceCache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
}

export function clearVaReferenceCache(prefix?: string): void {
  if (!prefix) {
    referenceCache.clear();
    return;
  }

  for (const key of referenceCache.keys()) {
    if (key.startsWith(prefix)) referenceCache.delete(key);
  }
}
