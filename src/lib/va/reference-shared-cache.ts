import "server-only";

import { createLogger } from "@/lib/observability/logger";
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
const SHARED_CACHE_MAX_VALUE_BYTES = 256 * 1024; // 256 KiB guard — reference views are small
const SHARED_CACHE_MAX_RESPONSE_BYTES = 64 * 1024; // bounded read for KV command replies
const SHARED_CACHE_MAX_KEY_LENGTH = 256;

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
 * Finite write/cardinality budget: at most `VA_SHARED_KEY_WRITE_MAX_PER_WINDOW`
 * admitted writes per namespace per window. Every resident entry was created by
 * an admitted write, so resident keys per namespace are bounded by
 * `cap × ceil(TTL / window)` — with the 5-minute entry TTL and a matching
 * window, ≤ 2 × 240 = 480 per namespace and ≤ 1,920 across the four allowlisted
 * namespaces, independent of the process-local LRU limit. The counter is
 * per-window rather than per-key, which over-counts refreshes of a hot key:
 * the bound stays conservative, and a refused write only makes the cache
 * colder, never incorrect.
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
  maxBytes = SHARED_CACHE_MAX_RESPONSE_BYTES,
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

export async function readVaSharedReferenceCache<T>(
  key: string,
  env: Env = process.env as Env,
): Promise<T | null> {
  if (!isAllowedVaSharedCacheKey(key)) return null;
  const config = loadVaSharedCacheConfig(env);
  if (!config) return null;

  const redisKey = prefixedKey(key, config.prefix);
  const epochKey = prefixedKey(VA_SHARED_CACHE_EPOCH_KEY, config.prefix);
  try {
    // MGET observes the invalidation epoch and the value in one atomic Redis
    // round-trip: a read can never see a pre-bump epoch together with a
    // post-bump value (or vice versa).
    const { ok, payload } = await postRedisCommand(config, ["MGET", epochKey, redisKey]);
    if (!ok || !payload) return null;
    if (payload.error) {
      sharedLogger.warn("va shared cache read error");
      return null;
    }
    const pair = payload.result;
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const currentEpoch = parseEpoch(pair[0]);
    if (currentEpoch === null) return null; // unreadable marker: fail closed
    const raw = pair[1];
    if (raw == null) return null;
    // Only a JSON object envelope with the expected version marker *and* the
    // currently observed epoch is a typed cache hit. A bare string or a
    // pre-invalidation envelope is discarded rather than cast into the
    // caller's view type.
    if (typeof raw !== "string") return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const envelope = parsed as { envelopeVersion?: unknown; epoch?: unknown; value?: unknown };
      if (envelope.envelopeVersion !== VA_SHARED_CACHE_ENVELOPE_VERSION) return null;
      if (typeof envelope.epoch !== "string" || envelope.epoch !== currentEpoch) return null;
      if (!envelope.value || typeof envelope.value !== "object" || Array.isArray(envelope.value)) return null;
      return envelope.value as T;
    } catch {
      return null;
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    sharedLogger.warn("va shared cache read failed", {
      outcome: isTimeout ? "timeout" : "network-error",
    });
    return null;
  }
}

export async function writeVaSharedReferenceCache<T>(
  key: string,
  value: T,
  ttlMs: number = VA_REFERENCE_CACHE_TTL_MS,
  env: Env = process.env as Env,
): Promise<void> {
  const namespace = vaSharedCacheKeyNamespace(key);
  if (namespace === null) {
    sharedLogger.warn("va shared cache write skipped — key not allowlisted");
    return;
  }
  const config = loadVaSharedCacheConfig(env);
  if (!config) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  // The envelope must carry the epoch that is current at write time, so an
  // unreadable marker skips the write (fail closed) instead of persisting a
  // value no reader could accept.
  const epoch = await readSharedCacheEpoch(config, env);
  if (epoch === null) {
    sharedLogger.warn("va shared cache write skipped — epoch unavailable");
    return;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify({
      envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
      epoch,
      value,
    });
  } catch {
    sharedLogger.warn("va shared cache write skipped — unserializable value");
    return;
  }
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > SHARED_CACHE_MAX_VALUE_BYTES) {
    sharedLogger.warn("va shared cache write skipped — value too large", { bytes });
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
  try {
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
 * Admit one write against the namespace's per-window budget. Returns
 * `unavailable` when the counter cannot be read (fail closed), `exhausted`
 * once the window cap is reached, and `admitted` otherwise — so the caller can
 * report the reason without guessing.
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
    const count = Number(increment.payload.result);
    if (!Number.isSafeInteger(count) || count < 1) return "unavailable";
    if (count > VA_SHARED_KEY_WRITE_MAX_PER_WINDOW) return "exhausted";
    if (count === 1) {
      // Bound the counter's lifetime. A failed EXPIRE only leaves one small
      // per-window key behind — later windows use a different bucket key.
      await runVaSharedKvCommand(
        ["EXPIRE", budgetKey, String(VA_SHARED_KEY_WRITE_WINDOW_SECONDS)],
        env,
      );
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
 * VA enforces a per-consumer request quota (60/minute) across all instances.
 * A shared GET/SET cache is not a rate limiter, so the distributed gate must
 * atomically reserve a slot in the shared store before every upstream attempt,
 * including retries. Fails closed (false) when the coordinator is missing,
 * unreachable, or returns a non-numeric result.
 *
 * This is only consulted when `VA_SHARED_CONSUMER_BUDGET=true`; see
 * `vaSharedConsumerBudgetEnabled`.
 */
export const VA_SHARED_CONSUMER_WINDOW_SECONDS = 120;
export const VA_SHARED_CONSUMER_MAX_REQUESTS = 60;

export async function reserveVaSharedConsumerSlot(
  env: Env = process.env as Env,
  now = Date.now(),
): Promise<boolean> {
  const config = loadVaSharedCacheConfig(env);
  if (!config) return false;

  const windowKey = `${config.prefix}budget:${Math.floor(now / 60_000)}`;
  try {
    const increment = await postRedisCommand(config, ["INCR", windowKey]);
    if (!increment.ok || !increment.payload) return false;
    const count = Number(increment.payload.result);
    if (!Number.isFinite(count) || count < 1) return false;

    if (count === 1) {
      // Bound the counter so an abandoned window cannot accumulate forever.
      await postRedisCommand(config, [
        "EXPIRE",
        windowKey,
        String(VA_SHARED_CONSUMER_WINDOW_SECONDS),
      ]);
    }
    return count <= VA_SHARED_CONSUMER_MAX_REQUESTS;
  } catch {
    sharedLogger.warn("va shared consumer budget unavailable");
    return false;
  }
}

export function clearVaSharedCacheEnvForTests(): void {
  // No in-memory state — helper for test ergonomics when stubbing env
}
