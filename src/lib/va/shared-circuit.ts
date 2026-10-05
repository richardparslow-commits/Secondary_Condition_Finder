import "server-only";

import { createLogger } from "@/lib/observability/logger";

import {
  CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS,
  CIRCUIT_RATE_LIMIT_MIN_COOLDOWN_MS,
  HALF_OPEN_PROBE_AFTER_MS,
  type VaCircuitService,
} from "./circuit-breaker";
import {
  loadVaSharedCacheConfig,
  runVaSharedKvCommand,
} from "./reference-shared-cache";

type Env = Record<string, string | undefined>;

/**
 * Shared cooldown/probe coordination for distributed runtimes.
 *
 * A process-local circuit breaker cannot represent a fleet: every instance has
 * its own counters and every half-open window admits one probe *per instance*.
 * When a shared KV is configured (and the distributed consumer budget has been
 * opted into), the gate below publishes a cooldown marker after an instance
 * opens its circuit, and admits exactly one half-open probe fleet-wide via an
 * atomic `SET … NX PX` lease. Any coordination failure resolves to
 * `unavailable` and callers fail closed rather than treating silence as a
 * closed circuit.
 *
 * Two audit-B06/B07 properties are load-bearing here:
 *
 * 1. **The cooldown is an absolute deadline, not a fixed comparison window.**
 *    The deadline key stores `retryNotBefore` in epoch ms and the gate compares
 *    the clock against it, so an upstream `Retry-After` of one second or ten
 *    minutes is honored exactly. Publishing is extend-only (Lua), so a stale
 *    failure from a request admitted earlier can never shorten a later, longer
 *    cooldown.
 * 2. **Only the admitted probe closes the generation it observed.** Recovery is
 *    an atomic compare-and-delete of the exact marker string that was read when
 *    the probe lease was granted, so an ordinary later success (or a slow probe
 *    from an older cooldown) cannot delete a newer cooldown. Lease releases are
 *    atomic compare-and-delete too, so an old owner can never delete a lease a
 *    replacement instance claimed between its read and its delete.
 */

/** Minimum marker TTL: must outlive the cooldown so clock/ordering skew cannot lose it. */
export const VA_SHARED_CIRCUIT_MARKER_TTL_SECONDS = 3600;
/** Extra TTL beyond the cooldown deadline, so the deadline key never expires first. */
export const VA_SHARED_CIRCUIT_MARKER_SLACK_SECONDS = 300;
/**
 * Probe lease TTL must cover the longest possible logical probe (every attempt
 * at the maximum timeout plus backoff). It only matters when a probe instance
 * dies without reporting an outcome; otherwise the lease is released as soon
 * as the probe resolves.
 */
export const VA_SHARED_CIRCUIT_PROBE_LEASE_MS = 120_000;

/**
 * Extend-only cooldown publication. `KEYS[1]` is the marker JSON, `KEYS[2]` the
 * absolute deadline, `ARGV[1]` the new deadline (epoch ms), `ARGV[2]` the new
 * marker JSON, `ARGV[3]` the TTL seconds. Returns 1 when published, 0 when a
 * later deadline is already in force (kept).
 */
export const SHARED_CIRCUIT_EXTEND_DEADLINE_SCRIPT = [
  "local current = redis.call('GET', KEYS[2])",
  "if current ~= false and tonumber(current) ~= nil and tonumber(current) >= tonumber(ARGV[1]) then return 0 end",
  "redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])",
  "redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[3])",
  "return 1",
].join("\n");

/**
 * Atomic compare-and-delete of a cooldown generation. `ARGV[1]` is the exact
 * marker string observed when the probe lease was granted. Returns 1 when the
 * observed generation was removed, 0 when no marker exists, and -1 when a newer
 * marker has been published since (refused — never delete a newer cooldown).
 */
export const SHARED_CIRCUIT_CLEAR_SCRIPT = [
  "local marker = redis.call('GET', KEYS[1])",
  "if marker == false then return 0 end",
  "if marker ~= ARGV[1] then return -1 end",
  "redis.call('DEL', KEYS[1])",
  "redis.call('DEL', KEYS[2])",
  "return 1",
].join("\n");

/**
 * Atomic compare-and-delete for leases: only the owner of the exact token may
 * release. GET-then-DEL is not used anywhere because another instance may
 * re-claim the key between those two commands.
 */
export const SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";

export type SharedCircuitStatus =
  | "closed"
  | "cooldown"
  | "probe-granted"
  | "probe-held"
  | "unavailable";

export interface SharedCircuitGate {
  status: SharedCircuitStatus;
  /**
   * Exact marker string observed while evaluating the gate (null when the
   * fleet circuit was closed or only a legacy marker existed without a
   * deadline). Probe-granted callers pass it back to recovery so only that
   * generation can be cleared.
   */
  observedMarker: string | null;
}

interface SharedCircuitMarker {
  state: "open";
  openedAt: number;
  /** Absolute epoch-ms deadline; legacy markers fall back to openedAt + 60s. */
  deadline: number;
  /** Fencing identity for this cooldown cycle. */
  generation: string;
}

function circuitMarkerKey(prefix: string, service: VaCircuitService): string {
  return `${prefix}circuit:${service}`;
}

function circuitDeadlineKey(prefix: string, service: VaCircuitService): string {
  return `${prefix}circuit-deadline:${service}`;
}

function circuitProbeKey(prefix: string, service: VaCircuitService): string {
  return `${prefix}circuit-probe:${service}`;
}

const sharedCircuitLogger = createLogger("va-shared-circuit");

/**
 * Lease tokens this instance currently holds, with the marker generation that
 * was observed when the fleet probe was granted. A release only deletes a lease
 * we still hold; recovery only clears the generation we observed.
 */
const heldProbeLeases = new Map<
  VaCircuitService,
  { token: string; observedMarker: string | null }
>();

function createLeaseToken(now: number): string {
  return `${now}-${Math.random().toString(36).slice(2)}`;
}

function createGeneration(now: number): string {
  return `${now}-${Math.random().toString(36).slice(2)}`;
}

function parseMarker(raw: unknown): SharedCircuitMarker | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const marker = parsed as {
    state?: unknown;
    openedAt?: unknown;
    deadline?: unknown;
    generation?: unknown;
  };
  if (marker.state !== "open") return null;
  if (typeof marker.openedAt !== "number" || !Number.isFinite(marker.openedAt)) {
    return null;
  }
  const deadline =
    typeof marker.deadline === "number" && Number.isFinite(marker.deadline)
      ? marker.deadline
      : marker.openedAt + HALF_OPEN_PROBE_AFTER_MS;
  const generation =
    typeof marker.generation === "string" && marker.generation
      ? marker.generation
      : `legacy-${marker.openedAt}`;
  return { state: "open", openedAt: marker.openedAt, deadline, generation };
}

/** Clamp a cooldown request into the shared policy window (1s–15min). */
export function clampSharedCooldownMs(cooldownMs: number | null | undefined): number {
  if (cooldownMs === null || cooldownMs === undefined || !Number.isFinite(cooldownMs)) {
    return HALF_OPEN_PROBE_AFTER_MS;
  }
  return Math.min(
    Math.max(cooldownMs, CIRCUIT_RATE_LIMIT_MIN_COOLDOWN_MS),
    CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS,
  );
}

function markerTtlSeconds(deadlineMs: number, now: number): number {
  const remainingSeconds = Math.ceil(Math.max(0, deadlineMs - now) / 1000);
  return Math.max(
    VA_SHARED_CIRCUIT_MARKER_TTL_SECONDS,
    remainingSeconds + VA_SHARED_CIRCUIT_MARKER_SLACK_SECONDS,
  );
}

/**
 * Evaluate the shared circuit for one service. This is a read, plus an atomic
 * probe-lease claim when the cooldown deadline has elapsed.
 */
export async function readSharedCircuitGate(
  service: VaCircuitService,
  options: { env?: Env; now?: number } = {},
): Promise<SharedCircuitGate> {
  const env = options.env ?? (process.env as Env);
  const now = options.now ?? Date.now();
  const config = loadVaSharedCacheConfig(env);
  if (!config) return { status: "unavailable", observedMarker: null };

  // The deadline key is authoritative and is compared directly against the
  // clock; the marker JSON is retained for identity, reporting, and legacy
  // markers written before the deadline key existed.
  const deadlineRead = await runVaSharedKvCommand(
    ["GET", circuitDeadlineKey(config.prefix, service)],
    env,
  );
  if (!deadlineRead.ok || !deadlineRead.payload || deadlineRead.payload.error !== undefined) {
    return { status: "unavailable", observedMarker: null };
  }
  const rawDeadline = deadlineRead.payload.result;
  let deadline: number | null = null;
  let rawMarker: string | null = null;

  if (rawDeadline !== null && rawDeadline !== undefined) {
    const parsed = Number(rawDeadline);
    if (!Number.isFinite(parsed)) return { status: "unavailable", observedMarker: null };
    deadline = parsed;
    const markerRead = await runVaSharedKvCommand(
      ["GET", circuitMarkerKey(config.prefix, service)],
      env,
    );
    if (!markerRead.ok || !markerRead.payload || markerRead.payload.error !== undefined) {
      return { status: "unavailable", observedMarker: null };
    }
    rawMarker =
      typeof markerRead.payload.result === "string" ? markerRead.payload.result : null;
  } else {
    const markerRead = await runVaSharedKvCommand(
      ["GET", circuitMarkerKey(config.prefix, service)],
      env,
    );
    if (!markerRead.ok || !markerRead.payload || markerRead.payload.error !== undefined) {
      return { status: "unavailable", observedMarker: null };
    }
    const raw = markerRead.payload.result;
    if (raw === null || raw === undefined) return { status: "closed", observedMarker: null };
    const marker = parseMarker(raw);
    if (!marker) return { status: "unavailable", observedMarker: null };
    deadline = marker.deadline;
    rawMarker = typeof raw === "string" ? raw : null;
  }

  // A deadline from the future (clock skew) is an active cooldown; an elapsed
  // deadline admits exactly one fleet-wide probe.
  if (deadline !== null && now < deadline) {
    return { status: "cooldown", observedMarker: rawMarker };
  }

  const leaseToken = createLeaseToken(now);
  const claim = await runVaSharedKvCommand(
    [
      "SET",
      circuitProbeKey(config.prefix, service),
      leaseToken,
      "NX",
      "PX",
      String(VA_SHARED_CIRCUIT_PROBE_LEASE_MS),
    ],
    env,
  );
  if (!claim.ok || !claim.payload || claim.payload.error !== undefined) {
    return { status: "unavailable", observedMarker: rawMarker };
  }
  if (claim.payload.result === "OK") {
    heldProbeLeases.set(service, { token: leaseToken, observedMarker: rawMarker });
    sharedCircuitLogger.info("shared circuit probe lease granted", { service });
    return { status: "probe-granted", observedMarker: rawMarker };
  }
  if (claim.payload.result === null) {
    // Another instance's lease may be live; if it is a stale lease for a
    // generation we can no longer recover, the fleet stays in cooldown until
    // the lease expires. Never delete another instance's lease from here.
    return { status: "probe-held", observedMarker: rawMarker };
  }
  return { status: "unavailable", observedMarker: rawMarker };
}

function clearHeldProbeLease(service: VaCircuitService): void {
  heldProbeLeases.delete(service);
}

/**
 * Publish (or extend) a fleet-wide cooldown after this instance observed a
 * failure. The stored deadline is absolute and the write is extend-only: a
 * later deadline already in force is never shortened by an older request's
 * failure. The probe lease is released only when this instance holds it.
 *
 * Returns true when the cooldown is at least as long as requested (newly
 * published or an equal/later deadline already existed), false when the
 * coordinator is unavailable or the command failed — callers must not treat a
 * failed publication as a closed circuit.
 */
export async function publishSharedCircuitOpen(
  service: VaCircuitService,
  options: { cooldownMs?: number; env?: Env; now?: number } = {},
): Promise<boolean> {
  const env = options.env ?? (process.env as Env);
  const now = options.now ?? Date.now();
  const config = loadVaSharedCacheConfig(env);
  if (!config) return false;

  const cooldownMs = clampSharedCooldownMs(options.cooldownMs);
  const deadline = now + cooldownMs;
  const marker: SharedCircuitMarker = {
    state: "open",
    openedAt: now,
    deadline,
    generation: createGeneration(now),
  };
  const ttlSeconds = markerTtlSeconds(deadline, now);

  const write = await runVaSharedKvCommand(
    [
      "EVAL",
      SHARED_CIRCUIT_EXTEND_DEADLINE_SCRIPT,
      "2",
      circuitMarkerKey(config.prefix, service),
      circuitDeadlineKey(config.prefix, service),
      String(deadline),
      JSON.stringify(marker),
      String(ttlSeconds),
    ],
    env,
  );
  // Release only our own lease; never delete another instance's in-flight probe.
  await releaseSharedProbeLease(service, { env });

  if (!write.ok || !write.payload || write.payload.error !== undefined) {
    sharedCircuitLogger.warn("shared circuit cooldown publish failed", {
      service,
      cooldownMs,
    });
    return false;
  }
  const result = Number(write.payload.result);
  if (result !== 0 && result !== 1) {
    sharedCircuitLogger.warn("shared circuit cooldown publish returned unexpected result", {
      service,
      cooldownMs,
    });
    return false;
  }
  if (result === 1) {
    sharedCircuitLogger.warn("shared circuit cooldown published", {
      service,
      cooldownMs,
    });
  }
  return true;
}

/**
 * Publish recovery for the exact cooldown generation the admitted probe
 * observed. The marker is removed only when it is still the same generation;
 * a newer cooldown published after the probe started is never deleted, and an
 * ordinary (non-probe) success must not call this at all.
 *
 * Returns true when the observed generation is gone (removed or already
 * absent), false when a newer generation is in force or the command failed.
 */
export async function publishSharedCircuitClosed(
  service: VaCircuitService,
  options: { observedMarker?: string | null; env?: Env } = {},
): Promise<boolean> {
  const env = options.env ?? (process.env as Env);
  const config = loadVaSharedCacheConfig(env);
  if (!config) return false;
  const observedMarker = options.observedMarker ?? "";
  const clear = await runVaSharedKvCommand(
    [
      "EVAL",
      SHARED_CIRCUIT_CLEAR_SCRIPT,
      "2",
      circuitMarkerKey(config.prefix, service),
      circuitDeadlineKey(config.prefix, service),
      observedMarker,
    ],
    env,
  );
  await releaseSharedProbeLease(service, { env });
  if (!clear.ok || !clear.payload || clear.payload.error !== undefined) {
    sharedCircuitLogger.warn("shared circuit recovery publish failed", { service });
    return false;
  }
  const result = Number(clear.payload.result);
  if (result === -1) {
    sharedCircuitLogger.info("shared circuit recovery refused; newer cooldown in force", {
      service,
    });
    return false;
  }
  if (result !== 0 && result !== 1) return false;
  if (result === 1) {
    sharedCircuitLogger.warn("shared circuit cooldown cleared by admitted probe", { service });
  }
  return true;
}

/**
 * Release a probe lease this instance claimed but could not use (the request
 * was abandoned before any upstream attempt). The compare-and-delete is atomic,
 * so a lease that expired and was re-claimed by another instance between the
 * read and the delete is never cancelled by the old owner.
 */
export async function releaseSharedProbeLease(
  service: VaCircuitService,
  options: { env?: Env } = {},
): Promise<void> {
  const held = heldProbeLeases.get(service);
  clearHeldProbeLease(service);
  if (!held) return;
  const env = options.env ?? (process.env as Env);
  const config = loadVaSharedCacheConfig(env);
  if (!config) return;

  const released = await runVaSharedKvCommand(
    [
      "EVAL",
      SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT,
      "1",
      circuitProbeKey(config.prefix, service),
      held.token,
    ],
    env,
  );
  if (!released.ok || !released.payload || released.payload.error !== undefined) {
    sharedCircuitLogger.warn("shared circuit probe lease release failed", { service });
    return;
  }
  if (Number(released.payload.result) === 1) {
    sharedCircuitLogger.info("shared circuit probe lease released", { service });
  }
}

/** Test helper: drop in-memory lease bookkeeping (KV state is stubbed in tests). */
export function clearSharedCircuitStateForTests(): void {
  heldProbeLeases.clear();
}
