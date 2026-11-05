import "server-only";

import {
  claimCircuitProbe,
  clampRetryAfterCooldownMs,
  HALF_OPEN_PROBE_AFTER_MS,
  recordCircuitFailure,
  recordCircuitRateLimit,
  readCircuitState,
  recordCircuitSuccess,
  releaseCircuitProbe,
  type VaCircuitService,
} from "./circuit-breaker";
import {
  publishSharedCircuitClosed,
  publishSharedCircuitOpen,
  readSharedCircuitGate,
  releaseSharedProbeLease,
} from "./shared-circuit";

type Env = Record<string, string | undefined>;

export type VaOutboundCircuitDecision =
  | "allow"
  | "probe"
  | "blocked"
  | "unavailable";

/**
 * What one logical request observed when it was admitted. The version and the
 * exact shared marker string fence the later outcome: a success may only close
 * the state (local or fleet-wide) that was in force when it started.
 */
export interface VaOutboundAdmission {
  decision: VaOutboundCircuitDecision;
  /** Local circuit version observed at admission (null when not admitted). */
  localVersion: number | null;
  /**
   * Exact shared cooldown marker observed when a fleet-wide probe was granted
   * (null when the fleet circuit was closed, no fleet probe was granted, or a
   * legacy marker without a deadline key was read).
   */
  sharedMarker: string | null;
}

function notAdmitted(decision: VaOutboundCircuitDecision): VaOutboundAdmission {
  return { decision, localVersion: null, sharedMarker: null };
}

/**
 * Decide whether one logical outbound request may start.
 *
 * Single-process runtimes use the in-memory breaker alone. Distributed
 * runtimes layer the shared cooldown/probe lease on top: the local breaker
 * still protects this instance, while the shared gate enforces the fleet-wide
 * cooldown and the single half-open probe. When the shared coordinator is
 * unreachable the decision is `unavailable` — callers must fail closed rather
 * than treat an unreadable circuit as closed.
 *
 * The returned admission carries the state version and shared marker observed
 * now; callers pass it back to `recordVaOutboundCircuitOutcome` so a late
 * outcome cannot clear a newer cooldown (audit B06).
 */
export async function evaluateVaOutboundCircuit(args: {
  service: VaCircuitService;
  distributed: boolean;
  env?: Env;
  now?: number;
}): Promise<VaOutboundAdmission> {
  const claimed = claimCircuitProbe(args.service, args.now);
  const localProbe = claimed && readCircuitState(args.service).state === "half-open";
  if (!claimed) return notAdmitted("blocked");
  const localVersion = readCircuitState(args.service).version;
  if (!args.distributed) {
    return {
      decision: localProbe ? "probe" : "allow",
      localVersion,
      sharedMarker: null,
    };
  }

  const shared = await readSharedCircuitGate(args.service, {
    env: args.env,
    now: args.now,
  });
  // `probe` means this request is the single admitted half-open probe (either
  // fleet-wide or this instance's), which matters when recording the outcome.
  if (shared.status === "closed") {
    return {
      decision: localProbe ? "probe" : "allow",
      localVersion,
      sharedMarker: null,
    };
  }
  if (shared.status === "probe-granted") {
    return {
      decision: "probe",
      localVersion,
      sharedMarker: shared.observedMarker,
    };
  }
  // No upstream attempt will be made, so give up any local probe claim instead
  // of stranding the circuit in half-open with a phantom probe in flight.
  releaseCircuitProbe(args.service);
  return notAdmitted(shared.status === "unavailable" ? "unavailable" : "blocked");
}

/**
 * Release a claimed probe after the request was abandoned before reaching the
 * network (e.g. the shared consumer budget failed closed).
 */
export async function abandonVaOutboundCircuitProbe(
  service: VaCircuitService,
  options: { distributed: boolean; env?: Env } = { distributed: false },
): Promise<void> {
  releaseCircuitProbe(service);
  if (options.distributed) {
    await releaseSharedProbeLease(service, { env: options.env });
  }
}

/**
 * Record the outcome of a logical outbound request.
 *
 * Failures publish (or extend) a shared cooldown when they open this instance's
 * breaker, when upstream returned 429, or when a fleet-wide probe failed (even
 * if this instance's breaker was still closed): one transient blip should not
 * take the fleet off live data, but a failed probe must restart the fleet
 * cooldown rather than leave the next instance probing immediately. Shared
 * cooldown publication is extend-only, so an older request's failure can never
 * shorten a later, longer upstream `Retry-After` deadline.
 *
 * Success closes the shared cooldown **only when this request was the admitted
 * probe and only for the generation it observed** (audit B06): an ordinary
 * success, or a slow success from an older cooldown, must not erase a newer
 * failure's backoff. The local fence works the same way through the admission's
 * `localVersion`.
 */
export async function recordVaOutboundCircuitOutcome(args: {
  service: VaCircuitService;
  distributed: boolean;
  success: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number | null;
  /** True when this request was the admitted half-open probe. */
  probeAdmitted?: boolean;
  /** Admission returned by `evaluateVaOutboundCircuit` for this request. */
  admission?: VaOutboundAdmission | null;
  env?: Env;
  now?: number;
}): Promise<void> {
  if (args.success) {
    recordCircuitSuccess(args.service, {
      admittedVersion: args.admission?.localVersion ?? undefined,
    });
    if (args.distributed && args.probeAdmitted) {
      // Fail closed when no admission was supplied: an unverifiable recovery is
      // treated as "observed no marker", so the compare-and-delete refuses to
      // remove any marker that now exists.
      await publishSharedCircuitClosed(args.service, {
        observedMarker: args.admission?.sharedMarker ?? null,
        env: args.env,
      });
    }
    return;
  }

  if (args.rateLimited) {
    recordCircuitRateLimit(args.service, args.retryAfterMs, args.now);
    if (args.distributed) {
      // The local and shared windows use the same clamp (1s–15min), so a long
      // upstream Retry-After is honored fleet-wide instead of being shortened
      // to one minute (audit B06).
      await publishSharedCircuitOpen(args.service, {
        cooldownMs: clampRetryAfterCooldownMs(args.retryAfterMs),
        env: args.env,
        now: args.now,
      });
    }
    return;
  }

  const admittedVersion = args.admission?.localVersion ?? undefined;
  const stale =
    admittedVersion !== undefined &&
    admittedVersion !== readCircuitState(args.service).version;
  const opened = recordCircuitFailure(args.service, args.now, {
    admittedVersion,
  });
  // A failure from an older generation must not republish a fleet cooldown
  // over a newer half-open probe. `recordCircuitFailure` keeps the local state
  // intact; suppress the shared publication for the same stale outcome.
  if (args.distributed && !stale && (opened || args.probeAdmitted)) {
    await publishSharedCircuitOpen(args.service, {
      cooldownMs: HALF_OPEN_PROBE_AFTER_MS,
      env: args.env,
      now: args.now,
    });
  }
}
