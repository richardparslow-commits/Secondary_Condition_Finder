import "server-only";

import { createLogger } from "@/lib/observability/logger";

import type { VaApiObservation } from "./sandbox";

export type VaCircuitService = VaApiObservation["service"];

export interface CircuitBreakerState {
  failures: number;
  openedAt: number | null;
  state: "closed" | "open" | "half-open";
}

const FAILURE_THRESHOLD = 5;
const HALF_OPEN_PROBE_AFTER_MS = 60_000;

const circuitState = new Map<VaCircuitService, CircuitBreakerState>();

function getState(service: VaCircuitService): CircuitBreakerState {
  let entry = circuitState.get(service);
  if (!entry) {
    entry = { failures: 0, openedAt: null, state: "closed" };
    circuitState.set(service, entry);
  }
  return entry;
}

const logger = createLogger("va-circuit-breaker");

export function isCircuitOpen(service: VaCircuitService, now = Date.now()): boolean {
  const entry = getState(service);
  if (entry.state === "open" && entry.openedAt !== null) {
    if (now - entry.openedAt >= HALF_OPEN_PROBE_AFTER_MS) {
      entry.state = "half-open";
      logger.info("circuit half-open; probing", { service });
      return false;
    }
    return true;
  }
  if (entry.state === "half-open") return false;
  return false;
}

export function recordCircuitSuccess(service: VaCircuitService): void {
  const entry = getState(service);
  if (entry.state !== "closed") {
    logger.info("circuit closed after success", { service });
  }
  entry.failures = 0;
  entry.openedAt = null;
  entry.state = "closed";
}

export function recordCircuitFailure(service: VaCircuitService, now = Date.now()): void {
  const entry = getState(service);
  if (entry.state === "half-open") {
    entry.state = "open";
    entry.openedAt = now;
    logger.warn("circuit re-opened from half-open", { service });
    return;
  }
  entry.failures += 1;
  if (entry.failures >= FAILURE_THRESHOLD && entry.state === "closed") {
    entry.state = "open";
    entry.openedAt = now;
    logger.warn("circuit opened", { service, failures: entry.failures });
  }
}

export function getCircuitSnapshot(): Record<VaCircuitService, CircuitBreakerState> {
  return {
    "va-forms": { ...getState("va-forms") },
    "benefits-reference-data": { ...getState("benefits-reference-data") },
    "accredited-representatives": { ...getState("accredited-representatives") },
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
