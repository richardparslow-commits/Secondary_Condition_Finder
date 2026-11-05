import "server-only";

import { createLogger } from "@/lib/observability/logger";

import { isDistributedRuntime, type RuntimeEnvironment } from "../runtime-deployment";
import type { VaApiObservation } from "./sandbox";

export type VaCircuitService = VaApiObservation["service"];

export interface CircuitBreakerState {
  failures: number;
  openedAt: number | null;
  state: "closed" | "open" | "half-open";
  /**
   * True while the single admitted half-open probe is in flight. A half-open
   * circuit admits exactly one probe; everyone else is blocked until the probe
   * succeeds (closes) or fails (re-opens) or the claim is explicitly released.
   */
  probeInFlight: boolean;
  /** Cooldown for the current open cycle; 429 responses may set a shorter window. */
  cooldownMs: number;
  /**
   * Monotonic version of the state machine, bumped on every state transition
   * (open, half-open, closed). An admission captures the version it observed;
   * a late outcome carrying a stale version must not close a circuit that was
   * re-opened after the request started (audit B06: an ordinary success
   * arriving after a newer 429 used to erase that newer backoff).
   */
  version: number;
}

const FAILURE_THRESHOLD = 5;
/** Default cooldown before a single half-open probe is admitted. */
export const HALF_OPEN_PROBE_AFTER_MS = 60_000;
/**
 * 429 pressure policy: an upstream rate limit immediately opens the circuit for
 * the upstream's `Retry-After` window (when provided), clamped to this range so
 * a hostile or misconfigured value cannot either disable the backoff or pin the
 * integration off for an unbounded time. Without a usable header the default
 * window applies.
 *
 * The maximum is 15 minutes rather than the previous 60 seconds so a long
 * upstream `Retry-After` (e.g. ten minutes) is actually honored. Honoring it
 * does not hold a web request open: the circuit being open means callers serve
 * the documented local/cached fallback immediately, and retries are deferred
 * until the cooldown expires (audit B06). The parser already bounds a header at
 * 24 hours, so a hostile value cannot pin the circuit off indefinitely.
 */
export const CIRCUIT_RATE_LIMIT_MIN_COOLDOWN_MS = 1_000;
export const CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS = 15 * 60_000;
export const CIRCUIT_RATE_LIMIT_DEFAULT_COOLDOWN_MS = 30_000;

const circuitState = new Map<VaCircuitService, CircuitBreakerState>();

function getState(service: VaCircuitService): CircuitBreakerState {
  let entry = circuitState.get(service);
  if (!entry) {
    entry = {
      failures: 0,
      openedAt: null,
      state: "closed",
      probeInFlight: false,
      cooldownMs: HALF_OPEN_PROBE_AFTER_MS,
      version: 0,
    };
    circuitState.set(service, entry);
  }
  return entry;
}

const logger = createLogger("va-circuit-breaker");

/**
 * Parse an HTTP `Retry-After` value (delay-seconds or HTTP-date) into
 * milliseconds. Returns null when the header is absent or unparseable.
 */
export function parseRetryAfterMs(
  value: string | null | undefined,
  now = Date.now(),
): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds)) return null;
    return Math.min(seconds, 86_400) * 1000;
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, timestamp - now);
}

/** Clamp a Retry-After value into the policy window; null uses the default. */
export function clampRetryAfterCooldownMs(
  retryAfterMs: number | null | undefined,
): number {
  if (
    retryAfterMs === null ||
    retryAfterMs === undefined ||
    !Number.isFinite(retryAfterMs)
  ) {
    return CIRCUIT_RATE_LIMIT_DEFAULT_COOLDOWN_MS;
  }
  return Math.min(
    Math.max(retryAfterMs, CIRCUIT_RATE_LIMIT_MIN_COOLDOWN_MS),
    CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS,
  );
}

/**
 * Whether the service is currently inside an open cooldown. Retained for
 * health/reporting callers; admission decisions use `claimCircuitProbe`, which
 * also enforces the single-probe rule.
 */
export function isCircuitOpen(service: VaCircuitService, now = Date.now()): boolean {
  const entry = getState(service);
  if (entry.state !== "open" || entry.openedAt === null) return false;
  return now - entry.openedAt < entry.cooldownMs;
}

/**
 * Claim permission to make a request for a service.
 *
 * Closed circuits admit every caller. An open circuit admits exactly one
 * half-open probe after its cooldown elapses; concurrent callers are refused
 * until that probe reports an outcome (or releases its claim).
 */
export function claimCircuitProbe(service: VaCircuitService, now = Date.now()): boolean {
  const entry = getState(service);
  if (entry.state === "closed") return true;
  if (entry.state === "half-open") {
    // Exactly one probe at a time; a claim released without an outcome (e.g.
    // the request was abandoned before reaching the network) may be re-claimed.
    if (entry.probeInFlight) return false;
    entry.probeInFlight = true;
    return true;
  }
  if (entry.openedAt !== null && now - entry.openedAt >= entry.cooldownMs) {
    entry.state = "half-open";
    entry.probeInFlight = true;
    entry.version += 1;
    logger.info("circuit half-open; admitting a single probe", {
      service,
      cooldownMs: entry.cooldownMs,
    });
    return true;
  }
  return false;
}

/**
 * Release an admitted probe without recording an outcome (e.g. the request was
 * abandoned before reaching the network because shared coordination refused
 * it). The circuit stays half-open so the next caller may claim the probe.
 */
export function releaseCircuitProbe(service: VaCircuitService): void {
  const entry = getState(service);
  if (entry.state === "half-open") entry.probeInFlight = false;
}

/**
 * Record a successful request. Returns true when this closed a non-closed
 * circuit (used to decide whether shared coordination needs the good news).
 */
export function recordCircuitSuccess(
  service: VaCircuitService,
  options: { admittedVersion?: number } = {},
): boolean {
  const entry = getState(service);
  // Fencing: the request observed this version when it was admitted. If the
  // circuit transitioned since then (a newer failure or 429 opened it, or a
  // probe re-opened it), this outcome is stale and must not close the newer
  // cycle. Callers that cannot supply a version keep the legacy behavior.
  if (
    options.admittedVersion !== undefined &&
    options.admittedVersion !== entry.version
  ) {
    logger.info("ignored stale circuit success; state changed after admission", {
      service,
      admittedVersion: options.admittedVersion,
      currentVersion: entry.version,
    });
    return false;
  }
  const wasUnhealthy = entry.state !== "closed";
  if (wasUnhealthy) {
    logger.info("circuit closed after success", { service });
  }
  entry.failures = 0;
  entry.openedAt = null;
  entry.state = "closed";
  entry.probeInFlight = false;
  entry.cooldownMs = HALF_OPEN_PROBE_AFTER_MS;
  if (wasUnhealthy) entry.version += 1;
  return wasUnhealthy;
}

/**
 * Record a failed request. Returns true when this opened (or re-opened) the
 * circuit, so distributed deployments can publish a shared cooldown.
 *
 * A failure may only mutate the state generation it was admitted under. A
 * request admitted while the circuit was closed can time out after a newer
 * failure opened the circuit and a half-open probe was admitted; if that late
 * failure re-opened the circuit it would clear the live probe's claim, and the
 * probe's success would then be discarded as stale. Callers that cannot supply
 * a version keep the legacy behavior.
 */
export function recordCircuitFailure(
  service: VaCircuitService,
  now = Date.now(),
  options: { admittedVersion?: number } = {},
): boolean {
  const entry = getState(service);
  if (
    options.admittedVersion !== undefined &&
    options.admittedVersion !== entry.version
  ) {
    logger.info("ignored stale circuit failure; state changed after admission", {
      service,
      admittedVersion: options.admittedVersion,
      currentVersion: entry.version,
    });
    return false;
  }
  entry.probeInFlight = false;
  if (entry.state === "half-open") {
    entry.state = "open";
    entry.openedAt = now;
    entry.version += 1;
    logger.warn("circuit re-opened from half-open", {
      service,
      cooldownMs: entry.cooldownMs,
    });
    return true;
  }
  entry.failures += 1;
  if (entry.failures >= FAILURE_THRESHOLD && entry.state === "closed") {
    entry.state = "open";
    entry.openedAt = now;
    entry.cooldownMs = HALF_OPEN_PROBE_AFTER_MS;
    entry.version += 1;
    logger.warn("circuit opened", { service, failures: entry.failures });
    return true;
  }
  return false;
}

/**
 * Record an upstream 429. A rate limit opens the circuit immediately for the
 * clamped Retry-After window so every instance reduces consumer pressure
 * instead of retrying into the limit.
 */
export function recordCircuitRateLimit(
  service: VaCircuitService,
  retryAfterMs?: number | null,
  now = Date.now(),
): void {
  const entry = getState(service);
  entry.state = "open";
  entry.openedAt = now;
  entry.probeInFlight = false;
  entry.cooldownMs = clampRetryAfterCooldownMs(retryAfterMs);
  entry.version += 1;
  logger.warn("circuit opened by upstream rate limit", {
    service,
    cooldownMs: entry.cooldownMs,
  });
}

export function getCircuitSnapshot(): Record<VaCircuitService, CircuitBreakerState> {
  return {
    "va-forms": { ...getState("va-forms") },
    "benefits-reference-data": { ...getState("benefits-reference-data") },
    "accredited-representatives": { ...getState("accredited-representatives") },
  };
}

/**
 * Regime label: does breaker state cover all traffic, or only this instance?
 * Deliberately the same vocabulary the rate limiter uses, because both describe
 * per-instance state that cannot coordinate.
 */
export type CircuitBreakerRegime = "single-process" | "per-instance";

export interface CircuitBreakerScope {
  scope: CircuitBreakerRegime;
  detail: string;
}

/**
 * Report what breaker state actually covers in this runtime.
 *
 * Unlike the reference cache and live VA access, the breaker is **not** gated on
 * the runtime classification — it always runs, because a breaker that is absent is
 * worse than one that is per-instance. That makes this the class of control most
 * likely to be misread: `getCircuitSnapshot()` reports this instance alone, so in
 * a distributed deployment a closed circuit here does not mean upstream is
 * healthy, and a circuit that trips protects only the traffic that instance
 * happens to serve. Nothing else surfaces that, which is why it is reported
 * through `runtime-capabilities.ts`.
 */
export function circuitBreakerScope(
  env: RuntimeEnvironment = process.env,
): CircuitBreakerScope {
  if (isDistributedRuntime(env)) {
    return {
      scope: "per-instance",
      detail:
        "each instance keeps its own failures and probe timer, so a breaker that opens on one instance does not protect the others and this endpoint reports only the instance that answered",
    };
  }

  return {
    scope: "single-process",
    detail:
      "one process serves traffic, so breaker state and half-open probes cover all of it",
  };
}

export function clearCircuitBreakerState(): void {
  circuitState.clear();
}

export function readCircuitState(
  service: VaCircuitService,
): CircuitBreakerState {
  return { ...getState(service) };
}
