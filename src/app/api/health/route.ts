import { NextResponse } from "next/server";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { openSessionPayload, sealSessionPayload } from "@/lib/workflow-session-crypto";
import { loadVaApiConfig } from "@/lib/va/sandbox";
import { getCircuitSnapshot } from "@/lib/va/circuit-breaker";
import { peekCacheCounters } from "@/lib/va/reference-cache";

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
 * - latencyMs: total endpoint latency
 * - timestamp: ISO 8601
 *
 * HTTP 200 when catalog + sessionCrypto are ok; 503 when either is error.
 */
export async function GET() {
  const started = Date.now();

  const [catalog, sessionCrypto] = await Promise.all([checkCatalog(), checkSessionCrypto()]);
  const vaConfig = checkVaConfig();
  const circuit = getCircuitSnapshot();
  const cacheCounters = peekCacheCounters();

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
      hits: cacheCounters.hits,
      misses: cacheCounters.misses,
      hitRate:
        cacheCounters.hits + cacheCounters.misses > 0
          ? Math.round((cacheCounters.hits / (cacheCounters.hits + cacheCounters.misses)) * 100)
          : null,
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
}
