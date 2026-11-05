import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it } from "vitest";

import nextConfig from "../next.config";
import {
  adminCacheClearLimiter,
  healthLimiter,
  referenceReadLimiter,
  regulatoryPreflightLimiter,
  workflowSessionLimiter,
} from "../src/lib/rate-limiter";
import { FORMS_FINDER_RATE_LIMITED_MESSAGE } from "@/lib/va/forms-finder-search";
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
  referenceReadLimiter.reset();
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
  it("leaves the OWASP baseline to next.config on successful proxy passes", async () => {
    const response = proxy(request("/secondary"));

    // One owner per response. next.config's headers() applies these to every
    // framework response; setting them here as well is not replaced but
    // concatenated by the OpenNext/Workers runtime, producing an invalid
    // `DENY, DENY` / repeated-directive HSTS value (the browser then ignores
    // XFO and may drop HSTS entirely).
    for (const key of [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
    ]) {
      expect(response.headers.get(key)).toBeNull();
    }

    const rules = (await nextConfig.headers?.()) ?? [];
    const baseline = rules.find((rule) => rule.source === "/:path*");
    const values = Object.fromEntries(
      (baseline?.headers ?? []).map((header) => [header.key, header.value]),
    );
    expect(values).toMatchObject({
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    });
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

  it("marks a rate-limited Forms Finder action as text/plain for the client", async () => {
    // Next only surfaces a non-RSC action error body when content-type is
    // exactly text/plain. JSON 429s became "unexpected response" and were
    // indistinguishable from an offline failure in the finder.
    const send = () =>
      proxy(
        new NextRequest(`${PROXY_URL}/va-forms/finder`, {
          method: "POST",
          headers: {
            "x-forwarded-for": TEST_CLIENT_IP,
            "next-action": "test-action-id",
          },
        }),
      );

    let blocked: Response | undefined;
    const attempts = Math.max(
      workflowSessionLimiter.max,
      referenceReadLimiter.max,
    ) + 1;
    for (let i = 0; i < attempts; i += 1) {
      blocked = send();
      if (blocked.status === 429) break;
    }

    expect(blocked?.status).toBe(429);
    if (!blocked) throw new Error("expected a rate-limited response");
    expect(blocked.headers.get("Content-Type")).toBe("text/plain");
    expect(await blocked.text()).toBe(FORMS_FINDER_RATE_LIMITED_MESSAGE);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(blocked.headers.get("Content-Security-Policy")).toContain("script-src");
  });
});

describe("CSP report endpoint scoping", () => {
  it("omits CSP and reporting headers on the report endpoint", () => {
    const response = proxy(request("/api/csp-report"));

    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Report-To")).toBeNull();
    expect(response.headers.get("Reporting-Endpoints")).toBeNull();
    // The baseline still reaches this path through next.config's headers()
    // (the real matcher excludes `/api/csp-report` from the proxy entirely).
    expect(response.headers.get("X-Content-Type-Options")).toBeNull();
    expect(response.headers.get("X-Frame-Options")).toBeNull();
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
