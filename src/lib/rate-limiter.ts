/**
 * Application-level **fixed-window** rate limiter.
 *
 * Provides defense-in-depth behind Vercel's edge WAF. Each limiter tracks
 * per-key (typically IP) request counts within a fixed window and returns 429
 * when the limit is exceeded. Fixed windows admit up to 2× the nominal rate
 * across a window boundary (a burst at the end of one window plus a burst at
 * the start of the next); that is an accepted trade-off for this secondary
 * layer, and the headers/contracts here must not claim a sliding guarantee.
 * All state is process-local and resets on cold start — intentional for
 * serverless (no stale state across instances) and acceptable as a secondary
 * layer behind the edge.
 *
 * Key cardinality is hard-bounded: an attacker rotating source keys cannot
 * grow the tracking map without limit. Expired buckets are swept as the map
 * grows, and a hard cap evicts the oldest buckets as a final backstop.
 *
 * Usage:
 *   import { createRateLimiter } from "@/lib/rate-limiter";
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const result = limiter.check(key);
 *   if (result.limited) return 429;
 */

export interface RateLimiterOptions {
  /** Fixed window duration in milliseconds. Default: 60 000 (1 minute). */
  windowMs?: number;
  /** Maximum requests per window per key. Default: 60. */
  max?: number;
  /** Human label for logging / metrics. Default: "default". */
  name?: string;
}

/**
 * Hard cap on tracked keys per limiter. A source rotating keys (spoofed
 * X-Forwarded-For values, many clients behind one NAT) must not grow process
 * memory without bound; past this many live buckets the oldest are evicted.
 */
export const RATE_LIMITER_MAX_TRACKED_KEYS = 10_000;

export interface CheckResult {
  /** Whether the request should be rejected (429). */
  limited: boolean;
  /** Number of requests remaining in the current window. */
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
  /** Current count of requests in the window. */
  count: number;
}

interface Bucket {
  /** Window start timestamp (ms). */
  windowStart: number;
  /** Number of requests in the current window. */
  count: number;
}

/**
 * Create a rate limiter. Keys are typically IP addresses extracted from
 * `X-Forwarded-For` (Vercel sets this header on every request).
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 60;
  const name = options.name ?? "default";

  const buckets = new Map<string, Bucket>();

  /**
   * Remove expired buckets to bound memory, then enforce the hard cap by
   * evicting the oldest windows. Sweeping on every check past the threshold
   * keeps the map at live-window size instead of letting an attacker who
   * rotates keys grow it without limit.
   */
  function sweep(now = Date.now()): void {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) {
        buckets.delete(key);
      }
    }
    if (buckets.size <= RATE_LIMITER_MAX_TRACKED_KEYS) return;
    const oldestFirst = [...buckets.entries()].sort(
      (a, b) => a[1].windowStart - b[1].windowStart,
    );
    const excess = buckets.size - RATE_LIMITER_MAX_TRACKED_KEYS;
    for (let i = 0; i < excess; i += 1) {
      buckets.delete(oldestFirst[i][0]);
    }
  }

  /**
   * Check whether the given key has exceeded its rate limit.
   * Increments the counter if not limited.
   */
  function check(key: string): CheckResult {
    const now = Date.now();
    if (buckets.size > 1_000) sweep(now);
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      // New or expired window
      buckets.set(key, { windowStart: now, count: 1 });
      return {
        limited: false,
        remaining: max - 1,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
        count: 1,
      };
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const elapsed = now - bucket.windowStart;
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      return {
        limited: true,
        remaining: 0,
        retryAfterSeconds,
        count: bucket.count,
      };
    }

    return {
      limited: false,
      remaining: max - bucket.count,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      count: bucket.count,
    };
  }

  /** Reset all state (for tests). */
  function reset(): void {
    buckets.clear();
  }

  return { check, reset, name, windowMs, max };
}

// ---------------------------------------------------------------------------
// Pre-configured limiters for application routes.
// ---------------------------------------------------------------------------

/** Workflow session writes (saveDiagnosed, saveServiceConnected, etc.) */
export const workflowSessionLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "workflow-session",
});

/** Regulatory preflight sync (authenticated, expensive upstream refresh). */
export const regulatoryPreflightLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  name: "regulatory-preflight",
});

/** Health endpoint (public, but should not be hammered). */
export const healthLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "health",
});

/** Admin cache-clear endpoint (authenticated, destructive). */
export const adminCacheClearLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  name: "admin-cache-clear",
});

/**
 * Public dynamic reference GETs that can reach upstream VA quota or shared
 * cache writes. Bounds inbound abuse independently of the workflow limiter,
 * which only covers POST Server Actions.
 */
export const referenceReadLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "reference-read",
});

// ---------------------------------------------------------------------------
// Key extraction helpers.
// ---------------------------------------------------------------------------

/**
 * Extract a rate-limit key from a request. Uses `X-Forwarded-For` (first
 * IP), trusting that the deployment edge overwrites or strips
 * client-supplied values. That trust is a deployment property this helper
 * cannot verify: without evidence that the proxy/WAF discards inbound
 * `X-Forwarded-For`, a client could rotate spoofed keys to evade per-client
 * limits. The setting is recorded as operator input in the 2026-10-03 audit
 * (§9.3), not assumed here. Falls back to a generic key when the header is
 * absent (local dev, tests).
 */
export function extractClientKey(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  // Fallback: use a generic key. In production behind Vercel, this path
  // should never be reached because X-Forwarded-For is always set.
  return "unknown";
}
