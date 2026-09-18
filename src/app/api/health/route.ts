import { NextResponse } from "next/server";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { rateLimitScope } from "@/lib/rate-limiter";
import { openSessionPayload, sealSessionPayload } from "@/lib/workflow-session-crypto";
import { loadVaApiConfig } from "@/lib/va/sandbox";
import { getCircuitSnapshot } from "@/lib/va/circuit-breaker";
import {
  peekCacheCounters,
  vaReferenceCacheScope,
} from "@/lib/va/reference-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ComponentCheck {
  status: "ok" | "error";
  latencyMs: number;
  detail?: string;
}

async function checkCatalog(): Promise<ComponentCheck & { count?: number }> {
  const started = Date.now();
  try {
    const catalog = loadConditionCatalog();
    return { status: "ok", latencyMs: Date.now() - started, count: catalog.length };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkSessionCrypto(): Promise<ComponentCheck> {
  const started = Date.now();
  try {
    const probe = { kind: "health-probe", version: 1, at: Date.now() };
    // Use an ephemeral secret for the probe so health never depends on env config.
    const secret = "health-probe-ephemeral-secret-32-plus-characters-long";
    const sealed = sealSessionPayload(probe, secret);
    const opened = openSessionPayload(sealed, secret) as typeof probe | null;
    if (!opened || opened.kind !== probe.kind) throw new Error("Session crypto round-trip failed");
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkVaConfig(): ComponentCheck & { enabled?: boolean; environment?: string | null } {
  const started = Date.now();
  try {
    const config = loadVaApiConfig();
    const detail = config.enabled
      ? `enabled (${config.environment}) — live integration requires shared coordinator in production`
      : `disabled (${config.environment}) — local fallback active`;
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      enabled: config.enabled,
      environment: config.environment ?? null,
      detail,
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * GET /api/health
 *
 * Health check endpoint used by Vercel monitoring and the production readiness
 * workflow. Returns component-level status for catalog, session crypto, VA API
 * config, and circuit breaker state.
 *
 * Response schema (see docs/api-specification.md):
 * - status: "healthy" | "degraded"
 * - components.catalog: { status, latencyMs, count?, detail? }
 * - components.sessionCrypto: { status, latencyMs, detail? }
 * - components.vaConfig: { status, latencyMs, enabled?, environment?, detail? }
 * - components.circuitBreaker: { status, latencyMs, detail, snapshot }
 * - components.vaReferenceCache: { scope, detail, hits, misses, hitRate } —
 *   `scope: "disabled"` means the counters are structurally frozen at zero and
 *   must not be read as "a cache that has not been used yet"
 * - components.rateLimit: { status, latencyMs, scope, detail } — whether
 *   application-level rate limiting is per-instance here, since the effective
 *   limit scales with instance count and is not otherwise observable
 * - latencyMs: total endpoint latency
 * - timestamp: ISO 8601
 *
 * HTTP 200 when catalog + sessionCrypto are ok; 503 when either is error.
 */
export async function GET() {
  const started = Date.now();

  try {
    const [catalog, sessionCrypto] = await Promise.all([checkCatalog(), checkSessionCrypto()]);
    const vaConfig = checkVaConfig();
    const circuit = getCircuitSnapshot();
    const cacheCounters = peekCacheCounters();
    const cacheScope = vaReferenceCacheScope();
    const rateLimit = rateLimitScope();

    const components = {
      catalog,
      sessionCrypto,
      vaConfig,
      circuitBreaker: {
        status: "ok" as const,
        latencyMs: 0,
        detail: `va-forms:${circuit["va-forms"].state} benefits-reference-data:${circuit["benefits-reference-data"].state} accredited-representatives:${circuit["accredited-representatives"].state}`,
        snapshot: circuit,
      },
      vaReferenceCache: {
        scope: cacheScope.scope,
        detail: cacheScope.detail,
        hits: cacheCounters.hits,
        misses: cacheCounters.misses,
        hitRate:
          cacheCounters.hits + cacheCounters.misses > 0
            ? Math.round((cacheCounters.hits / (cacheCounters.hits + cacheCounters.misses)) * 100)
            : null,
      },
      rateLimit: {
        status: "ok" as const,
        latencyMs: 0,
        scope: rateLimit.scope,
        detail: rateLimit.detail,
      },
    };

    const healthy = catalog.status === "ok" && sessionCrypto.status === "ok";
    const status = healthy ? 200 : 503;

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "degraded",
        components,
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status },
    );
  } catch (error) {
    // Health endpoint must never crash — return 503 with the failure detail
    // so monitoring systems see "degraded" rather than a 500 opaque error.
    return NextResponse.json(
      {
        status: "degraded",
        components: {
          catalog: { status: "error", latencyMs: 0, detail: "Health check aborted" },
          sessionCrypto: { status: "error", latencyMs: 0, detail: "Health check aborted" },
        },
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
