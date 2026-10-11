/**
 * Route → rate-limit policy registry.
 *
 * Which limiter guards an API route used to be decided by three
 * `url.pathname === "..."` comparisons written inline in `src/proxy.ts`. The
 * route list was not recorded anywhere a machine could check, so adding a
 * sensitive route meant remembering to add a branch — and forgetting one
 * produced no error, no lint failure, and no test failure. The route simply
 * ran unlimited, which is the failure mode that looks like a passing build.
 *
 * The mapping is now data, owned here, and
 * `tests/api-route-rate-limit-coverage.test.ts` derives the real API routes
 * from the filesystem (`src/app/api/**\/route.ts`) and fails if any route is
 * neither policed below nor explicitly listed in `API_ROUTES_WITHOUT_LIMITER`.
 *
 * Patterns use the same `[param]` convention as Next.js route directories, so
 * a route pattern can be copied from the folder path that produces it.
 */

import {
  accountAuthCallbackLimiter,
  accountAuthLoginLimiter,
  adminCacheClearLimiter,
  healthLimiter,
  regulatoryPreflightLimiter,
} from "./rate-limiter";
import type { createRateLimiter } from "./rate-limiter";

/** A configured limiter, as returned by `createRateLimiter`. */
type RateLimiter = ReturnType<typeof createRateLimiter>;

export interface ApiRouteLimitPolicy {
  /** Route pattern; `[param]` matches exactly one path segment. */
  path: string;
  /** Limiter applied to every request for this route. */
  limiter: RateLimiter;
  /**
   * Body returned with the 429. Route-specific rather than shared, because the
   * routes already answer 429 with different shapes and a client may parse them.
   */
  limitedBody: Record<string, unknown>;
  /** Why this route is rate-limited, so each entry justifies its own existence. */
  rationale: string;
}

/**
 * API routes that carry a limiter. Order matters only for overlapping patterns;
 * these are disjoint, and `tests/api-route-rate-limit-coverage.test.ts` pins
 * that they stay that way.
 */
export const API_ROUTE_LIMIT_POLICIES: readonly ApiRouteLimitPolicy[] = [
  {
    path: "/api/regulatory/preflight",
    limiter: regulatoryPreflightLimiter,
    limitedBody: {
      ok: false,
      error: "Rate limit exceeded. Please try again later.",
    },
    rationale:
      "Authenticated sync whose whole purpose is to force an expensive upstream refresh.",
  },
  {
    path: "/api/admin/cache-clear",
    limiter: adminCacheClearLimiter,
    limitedBody: {
      ok: false,
      error: "Rate limit exceeded. Please try again later.",
    },
    rationale:
      "Authenticated and destructive: its blast radius is the shared reference data behind every public page.",
  },
  {
    path: "/api/health",
    limiter: healthLimiter,
    limitedBody: { status: "rate_limited" },
    rationale:
      "Public and unauthenticated, so it is the cheapest route to hammer and the one an operator polls.",
  },
  {
    path: "/api/auth/login",
    limiter: accountAuthLoginLimiter,
    limitedBody: {
      ok: false,
      error: "Rate limit exceeded. Please try again later.",
    },
    rationale:
      "Every initiation mints a server-side OAuth transaction; unbounded calls exhaust the bounded transaction store.",
  },
  {
    path: "/api/auth/callback",
    limiter: accountAuthCallbackLimiter,
    limitedBody: {
      ok: false,
      error: "Rate limit exceeded. Please try again later.",
    },
    rationale:
      "Every callback performs an upstream token exchange plus a JWKS fetch; it is policed like the other upstream-forcing route.",
  },
];

/**
 * API routes deliberately served without a limiter, keyed by route pattern with
 * the reason for the exemption. A route that appears in neither this map nor
 * `API_ROUTE_LIMIT_POLICIES` fails the coverage test, which makes "unlimited" an
 * explicit decision on the record rather than an oversight.
 */
export const API_ROUTES_WITHOUT_LIMITER: Readonly<Record<string, string>> = {
  "/api/csp-report":
    "Excluded from the proxy matcher entirely so a browser can always deliver a " +
    "CSP/Trusted-Types violation report; policing it would suppress the very " +
    "telemetry that reveals a broken policy. The route redacts every report to a " +
    "bounded, content-free event before anything is logged or counted.",
};

/**
 * Compile a route pattern (`/api/forms/[id]`) into a matcher where each
 * `[param]` segment matches exactly one non-empty path segment. `/api/x/[id]`
 * therefore never matches `/api/x/1/y` or `/api/x/`.
 *
 * Exported so the coverage test and the proxy apply one rule rather than two
 * copies of it that could drift apart.
 */
export function compileApiRoutePattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withSegments = escaped.replace(/\\\[[^/]+\\\]/g, "[^/]+");
  return new RegExp(`^${withSegments}$`);
}

// Compiled once at module load rather than per request.
const COMPILED_POLICIES = API_ROUTE_LIMIT_POLICIES.map((policy) => ({
  policy,
  matcher: compileApiRoutePattern(policy.path),
}));

/**
 * The policy for a concrete request pathname, or `undefined` when the route is
 * not policed. An unmatched path means "no route-scoped limiter", which is why
 * the coverage test insists every real route is classified.
 */
export function findApiRouteLimitPolicy(
  pathname: string,
): ApiRouteLimitPolicy | undefined {
  return COMPILED_POLICIES.find(({ matcher }) => matcher.test(pathname))?.policy;
}
