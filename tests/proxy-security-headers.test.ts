import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it } from "vitest";

import {
  adminCacheClearLimiter,
  healthLimiter,
  regulatoryPreflightLimiter,
  workflowSessionLimiter,
} from "../src/lib/rate-limiter";
import proxy, { proxy as namedProxy } from "../src/proxy";

/**
 * Regression contracts for the hardened edge proxy (src/proxy.ts).
 *
 * Each test corresponds to a defect class fixed in the hardening pass:
 * reporting-header syntax, rate-limit path-normalization bypasses, missing
 * security headers on 429 responses, and the Next 16 `proxy` export
 * convention. These are behavioral tests against the real middleware
 * function — no source-text assertions.
 */

const PROXY_URL = "https://example.test";

/**
 * A fixed test-client IP, sent on every request this file makes.
 *
 * The limiter charges a bucket only for an attributed client: without a
 * forwarding header `resolveClientKey` returns `key: null` and the request is
 * passed through rather than collapsed into a shared "unknown" bucket. These
 * tests are about path normalization and the shape of 429 responses, so they
 * attribute one constant client to keep every route-spelling variant charging
 * the same budget. Identity resolution itself — including the unattributed
 * pass-through — is covered by `rate-limiter.test.ts` and
 * `api-route-rate-limit-coverage.test.ts`.
 */
const TEST_CLIENT_IP = "203.0.113.7";

function request(path: string, method = "GET"): NextRequest {
  return new NextRequest(`${PROXY_URL}${path}`, {
    method,
    headers: { "x-forwarded-for": TEST_CLIENT_IP },
  });
}

/** Limiter state is process-global; isolate every test's budget. */
beforeEach(() => {
  healthLimiter.reset();
  regulatoryPreflightLimiter.reset();
  adminCacheClearLimiter.reset();
  workflowSessionLimiter.reset();
});

describe("reporting header syntax", () => {
  it("emits Reporting-Endpoints as a dictionary, not a JSON array", () => {
    const response = proxy(request("/secondary"));

    const value = response.headers.get("Reporting-Endpoints");
    expect(value).not.toBeNull();
    // Dictionary syntax: name="url" — the previous implementation assigned
    // the Report-To JSON array here, which conforming browsers drop.
    expect(value).toBe('csp-endpoint="/api/csp-report"');
    expect(value?.trim().startsWith("[") || value?.trim().startsWith("{")).toBe(
      false,
    );
  });

  it("emits Report-To as the JSON array its header definition requires", () => {
    const response = proxy(request("/secondary"));

    const raw = response.headers.get("Report-To");
    expect(raw).not.toBeNull();
    const parsed: unknown = JSON.parse(raw ?? "");
    expect(parsed).toMatchObject({
      group: "csp-endpoint",
      endpoints: [{ url: "/api/csp-report" }],
    });
    expect(String(raw)).toContain("max_age");
  });
});

describe("rate-limit path normalization", () => {
  it("rate-limits /api/health across trailing and duplicate slash variants", () => {
    // healthLimiter allows 30/minute. Spread the budget across bypass
    // spellings of the same route; under strict-equality matching each
    // spelling skipped the limiter entirely.
    const variants = [
      "/api/health",
      "/api/health/",
      "/api/health//",
      "//api/health",
      "//api//health",
    ];
    let last: Response | undefined;
    for (let i = 0; i < 31; i++) {
      last = proxy(request(variants[i % variants.length]));
    }
    expect(last?.status).toBe(429);
  });

  it("returns 200 until the budget is exhausted, then 429", () => {
    // regulatoryPreflightLimiter allows 5/minute.
    for (let i = 0; i < 5; i++) {
      expect(proxy(request("/api/regulatory/preflight")).status).toBe(200);
    }
    expect(proxy(request("/api/regulatory/preflight/")).status).toBe(429);
  });

  it("rate-limits /api/admin/cache-clear across path variants", () => {
    const variants = [
      "/api/admin/cache-clear",
      "/api/admin/cache-clear/",
      "//api/admin/cache-clear",
    ];
    let last;
    for (let i = 0; i < 6; i++) {
      last = proxy(request(variants[i % variants.length]));
    }
    expect(last?.status).toBe(429);
  });

  it("treats the root path as itself after normalization", () => {
    // "/" must not normalize to an empty string or otherwise break routing.
    const response = proxy(request("/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
  });
});

describe("security headers on every response", () => {
  it("attaches the OWASP baseline to successful proxy passes", () => {
    const response = proxy(request("/secondary"));

    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    // Matches next.config.ts's (stricter) Referrer-Policy so responses never
    // carry conflicting duplicate values depending on their origin.
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("attaches CSP and both reporting headers to 429 rate-limit blocks", async () => {
    let blocked: Response | undefined;
    for (let i = 0; i < 6; i++) {
      blocked = proxy(request("/api/regulatory/preflight"));
    }
    expect(blocked?.status).toBe(429);
    if (!blocked) {
      throw new Error("expected a rate-limited response");
    }

    const headers = blocked.headers;
    const csp = headers.get("Content-Security-Policy");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("'strict-dynamic'");
    expect(headers.get("Report-To")).toContain("csp-endpoint");
    expect(headers.get("Reporting-Endpoints")).toBe(
      'csp-endpoint="/api/csp-report"',
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(Number(headers.get("Retry-After"))).toBeGreaterThan(0);

    await blocked.json();
  });

  it("keeps 429 JSON bodies intact for clients", async () => {
    let blocked: Response | undefined;
    for (let i = 0; i < 6; i++) {
      blocked = proxy(request("/api/admin/cache-clear"));
    }
    const body = (await blocked?.json()) as { ok?: boolean; error?: string };
    if (!body) {
      throw new Error("expected a JSON body from the rate-limited response");
    }
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Rate limit exceeded");
  });
});

describe("CSP report endpoint scoping", () => {
  it("omits CSP and reporting headers on the report endpoint but keeps the baseline", () => {
    const response = proxy(request("/api/csp-report"));

    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Report-To")).toBeNull();
    expect(response.headers.get("Reporting-Endpoints")).toBeNull();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });
});

describe("Next 16 proxy export convention", () => {
  it("exports the entry point under the proxy convention (default and named)", () => {
    // Next.js 16 renamed middleware.ts/proxy export — this file is the
    // proxy.ts convention. The named `middleware` export of Next <=15 must
    // NOT exist here; the default export plus named `proxy` both resolve.
    expect(typeof namedProxy).toBe("function");
    expect(namedProxy).toBe(proxy);
  });
});
