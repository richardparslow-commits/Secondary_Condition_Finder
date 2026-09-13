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
// upstream timeout (4s) and retries.
const SHARED_CACHE_TIMEOUT_MS = 750;
const SHARED_CACHE_MAX_VALUE_BYTES = 256 * 1024; // 256 KiB guard — reference views are small

const sharedLogger = createLogger("va-shared-cache");

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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = SHARED_CACHE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readVaSharedReferenceCache<T>(
  key: string,
  env: Env = process.env as Env,
): Promise<T | null> {
  const config = loadVaSharedCacheConfig(env);
  if (!config) return null;

  const redisKey = prefixedKey(key, config.prefix);
  try {
    const response = await fetchWithTimeout(
      config.url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["GET", redisKey]),
      },
      SHARED_CACHE_TIMEOUT_MS,
    );

    if (!response.ok) {
      sharedLogger.warn("va shared cache read http error", {
        key,
        status: response.status,
      });
      return null;
    }

    const payload = (await response.json()) as { result?: string | null; error?: string };
    if (payload.error) {
      sharedLogger.warn("va shared cache read error", { key, error: payload.error });
      return null;
    }
    const raw = payload.result;
    if (raw == null) return null;
    // Upstash returns the stored string value; we stored JSON.stringify(view)
    if (typeof raw !== "string") return raw as unknown as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // If stored as plain string (legacy), return as-is when T is string-like
      return raw as unknown as T;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    sharedLogger.warn("va shared cache read failed", {
      key,
      outcome: isTimeout ? "timeout" : "network-error",
      message,
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
  const config = loadVaSharedCacheConfig(env);
  if (!config) return;

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    sharedLogger.warn("va shared cache write skipped — unserializable value", { key });
    return;
  }
  if (Buffer.byteLength(serialized, "utf8") > SHARED_CACHE_MAX_VALUE_BYTES) {
    sharedLogger.warn("va shared cache write skipped — value too large", {
      key,
      bytes: Buffer.byteLength(serialized, "utf8"),
    });
    return;
  }

  const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
  const redisKey = prefixedKey(key, config.prefix);
  try {
    const response = await fetchWithTimeout(
      config.url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", redisKey, serialized, "EX", String(ttlSec)]),
      },
      SHARED_CACHE_TIMEOUT_MS,
    );

    if (!response.ok) {
      sharedLogger.warn("va shared cache write http error", {
        key,
        status: response.status,
      });
      return;
    }

    const payload = (await response.json()) as { result?: string; error?: string };
    if (payload.error) {
      sharedLogger.warn("va shared cache write error", { key, error: payload.error });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    sharedLogger.warn("va shared cache write failed", {
      key,
      outcome: isTimeout ? "timeout" : "network-error",
      message,
    });
  }
}

export function clearVaSharedCacheEnvForTests(): void {
  // No in-memory state — helper for test ergonomics when stubbing env
}
