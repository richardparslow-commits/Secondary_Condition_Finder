import "server-only";

import { createHash } from "node:crypto";

import type { RuntimeEnvironment } from "../runtime-deployment";

import type { VaApiEnvironment, VaApiSource } from "./sandbox";
import { vaProcessLocalStateAllowed } from "./runtime-state";

/**
 * Hash the user-supplied segment of a cache key.
 *
 * A Forms search query is free text and a locator ZIP is a quasi-identifier;
 * writing either into process-local or shared KV keys persists them as key
 * material (visible in provider dashboards, error messages, and key listings)
 * and lets query length drive key length. The lookup semantics only need equal
 * inputs to compare equal, so the key segment is a truncated SHA-256 instead of
 * the raw value. The cached *value* may still echo the query/ZIP for display
 * under the documented five-minute TTL.
 */
export function hashedCacheKeySegment(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 32);
}

export type VaReferenceCacheStatus = "hit" | "miss";

/**
 * Process-global hit/miss counters for the process-local VA reference cache.
 * Reset on cold start (process restart) — acceptable for serverless. Exposed
 * via GET /api/health so operators can monitor cache effectiveness.
 *
 * These counters live on the same global state as the entries below, not in a
 * module-level `let`. Next can evaluate this module once per route/page module
 * graph, so plain module state left the admin clear and health route reading a
 * different copy from the reference pages. GET /api/health then reported zero
 * forever and POST /api/admin/cache-clear reported `cleared: 0` while pages
 * kept serving hits (Heal s3-admin-cache-clear-misses-page-cache-1).
 */
export function consumeCacheCounters(): { hits: number; misses: number } {
  const snapshot = { hits: cacheState.hits, misses: cacheState.misses };
  cacheState.hits = 0;
  cacheState.misses = 0;
  return snapshot;
}

/** Return the current cache counters without resetting. */
export function peekCacheCounters(): { hits: number; misses: number } {
  return { hits: cacheState.hits, misses: cacheState.misses };
}

/**
 * What this cache is actually able to do in the current runtime.
 *
 * Same shape as `rateLimitScope()` in `rate-limiter.ts`, so `/api/health` can
 * report both regimes the same way.
 */
export interface VaReferenceCacheScope {
  /** `process-local` when this process owns the cache; `disabled` when it refuses to run. */
  scope: "process-local" | "disabled";
  /** Operator-facing explanation. */
  detail: string;
}

/**
 * Report whether the cache is live, and why not when it is not.
 *
 * The verdict is taken from `vaProcessLocalStateAllowed()`, the *same* predicate
 * that gates `readVaReferenceCache` and `writeVaReferenceCache`, rather than
 * re-derived here. That matters: a status endpoint which computes its own answer
 * can disagree with the code it reports on, which is exactly how the cache came
 * to look healthy while being structurally unable to store anything.
 *
 * Callers must not read the hit/miss counters without this: in a distributed
 * runtime both counters stay at zero forever, and a zero-transition `hitRate` is
 * indistinguishable from a cache that simply has not been used yet.
 */
export function vaReferenceCacheScope(
  env: RuntimeEnvironment = process.env,
): VaReferenceCacheScope {
  if (!vaProcessLocalStateAllowed(env)) {
    return {
      scope: "disabled",
      detail:
        "process-local cache is disabled in production and distributed runtimes until a shared cache coordinator is configured; reads always miss, writes are discarded, so the hit/miss counters cannot move and cache-clear operations clear nothing",
    };
  }

  return {
    scope: "process-local",
    detail:
      "process-local LRU on this instance only; entries reset on cold start and are not shared with other instances",
  };
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

interface VaReferenceCacheState {
  entries: Map<string, CacheEntry<unknown>>;
  hits: number;
  misses: number;
  /** Monotonic token that invalidates loads started before a clear. */
  generation?: number;
}

/**
 * One process-global state object for every module graph in this server.
 * A plain module-level Map is per compiled route, not per process: the admin
 * route would clear its own empty map while the reference page kept a warm one.
 * `globalThis` is the process-wide anchor inside this Node isolate, so the
 * clear, the counters, and every reference page now agree on one cache.
 */
function loadCacheState(): VaReferenceCacheState {
  const shared = globalThis as typeof globalThis & {
    __scfVaReferenceCacheStateV1?: VaReferenceCacheState;
  };
  shared.__scfVaReferenceCacheStateV1 ??= {
    entries: new Map<string, CacheEntry<unknown>>(),
    hits: 0,
    misses: 0,
    generation: 0,
  };
  return shared.__scfVaReferenceCacheStateV1;
}

const cacheState = loadCacheState();
const referenceCache = cacheState.entries;

export const VA_REFERENCE_CACHE_TTL_MS = 5 * 60 * 1_000;
export const VA_REFERENCE_CACHE_MAX_ENTRIES = 32;
export const VA_REFERENCE_CACHE_MAX_KEY_LENGTH = 256;

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
    cacheState.misses++;
    return null;
  }
  if (cached.expiresAt <= now) {
    referenceCache.delete(key);
    cacheState.misses++;
    return null;
  }

  // Refresh insertion order on a hit so the bounded single-process cache behaves
  // as a small LRU rather than evicting a frequently used Forms query.
  cacheState.hits++;
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

/**
 * The current clear generation. A loader captures this before fetching and
 * refuses to write if it changed, so a clear cannot be undone by a request
 * that was already in flight when the operator ran it.
 */
export function vaReferenceCacheGeneration(): number {
  return cacheState.generation ?? 0;
}

export function clearVaReferenceCache(prefix?: string): { cleared: number } {
  cacheState.generation = (cacheState.generation ?? 0) + 1;
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
