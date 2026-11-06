import "server-only";

import { createLogger } from "@/lib/observability/logger";

import { isDistributedRuntime, type RuntimeEnvironment } from "../runtime-deployment";
import {
  parseVaApiRateLimitGuidance,
  planVaApiConsumerPacing,
  type VaApiRateLimitHeaderSource,
} from "./api";
import {
  recordVaConsumerBudgetDecision,
  recordVaConsumerBudgetPacingCharge,
  recordVaConsumerBudgetPacingRefusal,
  type VaSharedConsumerBudgetOutcome,
} from "./consumer-budget-pressure";
import { VA_REFERENCE_CACHE_TTL_MS } from "./reference-cache";

type Env = Record<string, string | undefined>;

export interface VaSharedCacheConfig {
  url: string;
  token: string;
  prefix: string;
}

const VA_SHARED_CACHE_PREFIX_DEFAULT = "va:ref:";
// Best-effort timeout for the edge KV round-trip — must not dominate a
// force-dynamic page. 750ms keeps the shared-cache probe faster than the VA
// upstream timeout (4s) and retries. The deadline covers the *whole* exchange
// (headers **and** body), not just the response headers.
const SHARED_CACHE_TIMEOUT_MS = 750;
const SHARED_CACHE_MAX_KEY_LENGTH = 256;

/**
 * Shared-store byte budgets (audit A04: the read and write envelopes must be
 * the *same* envelope).
 *
 * The previous pair was 256 KiB admitted on write and 64 KiB bounded on read,
 * so a value between the two was written successfully and then returned a cache
 * miss on every later read — a silent, permanent no-op that also consumed the
 * per-namespace write budget. A Redis-REST reply wraps the stored envelope in a
 * JSON string (`{ result: [epoch, value] }`), so every quote or backslash
 * inside the envelope costs an extra byte on the way back; the size that
 * matters is therefore the **projected reply**, not the raw value.
 *
 * A write is admitted only when that projection fits the read budget minus
 * `VA_SHARED_CACHE_REPLY_RESERVE_BYTES`, a small reserve for reply framing the
 * projection does not model. Anything larger would be unreadable, so it is
 * refused up front instead of being stored. `readBoundedJsonObject` still caps
 * the body at the same budget and fails closed (a miss) rather than buffering
 * an oversized or hostile reply.
 */
export const VA_SHARED_CACHE_MAX_REPLY_BYTES = 64 * 1024;
export const VA_SHARED_CACHE_REPLY_RESERVE_BYTES = 512;

/**
 * Cache-key policy (audit A-03 item 5): the shared store is a cache, not a
 * generic KV. Keys are constrained to a conservative character set and to the
 * namespaces this client actually owns, so no caller can persist arbitrary
 * shapes (or arbitrary cardinality) under the operator prefix.
 */
export const VA_SHARED_CACHE_KEY_NAMESPACES: readonly string[] = [
  "forms:",
  // `forms-finder:` and `forms-reference:` are the disjoint namespaced roots
  // (`VA_REFERENCE_NAMESPACES`); `forms:` remains for legacy in-flight values
  // and direct module tests, so both key generations stay allowlisted.
  "forms-finder:",
  "forms-reference:",
  "accredited-rep:",
  "disabilities:",
  "service-branches:",
];
const SHARED_CACHE_KEY_PATTERN = /^[a-z0-9:_-]+$/;

/**
 * Return the allowlisted namespace label for `key` (`"forms:"`), or null when
 * the key is outside the policy. Coordination keys (circuit, probe lease,
 * consumer budget, epoch, cardinality) are fixed-shape constants owned by
 * their modules and never pass through this validator.
 */
export function vaSharedCacheKeyNamespace(key: string): string | null {
  if (!key || key.length > SHARED_CACHE_MAX_KEY_LENGTH) return null;
  if (!SHARED_CACHE_KEY_PATTERN.test(key)) return null;
  return VA_SHARED_CACHE_KEY_NAMESPACES.find((namespace) => key.startsWith(namespace)) ?? null;
}

export function isAllowedVaSharedCacheKey(key: string): boolean {
  return vaSharedCacheKeyNamespace(key) !== null;
}

/**
 * Global (store-wide) cache invalidation epoch.
 *
 * The admin cache-clear route cannot enumerate a shared KV's keys, so
 * invalidation is a version marker rather than a delete sweep: every cached
 * envelope is stamped with the epoch current when it was written, and a reader
 * accepts a value only when the epoch it observes **atomically** (one `MGET`)
 * matches. Bumping the epoch therefore invalidates cached entries for every
 * instance at once, without deleting keys or waiting out the entry TTL.
 *
 * The epoch key is absent until the first bump; an absent key is epoch "0", so
 * the first `INCR` (to 1) is itself a real advance. Unreadable or non-numeric
 * markers fail closed: readers see a miss and writers skip.
 */
export const VA_SHARED_CACHE_EPOCH_KEY = "cache-epoch";
export const VA_SHARED_CACHE_EPOCH_DEFAULT = "0";
export const VA_SHARED_CACHE_ENVELOPE_VERSION = 2;

/**
 * Publish a value only while the store-wide epoch is still the one the loader
 * observed before it started fetching.
 *
 * Checking in application code and then issuing an unconditional `SET` leaves a
 * clear race: the epoch can advance after the check but before the write, and a
 * pre-clear value would then be stamped with the new epoch and become readable
 * again. The comparison and write therefore happen in one Redis operation. A
 * straggler from before the clear returns 0 instead of overwriting a newer
 * post-clear entry.
 */
export const VA_SHARED_CACHE_CONDITIONAL_WRITE_SCRIPT = [
  "local current = redis.call('GET', KEYS[1])",
  "if current == false then current = '0' end",
  "if current ~= ARGV[1] then return 0 end",
  "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])",
  "return 1",
].join("\n");

/**
 * Finite write/cardinality budget: at most `VA_SHARED_KEY_WRITE_MAX_PER_WINDOW`
 * admitted writes per namespace per window. Every resident entry was created by
 * an admitted write, so resident keys per namespace are bounded by
 * `cap × ceil(TTL / window)` — with the 5-minute entry TTL and a matching
 * window, ≤ 2 × 240 = 480 per namespace and ≤ 1,920 across the four allowlisted
 * namespaces, independent of the process-local LRU limit. The counter is
 * per-window rather than per-key, which over-counts refreshes of a hot key:
 * the bound stays conservative, and a refused write only makes the cache
 * colder, never incorrect.
 *
 * That bound only holds while the counter is a counter and has a lifetime, so
 * the window reservation applies the same two rules as the consumer budget
 * below: the reply must be a non-negative safe integer (a coerced float, a
 * negative, a hex/exponent/padded string, or a JSON `true`/`[1]` is not a
 * count), and the lifetime applied on the window's first write must be
 * confirmed by the store — a counter that can never expire is an accumulating
 * key, not a bounded budget, so the slot is refused and the key removed.
 */
export const VA_SHARED_KEY_WRITE_WINDOW_SECONDS = 300;
export const VA_SHARED_KEY_WRITE_MAX_PER_WINDOW = 240;

const sharedLogger = createLogger("va-shared-cache");

/** Parse an epoch marker; an absent marker is epoch "0", garbage is null. */
function parseEpoch(raw: unknown): string | null {
  if (raw === null || raw === undefined) return VA_SHARED_CACHE_EPOCH_DEFAULT;
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw >= 0 ? String(raw) : null;
  }
  if (typeof raw === "string") return /^\d{1,20}$/.test(raw) ? raw : null;
  return null;
}

function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function firstPresent(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.trim() !== "") return value;
  }
  return undefined;
}

export function loadVaSharedCacheConfig(
  env: Env = process.env as Env,
): VaSharedCacheConfig | null {
  const rawUrl = firstPresent(
    env.VA_REFERENCE_SHARED_CACHE_URL,
    env.VA_REFERENCE_KV_REST_URL,
    env.UPSTASH_REDIS_REST_URL,
    env.KV_REST_API_URL,
  );
  const rawToken = firstPresent(
    env.VA_REFERENCE_SHARED_CACHE_TOKEN,
    env.VA_REFERENCE_KV_REST_TOKEN,
    env.UPSTASH_REDIS_REST_TOKEN,
    env.KV_REST_API_TOKEN,
  );

  const url = normalizeUrl(rawUrl);
  const token = rawToken?.trim() || null;
  if (!url || !token) return null;

  const prefix =
    env.VA_REFERENCE_SHARED_CACHE_PREFIX?.trim() ||
    env.VA_REFERENCE_KV_PREFIX?.trim() ||
    VA_SHARED_CACHE_PREFIX_DEFAULT;

  return { url, token, prefix };
}

export function isVaSharedCacheConfigured(env: Env = process.env as Env): boolean {
  return loadVaSharedCacheConfig(env) !== null;
}

function prefixedKey(key: string, prefix: string): string {
  return `${prefix}${key}`;
}

/**
 * Whether an operator has explicitly enabled the distributed consumer budget.
 *
 * A shared KV cache is a cache, not a rate-limit coordinator: writing a value
 * to a KV proves nothing about atomic counter semantics. The budget path is
 * therefore a separate, explicit opt-in (`VA_SHARED_CONSUMER_BUDGET=true`) so
 * a deployment that merely configures a cache URL cannot silently claim VA
 * quota coordination it does not have.
 */
export const VA_SHARED_CONSUMER_BUDGET_VARIABLE = "VA_SHARED_CONSUMER_BUDGET";

export function vaSharedConsumerBudgetEnabled(env: Env = process.env as Env): boolean {
  return env[VA_SHARED_CONSUMER_BUDGET_VARIABLE]?.trim().toLowerCase() === "true";
}

/**
 * Whether the fleet-wide consumer budget is actually in force here, and if not,
 * which prerequisite is missing.
 */
export interface VaSharedConsumerBudgetScope {
  /**
   * `fleet-shared` = every upstream attempt here reserves a slot in the fleet's
   * one window; `unenforced` = live VA access is refused before any attempt, so
   * nothing is bounded because nothing is sent; `not-required` = one process is
   * the whole fleet, so the per-instance outbound budget is the whole budget.
   */
  scope: "fleet-shared" | "unenforced" | "not-required";
  detail: string;
  /** True when the budget is at full strength here — enforced, or not needed. */
  full: boolean;
  /** Whether a shared coordinator is configured at all. */
  configured: boolean;
  /** Whether the explicit `VA_SHARED_CONSUMER_BUDGET` opt-in is set. */
  optIn: boolean;
  /** The operator's next action when the budget is not enforced. */
  blockedBy: "no-shared-budget-opt-in" | "no-shared-coordinator-configured" | null;
}

/**
 * Report the regime the consumer budget is in, in the budget's own terms.
 *
 * The budget is the control that makes a *shared* quota safe, so its scope answers
 * the one question a health surface cannot otherwise answer: is this deployment's
 * upstream traffic bounded by one shared window, and if not, what is missing? The
 * reservations that would show it are exactly the ones the gate refuses, which is
 * why the answer has to be a report rather than an observation.
 *
 * This is also the one capability that can be at full strength *while* distributed
 * (`fleet-shared`), because a shared atomic window is the correct fleet-wide form
 * of an in-process budget rather than a weaker version of it. The other available
 * readings are honest about what they are not: `unenforced` says live VA access is
 * refused outright (the same refusal `vaLiveIntegration` reports, from the
 * budget's side of it) instead of implying the fleet is unlimited.
 *
 * The verdict comes from the same three gates the reservation consults — the
 * runtime classification, the opt-in, and a configured coordinator — so a green
 * report cannot sit beside a closed gate.
 */
export function vaSharedConsumerBudgetScope(
  env: RuntimeEnvironment = process.env,
): VaSharedConsumerBudgetScope {
  const distributed = isDistributedRuntime(env);
  const configured = isVaSharedCacheConfigured(env);
  const optIn = vaSharedConsumerBudgetEnabled(env);

  if (!distributed) {
    return {
      scope: "not-required",
      detail: `one process is the whole fleet in this runtime, so the shared reservation is not consulted and the per-instance outbound budget (VA_API_OUTBOUND_WINDOW_MS / VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE) is the whole budget; the shared pressure counters stay structurally zero`,
      full: true,
      configured,
      optIn,
      blockedBy: null,
    };
  }

  if (!optIn) {
    return {
      scope: "unenforced",
      detail: `a distributed runtime requires the explicit ${VA_SHARED_CONSUMER_BUDGET_VARIABLE}=true opt-in before any upstream attempt is made, so no reservation is decided and the pressure counters stay structurally zero — live VA access itself is refused in this state, which is what the zero refusal count means here`,
      full: false,
      configured,
      optIn,
      blockedBy: "no-shared-budget-opt-in",
    };
  }

  if (!configured) {
    return {
      scope: "unenforced",
      detail: `the consumer-budget opt-in is set but no shared coordinator is configured (VA_REFERENCE_SHARED_CACHE_URL + TOKEN, or a vendor alias), so every upstream attempt is refused rather than granted a per-process budget`,
      full: false,
      configured,
      optIn,
      blockedBy: "no-shared-coordinator-configured",
    };
  }

  return {
    scope: "fleet-shared",
    detail: `every upstream attempt on this instance, including retries, reserves a slot in the fleet's one shared window (${VA_SHARED_CONSUMER_MAX_REQUESTS} per ${VA_SHARED_CONSUMER_WINDOW_MS} ms) before it reaches VA, so the budget bounds the whole fleet rather than this process; components.vaConsumerBudget.pressure reports this instance's share of the resulting refusals`,
    full: true,
    configured,
    optIn,
    blockedBy: null,
  };
}

/**
 * Execute one Redis-REST command under a whole-exchange deadline.
 *
 * The abort timer stays armed while the response **body** is read, so a
 * stalled body cannot outlive the timeout (the previous implementation
 * cleared the timer as soon as headers arrived and then called
 * `response.json()` unbounded). The body is also byte-capped while streaming,
 * so a hostile or oversized reply cannot be buffered whole. Redirects are
 * refused outright: the request carries the store bearer token, and a
 * followed redirect would replay that credential to another origin.
 */
async function postRedisCommand(
  config: VaSharedCacheConfig,
  command: unknown[],
  timeoutMs = SHARED_CACHE_TIMEOUT_MS,
): Promise<{ ok: boolean; payload: Record<string, unknown> | null }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) return { ok: false, payload: null };
    return { ok: true, payload: await readBoundedJsonObject(response) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Read at most `maxBytes` from a response body and parse it as a JSON object.
 * Returns null for oversized, empty, or non-object payloads — a KV reply that
 * is not an object is never coerced into a typed value.
 */
async function readBoundedJsonObject(
  response: Response,
  maxBytes = VA_SHARED_CACHE_MAX_REPLY_BYTES,
): Promise<Record<string, unknown> | null> {
  const body = response.body;
  if (!body) return null;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(merged));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeEnvelope(epoch: string, value: unknown): string | null {
  try {
    return JSON.stringify({
      envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
      epoch,
      value,
    });
  } catch {
    return null;
  }
}

/** Bytes the store would return for `serialized`, using the reader's own shape. */
function replyBytesFor(epoch: string, serialized: string): number {
  return Buffer.byteLength(JSON.stringify({ result: [epoch, serialized] }), "utf8");
}

/**
 * Project the KV reply byte count for a candidate value, or null when it cannot
 * be serialized. Exported so the write budget is a measurable number a test can
 * check against the read budget instead of a re-declared constant.
 */
export function vaSharedCacheReplyBytes(
  value: unknown,
  epoch: string = VA_SHARED_CACHE_EPOCH_DEFAULT,
): number | null {
  const serialized = serializeEnvelope(epoch, value);
  if (serialized === null) return null;
  return replyBytesFor(epoch, serialized);
}

export interface VaSharedReferenceCacheRead<T> {
  value: T | null;
  /**
   * The epoch observed in the same atomic `MGET` as `value`. A miss still
   * carries the current epoch, so a loader can make its later write conditional
   * on the invalidation state it actually observed before fetching.
   */
  epoch: string | null;
}

/**
 * Read a shared-cache value together with the epoch it was validated against.
 *
 * Keeping the epoch beside the value is what lets a later write distinguish
 * "the store changed while I was fetching" from "the store is unchanged". The
 * plain reader remains the value-only view for callers that do not write.
 */
export async function readVaSharedReferenceCacheSnapshot<T>(
  key: string,
  env: Env = process.env as Env,
): Promise<VaSharedReferenceCacheRead<T>> {
  if (!isAllowedVaSharedCacheKey(key)) return { value: null, epoch: null };
  const config = loadVaSharedCacheConfig(env);
  if (!config) return { value: null, epoch: null };

  const redisKey = prefixedKey(key, config.prefix);
  const epochKey = prefixedKey(VA_SHARED_CACHE_EPOCH_KEY, config.prefix);
  try {
    // MGET observes the invalidation epoch and the value in one atomic Redis
    // round-trip: a read can never see a pre-bump epoch together with a
    // post-bump value (or vice versa).
    const { ok, payload } = await postRedisCommand(config, ["MGET", epochKey, redisKey]);
    if (!ok || !payload) return { value: null, epoch: null };
    if (payload.error) {
      sharedLogger.warn("va shared cache read error");
      return { value: null, epoch: null };
    }
    const pair = payload.result;
    if (!Array.isArray(pair) || pair.length !== 2) return { value: null, epoch: null };
    const currentEpoch = parseEpoch(pair[0]);
    if (currentEpoch === null) return { value: null, epoch: null }; // unreadable marker: fail closed
    const raw = pair[1];
    if (raw == null) return { value: null, epoch: currentEpoch };
    // Only a JSON object envelope with the expected version marker *and* the
    // currently observed epoch is a typed cache hit. A bare string or a
    // pre-invalidation envelope is discarded rather than cast into the
    // caller's view type.
    if (typeof raw !== "string") return { value: null, epoch: currentEpoch };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { value: null, epoch: currentEpoch };
      }
      const envelope = parsed as { envelopeVersion?: unknown; epoch?: unknown; value?: unknown };
      if (envelope.envelopeVersion !== VA_SHARED_CACHE_ENVELOPE_VERSION) {
        return { value: null, epoch: currentEpoch };
      }
      if (typeof envelope.epoch !== "string" || envelope.epoch !== currentEpoch) {
        return { value: null, epoch: currentEpoch };
      }
      if (!envelope.value || typeof envelope.value !== "object" || Array.isArray(envelope.value)) {
        return { value: null, epoch: currentEpoch };
      }
      return { value: envelope.value as T, epoch: currentEpoch };
    } catch {
      return { value: null, epoch: currentEpoch };
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    sharedLogger.warn("va shared cache read failed", {
      outcome: isTimeout ? "timeout" : "network-error",
    });
    return { value: null, epoch: null };
  }
}

export async function readVaSharedReferenceCache<T>(
  key: string,
  env: Env = process.env as Env,
): Promise<T | null> {
  return (await readVaSharedReferenceCacheSnapshot<T>(key, env)).value;
}

export async function writeVaSharedReferenceCache<T>(
  key: string,
  value: T,
  ttlMs: number = VA_REFERENCE_CACHE_TTL_MS,
  env: Env = process.env as Env,
  /**
   * Epoch observed before the fetch. When supplied, the write is conditional on
   * the store still being at that epoch; `null` means the writer could not
   * observe the store and must fail closed. Omit for callers that intentionally
   * write against the current epoch.
   */
  expectedEpoch?: string | null,
): Promise<void> {
  const namespace = vaSharedCacheKeyNamespace(key);
  if (namespace === null) {
    sharedLogger.warn("va shared cache write skipped — key not allowlisted");
    return;
  }
  const config = loadVaSharedCacheConfig(env);
  if (!config) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  // The envelope must carry a readable epoch, so an unreadable marker skips the
  // write (fail closed) instead of persisting a value no reader could accept.
  // When the loader observed an epoch before fetching, use that value both as
  // the envelope stamp and as the conditional-write expectation.
  if (
    expectedEpoch !== undefined &&
    (expectedEpoch === null || !/^\d{1,20}$/.test(expectedEpoch))
  ) {
    sharedLogger.warn("va shared cache write skipped — epoch unavailable");
    return;
  }
  const epoch = expectedEpoch === undefined ? await readSharedCacheEpoch(config, env) : expectedEpoch;
  if (epoch === null) {
    sharedLogger.warn("va shared cache write skipped — epoch unavailable");
    return;
  }

  const serialized = serializeEnvelope(epoch, value);
  if (serialized === null) {
    sharedLogger.warn("va shared cache write skipped — unserializable value");
    return;
  }
  // A04: refuse anything a reader could not return, measured as the reply the
  // reader actually parses rather than the value's own byte count.
  const bytes = replyBytesFor(epoch, serialized);
  const budget = VA_SHARED_CACHE_MAX_REPLY_BYTES - VA_SHARED_CACHE_REPLY_RESERVE_BYTES;
  if (bytes > budget) {
    sharedLogger.warn("va shared cache write skipped — reply would exceed the read budget", {
      bytes,
    });
    return;
  }

  const admission = await reserveSharedCacheWriteSlot(config, namespace, env);
  if (admission !== "admitted") {
    sharedLogger.warn(
      admission === "exhausted"
        ? "va shared cache write skipped — key budget exceeded"
        : "va shared cache write skipped — key budget unavailable",
    );
    return;
  }

  const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
  const redisKey = prefixedKey(key, config.prefix);
  const epochKey = prefixedKey(VA_SHARED_CACHE_EPOCH_KEY, config.prefix);
  try {
    if (expectedEpoch !== undefined) {
      const { ok, payload } = await postRedisCommand(config, [
        "EVAL",
        VA_SHARED_CACHE_CONDITIONAL_WRITE_SCRIPT,
        "2",
        epochKey,
        redisKey,
        epoch,
        serialized,
        String(ttlSec),
      ]);
      if (!ok) {
        sharedLogger.warn("va shared cache write http error");
        return;
      }
      if (payload?.error) {
        sharedLogger.warn("va shared cache write error");
        return;
      }
      if (payload?.result !== 1 && payload?.result !== "1") {
        sharedLogger.warn("va shared cache write skipped — epoch changed");
      }
      return;
    }

    const { ok, payload } = await postRedisCommand(config, [
      "SET",
      redisKey,
      serialized,
      "EX",
      String(ttlSec),
    ]);
    if (!ok) {
      sharedLogger.warn("va shared cache write http error");
      return;
    }
    if (payload?.error) {
      sharedLogger.warn("va shared cache write error");
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    sharedLogger.warn("va shared cache write failed", {
      outcome: isTimeout ? "timeout" : "network-error",
    });
  }
}

/**
 * Read the store-wide invalidation epoch. Returns null when the marker cannot
 * be observed or is not a non-negative integer string — both fail closed.
 */
async function readSharedCacheEpoch(
  config: VaSharedCacheConfig,
  env: Env,
): Promise<string | null> {
  const read = await runVaSharedKvCommand(
    ["GET", prefixedKey(VA_SHARED_CACHE_EPOCH_KEY, config.prefix)],
    env,
  );
  if (!read.ok || !read.payload || read.payload.error !== undefined) return null;
  return parseEpoch(read.payload.result);
}

/**
 * Atomically advance the store-wide invalidation epoch. Every cached entry
 * written under the previous epoch becomes unreadable fleet-wide immediately.
 * Returns the new epoch, or null when the coordinator is unconfigured or
 * unreachable — a failed bump is reported, never silently treated as applied.
 */
export async function bumpVaSharedCacheEpoch(
  env: Env = process.env as Env,
): Promise<string | null> {
  const config = loadVaSharedCacheConfig(env);
  if (!config) return null;
  const result = await runVaSharedKvCommand(
    ["INCR", prefixedKey(VA_SHARED_CACHE_EPOCH_KEY, config.prefix)],
    env,
  );
  const epoch =
    result.ok && result.payload && result.payload.error === undefined
      ? parseEpoch(result.payload.result)
      : null;
  if (epoch === null || epoch === VA_SHARED_CACHE_EPOCH_DEFAULT) {
    sharedLogger.warn("va shared cache invalidation epoch unavailable");
    return null;
  }
  sharedLogger.info("va shared cache invalidation epoch advanced", {
    epoch: Number(epoch),
  });
  return epoch;
}

/**
 * Read a Redis-REST integer reply strictly. Accepts a non-negative safe integer
 * or its bare digit-string form and rejects fractions (`1.5`), negatives,
 * exponents, hex and whitespace-padded strings, JSON booleans and arrays, and
 * everything else — so no coerced value can authorise a slot or confirm a
 * counter's lifetime. Shared by the per-namespace write budget and the
 * distributed consumer budget.
 */
function readStrictCounter(reply: unknown): number | null {
  if (typeof reply === "number") {
    return Number.isSafeInteger(reply) && reply >= 0 ? reply : null;
  }
  if (typeof reply === "string" && /^\d{1,15}$/.test(reply)) {
    return Number.isSafeInteger(Number(reply)) ? Number(reply) : null;
  }
  return null;
}

/**
 * Admit one write against the namespace's per-window budget. Returns
 * `unavailable` when the counter cannot be read as a counter or cannot be given
 * a lifetime (fail closed), `exhausted` once the window cap is reached, and
 * `admitted` otherwise — so the caller can report the reason without guessing.
 */
type SharedCacheWriteAdmission = "admitted" | "exhausted" | "unavailable";

async function reserveSharedCacheWriteSlot(
  config: VaSharedCacheConfig,
  namespace: string,
  env: Env,
): Promise<SharedCacheWriteAdmission> {
  const windowBucket = Math.floor(Date.now() / (VA_SHARED_KEY_WRITE_WINDOW_SECONDS * 1000));
  const budgetKey = `${config.prefix}cardinality:${namespace.replace(/:$/, "")}:${windowBucket}`;
  try {
    const increment = await runVaSharedKvCommand(["INCR", budgetKey], env);
    if (!increment.ok || !increment.payload || increment.payload.error !== undefined) {
      return "unavailable";
    }
    const count = readStrictCounter(increment.payload.result);
    if (count === null || count < 1) return "unavailable";
    if (count > VA_SHARED_KEY_WRITE_MAX_PER_WINDOW) return "exhausted";
    if (count === 1) {
      // Bound the counter's lifetime, and require the store to confirm it: a
      // per-window counter that can never expire is an accumulating key, so an
      // unconfirmed lifetime removes it and refuses the write rather than
      // leaving one permanent key per window behind.
      const expire = await runVaSharedKvCommand(
        ["EXPIRE", budgetKey, String(VA_SHARED_KEY_WRITE_WINDOW_SECONDS)],
        env,
      );
      const lifetimeConfirmed =
        expire.ok &&
        expire.payload !== null &&
        expire.payload.error === undefined &&
        readStrictCounter(expire.payload.result) === 1;
      if (!lifetimeConfirmed) {
        await runVaSharedKvCommand(["DEL", budgetKey], env);
        sharedLogger.warn("va shared cache write budget unavailable", {
          outcome: "counter-lifetime-refused",
        });
        return "unavailable";
      }
    }
    return "admitted";
  } catch {
    return "unavailable";
  }
}

/**
 * Run one Redis-REST command against the configured shared store on behalf of
 * other coordination modules (circuit cooldown markers and probe leases).
 * Returns `{ ok: false }` when the store is unconfigured, unreachable, or the
 * exchange times out, so every caller can fail closed without throwing.
 */
export async function runVaSharedKvCommand(
  command: unknown[],
  env: Env = process.env as Env,
): Promise<{ ok: boolean; payload: Record<string, unknown> | null }> {
  const config = loadVaSharedCacheConfig(env);
  if (!config) return { ok: false, payload: null };
  try {
    return await postRedisCommand(config, command);
  } catch {
    sharedLogger.warn("va shared kv command failed");
    return { ok: false, payload: null };
  }
}

/**
 * Conservative **rolling** consumer budget (audit A03), decided in one atomic
 * server-side operation.
 *
 * VA enforces a per-consumer request quota across all instances, and a shared
 * GET/SET cache is not a rate limiter, so the distributed gate reserves a slot in
 * the shared store before every upstream attempt, including retries. It fails
 * closed (false) when the coordinator is missing, unreachable, or answers
 * anything this module cannot read as a decision.
 *
 * **One round trip, one atomic decision.** The rolling rule — this window's
 * count charged together with a weighted share of the predecessor window it
 * still overlaps — used to be assembled from two commands (`INCR` here, `GET` of
 * the predecessor there, plus a separate `EXPIRE`), so the two terms were read at
 * different instants and a concurrent reservation, or a stalled one, could be
 * decided against a predecessor that was still moving. It is now a single
 * `EVAL`: the script reads the predecessor, increments this window, establishes
 * the counter's lifetime, and applies the fence, all inside one server-side
 * operation that no other command can interleave with. The reservation's worst
 * case is therefore one bounded exchange instead of up to three.
 *
 * Three defects are closed here:
 *
 *   - **No fixed-minute boundary burst.** `floor(now / 60000)` admitted 60
 *     reservations at 59,999 ms and another 60 at 60,000 ms — 120 admissions
 *     against a budget of 60, one millisecond apart. The rolling rule refuses
 *     that burst: the predecessor's weight is still 1 at the boundary, so the
 *     second window admits nothing, and pacing recovers gradually as the overlap
 *     decays. `ceil` on the product keeps the approximation on the conservative
 *     side, so this is still conservative pacing rather than a hard sliding
 *     window — but the pacing is now atomic, which is what makes the bound hold
 *     under concurrency rather than only in sequence.
 *   - **No superseded window.** A reservation whose window the store has already
 *     moved past — a call stalled long enough to cross a boundary, or an instance
 *     whose clock lags the fleet's — is refused instead of being decided against
 *     a predecessor other instances are still writing. Without that fence the
 *     straddling case is exactly the fixed-minute burst again, released by
 *     latency instead of by the clock: N instances admit a window's budget while
 *     the previous window's callers have not landed yet, and then those callers
 *     admit theirs. The fence makes the cross-boundary total at most one budget.
 *     It is deliberately one-sided: an instance whose clock *leads* the fleet's
 *     opens the next window early and causes the lagging instances to be refused,
 *     so clock skew can only narrow the fleet's traffic, never widen it.
 *   - **Strict decision validation.** The reply must be a decision code
 *     (`VA_SHARED_CONSUMER_DECISION`), read as a non-negative safe integer in
 *     either Redis-REST encoding; a fractional, negative, unknown, or erroring
 *     reply refuses the slot instead of being coerced. The predecessor's value is
 *     validated with the same strictness *inside* the script (a non-integer
 *     predecessor refuses the slot), so a corrupted counter can never be
 *     arithmetic fuel. The counter's lifetime is established in the same atomic
 *     step as the increment, which closes the old hole where the instance that
 *     created the counter could die — or fail its `EXPIRE` — and leave a
 *     lifetime-less counter behind.
 *
 * A refused *exhausted* reservation still consumes a slot, exactly as before,
 * because the script increments before it decides. That over-count keeps the
 * budget conservative: a refused attempt can only reduce traffic against VA.
 * Refusals that are not about the budget — a superseded window, an invalid
 * predecessor, an unreadable reply — are decided before the increment and so
 * spend nothing, because there is no window for them to be counted in.
 *
 * The upstream's own `ratelimit-remaining`/`reset` guidance is consumed by
 * `applyVaConsumerPacingGuidance` below, in the only direction that needs no
 * confirmed policy: it can add reservations to this budget, never remove them,
 * and guidance this module cannot read exactly changes nothing.
 *
 * Still unconfirmed, and therefore still an operator item: the issued
 * consumer's rolling/fixed/reset semantics, its environment and
 * credential-sharing key scope, and whether a confirmed quota policy may
 * **relax** this pacing. Issue #287 owns that evidence; this module does not
 * guess at it, and its narrowing is one-way, so a confirmed policy that
 * permits more can only be applied by changing this code deliberately.
 *
 * This is only consulted when `VA_SHARED_CONSUMER_BUDGET=true`; see
 * `vaSharedConsumerBudgetEnabled`.
 */
export const VA_SHARED_CONSUMER_WINDOW_MS = 60_000;
export const VA_SHARED_CONSUMER_MAX_REQUESTS = 60;
/**
 * Lifetime of one window's counter. Longer than the window itself, so the next
 * window can still read it as its pacing predecessor, and short enough that a
 * counter cannot accumulate in the store.
 */
export const VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS = 120;

/**
 * The decision codes `SHARED_CONSUMER_WINDOW_SCRIPT` returns.
 *
 * Exported as names rather than bare integers because three layers have to agree
 * on them: the script (Lua), the reservation (which validates the reply), and the
 * store fake the concurrency proof runs against.
 */
export const VA_SHARED_CONSUMER_DECISION = {
  /** A slot was reserved for this window. */
  admitted: 1,
  /** This window's budget is spent; the increment still counted. */
  exhausted: 2,
  /** The predecessor counter is not a strictly valid non-negative integer. */
  predecessorInvalid: 3,
  /** The store already holds a later window, so this reservation is behind it. */
  supersededWindow: 4,
  /** Defensive: the counter could not be given the lifetime it must have. */
  counterLifetimeRefused: 5,
} as const;

export type VaSharedConsumerDecision =
  (typeof VA_SHARED_CONSUMER_DECISION)[keyof typeof VA_SHARED_CONSUMER_DECISION];

/**
 * The whole rolling admission decision, as one server-side operation (audit A03).
 *
 * `KEYS[1]` is this window's counter, `KEYS[2]` its predecessor's (an impossible
 * key when there is none, so the script reads a miss), `KEYS[3]` its successor's.
 * `ARGV[1]` is the budget, `ARGV[2]` the elapsed milliseconds inside this window,
 * `ARGV[3]` the window length in milliseconds, `ARGV[4]` the counter's lifetime in
 * seconds. It returns one of `VA_SHARED_CONSUMER_DECISION`.
 *
 * Order matters and is deliberate:
 *
 *   1. The successor check comes first: a reservation for a window the store has
 *      already moved past is refused before anything is written, because deciding
 *      it would be deciding it against a predecessor other callers are still
 *      writing (see the block comment above).
 *   2. The predecessor is validated *strictly* — digits only, at most fifteen of
 *      them — so a fractional, negative, padded, or non-numeric counter refuses
 *      the slot instead of fuelling the arithmetic.
 *   3. The increment happens before the decision, preserving the documented
 *      over-count: an exhausted refusal still costs a slot, which can only reduce
 *      traffic against VA.
 *   4. The lifetime is established in the same atomic step, so no window's
 *      counter can be left behind without one.
 *
 * Run against a store whose `EVAL` is unavailable, every branch fails closed: the
 * command errors, the caller sees no decision code, and the slot is refused.
 */
export const SHARED_CONSUMER_WINDOW_SCRIPT = [
  "if redis.call('EXISTS', KEYS[3]) == 1 then return 4 end",
  "local carry = 0",
  "local previous = redis.call('GET', KEYS[2])",
  "if previous ~= false then",
  "  if string.len(previous) > 15 or string.match(previous, '^%d+$') == nil then return 3 end",
  "  local weight = (tonumber(ARGV[3]) - tonumber(ARGV[2])) / tonumber(ARGV[3])",
  "  if weight < 0 then weight = 0 end",
  "  if weight > 1 then weight = 1 end",
  "  carry = math.ceil(tonumber(previous) * weight)",
  "end",
  "local count = redis.call('INCR', KEYS[1])",
  "if redis.call('TTL', KEYS[1]) < 0 then",
  "  if tonumber(ARGV[4]) == nil or tonumber(ARGV[4]) < 1 or redis.call('EXPIRE', KEYS[1], ARGV[4]) ~= 1 then",
  "    redis.call('DEL', KEYS[1])",
  "    return 5",
  "  end",
  "end",
  "if count + carry <= tonumber(ARGV[1]) then return 1 end",
  "return 2",
].join("\n");

/**
 * Read a decision code without coercing it.
 *
 * Redis-REST encodes a Lua number as a JSON number or its digit-string form, and
 * proxies differ on whether a scalar return is wrapped in a one-element array, so
 * both shapes are accepted — and nothing else is.
 */
function readDecisionCode(reply: unknown): number | null {
  const raw = Array.isArray(reply) && reply.length === 1 ? reply[0] : reply;
  return readStrictCounter(raw);
}

/**
 * Reserve one slot in the shared consumer budget, in a single atomic operation.
 *
 * Returns whether the caller may make this upstream attempt. Every failure mode —
 * an unconfigured or unreachable coordinator, an erroring reply, an unreadable
 * decision code, a refused lifetime, an invalid predecessor, or a window the
 * store has already superseded — returns `false` with a warning, so the caller's
 * fallback path is the same for all of them and none of them can spend quota.
 *
 * Every one of those paths also records its outcome in `consumer-budget-pressure.ts`,
 * through the single `decide` helper below, so the admit/refuse pressure reported
 * on `/api/health` is written by the same statement that makes the decision. A
 * refusal reason the recorder does not know cannot be introduced without a type
 * error, and a decision that returns without recording cannot be introduced
 * without dropping the helper.
 */
export async function reserveVaSharedConsumerSlot(
  env: Env = process.env as Env,
  now = Date.now(),
): Promise<boolean> {
  const decide = (outcome: VaSharedConsumerBudgetOutcome): boolean => {
    recordVaConsumerBudgetDecision({ outcome, now, windowMs: VA_SHARED_CONSUMER_WINDOW_MS });
    return outcome === "admitted";
  };

  const config = loadVaSharedCacheConfig(env);
  if (!config) return decide("store-unconfigured");
  // A clock the bucket arithmetic cannot represent would key a counter by
  // `NaN` or a negative index; refuse instead of pretending that is a window.
  if (!Number.isSafeInteger(now) || now < 0) return decide("clock-unusable");

  const budgetKey = (index: number) => `${config.prefix}budget:${index}`;
  const bucket = Math.floor(now / VA_SHARED_CONSUMER_WINDOW_MS);
  try {
    const exchange = await postRedisCommand(config, [
      "EVAL",
      SHARED_CONSUMER_WINDOW_SCRIPT,
      "3",
      budgetKey(bucket),
      // An impossible key as the predecessor: reservations only ever write
      // `bucket >= 0`, so a miss is the honest representation of "no predecessor".
      budgetKey(bucket - 1),
      budgetKey(bucket + 1),
      String(VA_SHARED_CONSUMER_MAX_REQUESTS),
      String(now - bucket * VA_SHARED_CONSUMER_WINDOW_MS),
      String(VA_SHARED_CONSUMER_WINDOW_MS),
      String(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS),
    ]);
    if (!exchange.ok || !exchange.payload || exchange.payload.error !== undefined) {
      return decide("store-unreachable");
    }

    const code = readDecisionCode(exchange.payload.result);
    switch (code) {
      case VA_SHARED_CONSUMER_DECISION.admitted:
        return decide("admitted");
      case VA_SHARED_CONSUMER_DECISION.exhausted:
        sharedLogger.warn("va shared consumer budget exhausted", { outcome: "refused" });
        return decide("exhausted");
      case VA_SHARED_CONSUMER_DECISION.supersededWindow:
        sharedLogger.warn("va shared consumer budget unavailable", {
          outcome: "superseded-window",
        });
        return decide("superseded-window");
      case VA_SHARED_CONSUMER_DECISION.predecessorInvalid:
        sharedLogger.warn("va shared consumer budget unavailable", {
          outcome: "predecessor-invalid",
        });
        return decide("predecessor-invalid");
      case VA_SHARED_CONSUMER_DECISION.counterLifetimeRefused:
        sharedLogger.warn("va shared consumer budget unavailable", {
          outcome: "counter-lifetime-refused",
        });
        return decide("counter-lifetime-refused");
      default:
        sharedLogger.warn("va shared consumer budget unavailable", {
          outcome: "unreadable-decision",
        });
        return decide("unreadable-decision");
    }
  } catch {
    sharedLogger.warn("va shared consumer budget unavailable");
    return decide("store-unreachable");
  }
}

/** What one attempt to apply upstream rate-limit guidance to the budget did. */
export interface VaSharedConsumerPacingOutcome {
  /** True only when the charge was written to the shared counter. */
  applied: boolean;
  reason:
    | "quota-deficit"
    | "no-guidance"
    | "headroom-ample"
    | "reset-imminent"
    | "store-unconfigured"
    | "charge-refused";
  /** Reservations charged against this window's budget (0 when nothing was). */
  extraReservations: number;
}

/**
 * Feed the upstream's own rate-limit guidance into the shared consumer budget.
 *
 * The budget above approximates VA's per-consumer quota with a local rolling
 * window. When a response states how much quota is actually left, that statement
 * is strictly better information than the approximation, and the conservative
 * way to use it is to charge the local counter for the difference — see
 * `planVaApiConsumerPacing`, which owns the arithmetic and the direction rule.
 *
 * Three properties matter more than the arithmetic here:
 *
 *   1. **Tightening only.** The charge is a positive `INCRBY` against the
 *      current window's counter. Nothing in this function can lower a counter,
 *      raise the cap, or extend a window, so no header the upstream sends can
 *      loosen the pacing. A confirmed VA policy could justify relaxing it; that
 *      is an operator decision this module does not pre-empt.
 *   2. **Fail-soft, never fail-open-by-accident and never throw.** The caller is
 *      holding a live upstream response, so an unconfigured, unreachable, or
 *      uncooperative store must not turn that response into a fallback. Every
 *      failure returns `{ applied: false }` and logs; the reservation path stays
 *      the fail-closed control it already is.
 *   3. **A charged counter still has a lifetime.** A charge can create the
 *      window's counter before any reservation does, so the `EXPIRE` that the
 *      reservation would normally apply is applied here, validated the same
 *      strict way, and an unconfirmable lifetime deletes the key rather than
 *      leaving one permanent key per window in the store.
 *
 * Repeated observations re-charge: a fleet that keeps seeing a short quota
 * tightens further, and the counter can only rise, so the effect is bounded to
 * one window (the counter's own TTL) and to traffic the upstream has already
 * said it does not have.
 *
 * Only called on the distributed request path, where a shared coordinator is
 * already required; with no store configured it returns without any traffic.
 */
export async function applyVaConsumerPacingGuidance(
  headers: VaApiRateLimitHeaderSource,
  env: Env = process.env as Env,
  now = Date.now(),
): Promise<VaSharedConsumerPacingOutcome> {
  const idle = (
    reason: VaSharedConsumerPacingOutcome["reason"],
  ): VaSharedConsumerPacingOutcome => {
    // A refused charge is not a refused request — the response it came with is
    // still served — so it is counted beside the reservation pressure rather than
    // in it. `charge-refused` is exactly the set of paths where a charge was
    // attempted and the store would not take it; `store-unconfigured` made no
    // attempt, and the remaining reasons are the upstream saying there is nothing
    // to charge.
    if (reason === "charge-refused") recordVaConsumerBudgetPacingRefusal();
    return { applied: false, reason, extraReservations: 0 };
  };

  const config = loadVaSharedCacheConfig(env);
  if (!config) return idle("store-unconfigured");
  // An unusable clock would charge a bucket key the reservations never consult.
  if (!Number.isSafeInteger(now) || now < 0) return idle("charge-refused");

  const plan = planVaApiConsumerPacing({
    guidance: parseVaApiRateLimitGuidance(headers),
    maxRequests: VA_SHARED_CONSUMER_MAX_REQUESTS,
    windowMs: VA_SHARED_CONSUMER_WINDOW_MS,
  });
  if (!plan.adapt) return idle(plan.reason);

  const budgetKey = `${config.prefix}budget:${Math.floor(now / VA_SHARED_CONSUMER_WINDOW_MS)}`;
  try {
    const charge = await postRedisCommand(config, [
      "INCRBY",
      budgetKey,
      String(plan.extraReservations),
    ]);
    if (!charge.ok || !charge.payload || charge.payload.error !== undefined) {
      sharedLogger.warn("va shared consumer budget unavailable", {
        outcome: "pacing-charge-refused",
      });
      return idle("charge-refused");
    }
    // The reply is the counter's new value, so it can never be below the amount
    // just charged; anything else is a store this module cannot read a counter
    // from, and the charge is not counted as applied.
    const count = readStrictCounter(charge.payload.result);
    if (count === null || count < plan.extraReservations) {
      sharedLogger.warn("va shared consumer budget unavailable", {
        outcome: "pacing-charge-invalid",
      });
      return idle("charge-refused");
    }

    if (count === plan.extraReservations) {
      // This charge created the counter, so it owes the lifetime the reservation
      // path applies: a counter that can never expire is one accumulating key
      // per window, which is the defect the reservation already refuses.
      const expire = await postRedisCommand(config, [
        "EXPIRE",
        budgetKey,
        String(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS),
      ]);
      const ttlApplied =
        expire.ok &&
        expire.payload !== null &&
        expire.payload.error === undefined &&
        readStrictCounter(expire.payload.result) === 1;
      if (!ttlApplied) {
        await postRedisCommand(config, ["DEL", budgetKey]);
        sharedLogger.warn("va shared consumer budget unavailable", {
          outcome: "pacing-counter-lifetime-refused",
        });
        return idle("charge-refused");
      }
    }

    sharedLogger.warn("va shared consumer budget paced by upstream guidance", {
      outcome: "upstream-quota-deficit",
      count: plan.extraReservations,
    });
    recordVaConsumerBudgetPacingCharge({ reservations: plan.extraReservations, now });
    return {
      applied: true,
      reason: "quota-deficit",
      extraReservations: plan.extraReservations,
    };
  } catch {
    sharedLogger.warn("va shared consumer budget unavailable");
    return idle("charge-refused");
  }
}

export function clearVaSharedCacheEnvForTests(): void {
  // No in-memory state — helper for test ergonomics when stubbing env
}
