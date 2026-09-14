import "server-only";

import type { VaApiEnvironment, VaApiSource } from "./sandbox";
import { vaProcessLocalStateAllowed } from "./runtime-state";

export type VaReferenceCacheStatus = "hit" | "miss";

/**
 * Module-level hit/miss counters for the process-local VA reference cache.
 * Reset on cold start (process restart) — acceptable for serverless. Exposed
 * via GET /api/health so operators can monitor cache effectiveness.
 */
let cacheHits = 0;
let cacheMisses = 0;

/** Return a snapshot of the current cache counters and reset them. */
export function consumeCacheCounters(): { hits: number; misses: number } {
  const snapshot = { hits: cacheHits, misses: cacheMisses };
  cacheHits = 0;
  cacheMisses = 0;
  return snapshot;
}

/** Return the current cache counters without resetting. */
export function peekCacheCounters(): { hits: number; misses: number } {
  return { hits: cacheHits, misses: cacheMisses };
}

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
export const VA_REFERENCE_CACHE_MAX_ENTRIES = 32;
export const VA_REFERENCE_CACHE_MAX_KEY_LENGTH = 256;

const referenceCache = new Map<string, CacheEntry<unknown>>();

function pruneExpiredEntries(now: number): void {
  for (const [key, entry] of referenceCache.entries()) {
    if (entry.expiresAt <= now) referenceCache.delete(key);
  }
}

function evictOldestEntry(): void {
  const oldestKey = referenceCache.keys().next().value as string | undefined;
  if (oldestKey !== undefined) referenceCache.delete(oldestKey);
}

export function readVaReferenceCache<T>(
  key: string,
  now = Date.now(),
): T | null {
  if (!vaProcessLocalStateAllowed()) return null;

  const cached = referenceCache.get(key) as CacheEntry<T> | undefined;
  if (!cached) {
    cacheMisses++;
    return null;
  }
  if (cached.expiresAt <= now) {
    referenceCache.delete(key);
    cacheMisses++;
    return null;
  }

  // Refresh insertion order on a hit so the bounded single-process cache behaves
  // as a small LRU rather than evicting a frequently used Forms query.
  cacheHits++;
  referenceCache.delete(key);
  referenceCache.set(key, cached as CacheEntry<unknown>);
  return cached.value;
}

export function writeVaReferenceCache<T>(
  key: string,
  value: T,
  now = Date.now(),
  ttlMs = VA_REFERENCE_CACHE_TTL_MS,
): void {
  if (!key || key.length > VA_REFERENCE_CACHE_MAX_KEY_LENGTH) {
    throw new Error(`VA reference cache keys must contain 1-${VA_REFERENCE_CACHE_MAX_KEY_LENGTH} characters.`);
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("VA reference cache TTL must be a positive finite number.");
  }
  if (!vaProcessLocalStateAllowed()) return;

  pruneExpiredEntries(now);
  referenceCache.delete(key);
  while (referenceCache.size >= VA_REFERENCE_CACHE_MAX_ENTRIES) {
    evictOldestEntry();
  }
  referenceCache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
}

export function clearVaReferenceCache(prefix?: string): { cleared: number } {
  let cleared = 0;
  if (!prefix) {
    cleared = referenceCache.size;
    referenceCache.clear();
  } else {
    for (const key of [...referenceCache.keys()]) {
      if (key.startsWith(prefix)) {
        referenceCache.delete(key);
        cleared++;
      }
    }
  }
  return { cleared };
}
