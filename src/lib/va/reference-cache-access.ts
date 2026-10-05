import "server-only";

import {
  clearVaReferenceCache,
  readVaReferenceCache,
  VA_REFERENCE_CACHE_TTL_MS,
  writeVaReferenceCache,
} from "./reference-cache";
import {
  readVaSharedReferenceCache,
  writeVaSharedReferenceCache,
} from "./reference-shared-cache";
import {
  acquireVaSharedFetchLease,
  awaitVaSharedFetchOutcome,
  releaseVaSharedFetchLease,
} from "./shared-single-flight";

/**
 * The single owner of VA reference cache key namespaces.
 *
 * Every VA reference module used to declare its own literal key prefix and its
 * own `<prefix>:`-based clear call. Two of those prefixes overlapped
 * (`forms-finder` cleared `"forms:"`, which also matched the `form-reference`
 * module's `forms:reference:` keys), so one module silently invalidated
 * another's entries — and `form-reference` never grew a clear function of its
 * own because it appeared to work by accident.
 *
 * Namespaces are therefore declared once, here, and each is a distinct root
 * segment. `vaReferenceCacheKey` always appends the `:` separator, so
 * `forms-finder:` can never match a `forms-reference:` key.
 */
export const VA_REFERENCE_NAMESPACES = {
  serviceBranches: "service-branches",
  formsFinder: "forms-finder",
  formReference: "forms-reference",
  disabilityReference: "disabilities",
  accreditedRepresentatives: "accredited-rep",
} as const;

export type VaReferenceNamespace =
  (typeof VA_REFERENCE_NAMESPACES)[keyof typeof VA_REFERENCE_NAMESPACES];

const KEY_SEPARATOR = ":";

/** Builds a cache key owned by `namespace`. Parts are appended verbatim. */
export function vaReferenceCacheKey(
  namespace: VaReferenceNamespace,
  ...parts: Array<string | number>
): string {
  return [namespace, ...parts].join(KEY_SEPARATOR);
}

/** The exact prefix `clearVaReferenceNamespace` removes for `namespace`. */
export function vaReferenceNamespacePrefix(
  namespace: VaReferenceNamespace,
): string {
  return `${namespace}${KEY_SEPARATOR}`;
}

/**
 * Clears only the entries owned by `namespace` and returns how many were
 * removed. Prefer this over calling `clearVaReferenceCache` directly: a
 * hand-written prefix is how the `forms:` overlap happened.
 */
export function clearVaReferenceNamespace(
  namespace: VaReferenceNamespace,
): number {
  return clearVaReferenceCache(vaReferenceNamespacePrefix(namespace)).cleared;
}

/**
 * What a cache-miss loader resolves to.
 *
 * `cacheable` is a deliberate, required decision rather than an inferred one.
 * All five callers return degraded local fallbacks on a VA outage, and none of
 * them may be cached: pinning a fallback for a full TTL would keep showing
 * "VA data unavailable" after the upstream recovered. Previously that rule was
 * unstated — a `return localFallback()` placed after the write instead of
 * before it would have cached the degradation silently, in one copy of five.
 */
export interface VaReferenceCacheLoad<T> {
  view: T;
  /** Cache this view in both tiers. `false` for degraded fallbacks. */
  cacheable: boolean;
}

export interface WithVaReferenceCacheOptions<T> {
  /**
   * Set `false` when the caller injected a fetcher (tests, scenarios): skips
   * both cache tiers entirely so the injected fetcher always runs.
   */
  enabled?: boolean;
  /** Applied only to cache hits, e.g. `(view) => ({ ...view, cacheStatus: "hit" })`. */
  decorateHit?: (view: T) => T;
  /** Shared-tier TTL. Defaults to `VA_REFERENCE_CACHE_TTL_MS`. */
  ttlMs?: number;
  /**
   * Read-side trust guard for shared-tier values (audit item 12): a shared hit
   * is served as a live VA-labelled view, so an unguarded value could set
   * trusted links or provenance labels this deployment never wrote. A value
   * the guard rejects is treated as a miss. Omit to accept any cached value.
   */
  acceptSharedCached?: (view: T) => boolean;
  /**
   * Per-key single-flight for shared-cache misses (audit A-03): one instance
   * claims a short lease and fetches while contenders wait a bounded window for
   * it to publish instead of duplicating the upstream request. Fails open — an
   * unavailable coordinator means the normal fetch path, where the distributed
   * consumer budget still gates every attempt.
   */
  singleFlight?: boolean;
}

/**
 * Reads a VA reference view through both cache tiers, falling back to `load`.
 *
 * Order of operations, identical for every VA reference module:
 *   1. process-local tier (`readVaReferenceCache`) — cheapest, in-memory
 *   2. shared tier (`readVaSharedReferenceCache`) — one KV round-trip
 *      - on a shared hit, promote into the process-local tier so the next call
 *        is served without a KV round-trip
 *   3. `load()`, then populate both tiers when the loader marks it cacheable
 *
 * The process-local tier is inert in production and distributed runtimes
 * (see `vaProcessLocalStateAllowed`), which is safe: every step degrades to the
 * tier below it, and the shared tier carries the load when configured.
 */
export async function withVaReferenceCache<T>(
  cacheKey: string,
  load: () => Promise<VaReferenceCacheLoad<T>>,
  options: WithVaReferenceCacheOptions<T> = {},
): Promise<T> {
  const {
    enabled = true,
    decorateHit,
    ttlMs = VA_REFERENCE_CACHE_TTL_MS,
    acceptSharedCached,
    singleFlight = false,
  } = options;
  const asHit = (view: T): T => (decorateHit ? decorateHit(view) : view);
  const trusted = (view: T): boolean =>
    acceptSharedCached ? acceptSharedCached(view) : true;

  if (!enabled) {
    const { view } = await load();
    return view;
  }

  const localCached = readVaReferenceCache<T>(cacheKey);
  if (localCached) return asHit(localCached);

  const sharedCached = await readVaSharedReferenceCache<T>(cacheKey);
  if (sharedCached && trusted(sharedCached)) {
    // Promote so the next request is served without another KV round-trip.
    writeVaReferenceCache(cacheKey, sharedCached);
    return asHit(sharedCached);
  }

  // Single-flight (audit A-03): one instance fetches a cold/expired key while
  // contenders wait a bounded window for it to publish. A lease that is
  // unavailable (unconfigured coordinator, non-allowlisted key) fails open
  // into the normal fetch path below.
  const lease = singleFlight ? await acquireVaSharedFetchLease(cacheKey) : null;
  if (lease?.status === "contended") {
    const published = await awaitVaSharedFetchOutcome<T>(cacheKey);
    if (published && trusted(published)) {
      writeVaReferenceCache(cacheKey, published);
      return asHit(published);
    }
  }

  try {
    const { view, cacheable } = await load();
    if (cacheable) {
      writeVaReferenceCache(cacheKey, view);
      // Awaited (not fire-and-forget): a floating promise can be torn down with
      // the request before the write lands, silently leaving the shared cache
      // stale — and the single-flight lease must not be released before the
      // winner's value is observable, or contenders miss within their bounded
      // wait and duplicate the upstream request. The 750 ms KV deadline bounds
      // the added latency.
      await writeVaSharedReferenceCache(cacheKey, view, ttlMs);
    }
    return view;
  } finally {
    if (lease?.status === "acquired") {
      await releaseVaSharedFetchLease(cacheKey, lease.token);
    }
  }
}
