import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import {
  API_ROUTES_WITHOUT_LIMITER,
  API_ROUTE_LIMIT_POLICIES,
  compileApiRoutePattern,
  findApiRouteLimitPolicy,
} from "@/lib/api-route-policies";
import { workflowSessionLimiter } from "@/lib/rate-limiter";
import { proxy } from "@/proxy";

/**
 * Guards the route → rate-limit wiring in `src/proxy.ts`.
 *
 * The proxy used to decide which limiter applied via three
 * `url.pathname === "..."` comparisons, with the route list recorded nowhere a
 * machine could check. This suite derives the real routes from
 * `src/app/api/**\/route.ts` on disk and requires every one of them to be
 * either policed or explicitly exempted, so adding a sensitive route without a
 * limiter fails here instead of shipping unlimited.
 */

const APP_DIR = path.join(process.cwd(), "src", "app");
const API_DIR = path.join(APP_DIR, "api");

interface DiscoveredRoute {
  /** Route pattern with `[param]` segments kept, e.g. `/api/forms/[id]`. */
  pattern: string;
  file: string;
  /** Exported HTTP handlers, read from the route module's own source. */
  methods: string[];
}

function listRouteFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRouteFiles(absolute);
    return entry.name === "route.ts" ? [absolute] : [];
  });
}

function discoverRoutes(): DiscoveredRoute[] {
  return listRouteFiles(API_DIR).map((file) => {
    const relative = path.relative(APP_DIR, file).split(path.sep);
    const segments = relative.slice(0, -1); // drop "route.ts"
    const source = fs.readFileSync(file, "utf8");
    const methods = [
      ...source.matchAll(
        /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
      ),
    ].map((match) => match[1]);

    return { pattern: `/${segments.join("/")}`, file, methods };
  });
}

function instantiate(pattern: string): string {
  return pattern.replace(/\[[^\]]+\]/g, "sample-segment");
}

/** A request path built from a pattern, plus a method the route actually exports. */
function requestFor(route: DiscoveredRoute): { path: string; method: string } {
  return {
    path: instantiate(route.pattern),
    method: route.methods.includes("GET") ? "GET" : (route.methods[0] ?? "GET"),
  };
}

const routes = discoverRoutes();
const policyPaths = API_ROUTE_LIMIT_POLICIES.map((policy) => policy.path);
const exemptPaths = Object.keys(API_ROUTES_WITHOUT_LIMITER);

function resetLimiters(): void {
  workflowSessionLimiter.reset();
  for (const policy of API_ROUTE_LIMIT_POLICIES) policy.limiter.reset();
}

beforeEach(resetLimiters);

describe("API route rate-limit coverage", () => {
  it("discovers the API routes from disk rather than a hand-kept list", () => {
    // Anti-vacuity: the assertions below are meaningless if the walk finds
    // nothing, so pin that the walker actually sees the routes we know exist.
    expect(routes.map((route) => route.pattern).sort()).toEqual(
      expect.arrayContaining(["/api/admin/cache-clear", "/api/health", "/api/regulatory/preflight"]),
    );
    expect(routes.length).toBeGreaterThanOrEqual(3);
    for (const route of routes) {
      expect(route.methods.length, `${route.pattern} exports no handler`).toBeGreaterThan(0);
    }
  });

  it("classifies every route in src/app/api as either policed or exempt", () => {
    const classified = new Set([...policyPaths, ...exemptPaths]);
    const unclassified = routes
      .map((route) => route.pattern)
      .filter((pattern) => !classified.has(pattern));

    expect(
      unclassified,
      `add these to API_ROUTE_LIMIT_POLICIES or API_ROUTES_WITHOUT_LIMITER: ${unclassified.join(", ")}`,
    ).toEqual([]);
  });

  it("has no policy or exemption for a route that does not exist", () => {
    const known = new Set(routes.map((route) => route.pattern));
    const stale = [...policyPaths, ...exemptPaths].filter((pattern) => !known.has(pattern));

    expect(
      stale,
      `these entries no longer match a route file: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("accounts for every discovered route exactly once", () => {
    const classified = new Set([...policyPaths, ...exemptPaths]);

    expect(classified.size).toBe(policyPaths.length + exemptPaths.length);
    expect(classified.size).toBe(routes.length);
  });

  it("keeps policies disjoint so no request is attributed to two limiters", () => {
    for (const policy of API_ROUTE_LIMIT_POLICIES) {
      const matching = API_ROUTE_LIMIT_POLICIES.filter((candidate) =>
        compileApiRoutePattern(candidate.path).test(instantiate(policy.path)),
      );
      expect(matching.map((candidate) => candidate.path)).toEqual([policy.path]);
    }
  });

  it("does not police and exempt the same path", () => {
    for (const exempt of exemptPaths) {
      expect(policyPaths).not.toContain(exempt);
    }
  });

  it("records why each policed route is policed", () => {
    const names = API_ROUTE_LIMIT_POLICIES.map((policy) => policy.limiter.name);

    expect(new Set(names).size).toBe(names.length);
    for (const policy of API_ROUTE_LIMIT_POLICIES) {
      expect(policy.rationale.length).toBeGreaterThan(20);
      expect(policy.limiter.max).toBeGreaterThan(0);
      expect(Object.keys(policy.limitedBody).length).toBeGreaterThan(0);
    }
  });

  it("binds each route to the limiter intended for it", () => {
    const expected: Record<string, string> = {
      "/api/admin/cache-clear": "admin-cache-clear",
      "/api/health": "health",
      "/api/regulatory/preflight": "regulatory-preflight",
    };

    for (const policy of API_ROUTE_LIMIT_POLICIES) {
      if (expected[policy.path]) {
        expect(policy.limiter.name).toBe(expected[policy.path]);
      }
    }
  });
});

describe("proxy route-policy wiring", () => {
  it.each(API_ROUTE_LIMIT_POLICIES.map((policy) => [policy.path, policy] as const))(
    "rejects over-limit traffic to %s with that route's body and Retry-After",
    async (pattern, policy) => {
      const route = routes.find((candidate) => candidate.pattern === pattern);
      expect(route, `no route file for ${pattern}`).toBeDefined();
      const { path: requestPath, method } = requestFor(route!);
      const clientIp = `203.0.113.${policyPaths.indexOf(pattern) + 1}`;

      const send = () =>
        proxy(
          new NextRequest(`https://example.test${requestPath}`, {
            method,
            headers: { "x-forwarded-for": clientIp },
          }),
        );

      for (let i = 0; i < policy.limiter.max; i += 1) {
        expect((await send()).status, `request ${i + 1} should be allowed`).not.toBe(429);
      }

      const limited = await send();
      expect(limited.status).toBe(429);
      expect(limited.headers.get("Retry-After")).toBeTruthy();
      expect(limited.headers.get("Content-Security-Policy")).toBeTruthy();
      expect(await limited.json()).toEqual(policy.limitedBody);
    },
  );

  it("lets a request to an unpoliced path through", () => {
    const response = proxy(
      new NextRequest("https://example.test/api/not-a-real-route", {
        headers: { "x-forwarded-for": "198.51.100.7" },
      }),
    );

    expect(response.status).not.toBe(429);
  });

  it("counts an API POST against both the method rule and its own route policy", async () => {
    const route = routes.find((candidate) => candidate.pattern === "/api/admin/cache-clear");
    if (!route?.methods.includes("POST")) return;

    const send = () =>
      proxy(
        new NextRequest("https://example.test/api/admin/cache-clear", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.9" },
        }),
      );

    // The admin policy is tighter than the POST rule, so the route body wins.
    const policy = API_ROUTE_LIMIT_POLICIES.find(
      (candidate) => candidate.path === "/api/admin/cache-clear",
    )!;
    for (let i = 0; i < policy.limiter.max; i += 1) await send();

    const limited = await send();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual(policy.limitedBody);
    expect(workflowSessionLimiter.check("probe").limited).toBe(false);
  });

  it("does not collapse unattributed requests into one shared bucket", async () => {
    // Every request without a forwarding header used to draw from a single
    // `"unknown"` bucket, so the configured per-IP allowance silently became a
    // *global* cap: one client's traffic rejected everyone else's, and nothing in
    // the response said so. These requests are now simply not charged to a
    // bucket — capacity is the edge WAF's job.
    const post = () =>
      proxy(new NextRequest("https://example.test/secondary/diagnosed", { method: "POST" }));

    for (let i = 0; i < workflowSessionLimiter.max + 5; i += 1) {
      expect((await post()).status, `unattributed POST ${i + 1}`).not.toBe(429);
    }

    const health = () => proxy(new NextRequest("https://example.test/api/health"));
    for (let i = 0; i < 40; i += 1) {
      expect((await health()).status, `unattributed health ${i + 1}`).not.toBe(429);
    }
  });

  it("keeps the method-scoped POST rule for a client that does identify itself", async () => {
    const send = () =>
      proxy(
        new NextRequest("https://example.test/secondary/diagnosed", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.44" },
        }),
      );

    for (let i = 0; i < workflowSessionLimiter.max; i += 1) {
      expect((await send()).status).not.toBe(429);
    }

    const limited = await send();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({
      error: "Too many requests. Please try again later.",
    });
  });

  it("still limits a client identified only by X-Real-IP", async () => {
    const send = () =>
      proxy(
        new NextRequest("https://example.test/api/health", {
          headers: { "x-real-ip": "198.51.100.55" },
        }),
      );

    const policy = API_ROUTE_LIMIT_POLICIES.find(
      (candidate) => candidate.path === "/api/health",
    )!;
    for (let i = 0; i < policy.limiter.max; i += 1) await send();

    const limited = await send();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual(policy.limitedBody);
  });
});

describe("compileApiRoutePattern", () => {
  it("matches a static pattern exactly, and nothing that extends it", () => {
    const matcher = compileApiRoutePattern("/api/health");

    expect(matcher.test("/api/health")).toBe(true);
    expect(matcher.test("/api/health-extra")).toBe(false);
    expect(matcher.test("/api/health/")).toBe(false);
    expect(matcher.test("/prefix/api/health")).toBe(false);
  });

  it("matches a dynamic segment against exactly one non-empty segment", () => {
    const matcher = compileApiRoutePattern("/api/forms/[id]");

    expect(matcher.test("/api/forms/21-526ez")).toBe(true);
    expect(matcher.test("/api/forms/")).toBe(false);
    expect(matcher.test("/api/forms/21/extra")).toBe(false);
    expect(matcher.test("/api/forms")).toBe(false);
  });

  it("returns undefined from the lookup for unclassified paths", () => {
    expect(findApiRouteLimitPolicy("/api/health")).toBeDefined();
    expect(findApiRouteLimitPolicy("/api/health-extra")).toBeUndefined();
    expect(findApiRouteLimitPolicy("/api/health/")).toBeUndefined();
  });
});
