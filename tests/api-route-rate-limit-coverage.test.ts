import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  API_ROUTES_WITHOUT_LIMITER,
  API_ROUTE_LIMIT_POLICIES,
  compileApiRoutePattern,
  findApiRouteLimitPolicy,
} from "@/lib/api-route-policies";
import {
  healthLimiter,
  referenceReadLimiter,
  unattributedAdmissionLimiter,
  workflowSessionLimiter,
} from "@/lib/rate-limiter";
import {
  admissionRefusalWindowReport,
  clearAdmissionRefusalWindow,
} from "@/lib/observability/refusal-window";
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
  referenceReadLimiter.reset();
  workflowSessionLimiter.reset();
  for (const policy of API_ROUTE_LIMIT_POLICIES) policy.limiter.reset();
  // The shared admission ceiling is charged by every limited surface, so it is
  // part of "clean limiter state" here too. Suites that tune it declare their
  // own budget (see the SEC-02 ceiling describe below).
  unattributedAdmissionLimiter().reset();
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
      "/api/internal/tiger-catalog-compare": "tiger-catalog-probe",
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

// Page loaders sit outside src/app/api and therefore are not discovered by
// the API policy inventory above. Exercise every currently guarded public
// reference page plus the account/OAuth routes against the real proxy.
const REFERENCE_READ_PATHS = [
  "/va-forms",
  "/va-forms/finder",
  "/va-reference",
  "/va-reference/service-branches",
  "/presumptive",
  "/presumptive/results",
  "/secondary/suggestions",
  "/secondary/evidence",
  "/va-account",
  "/va-account/oauth/claims/start",
] as const;

describe("public reference page rate-limit coverage (SEC-02)", () => {
  it("covers every page importing a public VA or regulatory review loader", () => {
    const loaderNames = [
      "loadClaimFormReference",
      "loadVaFormsFinder",
      "loadDisabilityReference",
      "loadServiceBranchReference",
      "loadAccreditedRepresentatives",
      "prepareRegulatoryReview",
    ];
    const discoverPages = (directory: string): string[] =>
      fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) return discoverPages(absolute);
        if (entry.name !== "page.tsx") return [];
        const source = fs.readFileSync(absolute, "utf8");
        if (!loaderNames.some((name) => source.includes(name))) return [];
        return [`/${path.relative(APP_DIR, directory).split(path.sep).join("/")}`];
      });
    const loaderPages = discoverPages(APP_DIR);
    expect(loaderPages).toEqual(expect.arrayContaining([
      "/va-forms/finder", "/secondary/evidence",
    ]));
    expect(loaderPages.filter((page) =>
      !REFERENCE_READ_PATHS.some((guarded) => guarded === page),
    )).toEqual([]);
  });

  it.each(REFERENCE_READ_PATHS)("limits GETs to %s before its loader runs", async (pathname) => {
    const send = () => proxy(new NextRequest(`https://example.test${pathname}`, {
      headers: { "x-forwarded-for": "203.0.113.61" },
    }));
    for (let i = 0; i < referenceReadLimiter.max; i += 1) {
      expect(send().status, `request ${i + 1}`).toBe(200);
    }
    const blocked = send();
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: "Too many requests. Please try again later.",
    });
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(blocked.headers.get("Content-Security-Policy")).toBeTruthy();
    expect(blocked.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it.each(REFERENCE_READ_PATHS)("charges HEADs to the same budget as GETs on %s", (pathname) => {
    const send = (method: string) => proxy(new NextRequest(`https://example.test${pathname}`, {
      method,
      headers: { "x-forwarded-for": "203.0.113.62" },
    }));
    for (let i = 0; i < referenceReadLimiter.max; i += 1) {
      expect(send(i % 2 === 0 ? "GET" : "HEAD").status).toBe(200);
    }
    expect(send("HEAD").status).toBe(429);
    expect(send("GET").status).toBe(429);
  });

  it.each(["/va-forms/finder", "/secondary/evidence"])(
    "charges a reference Server Action POST to the shared reference budget on %s",
    (pathname) => {
      // Audit A01 moved the Forms Finder search (and the locator form on the
      // workflow steps) to Server Action POSTs, so the request body carries the
      // text and the URL does not. The request still reaches the same reference
      // loader, so POST must consume this budget rather than sit outside it —
      // otherwise moving the search off the URL would have moved it off the
      // reference admission control instead.
      const send = (method: string) => proxy(new NextRequest(`https://example.test${pathname}`, {
        method,
        headers: { "x-forwarded-for": "203.0.113.67" },
      }));

      // Five Server Action POSTs...
      for (let i = 0; i < 5; i += 1) {
        expect(send("POST").status, `POST ${i + 1}`).toBe(200);
      }
      // ...leave exactly 25 of the 30 admissions for reads.
      for (let i = 0; i < referenceReadLimiter.max - 5; i += 1) {
        expect(send("GET").status, `GET ${i + 1}`).toBe(200);
      }
      expect(send("GET").status).toBe(429);
      expect(send("POST").status).toBe(429);
    },
  );

  it.each(["/va-forms/finder", "/secondary/evidence"])(
    "does not grant a fresh budget for query, slash, or RSC variants of %s",
    (pathname) => {
      const variants = [
        pathname,
        `${pathname}/?q=21-526EZ`,
        `${pathname}//?zip=12345`,
        `${pathname.replaceAll("/", "//")}?_rsc=probe`,
      ];
      for (let i = 0; i < referenceReadLimiter.max; i += 1) {
        const response = proxy(new NextRequest(
          `https://example.test${variants[i % variants.length]}`,
          { headers: { "x-forwarded-for": "203.0.113.63", rsc: "1" } },
        ));
        expect(response.status).toBe(200);
      }
      expect(proxy(new NextRequest(`https://example.test${pathname}?q=new-query`, {
        headers: { "x-forwarded-for": "203.0.113.63", "next-router-prefetch": "1" },
      })).status).toBe(429);
    },
  );

  it("shares the reference budget across routes but isolates attributed clients", () => {
    for (let i = 0; i < referenceReadLimiter.max; i += 1) {
      expect(proxy(new NextRequest(`https://example.test${REFERENCE_READ_PATHS[i % REFERENCE_READ_PATHS.length]}`, {
        headers: { "x-forwarded-for": "203.0.113.64" },
      })).status).toBe(200);
    }
    expect(proxy(new NextRequest("https://example.test/va-forms/finder", {
      headers: { "x-forwarded-for": "203.0.113.64" },
    })).status).toBe(429);
    expect(proxy(new NextRequest("https://example.test/va-forms/finder", {
      headers: { "x-forwarded-for": "203.0.113.65" },
    })).status).toBe(200);
  });

  it("does not consume the reference budget for unrelated pages or sibling paths", () => {
    for (const pathname of ["/", "/secondary/upload", "/va-forms/finder-extra", "/secondary/evidence-extra"]) {
      for (let i = 0; i < referenceReadLimiter.max + 1; i += 1) {
        expect(proxy(new NextRequest(`https://example.test${pathname}`, {
          headers: { "x-forwarded-for": "203.0.113.66" },
        })).status).toBe(200);
      }
    }
    expect(referenceReadLimiter.check("203.0.113.66").count).toBe(1);
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

/**
 * SEC-02's admission half, exercised at the boundary a client actually reaches.
 *
 * A per-client bucket is keyed on a header the client supplies, so the two
 * historical ways to opt out of admission were to send nothing usable (no key →
 * every limiter skipped) and to send a fresh value per request (a private bucket
 * each time, none of them saturated). Both are driven against the real proxy
 * here, with the shared ceiling tuned down so the assertions are about behaviour
 * rather than about how many requests a test can afford to send.
 */
describe("shared admission ceiling (SEC-02)", () => {
  const CEILING = 5;
  const REFUSAL_BODY = { error: "Too many requests. Please try again later." };

  beforeEach(() => {
    // Read through `process.env`, which is where the proxy reads it, and reset
    // the limiter that value selects — the real enforced one, not a stand-in.
    vi.stubEnv("RATE_LIMIT_UNATTRIBUTED_MAX", String(CEILING));
    unattributedAdmissionLimiter(process.env).reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    unattributedAdmissionLimiter().reset();
  });

  const send = (headers: Record<string, string>) =>
    proxy(new NextRequest("https://example.test/va-forms/finder", { headers }));

  it("bounds a request that presents no identity at all", async () => {
    for (let i = 0; i < CEILING; i += 1) {
      expect(send({}).status, `request ${i + 1}`).toBe(200);
    }
    const blocked = send({});
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual(REFUSAL_BODY);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(blocked.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(blocked.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("does not let a junk forwarding header buy unlimited admission", () => {
    for (let i = 0; i < CEILING; i += 1) {
      expect(send({ "x-forwarded-for": "not-an-ip" }).status).toBe(200);
    }
    expect(send({ "x-forwarded-for": "not-an-ip" }).status).toBe(429);
  });

  it("does not let a rotating valid IP buy unlimited admission", () => {
    for (let i = 0; i < CEILING; i += 1) {
      expect(send({ "x-forwarded-for": `203.0.113.${i}` }).status).toBe(200);
    }
    // A fresh, never-seen, syntactically valid key: it would have its own
    // untouched per-client bucket, so only the shared ceiling can refuse it.
    expect(send({ "x-forwarded-for": "203.0.113.200" }).status).toBe(429);
  });

  it("shares one ceiling across guarded surfaces rather than granting one each", () => {
    const paths = ["/va-forms/finder", "/secondary/evidence", "/va-forms", "/va-reference"];
    for (let i = 0; i < CEILING; i += 1) {
      const response = proxy(new NextRequest(`https://example.test${paths[i % paths.length]}`, {
        headers: {},
      }));
      expect(response.status, `request ${i + 1}`).toBe(200);
    }
    expect(proxy(new NextRequest("https://example.test/va-reference", {
      headers: { "x-forwarded-for": "198.51.100.7" },
    })).status).toBe(429);
  });

  it("does not charge unpoliced pages or take their requests away", () => {
    for (let i = 0; i < CEILING * 3; i += 1) {
      expect(proxy(new NextRequest("https://example.test/", { headers: {} })).status).toBe(200);
    }
    // Nothing was consumed, so a guarded surface still has its full budget.
    for (let i = 0; i < CEILING; i += 1) {
      expect(send({ "x-forwarded-for": "192.0.2.9" }).status).toBe(200);
    }
    expect(send({ "x-forwarded-for": "192.0.2.9" }).status).toBe(429);
  });
});

/**
 * `RATE_LIMIT_TRUSTED_INGRESS` as an **enforcement** switch, not a reporting
 * label (SEC-02).
 *
 * The unasserted rule keys on the hop the client writes, which is the correct
 * rule only for an ingress that overwrites the header. An ingress that *appends*
 * the observed peer needs the opposite end read, and that is what the declared
 * model changes — measured here through the real proxy rather than asserted from
 * the configuration.
 */
describe("declared ingress model (SEC-02)", () => {
  /** `healthLimiter`'s per-client max, so 31 requests must produce one refusal. */
  const CLIENT_BUDGET = 30;

  const sendHealth = (headers: Record<string, string>) =>
    proxy(new NextRequest("https://example.test/api/health", { headers }));

  beforeEach(() => {
    healthLimiter.reset();
    unattributedAdmissionLimiter(process.env).reset();
    clearAdmissionRefusalWindow();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    healthLimiter.reset();
    unattributedAdmissionLimiter().reset();
    clearAdmissionRefusalWindow();
  });

  it("keys an appending ingress on the ingress-observed hop, not the client's", () => {
    vi.stubEnv("RATE_LIMIT_TRUSTED_INGRESS", "append");

    for (let index = 0; index < CLIENT_BUDGET; index += 1) {
      const response = sendHealth({ "x-forwarded-for": `198.51.100.${index}, 203.0.113.7` });
      expect(response.status, `request ${index + 1}`).toBe(200);
    }

    // Every request carried a fresh client-written hop beside one constant
    // appended hop, so all 31 share one bucket and the last is refused.
    expect(sendHealth({ "x-forwarded-for": "198.51.100.250, 203.0.113.7" }).status).toBe(429);
  });

  it("reads the declared appender's hop when the client pads the header", () => {
    // `append:2` declares two appenders (a CDN and the app proxy), so the second
    // entry from the right is the app proxy's value. A client that pads the
    // header with its own rotating value in front of both cannot move the key.
    vi.stubEnv("RATE_LIMIT_TRUSTED_INGRESS", "append:2");

    const spoofed = (index: number) => `198.51.100.${index}, 203.0.113.7, 203.0.113.8`;
    for (let index = 0; index < CLIENT_BUDGET; index += 1) {
      expect(sendHealth({ "x-forwarded-for": spoofed(index) }).status, `request ${index + 1}`).toBe(
        200,
      );
    }
    expect(sendHealth({ "x-forwarded-for": spoofed(250) }).status).toBe(429);
  });

  // The contrast that makes the model mean something: without a claim the same
  // rotating hops each mint a bucket, which is exactly the A2 failure the runbook
  // records for an edge that passes the header through.
  it("still keys an unasserted deployment on the client's own hop", () => {
    for (let index = 0; index <= CLIENT_BUDGET; index += 1) {
      const response = sendHealth({ "x-forwarded-for": `198.51.100.${index}, 203.0.113.7` });
      expect(response.status, `request ${index + 1}`).toBe(200);
    }
  });

  // The inversion this closes: without a declared model an identity-less request is
  // admitted until the shared ceiling is spent, so hiding your identity bought a
  // bound far above the one a keyed client gets. Declaring the model charges the
  // class of identity-less requests to the surface's own budget instead.
  it("does not let an unidentified request draw on the whole ceiling", () => {
    vi.stubEnv("RATE_LIMIT_TRUSTED_INGRESS", "append");
    vi.stubEnv("RATE_LIMIT_UNATTRIBUTED_MAX", "5000");
    unattributedAdmissionLimiter(process.env).reset();

    for (let index = 0; index < CLIENT_BUDGET; index += 1) {
      const response = proxy(
        new NextRequest("https://example.test/api/health", { headers: {} }),
      );
      expect(response.status, `request ${index + 1}`).toBe(200);
    }
    expect(proxy(new NextRequest("https://example.test/api/health", { headers: {} })).status).toBe(
      429,
    );
    // The refusal is the class bucket, not the ceiling: the aggregate budget is
    // nowhere near spent, which is exactly what "no larger allowance" means here.
    expect(admissionRefusalWindowReport().byBudget).toEqual({
      ceiling: 0,
      perClient: 0,
      unidentified: 1,
    });
  });

  it("bounds a request that does not carry the declared hop count", () => {
    vi.stubEnv("RATE_LIMIT_TRUSTED_INGRESS", "append:2");
    vi.stubEnv("RATE_LIMIT_UNATTRIBUTED_MAX", "3");
    unattributedAdmissionLimiter(process.env).reset();

    // One hop where two appenders are declared: the request did not traverse the
    // ingress, so it is unattributed and bounded by the ceiling rather than keyed
    // on the value it sent. This is the observable form of the position check —
    // the ceiling refuses it after three charges, where an identity would have
    // had the full per-client budget.
    for (let index = 0; index < 3; index += 1) {
      expect(sendHealth({ "x-forwarded-for": "203.0.113.7" }).status, `request ${index + 1}`).toBe(
        200,
      );
    }
    expect(sendHealth({ "x-forwarded-for": "203.0.113.7" }).status).toBe(429);
  });
});
