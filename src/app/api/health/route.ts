import { NextResponse } from "next/server";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { openSessionPayload, sealSessionPayload } from "@/lib/workflow-session-crypto";
import { loadVaApiConfig } from "@/lib/va/sandbox";
import { getCircuitSnapshot } from "@/lib/va/circuit-breaker";

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

export async function GET() {
  const started = Date.now();

  const [catalog, sessionCrypto] = await Promise.all([checkCatalog(), checkSessionCrypto()]);
  const vaConfig = checkVaConfig();
  const circuit = getCircuitSnapshot();

  const components = {
    catalog,
    sessionCrypto,
    vaConfig,
    circuitBreaker: {
      status: "ok" as const,
      latencyMs: 0,
      detail: `va-forms:${circuit["va-forms"].state} benefits-reference-data:${circuit["benefits-reference-data"].state}`,
      snapshot: circuit,
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
