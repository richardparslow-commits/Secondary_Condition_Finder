import { NextRequest, NextResponse } from "next/server";

import { findApiRouteLimitPolicy } from "@/lib/api-route-policies";
import {
  chargeAdmission,
  referenceReadLimiter,
  resolveClientKey,
  workflowSessionLimiter,
} from "@/lib/rate-limiter";
import {
  guardPrivateContextRequest,
  privateContextRefusalBody,
  type PrivateContextRefusal,
} from "@/lib/security/private-context-request-guard";

/**
 * CSP / Trusted-Types violation reporting target.
 *
 * Violations POST (JSON) to /api/csp-report, which redacts every report to a
 * bounded, content-free event before anything is logged or counted — raw
 * report bodies (URLs with paths/queries, script samples) are never
 * persisted. Modern browsers use the Reporting-Endpoints dictionary; older
 * ones use report-uri; wiring both costs nothing and misses nothing.
 */
const CSP_REPORT_GROUP = "csp-endpoint";
const CSP_REPORT_ENDPOINT = "/api/csp-report";

/**
 * PRIV-01 stage 3 (2026-10-07): the legacy `secondary-workflow-v2` cookie is
 * retired. Nothing reads it, but a browser that still presents one may hold
 * veteran health context (diagnoses, ratings, medications, history), so every
 * response that sees the cookie carries a path-scoped tombstone that deletes
 * it. Both the app's historical `/secondary` path and a `/` path (written by
 * an older maintainer screenshot tool) are cleared.
 */
const RETIRED_SECONDARY_WORKFLOW_COOKIE = "secondary-workflow-v2";

/**
 * PRIV-01 follow-on (2026-10-08): the `presumptive-workflow-v1` cookie is
 * retired with the `saveServiceHistory` Server Action that wrote it. Confirmed
 * service locations, branches and dates are now browser-local, nothing reads
 * this cookie, and a browser that still presents one is tombstoned on the path
 * its writer scoped.
 */
const RETIRED_PRESUMPTIVE_WORKFLOW_COOKIE = "presumptive-workflow-v1";

/**
 * Retired cookie name → every historical path that could still hold one. The
 * secondary cookie is cleared on both the app path and a `/` path written by
 * an older maintainer screenshot tool; the presumptive writer only ever scoped
 * `/presumptive`.
 */
const RETIRED_WORKFLOW_COOKIES: readonly (readonly [string, readonly string[]])[] = [
  [RETIRED_SECONDARY_WORKFLOW_COOKIE, ["/secondary", "/"]],
  [RETIRED_PRESUMPTIVE_WORKFLOW_COOKIE, ["/presumptive"]],
];

/**
 * Serialize an expired tombstone for one historical path. Written directly to
 * the header list instead of `response.cookies.set` because several tombstones
 * share a cookie name and the framework helper collapses them onto one
 * Set-Cookie header, which would leave the other path's cookie alive.
 */
function retiredWorkflowCookieTombstone(cookie: string, path: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${cookie}=`,
    `Path=${path}`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ") + secure;
}

/**
 * `Reporting-Endpoints` value in the **dictionary syntax required by the
 * Fetch standard** (the same shape Service-Worker and Report-To consumers
 * parse). This header takes endpoint name → URL pairs, NOT the JSON array
 * the older `Report-To` header uses. Assigning the JSON array here made the
 * whole header value invalid, so conforming browsers silently dropped the
 * reporting endpoint and CSP violations were never delivered.
 */
const REPORTING_ENDPOINTS_VALUE = `${CSP_REPORT_GROUP}="${CSP_REPORT_ENDPOINT}"`;

/**
 * `Report-To` value in its JSON-array syntax (`ReportTo` header from the
 * Reporting API v1 draft, still parsed by older engines and some
 * intermediaries). Kept alongside the modern dictionary header so both
 * generations of reporting clients resolve the same endpoint.
 */
function buildReportToJson(): string {
  return JSON.stringify({
    group: CSP_REPORT_GROUP,
    max_age: 10_886_400, // one week, in seconds
    endpoints: [{ url: CSP_REPORT_ENDPOINT }],
  });
}

/**
 * Normalize a URL pathname for security decisions (rate limiting):
 *
 * - collapse repeated slashes (`//api//health` → `/api/health`), and
 * - strip trailing slashes (`/api/health/` → `/api/health`), including the
 *   duplicate-slash trailing variant (`/api/health//`).
 *
 * Strict-equality checks against the raw `url.pathname` were bypassable:
 * an attacker appending a trailing slash (or doubling slashes) evaded the
 * per-endpoint limiters entirely while still hitting the route. The root
 * path `"/"` must normalize to itself so it does not become an empty string.
 */
function normalizePathname(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
}

/**
 * OWASP-recommended transport/browser hardening headers, aligned 1:1 with
 * `next.config.ts` `securityHeaders` (which applies them to framework-
 * rendered responses). Middleware-constructed responses — notably the 429
 * rate-limit blocks below — never flow through the config `headers()`
 * pipeline, so they must carry the same headers here. Values are kept
 * byte-identical to the config to avoid duplicate-header drift: when two
 * header instances are present, browsers honour the first for
 * `Strict-Transport-Security` (RFC 6797) and ignore `X-Frame-Options`
 * duplicates, so a *weaker* duplicate would silently downgrade protection.
 *
 * `Referrer-Policy` intentionally uses `no-referrer` (stricter than the
 * common `strict-origin-when-cross-origin` baseline) to match the config.
 */
const STANDARD_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

/**
 * Build the full downstream security-header set for a response.
 *
 * `Content-Security-Policy` and the reporting headers are omitted for
 * requests to the CSP report endpoint itself: the browser must not receive a
 * reporting policy from a violation report response (it would loop
 * report→violation→report), and the endpoint accepts JSON posts — it never
 * renders HTML, so a nonce is meaningless there.
 */
function buildSecurityHeaders(
  nonce: string,
  contentSecurityPolicy: string,
  options: { includeCsp: boolean },
): Record<string, string> {
  const headers: Record<string, string> = { ...STANDARD_SECURITY_HEADERS };
  if (options.includeCsp) {
    headers["Content-Security-Policy"] = contentSecurityPolicy;
    headers["Report-To"] = buildReportToJson();
    headers["Reporting-Endpoints"] = REPORTING_ENDPOINTS_VALUE;
  }
  return headers;
}

function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";
  const scriptSource = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    // Narrow WASM allowance for the browser-local OCR core (tesseract.js).
    // Permits WebAssembly compilation only, not general eval.
    "'wasm-unsafe-eval'",
  ].join(" ");
  const connectSource = isDevelopment
    ? "connect-src 'self' ws: wss:"
    : "connect-src 'self'";

  // Trusted Types: sink XSS is closed for first-party code (the repo has no
  // first-party innerHTML/document.write sinks). The one library that reaches
  // a TT sink is tesseract.js v6 (pinned): it has no createPolicy calls of its
  // own and constructs its OCR worker from a plain string, so the gated
  // `default` policy below is its escape hatch. That policy is deliberately
  // narrow: same-origin http(s) script URLs only (framework chunks and the
  // direct `/tesseract/worker.min.js` spawn ride the same gate; blob/data/
  // javascript/cross-origin refused). The worker itself loads its WASM core
  // via importScripts and traineddata via fetch inside its own realm, so no
  // further CSP allowance is needed.
  //
  // Enforced in production only: React's development-mode eval and the
  // Turbopack dev chunk loader both violate require-trusted-types-for
  // (verified in headless Chrome), and local dev already runs with
  // 'unsafe-eval'. Enforcement here adds no security value to a developer's
  // own machine while breaking the toolchain.
  const trustedTypesDirectives = isDevelopment
    ? []
    : [
        "require-trusted-types-for 'script'",
        // Policy names are unquoted allowlist tokens. `default` lets the
        // TrustedTypesGate component open a strictly gated, same-origin
        // fallback for libraries that are not TT-aware (tesseract.js v6 has
        // no createPolicy calls and builds its worker from a plain string —
        // verified in the pinned bundle).
        //
        // Framework policy names are deliberately NOT allowlisted. They were
        // emitted quoted (`'nextjs' 'dompurify'`) and Chrome rejected the
        // quoted tokens as invalid policy names on every production page load
        // — so they were pure console noise, and `createPolicy('nextjs')`
        // threw "Policy disallowed" regardless (verified in the production
        // build). Next.js's lazy route loader tolerates that failure and its
        // plain chunk URLs then ride the strict `default` policy (same-origin
        // only) — client-side navigation was verified violation-free under
        // exactly that configuration. If a future Next.js version requires
        // its own policy, add `nextjs` UNQUOTED (and re-verify navigation).
        //
        // 'allow-duplicates' is a keyword *within* the trusted-types
        // directive's value list, not a directive of its own: emitting it as
        // a separate directive makes it unknown-and-ignored, so a duplicate
        // policy creation still throws where the keyword was meant to allow it.
        "trusted-types default 'allow-duplicates'",
      ];

  return [
    "default-src 'self'",
    scriptSource,
    "script-src-attr 'none'",
    // Inline styles are retained because this audit item concerns script execution;
    // React/Next UI styles are not converted to a nonce contract in this change.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    connectSource,
    // Workers load from same-origin script URLs only: Tesseract is spawned
    // with `workerBlobURL: false` (direct /tesseract/worker.min.js) because
    // production Trusted Types refuses the library's default blob wrapper.
    // `blob:` is deliberately absent so a regression to blob spawning fails
    // in every browser, not only Trusted-Types-enforcing ones.
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    ...trustedTypesDirectives,
    "report-uri /api/csp-report",
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

/**
 * Edge proxy entry point (Next.js 16 convention).
 *
 * In Next.js 16 the `middleware.ts` file convention and its `middleware`
 * export were **renamed** to `proxy.ts` / `proxy` (see the Next.js
 * "Migration to Proxy" guide); the previous names are only a
 * backwards-compatibility shim on the deprecated path. This file must
 * therefore export `proxy` — renaming it to `middleware` would make the
 * runtime silently skip this module on every request, dropping the CSP,
 * nonce, and rate limiting entirely. The additional default export keeps the
 * module invocable under either convention and is what Next resolves for
 * `proxy.ts` module loading.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const url = new URL(request.url);
  // Violation reports themselves must never carry the reporting policy (the
  // browser would otherwise loop report→violation→report) and don't need the
  // nonce (the endpoint accepts JSON posts, it doesn't render HTML).
  const isCspReportRequest = url.pathname === CSP_REPORT_ENDPOINT;
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (!isCspReportRequest) {
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  }

  // Normalized once per request so every limiter below compares against the
  // canonical path rather than a client-controlled raw pathname.
  const pathname = normalizePathname(url.pathname);

  // --- Application-level rate limiting (defense-in-depth behind edge WAF) ---
  //
  // Identity is a *validated* IP literal from a forwarding header, or nothing.
  // Unattributed requests are no longer skipped: `chargeAdmission` always charges
  // the shared admission ceiling, and charges a per-client bucket only when an
  // identity exists. A client therefore cannot avoid admission control by
  // sending a junk or rotating `X-Forwarded-For`, and the ceiling is reported as
  // its own budget (`rateLimitScope`), never as a relabelled per-IP allowance.
  // See `resolveClientKey` and `chargeAdmission` in `rate-limiter.ts`.
  const client = resolveClientKey(requestHeaders);
  const method = request.method;

  /**
    * Deletes any still-present retired workflow cookie on the way out. Each
    * tombstone mirrors the attributes the legacy writer used (httpOnly,
    * SameSite=Strict, secure only in production) so the browser accepts the
    * deletion from the same origin that stored it. Expired empty values on every
    * historical path remove the app-written cookies and the older
    * maintainer-tool one (path `/`) alike.
   */
  const clearRetiredWorkflowCookie = (response: NextResponse): NextResponse => {
    for (const [cookie, paths] of RETIRED_WORKFLOW_COOKIES) {
      if (!request.cookies.has(cookie)) continue;
      for (const path of paths) {
        response.headers.append(
          "Set-Cookie",
          retiredWorkflowCookieTombstone(cookie, path),
        );
      }
    }
    return response;
  };

  /** 429 response carrying the full security-header set, not just CSP. */
  const tooManyRequests = (
    body: Record<string, unknown>,
    retryAfterSeconds: number,
  ) =>
    clearRetiredWorkflowCookie(
      NextResponse.json(body, {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          ...buildSecurityHeaders(nonce, contentSecurityPolicy, {
            includeCsp: !isCspReportRequest,
          }),
        },
      }),
    );

  /**
   * 400 for a request carrying veteran health context (PRIV-01). Carries the
   * standard security headers and still deletes a stale retired cookie, so a
   * refused request cannot leave the legacy payload in place.
   */
  const refusePrivateContext = (refusal: PrivateContextRefusal) =>
    clearRetiredWorkflowCookie(
      NextResponse.json(privateContextRefusalBody(refusal), {
        status: refusal.status,
        headers: buildSecurityHeaders(nonce, contentSecurityPolicy, {
          includeCsp: !isCspReportRequest,
        }),
      }),
    );

  // Admission control runs on every limited surface, attributed or not: a
  // request cannot opt out by omitting identity, because `chargeAdmission`
  // charges the shared ceiling first and the per-client bucket only when a
  // validated identity exists. See `rate-limiter.ts` (SEC-02).

  // Method-scoped rule, not a route rule: this covers every POST that is not a
  // Next.js asset request, including Server Action form submissions to pages
  // with server-only directives *and* API POSTs. An API POST therefore consumes
  // this bucket as well as its own route policy below.
  if (method === "POST" && !pathname.startsWith("/_next")) {
    const result = chargeAdmission(workflowSessionLimiter, client.key);
    if (result.limited) {
      return tooManyRequests(
        { error: "Too many requests. Please try again later." },
        result.retryAfterSeconds,
      );
    }
  }

  // Public dynamic reference reads (forms search, accredited-representative
  // lookup) reach upstream VA quota and must be bounded even though the
  // workflow limiter above only covers POSTs and the registry below only
  // matches `/api/*` routes. HEAD can execute the same page loader as GET,
  // so it consumes the same budget. Query/RSC/prefetch variants are not exempt.
  //
  // POST is included because the Forms Finder search is a Server Action now
  // (audit A01): the visitor's text travels in the request body instead of the
  // URL, and the request still reaches the same reference loader. Leaving POST
  // out would have moved the search off the reference budget rather than off
  // the URL, which is the regression this branch exists to prevent. A reference
  // POST therefore consumes both this budget and the method-scoped POST bucket.
  // Pinned by the page-loader inventory and behavioral coverage tests in
  // tests/api-route-rate-limit-coverage.test.ts (SEC-02).
  if (
    (method === "GET" || method === "HEAD" || method === "POST") &&
    (pathname === "/va-forms" ||
      pathname === "/va-forms/finder" ||
      pathname === "/va-reference" ||
      pathname === "/va-reference/service-branches" ||
      pathname === "/presumptive" ||
      pathname === "/presumptive/results" ||
      pathname === "/secondary/suggestions" ||
      pathname === "/secondary/evidence" ||
      pathname === "/va-account" ||
      pathname.startsWith("/va-account/oauth/"))
  ) {
    const result = chargeAdmission(referenceReadLimiter, client.key);
    if (result.limited) {
      return tooManyRequests(
        { error: "Too many requests. Please try again later." },
        result.retryAfterSeconds,
      );
    }
  }

  // Route-scoped policies. The registry in `api-route-policies.ts` is the only
  // place that knows which routes are limited and what each one answers on
  // rejection, so this loop is all the wiring a new policed route needs.
  //
  // Matched against the *normalized* pathname, never the raw `url.pathname`:
  // the compiled patterns are anchored (`^/api/health$`), so a trailing or
  // doubled slash would slip past the registry while still reaching the route,
  // which is the bypass `normalizePathname` exists to close.
  const routePolicy = findApiRouteLimitPolicy(pathname);
  if (routePolicy) {
    const result = chargeAdmission(routePolicy.limiter, client.key);
    if (result.limited) {
      return tooManyRequests(routePolicy.limitedBody, result.retryAfterSeconds);
    }
  }

  // --- PRIV-01: refuse any request that carries veteran health context ---
  //
  // The workflow is browser-local
  // (docs/privacy-acceptance-contract-2026-10-07.md), so no server path needs
  // these values, and the only shapes that still supply them are retired
  // transports: a stale bookmark or cached form carrying the pre-PRIV-01 flat
  // fields, or a write method aimed at a workflow step page that no longer has
  // a Server Action. Both are refused before any loader runs, and the refusal
  // names at most one constant parameter name — never a value. The parameter
  // rule applies on every path (the contract's prohibited flow names no route);
  // the write rule applies to the workflow area only, because other tracks
  // still POST their own Server Actions.
  //
  // Deliberately evaluated AFTER the limiters: admission control stays in
  // front, so a refused write is still charged to its bucket (refusal must not
  // become an unthrottled endpoint) and the ordered POST rule keeps its
  // existing coverage.
  const privateContextRefusal = guardPrivateContextRequest(
    method,
    pathname,
    url.searchParams.keys(),
  );
  if (privateContextRefusal) return refusePrivateContext(privateContextRefusal);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  if (!isCspReportRequest) {
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    response.headers.set("Report-To", buildReportToJson());
    response.headers.set("Reporting-Endpoints", REPORTING_ENDPOINTS_VALUE);
  }
  for (const [key, value] of Object.entries(STANDARD_SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return clearRetiredWorkflowCookie(response);
}

export default proxy;

export const config = {
  matcher: [
    {
      // No `missing` conditions: skipping any request by header (prefetch or
      // otherwise) let an ordinary GET with `next-router-prefetch: 1` reach
      // the app with no CSP and no security headers. Prefetch requests are
      // cheap to serve and must still carry the mandatory policy; optional
      // per-route limits below remain independent of this matcher.
      source: "/((?!_next/static|_next/image|favicon.ico|api/csp-report).*)",
    },
  ],
};
