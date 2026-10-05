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
 * What this module promises is per-client request **fairness**, as a secondary
 * layer behind the edge WAF. That is deliberately a weaker promise than the one
 * `src/lib/va/runtime-state.ts` makes about process-local state, and the
 * difference is the point:
 *
 *   - Buckets here are per instance, so running N instances means the effective
 *     limit is roughly the configured limit × N — the guard **degrades** as the
 *     deployment scales. `rateLimitScope()` reports which regime a process is in.
 *   - That degradation can only make this limiter *weaker* than intended. It
 *     cannot make it *wrong*. A per-instance VA reference cache can serve data
 *     belonging to a different environment, and a per-instance outbound budget
 *     can permit N× the intended traffic against VA. A limiter that permits more
 *     than intended is still restricting traffic; a cache that returns the wrong
 *     snapshot is a correctness failure.
 *
 * So this module does **not** fail closed in production the way the VA cache
 * does, and that is policy rather than oversight: disabling a limiter in
 * production would remove defense-in-depth entirely, while its worst failure
 * mode is a weaker guard. Both modules read the same runtime fact from
 * `runtime-deployment.ts`, so they can no longer disagree about the runtime —
 * only about what to do with it, which is written down here and pinned by
 * `tests/process-local-state-contract.test.ts`.
 *
 * Usage:
 *   import { createRateLimiter } from "@/lib/rate-limiter";
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const result = limiter.check(key);
 *   if (result.limited) return 429;
 */

import { isDistributedRuntime, type RuntimeEnvironment } from "./runtime-deployment";

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
// Runtime scope
// ---------------------------------------------------------------------------

/**
 * The environment a runtime's rate limiting actually has.
 *
 * Reported rather than inferred by operators, so that "this limiter is
 * per-instance" is a fact anyone can read off `/api/health` instead of a
 * paragraph in a comment that has to be found first.
 */
export interface RateLimitScope {
  /** `single-process` when one process owns the buckets; `per-instance` when several do. */
  scope: "single-process" | "per-instance";
  /** Operator-facing explanation of what the configured limits mean here. */
  detail: string;
}

/**
 * Describe what the configured limits mean in this runtime. Classification comes
 * from `runtime-deployment.ts`, the same source the VA cache uses for its own,
 * stricter verdict.
 */
export function rateLimitScope(
  env: RuntimeEnvironment = process.env,
): RateLimitScope {
  if (isDistributedRuntime(env)) {
    return {
      scope: "per-instance",
      detail:
        "per-IP limits apply per instance, so the aggregate is roughly the configured limit x instance count; the edge WAF remains the capacity layer",
    };
  }

  return {
    scope: "single-process",
    detail: "per-IP limits apply to the whole deployment",
  };
}

// ---------------------------------------------------------------------------
// Client identity helpers.
// ---------------------------------------------------------------------------

/** Header a client key was taken from. */
export type ClientKeySource = "x-forwarded-for" | "x-real-ip" | "none";

export interface ClientKeyResolution {
  /** Per-client bucket key, or `null` when the request carries no trustworthy identity. */
  key: string | null;
  source: ClientKeySource;
}

/** First hop of a comma-separated forwarding header: `"client, proxy1"` → `"client"`. */
function firstHop(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * Resolve the per-client bucket key for a request.
 *
 * `key` is `null` when no trustworthy client identity is present. That case used
 * to collapse into one shared `"unknown"` bucket, which is not a per-client limit
 * at all: every unattributed client drew from a single bucket, so the configured
 * per-IP allowance silently became a **global** cap that one client could exhaust
 * on everyone else's behalf — and nothing in a response, log, or metric revealed
 * that the control had changed meaning.
 *
 * Callers must therefore handle `null` explicitly. `proxy.ts` proceeds without
 * limiting, because capacity is the edge WAF's job and an absent limiter is a
 * more honest instrument for it than a mislabelled global cap.
 *
 * `X-Forwarded-For` is preferred; `X-Real-IP` is accepted next because it is what
 * nginx-style reverse proxies set. Both are only as trustworthy as the proxy in
 * front of the app, which is another reason the WAF stays the capacity layer.
 */
export function resolveClientKey(requestHeaders: Headers): ClientKeyResolution {
  const forwarded = firstHop(requestHeaders.get("x-forwarded-for"));
  if (forwarded) return { key: forwarded, source: "x-forwarded-for" };

  const realIp = firstHop(requestHeaders.get("x-real-ip"));
  if (realIp) return { key: realIp, source: "x-real-ip" };

  return { key: null, source: "none" };
}
