/**
 * CSRF defense-in-depth validation.
 *
 * Next.js Server Actions already provide built-in CSRF protection via
 * encrypted action IDs and SameSite=Strict cookies. This module adds an
 * explicit Origin/Referer header check as defense-in-depth — a secondary
 * layer that catches misconfigurations or framework bypasses.
 *
 * Status: this helper currently has no production callers. Next.js Server
 * Actions are the protected mutation boundary; this module is retained as
 * reviewed defense-in-depth and must be tested behind the deployed host/proxy
 * configuration before being wired into any request path.
 *
 * Usage (in Server Actions or middleware):
 *   import { validateRequestOrigin } from "@/lib/security/csrf";
 *   const result = validateRequestOrigin(headers);
 *   if (!result.ok) return redirect(result.redirectPath);
 */

import { createLogger } from "@/lib/observability/logger";

const logger = createLogger("csrf");

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
];

export interface CsrfValidationResult {
  ok: boolean;
  /** Path to redirect to on failure (includes error code). */
  redirectPath?: string;
  /** Reason for rejection (for logging). */
  reason?: string;
}

/**
 * Validate that a request originates from the same application.
 *
 * Checks Origin and Referer headers against the expected production origin.
 * In development, localhost origins are also accepted.
 *
 * This is a defense-in-depth layer — it does NOT replace Next.js's built-in
 * CSRF protection (encrypted action IDs, SameSite=Strict cookies). It catches
 * edge cases where those protections might be bypassed (e.g., misconfigured
 * reverse proxies, cookie stripping).
 *
 * @param headers - Request headers (from NextRequest or Server Action context)
 * @param expectedOrigin - Production origin (default: from VERCEL_URL or window.location)
 * @returns Validation result with ok/reason/redirectPath
 */
export function validateRequestOrigin(
  headers: Headers,
  expectedOrigin?: string,
): CsrfValidationResult {
  const isProduction = process.env.NODE_ENV === "production";

  // In production, we require a valid Origin or Referer.
  // In development, we're more lenient (localhost is always accepted).
  const origin = headers.get("origin");
  const referer = headers.get("referer");

  // --- Origin header check ---
  if (origin) {
    const parsed = safeParseOrigin(origin);
    if (!parsed) {
      return reject(`invalid-origin-header`);
    }

    if (isProduction) {
      const prodOrigin = expectedOrigin ?? productionOrigin();
      if (!prodOrigin) {
        // Unresolved production origin: fail closed instead of accepting any
        // Origin because the deployment URL variables are missing.
        logger.warn("CSRF origin unresolved");
        return reject(`origin-unresolved`);
      }
      if (parsed.origin !== prodOrigin) {
        logger.warn("CSRF origin mismatch", {
          origin: parsed.origin,
          expected: prodOrigin,
        });
        return reject(`origin-mismatch`);
      }
    } else {
      // Development: accept localhost origins
      if (!DEV_ORIGINS.includes(parsed.origin)) {
        logger.warn("CSRF origin not in dev allowlist", {
          origin: parsed.origin,
        });
        return reject(`origin-not-in-dev-allowlist`);
      }
    }

    return { ok: true };
  }

  // --- Referer header check (fallback when Origin is absent) ---
  if (referer) {
    const parsed = safeParseOrigin(referer);
    if (!parsed) {
      return reject(`invalid-referer-header`);
    }

    if (isProduction) {
      const prodOrigin = expectedOrigin ?? productionOrigin();
      if (!prodOrigin) {
        logger.warn("CSRF referer unresolved");
        return reject(`referer-unresolved`);
      }
      if (parsed.origin !== prodOrigin) {
        logger.warn("CSRF referer mismatch", {
          referer: parsed.origin,
          expected: prodOrigin,
        });
        return reject(`referer-mismatch`);
      }
    } else {
      if (!DEV_ORIGINS.includes(parsed.origin)) {
        return reject(`referer-not-in-dev-allowlist`);
      }
    }

    return { ok: true };
  }

  // --- No Origin or Referer header ---
  // Browser-initiated state changes always carry one of these. A missing
  // header in production cannot be distinguished from a stripped or forged
  // request, so it fails closed rather than relying on Next.js action IDs
  // alone; development keeps the permissive behavior for curl/server-to-server
  // tooling. This function is currently a defense-in-depth helper with no
  // production call sites, and its contract must not be "allow by default".
  if (isProduction) {
    logger.warn("CSRF: no Origin or Referer header on request");
    return reject("missing-origin-and-referer");
  }

  return { ok: true };
}

function reject(reason: string): CsrfValidationResult {
  return {
    ok: false,
    redirectPath: `/secondary?error=csrf-validation-failed`,
    reason,
  };
}

function safeParseOrigin(value: string): { origin: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { origin: url.origin };
  } catch {
    return null;
  }
}

function productionOrigin(): string | null {
  // APP_URL (the canonical deployment origin, e.g. a custom domain) wins over
  // the deployment-specific VERCEL_URL, so validation compares against the
  // origin users actually visit rather than a per-deployment hostname.
  const appUrl = process.env.APP_URL;
  if (appUrl) return appUrl;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return null;
}
