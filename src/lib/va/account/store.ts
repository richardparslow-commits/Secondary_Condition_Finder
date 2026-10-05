import "server-only";

import { createHash } from "node:crypto";

import { isDistributedRuntime } from "@/lib/runtime-deployment";
import { openSessionPayload, sealSessionPayload } from "@/lib/workflow-session-crypto";

import { type AccountEnv, type VaAccountConfig } from "./config";

export interface AccountStore {
  put(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
  read(key: string): Promise<unknown | null>;
  consume(key: string): Promise<unknown | null>;
  replace(key: string, expected: unknown, value: unknown, ttlSeconds: number): Promise<boolean>;
  remove(key: string): Promise<boolean>;
}

class MemoryAccountStore implements AccountStore {
  private entries = new Map<string, { sealed: string; expiresAt: number }>();
  constructor(private secret: string) {}
  private live(key: string) {
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= Date.now()) this.entries.delete(id);
    }
    return this.entries.get(key);
  }
  async put(key: string, value: unknown, ttlSeconds: number) {
    if (this.live(key) || this.entries.size >= 256) return false;
    this.entries.set(key, { sealed: sealSessionPayload(value, this.secret, { maxAgeSeconds: ttlSeconds }), expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  async read(key: string) {
    const entry = this.live(key);
    return entry ? openSessionPayload(entry.sealed, this.secret) : null;
  }
  async consume(key: string) {
    const entry = this.live(key);
    this.entries.delete(key);
    return entry ? openSessionPayload(entry.sealed, this.secret) : null;
  }
  async replace(key: string, expected: unknown, value: unknown, ttlSeconds: number) {
    const entry = this.live(key);
    if (!entry || JSON.stringify(openSessionPayload(entry.sealed, this.secret)) !== JSON.stringify(expected)) return false;
    this.entries.set(key, { sealed: sealSessionPayload(value, this.secret, { maxAgeSeconds: ttlSeconds }), expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  async remove(key: string) {
    this.entries.delete(key);
    return true;
  }
}

export function createMemoryAccountStore(secret: string): AccountStore {
  return new MemoryAccountStore(secret);
}

/** One bounded exchange; abort covers response body, not just headers. */
export async function boundedAccountJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw new Error("Account response unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error("Account response exceeds limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

class SharedAccountStore implements AccountStore {
  private observed = new Map<string, string>();
  constructor(private url: string, private token: string, private secret: string) {}
  private key(key: string) { return `va:account:sandbox:${key}`; }
  private async command(command: unknown[]): Promise<{ success: boolean; result: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 750);
    try {
      const response = await fetch(this.url, {
        method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) return { success: false, result: null };
      const data = await boundedAccountJson(response, 128 * 1024);
      if (!data || typeof data !== "object" || Array.isArray(data) || "error" in data || !("result" in data)) return { success: false, result: null };
      return { success: true, result: data.result };
    } catch {
      // No exception, token, URL, or command body enters a logging sink.
      return { success: false, result: null };
    } finally { clearTimeout(timer); }
  }
  async put(key: string, value: unknown, ttlSeconds: number) {
    const sealed = sealSessionPayload(value, this.secret, { maxAgeSeconds: ttlSeconds });
    const reply = await this.command(["SET", this.key(key), sealed, "NX", "EX", String(ttlSeconds)]);
    return reply.success && reply.result === "OK";
  }
  async read(key: string) {
    const reply = await this.command(["GET", this.key(key)]);
    if (!reply.success || typeof reply.result !== "string") return null;
    const opened = openSessionPayload(reply.result, this.secret);
    if (opened !== null) this.observed.set(key, reply.result);
    return opened;
  }
  async consume(key: string) {
    // GETDEL is atomic: concurrent/replayed callbacks cannot both redeem.
    const reply = await this.command(["GETDEL", this.key(key)]);
    return reply.success && typeof reply.result === "string" ? openSessionPayload(reply.result, this.secret) : null;
  }
  async replace(key: string, expected: unknown, value: unknown, ttlSeconds: number) {
    const sealedExpected = this.observed.get(key);
    this.observed.delete(key);
    if (!sealedExpected || JSON.stringify(openSessionPayload(sealedExpected, this.secret)) !== JSON.stringify(expected)) return false;
    const sealed = sealSessionPayload(value, this.secret, { maxAgeSeconds: ttlSeconds });
    const script = "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1 else return 0 end";
    const reply = await this.command(["EVAL", script, "1", this.key(key), sealedExpected, sealed, String(ttlSeconds)]);
    return reply.success && reply.result === 1;
  }
  async remove(key: string) {
    const reply = await this.command(["DEL", this.key(key)]);
    return reply.success && (reply.result === 0 || reply.result === 1);
  }
}

const localStores = new Map<string, AccountStore>();

export function loadAccountStore(config: VaAccountConfig, env: AccountEnv = process.env): AccountStore | null {
  const url = env.VA_ACCOUNT_STORE_URL?.trim();
  const token = env.VA_ACCOUNT_STORE_TOKEN?.trim();
  if (url && token) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
      return new SharedAccountStore(parsed.toString(), token, config.encryptionSecret);
    } catch { return null; }
  }
  // No implicit in-memory fallback on a hosted or production-mode runtime. The
  // classification comes from the shared fact (`runtime-deployment.ts`) rather
  // than a private marker list, so this store cannot disagree with the VA
  // cache and rate limiter about what "distributed" means.
  if (env.VA_ACCOUNT_LOCAL_ONLY !== "true" || isDistributedRuntime(env) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.appOrigin).hostname)) return null;
  const key = createHash("sha256").update(config.encryptionSecret).digest("hex");
  let store = localStores.get(key);
  if (!store) { store = createMemoryAccountStore(config.encryptionSecret); localStores.set(key, store); }
  return store;
}
