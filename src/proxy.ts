import { NextRequest, NextResponse } from "next/server";

import {
  adminCacheClearLimiter,
  extractClientKey,
  healthLimiter,
  regulatoryPreflightLimiter,
  workflowSessionLimiter,
} from "@/lib/rate-limiter";

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
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  // --- Application-level rate limiting (defense-in-depth behind edge WAF) ---
  const clientKey = extractClientKey(requestHeaders);
  const url = new URL(request.url);
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
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
