import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKbGraph } from "@/lib/kb/graph";
import { cspViolationWindowReport } from "@/lib/observability/csp-violation-window";
import { runtimeCapabilities } from "@/lib/runtime-capabilities";
import {
  openSessionPayload,
  sealSessionPayload,
  workflowSessionRuntimeReady,
} from "@/lib/workflow-session-crypto";
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
  } catch {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      detail: "Catalog validation failed.",
    };
  }
}

async function checkSessionCrypto(): Promise<ComponentCheck> {
  const started = Date.now();
  try {
    const probe = { kind: "health-probe", version: 1, at: Date.now() };
    // An ephemeral per-call secret, generated rather than written down: the probe
    // proves the cipher round-trips without depending on env config, and keeping
    // no credential-shaped literal in the source leaves a secret scanner nothing
    // to flag (and nothing to leak).
    const secret = randomBytes(32).toString("base64url");
    const sealed = sealSessionPayload(probe, secret);
    const opened = openSessionPayload(sealed, secret) as typeof probe | null;
    if (!opened || opened.kind !== probe.kind) throw new Error("Session crypto round-trip failed");
    return { status: "ok", latencyMs: Date.now() - started };
  } catch {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      detail: "Session crypto probe failed.",
    };
  }
}

/**
 * Workflow-session readiness: can this deployment actually seal and open a
 * workflow session right now?
 *
 * `checkSessionCrypto` above proves the *primitives* work using an ephemeral
 * probe secret, which is deliberate — it must not fail because of configuration.
 * That is exactly why it cannot answer this question: a deployment whose
 * production secret is missing or too short seals nothing, while the primitive
 * check stays green. Measured independently, a missing key produced
 * `workflowSessionRuntimeReady() === false` alongside a `200 healthy` health
 * body (REL-04). This component is the missing half.
 *
 * Development is `ok` on purpose: non-production runs on a documented
 * development-only fallback secret, so the workflow genuinely works there, and
 * reporting it as broken would train operators to ignore the field. Production
 * requires the real secret, proved by a round trip rather than by presence, so
 * a configured-but-unusable key is an `error` here instead of a silent one.
 * Nothing about the secret is returned — the detail is a fixed string.
 */
function checkWorkflowSession(): ComponentCheck {
  const started = Date.now();
  let ready: boolean;
  try {
    ready = process.env.NODE_ENV !== "production" || workflowSessionRuntimeReady();
  } catch {
    ready = false;
  }
  return {
    status: ready ? "ok" : "error",
    latencyMs: Date.now() - started,
    detail: ready
      ? process.env.NODE_ENV === "production"
        ? "Workflow session secret configured and round-trip verified"
        : "Workflow session using the development-only fallback secret"
      : "Workflow session configuration unusable",
  };
}

/**
 * Adjacency-graph migration state. The loader validates every node file
 * (schema, filename identity, duplicates, catalog membership) and fails loud
 * on invalid data, so `status: "ok"` is itself the validation verdict; the
 * counts let operators watch the migration progress toward a populated graph.
 * An empty graph is the valid pre-migration state, not a failure.
 */
function checkKbGraph(): ComponentCheck & { nodes?: number; edges?: number } {
  const started = Date.now();
  try {
    const graph = loadKbGraph();
    let edges = 0;
    for (const node of graph.values()) edges += node.outgoingEdges.length;
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      nodes: graph.size,
      edges,
    };
  } catch {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      detail: "Knowledge graph validation failed.",
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
  } catch {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      detail: "VA configuration unavailable.",
    };
  }
}

/**
 * GET /api/health
 *
 * Health check endpoint used by Vercel monitoring and the production readiness
 * workflow. Returns component-level status for catalog, session crypto, the
 * configured workflow session, the CRG adjacency graph, VA API config, circuit
 * breaker state, and the shared consumer budget's admit/refuse pressure.
 *
 * Response schema (see docs/api-specification.md):
 * - status: "healthy" | "degraded"
 * - components.catalog: { status, latencyMs, count?, detail? }
 * - components.sessionCrypto: { status, latencyMs, detail? } — primitives only,
 *   on an ephemeral probe secret; unrelated to configured readiness
 * - components.workflowSession: { status, latencyMs, detail? } — the configured
 *   workflow session, i.e. whether this deployment can seal/read one at all
 * - components.kbGraph: { status, latencyMs, nodes?, edges?, detail? }
 * - components.vaConfig: { status, latencyMs, enabled?, environment?, detail? }
 * - components.circuitBreaker: { status, latencyMs, detail, snapshot }
 * - components.vaReferenceCache: { scope, detail, hits, misses, hitRate } —
 *   `scope: "disabled"` means the counters are structurally frozen at zero and
 *   must not be read as "a cache that has not been used yet"
 * - components.vaConsumerBudget: { status, latencyMs, scope, detail, budget,
 *   store, pressure } — whether the fleet's upstream traffic is bounded by one
 *   shared window here (`fleet-shared` / `unenforced` / `not-required`), the
 *   budget's own bounds and gate, and the admit/refuse pressure this instance has
 *   accumulated (A03): `pressure.refused` rising is the fleet being throttled,
 *   readable before VA answers 429, and `pressure.pacing.chargedReservations` is
 *   the earliest warning — the upstream itself said the remaining quota is short.
 *   These counters are per-instance and reset on cold start; a refusal is an
 *   event, so any non-zero count is true of the fleet as a whole
 * - components.rateLimit: { status, latencyMs, scope, detail, identity, ceiling,
 *   store, refusals } — whether application-level rate limiting is per-instance
 *   here, since the effective limit scales with instance count and is not
 *   otherwise observable; `identity` records whether per-client keys rest on an
 *   asserted ingress model or on client-supplied headers — and, for an asserted
 *   model, which hop of the header that model makes authoritative — `ceiling` is
 *   the shared budget that bounds unattributed and key-rotating traffic (read off
 *   the limiter that enforces it, so the report and the behaviour are one number),
 *   and `store` records whether those counters are deployment-wide or
 *   process-local. `refusals` is the reason a refusal happened, counted here
 *   because the 429 body deliberately does not say which budget refused:
 *   `byBudget.ceiling` with a rising `ceilingShare` is aggregate pressure (many
 *   different clients refused in one window), `byBudget.perClient` is individual
 *   clients at their own limit, and both are per-instance and reset on cold
 *   start. It carries surface labels and counts only — never the client key — so
 *   no address can reach this (public) payload
 * - components.cspReports: { status, latencyMs, scope, windowMs, maxEvents,
 *   received, oversized, evicted, since, lastReceivedAt, directives,
 *   directivesOmitted, detail } — the CSP / Trusted-Types violations browsers
 *   reported in the last few minutes, so a policy regression is an operator-
 *   readable fact here instead of only a browser-console line. Carries fact
 *   names and counts only: no document URL, blocked URL, source file or sample
 *   can reach this (public) payload, because the window is handed the bounded
 *   directive/disposition pair. `scope` is `process-local` — reports are
 *   accepted where the POST lands — and `received > 0` is the signal that some
 *   deploy is blocking something the policy did not intend; it never changes
 *   overall health
 * - components.runtime: { status, latencyMs, distributed, reduced, capabilities,
 *   detail } — the aggregate answer to "what does this deployment give up?",
 *   covering every process-local control (including live VA access and the
 *   circuit breaker, which have no component of their own). `reduced` lists the
 *   capabilities below full strength; `capabilities` maps every id to its regime
 * - latencyMs: total endpoint latency
 * - timestamp: ISO 8601
 *
 * HTTP 200 when catalog + sessionCrypto + workflowSession + kbGraph are ok; 503
 * when any is error — invalid adjacency data and an unusable workflow secret are
 * both deployed-integrity/readiness failures, not degraded-but-expected states.
 */
export async function GET() {
  const started = Date.now();

  try {
    const [catalog, sessionCrypto] = await Promise.all([checkCatalog(), checkSessionCrypto()]);
    const workflowSession = checkWorkflowSession();
    const kbGraph = checkKbGraph();
    const vaConfig = checkVaConfig();
    const circuit = getCircuitSnapshot();
    const cacheCounters = peekCacheCounters();
    const cspReports = cspViolationWindowReport();
    // Scopes come from the single capabilities report, never re-derived here, so a
    // control cannot grow a health field that disagrees with its own behaviour.
    const capabilities = runtimeCapabilities();
    const cacheScope = capabilities.capabilities.vaReferenceCache;
    const consumerBudget = capabilities.capabilities.vaConsumerBudget;
    const rateLimit = capabilities.capabilities.rateLimit;

    const components = {
      catalog,
      sessionCrypto,
      workflowSession,
      kbGraph,
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
      // A report, never a health failure: an exhausted or unenforced budget is the
      // documented degradation path (the request falls back to local reference
      // data), not a reason to take the deployment out of service — exactly as a
      // disabled live integration is reported `ok` above. The scope and the
      // pressure fields are where the operator reads what is actually happening.
      vaConsumerBudget: {
        status: "ok" as const,
        latencyMs: 0,
        scope: consumerBudget.scope,
        detail: consumerBudget.detail,
        // The control's own facts (budget bounds, gate, per-instance pressure),
        // forwarded rather than re-derived here.
        ...consumerBudget.details,
      },
      rateLimit: {
        status: "ok" as const,
        latencyMs: 0,
        scope: rateLimit.scope,
        detail: rateLimit.detail,
        // The control's own facts (identity trust, enforced ceiling, store
        // regime), forwarded rather than re-derived here.
        ...rateLimit.details,
      },
      // A report, never a health failure — exactly like the budget and the
      // limiter above. A blocked inline style or script sink means a page is
      // rendering under an unintended policy, which an operator must see; it
      // does not mean the deployment cannot serve, and making it a 503 would
      // take the site down over a policy finding. The window's own facts are
      // forwarded rather than re-derived here, so the report and the counting
      // cannot disagree.
      cspReports: {
        status: "ok" as const,
        latencyMs: 0,
        ...cspReports,
      },
      runtime: {
        status: "ok" as const,
        latencyMs: 0,
        distributed: capabilities.distributed,
        reduced: capabilities.summary.reduced,
        capabilities: capabilities.summary.scopes,
        detail: capabilities.summary.detail,
      },
    };

    const healthy =
      catalog.status === "ok" &&
      sessionCrypto.status === "ok" &&
      workflowSession.status === "ok" &&
      kbGraph.status === "ok";
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
  } catch {
    // Health endpoint must never crash — return a content-free 503 so
    // monitoring sees "degraded" without exporting exception details.
    return NextResponse.json(
      {
        status: "degraded",
        components: {
          catalog: { status: "error", latencyMs: 0, detail: "Health check aborted" },
          sessionCrypto: { status: "error", latencyMs: 0, detail: "Health check aborted" },
          workflowSession: { status: "error", latencyMs: 0, detail: "Health check aborted" },
          kbGraph: { status: "error", latencyMs: 0, detail: "Health check aborted" },
        },
        error: "Health check failed; diagnostic details withheld.",
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
