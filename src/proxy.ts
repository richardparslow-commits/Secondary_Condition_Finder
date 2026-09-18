import { NextRequest, NextResponse } from "next/server";

import { findApiRouteLimitPolicy } from "@/lib/api-route-policies";
import { resolveClientKey, workflowSessionLimiter } from "@/lib/rate-limiter";

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
  // first-party innerHTML/document.write sinks) while the tesseract worker
  // keeps its required escape hatch. tesseract.js resolves its worker, WASM
  // core, and traineddata through Blob/blob-URL paths on some
  // configuration/code paths, and its worker script uses string-to-DOM
  // patterns that TT blocks — without a policy, the OCR pipeline dies in
  // browsers with TT enabled. Scope the allowance narrowly: same-origin
  // window URLs for assets served from /tesseract/* + a data-policy for the
  // engine's internal data: documents, and deny others.
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
        // verified in the pinned bundle). Framework (`nextjs`) and DOMPurify
        // names remain allowlisted for forward compatibility.
        "trusted-types 'nextjs' 'dompurify' default",
        "'allow-duplicates'",
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
    "worker-src 'self' blob:",
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
  // A request carrying no trustworthy client identity is not charged to a bucket
  // at all. Every unattributed request used to share one `"unknown"` bucket,
  // which silently turned the configured per-IP allowance into a *global* cap
  // that a single client could exhaust on everyone else's behalf. Those requests
  // now proceed unthrottled: capacity is the edge WAF's job, and an absent
  // limiter is a better instrument for it than a mislabelled global cap. See
  // `resolveClientKey` in `rate-limiter.ts` for the resolution rules.
  const client = resolveClientKey(requestHeaders);
  const method = request.method;

  /** 429 response carrying the full security-header set, not just CSP. */
  const tooManyRequests = (
    body: Record<string, unknown>,
    retryAfterSeconds: number,
  ) =>
    NextResponse.json(body, {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        ...buildSecurityHeaders(nonce, contentSecurityPolicy, {
          includeCsp: !isCspReportRequest,
        }),
      },
    });

  if (client.key) {
    // Method-scoped rule, not a route rule: this covers every POST that is not a
    // Next.js asset request, including Server Action form submissions to pages
    // with server-only directives *and* API POSTs. An API POST therefore consumes
    // this bucket as well as its own route policy below.
    if (method === "POST" && !pathname.startsWith("/_next")) {
      const result = workflowSessionLimiter.check(client.key);
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
      const result = routePolicy.limiter.check(client.key);
      if (result.limited) {
        return tooManyRequests(routePolicy.limitedBody, result.retryAfterSeconds);
      }
    }
  }

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
  return response;
}

export default proxy;

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|api/csp-report).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
