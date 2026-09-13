/**
 * Application-level sliding-window rate limiter.
 *
 * Provides defense-in-depth behind Vercel's edge WAF. Each limiter tracks
 * per-key (typically IP) request counts within a sliding window and returns
 * 429 when the limit is exceeded. All state is process-local and resets on
 * cold start — this is intentional for serverless (no stale state across
 * instances) and acceptable as a secondary layer behind the edge.
 *
 * Usage:
 *   import { createRateLimiter } from "@/lib/rate-limiter";
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const result = limiter.check(key);
 *   if (result.limited) return 429;
 */

export interface RateLimiterOptions {
  /** Sliding window duration in milliseconds. Default: 60 000 (1 minute). */
  windowMs?: number;
  /** Maximum requests per window per key. Default: 60. */
  max?: number;
  /** Human label for logging / metrics. Default: "default". */
  name?: string;
}

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

  /** Periodic cleanup: remove expired buckets to prevent unbounded growth. */
  function sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) {
        buckets.delete(key);
      }
    }
  }

  /**
   * Check whether the given key has exceeded its rate limit.
   * Increments the counter if not limited.
   */
  function check(key: string): CheckResult {
    const now = Date.now();
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

  // Sweep stale buckets on every check (O(n) but n is bounded by unique IPs
  // in the window; in production with WAF in front, this is small).
  // Call sweep lazily only when buckets grow large.
  const originalCheck = check;
  const wrappedCheck = (key: string): CheckResult => {
    if (buckets.size > 10_000) sweep();
    return originalCheck(key);
  };

  return { check: wrappedCheck, reset, name, windowMs, max };
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

// ---------------------------------------------------------------------------
// Key extraction helpers.
// ---------------------------------------------------------------------------

/**
 * Extract a rate-limit key from a request. Uses `X-Forwarded-For` (first
 * IP) which Vercel and most reverse proxies set. Falls back to a generic
 * key when the header is absent (local dev, tests).
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
