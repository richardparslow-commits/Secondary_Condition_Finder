import { NextRequest, NextResponse } from "next/server";

import {
  adminCacheClearLimiter,
  extractClientKey,
  healthLimiter,
  regulatoryPreflightLimiter,
  workflowSessionLimiter,
} from "@/lib/rate-limiter";

/**
 * Report-To group for CSP / Trusted-Types violation reporting.
 *
 * Violations POST (JSON) to /api/csp-report, which redacts every report to a
 * bounded, content-free event before anything is logged or counted — raw
 * report bodies (URLs with paths/queries, script samples) are never
 * persisted. Modern browsers use the Report-To endpoint; older ones use
 * report-uri; wiring both costs nothing and misses nothing.
 */
const CSP_REPORT_GROUP = "csp-endpoint";
const CSP_REPORT_ENDPOINT = "/api/csp-report";

function buildReportToJson(): string {
  return JSON.stringify({
    group: CSP_REPORT_GROUP,
    max_age: 10_886_400, // one week, in seconds
    endpoints: [{ url: CSP_REPORT_ENDPOINT }],
  });
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

  // --- Application-level rate limiting (defense-in-depth behind edge WAF) ---
  const clientKey = extractClientKey(requestHeaders);
  const method = request.method;

  // Server Action POSTs (Next.js form submissions to pages with server-only
  // directives) are rate-limited as workflow session writes.
  if (method === "POST" && !url.pathname.startsWith("/_next")) {
    const result = workflowSessionLimiter.check(clientKey);
    if (result.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
            "Content-Security-Policy": contentSecurityPolicy,
          },
        },
      );
    }
  }

  // Regulatory preflight sync (authenticated, expensive upstream refresh)
  if (url.pathname === "/api/regulatory/preflight") {
    const result = regulatoryPreflightLimiter.check(clientKey);
    if (result.limited) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
            "Content-Security-Policy": contentSecurityPolicy,
          },
        },
      );
    }
  }

  // Admin cache-clear endpoint (authenticated, destructive)
  if (url.pathname === "/api/admin/cache-clear") {
    const result = adminCacheClearLimiter.check(clientKey);
    if (result.limited) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
            "Content-Security-Policy": contentSecurityPolicy,
          },
        },
      );
    }
  }

  // Health endpoint (public, lightweight but should not be hammered)
  if (url.pathname === "/api/health") {
    const result = healthLimiter.check(clientKey);
    if (result.limited) {
      return NextResponse.json(
        { status: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
            "Content-Security-Policy": contentSecurityPolicy,
          },
        },
      );
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  if (!isCspReportRequest) {
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    response.headers.set("Reporting-Endpoints", buildReportToJson());
    response.headers.set("Report-To", buildReportToJson());
  }
  return response;
}

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
