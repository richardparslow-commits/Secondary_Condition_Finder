import "server-only";

import { rateLimitScope } from "./rate-limiter";
import { isDistributedRuntime, type RuntimeEnvironment } from "./runtime-deployment";
import { circuitBreakerScope } from "./va/circuit-breaker";
import { vaReferenceCacheScope } from "./va/reference-cache";
import { vaLiveIntegrationScope } from "./va/runtime-state";

/**
 * What does this deployment give up?
 *
 * Several controls here depend on process-local state, and each behaves
 * differently once more than one process serves traffic. Two **refuse** to run at
 * all (live VA access, the VA reference cache); two keep running but **weaker**
 * than written (application rate limiting, the VA circuit breaker).
 *
 * Before this module, each control answered that question only inside its own
 * file, if at all. An operator reading `/api/health` could see a hit/miss counter
 * frozen at zero, or a circuit reported closed, with nothing saying that either
 * reading was structurally uninformative. Each capability now reports its own
 * regime, and this module collects them so the answer exists in one place.
 *
 * The split of responsibility mirrors `runtime-deployment.ts`: that module owns
 * the runtime *fact*, each capability owns its *policy* over the fact, and this
 * module owns the *aggregate* question. `tests/runtime-capabilities.test.ts` walks
 * `src/` for every module that consults the fact and fails when one is not
 * accounted for below, so a new process-local control cannot be added without
 * either reporting a scope or failing the build.
 */

/** Stable capability ids. Also the keys of the report and of health components. */
export type RuntimeCapabilityId =
  | "vaLiveIntegration"
  | "vaReferenceCache"
  | "rateLimit"
  | "circuitBreaker";

/**
 * How a control responds when process-local state is not allowed here.
 *
 * `refuses` is the correctness stance: serving a wrong answer is not an
 * acceptable degradation, so the control declines. `degrades` is the guard
 * stance: running weaker than written beats not running, because a weaker guard
 * still restricts traffic while an absent one restricts nothing.
 */
export type RuntimeCapabilityBehavior = "refuses" | "degrades";

export interface RuntimeCapability {
  id: RuntimeCapabilityId;
  /** Human label, for health detail and log lines. */
  label: string;
  /** `refuses` = unavailable in this runtime; `degrades` = runs, weaker than written. */
  behavior: RuntimeCapabilityBehavior;
  /** True when the control operates at full strength in this runtime. */
  full: boolean;
  /** Regime label, in that control's own vocabulary (`enabled`/`disabled`, `process-local`, `single-process`/`per-instance`). */
  scope: string;
  /** Operator-facing explanation of the consequence, not just the label. */
  detail: string;
  /**
   * Control-specific facts that belong beside the regime in `/api/health`.
   *
   * The control owns these keys and the route forwards them verbatim, so a
   * capability's own detail cannot be invented by the endpoint that displays it.
   * `rateLimit` uses this for the two limits of its promise — whether per-client
   * keys rest on an asserted ingress, and whether the counters are
   * deployment-wide — plus the ceiling it actually enforces (SEC-02). A capability
   * that adds keys here must pin them in tests, because health asserts nothing
   * about their shape.
   */
  details?: Record<string, unknown>;
  /**
   * Modules that consult the runtime fact on this control's behalf, repo-relative.
   *
   * Declared so the guard test can compare it against what actually exists on
   * disk in both directions: a consumer missing here means a control that reports
   * nothing, and an entry whose file no longer consults the fact means a stale
   * claim. Both were previously possible because the knowledge lived in comments.
   */
  sources: readonly string[];
}

export type RuntimeCapabilityReport = Record<RuntimeCapabilityId, RuntimeCapability>;

export interface RuntimeCapabilitySummary {
  /** Ids operating below full strength here. */
  reduced: RuntimeCapabilityId[];
  /** Capability id → regime label, for reading the whole surface at a glance. */
  scopes: Record<string, string>;
  /** One sentence on what this deployment gives up. */
  detail: string;
}

export interface RuntimeCapabilities {
  /** True when this process is one of several. */
  distributed: boolean;
  /** Per-control regime, keyed by capability id. */
  capabilities: RuntimeCapabilityReport;
  /** The same information rolled up into "what does this deployment give up?". */
  summary: RuntimeCapabilitySummary;
}

function summarize(
  capabilities: RuntimeCapabilityReport,
): RuntimeCapabilitySummary {
  const all = Object.values(capabilities);
  const reduced = all.filter((capability) => !capability.full);

  return {
    reduced: reduced.map((capability) => capability.id),
    scopes: Object.fromEntries(all.map((capability) => [capability.id, capability.scope])),
    detail:
      reduced.length === 0
        ? "all process-local capabilities run at full strength in this runtime"
        : `${reduced.length} of ${all.length} process-local capabilities are below full strength here: ` +
          reduced
            .map((capability) => `${capability.label} (${capability.behavior}, ${capability.scope})`)
            .join("; "),
  };
}

/**
 * Every process-local-dependent control, with this runtime's regime for each.
 *
 * `full` is `!isDistributedRuntime(env)` for all four today: in a single-process
 * runtime per-instance state *is* global, and in a distributed one none of these
 * four can be at full strength. A future capability that stays full while
 * distributed belongs here too, but it must also change the invariant assertion
 * in `tests/runtime-capabilities.test.ts` — deliberately, since that is a claim
 * worth stating out loud rather than inheriting.
 */
export function runtimeCapabilities(
  env: RuntimeEnvironment = process.env,
): RuntimeCapabilities {
  const distributed = isDistributedRuntime(env);

  const vaLive = vaLiveIntegrationScope(env);
  const cache = vaReferenceCacheScope(env);
  const limiter = rateLimitScope(env);
  const breaker = circuitBreakerScope(env);

  const capabilities: RuntimeCapabilityReport = {
    vaLiveIntegration: {
      id: "vaLiveIntegration",
      label: "Live VA API access",
      behavior: "refuses",
      full: !distributed,
      scope: vaLive.scope,
      detail: vaLive.detail,
      sources: [
        "src/lib/va/runtime-state.ts",
        "src/lib/va/sandbox.ts",
        "src/lib/va/account/store.ts",
        // The demo fixture gate refuses to answer in any runtime the shared fact
        // calls distributed, so it consults the fact on this capability's behalf
        // and must be declared here rather than failing the guard test.
        "src/lib/va/account/demo-fixtures.ts",
      ],
    },
    vaReferenceCache: {
      id: "vaReferenceCache",
      label: "VA reference cache",
      behavior: "refuses",
      full: !distributed,
      scope: cache.scope,
      detail: cache.detail,
      sources: ["src/lib/va/reference-cache.ts"],
    },
    rateLimit: {
      id: "rateLimit",
      label: "Application rate limiting",
      behavior: "degrades",
      full: !distributed,
      scope: limiter.scope,
      detail: limiter.detail,
      details: {
        identity: limiter.identity,
        ceiling: limiter.ceiling,
        store: limiter.store,
      },
      sources: ["src/lib/rate-limiter.ts"],
    },
    circuitBreaker: {
      id: "circuitBreaker",
      label: "VA API circuit breaker",
      behavior: "degrades",
      full: !distributed,
      scope: breaker.scope,
      detail: breaker.detail,
      sources: ["src/lib/va/circuit-breaker.ts"],
    },
  };

  return { distributed, capabilities, summary: summarize(capabilities) };
}
