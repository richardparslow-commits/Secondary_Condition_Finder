import "server-only";

import { createLogger } from "@/lib/observability/logger";

import {
  isAllowedVaSharedCacheKey,
  loadVaSharedCacheConfig,
  readVaSharedReferenceCache,
  runVaSharedKvCommand,
} from "./reference-shared-cache";
import { SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT } from "./shared-circuit";

type Env = Record<string, string | undefined>;

/**
 * Per-key single-flight for shared-cache misses (audit A-03).
 *
 * Five-minute TTLs expire across the fleet at once, so without coordination
 * every instance that misses the same key at the same moment issues its own
 * upstream request. One instance claims a short `SET … NX PX` lease per cache
 * key; contenders wait a bounded window for the winner to publish into the
 * shared cache and serve that value instead of duplicating the fetch.
 *
 * This is a dedupe optimization, **not** a safety control: the lease fails
 * open. An unconfigured or unreachable coordinator, a non-allowlisted key, or
 * an expired lease all mean "proceed with the normal fetch path", where the
 * distributed consumer budget still gates the attempt and fails closed on its
 * own. A lease that is never released (instance death) simply expires.
 */

/**
 * Must cover a whole logical fetch: every attempt at the 30 s per-attempt cap
 * (`VA_API_MAX_RETRIES + 1` attempts), inter-attempt backoff, and the shared
 * write at the end. The previous 45 s lease expired in the middle of a legal
 * three-attempt fetch, which let contenders start a duplicate fetch while the
 * winner was still running (audit B07: align or renew leases with the total
 * deadline). 120 s covers 3 × 30 s attempts plus backoff and KV overhead.
 */
export const VA_SHARED_FETCH_LEASE_MS = 120_000;
/** Bounded wait: contenders must not stall a page on someone else's fetch. */
export const VA_SHARED_FETCH_WAIT_ATTEMPTS = 3;
export const VA_SHARED_FETCH_WAIT_INTERVAL_MS = 200;

export type VaSharedFetchLeaseStatus = "acquired" | "contended" | "unavailable";

export interface VaSharedFetchLease {
  status: VaSharedFetchLeaseStatus;
  /** Present only when this instance holds the lease. */
  token: string | null;
}

const singleFlightLogger = createLogger("va-shared-single-flight");

/** Lease tokens this instance still holds, so release only deletes our own. */
const heldFetchLeases = new Map<string, string>();

function leaseKey(prefix: string, cacheKey: string): string {
  return `${prefix}inflight:${cacheKey}`;
}

function createLeaseToken(now: number): string {
  return `${now}-${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function acquireVaSharedFetchLease(
  key: string,
  options: { env?: Env } = {},
): Promise<VaSharedFetchLease> {
  const env = options.env ?? (process.env as Env);
  if (!isAllowedVaSharedCacheKey(key)) {
    singleFlightLogger.warn("va shared fetch lease unavailable");
    return { status: "unavailable", token: null };
  }
  const config = loadVaSharedCacheConfig(env);
  if (!config) return { status: "unavailable", token: null };

  const token = createLeaseToken(Date.now());
  const claim = await runVaSharedKvCommand(
    [
      "SET",
      leaseKey(config.prefix, key),
      token,
      "NX",
      "PX",
      String(VA_SHARED_FETCH_LEASE_MS),
    ],
    env,
  );
  if (!claim.ok || !claim.payload || claim.payload.error !== undefined) {
    singleFlightLogger.warn("va shared fetch lease unavailable");
    return { status: "unavailable", token: null };
  }
  if (claim.payload.result === "OK") {
    heldFetchLeases.set(key, token);
    singleFlightLogger.info("va shared fetch lease granted", { service: "va-reference" });
    return { status: "acquired", token };
  }
  if (claim.payload.result === null) {
    singleFlightLogger.info("va shared fetch lease contended", { service: "va-reference" });
    return { status: "contended", token: null };
  }
  singleFlightLogger.warn("va shared fetch lease unavailable");
  return { status: "unavailable", token: null };
}

/**
 * Bounded wait for the lease holder to publish a value. Returns the shared
 * value when one appears (the caller still applies its read-side trust guard),
 * or null after the bounded window, so the caller falls back to its own fetch.
 */
export async function awaitVaSharedFetchOutcome<T>(
  key: string,
  options: { env?: Env; attempts?: number; intervalMs?: number } = {},
): Promise<T | null> {
  const env = options.env ?? (process.env as Env);
  const attempts = options.attempts ?? VA_SHARED_FETCH_WAIT_ATTEMPTS;
  const intervalMs = options.intervalMs ?? VA_SHARED_FETCH_WAIT_INTERVAL_MS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(intervalMs);
    const value = await readVaSharedReferenceCache<T>(key, env);
    if (value) return value;
  }
  return null;
}

/**
 * Release a lease this instance still holds. The release is an atomic
 * compare-and-delete: a lease that expired and was re-claimed by another
 * instance between a read and a delete is never cancelled by the old owner
 * (audit B07: GET-then-DEL was not atomic).
 */
export async function releaseVaSharedFetchLease(
  key: string,
  token: string | null,
  options: { env?: Env } = {},
): Promise<void> {
  const held = heldFetchLeases.get(key);
  if (!token || held !== token) return;
  heldFetchLeases.delete(key);
  const env = options.env ?? (process.env as Env);
  const config = loadVaSharedCacheConfig(env);
  if (!config) return;

  const released = await runVaSharedKvCommand(
    [
      "EVAL",
      SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT,
      "1",
      leaseKey(config.prefix, key),
      token,
    ],
    env,
  );
  if (!released.ok || !released.payload || released.payload.error !== undefined) {
    singleFlightLogger.warn("va shared fetch lease release failed");
    return;
  }
  if (Number(released.payload.result) === 1) {
    singleFlightLogger.info("va shared fetch lease released", { service: "va-reference" });
  }
}

/** Test helper: drop in-memory lease bookkeeping (KV state is stubbed in tests). */
export function clearSharedSingleFlightStateForTests(): void {
  heldFetchLeases.clear();
}
