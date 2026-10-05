import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearVaReferenceCache,
  consumeCacheCounters,
  readVaReferenceCache,
  vaReferenceCacheScope,
  writeVaReferenceCache,
} from "@/lib/va/reference-cache";

/**
 * The process-local VA reference cache refuses to operate in production and
 * distributed runtimes. That refusal used to be invisible: `/api/health`
 * reported hit/miss counters that are structurally frozen at zero, and
 * `POST /api/admin/cache-clear` answered `{ ok: true, cleared: 0 }` — the same
 * response a working, cold cache gives. Both now report a `scope`.
 *
 * These tests assert the report tracks the real gate rather than restating it,
 * which is the only way the report can be trusted: a status endpoint that
 * computes its own answer can be right while the thing it describes is wrong.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  clearVaReferenceCache();
  consumeCacheCounters();
});

describe("vaReferenceCacheScope", () => {
  it("reports process-local where the cache actually works", () => {
    vi.stubEnv("NODE_ENV", "test");

    expect(vaReferenceCacheScope().scope).toBe("process-local");
    writeVaReferenceCache("scope-probe", { value: 1 });
    expect(readVaReferenceCache("scope-probe")).toEqual({ value: 1 });
  });

  it("reports disabled exactly where reads and writes are refused", () => {
    vi.stubEnv("NODE_ENV", "test");
    writeVaReferenceCache("scope-probe", { value: 1 });
    expect(readVaReferenceCache("scope-probe")).toEqual({ value: 1 });

    vi.stubEnv("NODE_ENV", "production");

    expect(vaReferenceCacheScope().scope).toBe("disabled");
    // The entry is still physically present, and the gate is what refuses it —
    // which is why the scope report must be derived from the gate, not from the
    // map's contents.
    expect(readVaReferenceCache("scope-probe")).toBeNull();
    writeVaReferenceCache("scope-probe-2", { value: 2 });
    expect(readVaReferenceCache("scope-probe-2")).toBeNull();
  });

  it("reports disabled in a distributed runtime even outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "1");

    expect(vaReferenceCacheScope().scope).toBe("disabled");
  });

  it("freezes the counters it is there to explain", () => {
    vi.stubEnv("NODE_ENV", "production");
    consumeCacheCounters();

    writeVaReferenceCache("frozen-counter-probe", { value: 1 });
    readVaReferenceCache("frozen-counter-probe");

    // Neither counter moves, so a zero-transition hitRate is the *expected*
    // production reading and carries no information on its own.
    expect(consumeCacheCounters()).toEqual({ hits: 0, misses: 0 });
  });

  it("explains the consequence rather than only naming the regime", () => {
    expect(vaReferenceCacheScope({ NODE_ENV: "production" }).detail).toMatch(
      /counters cannot move/,
    );
    expect(vaReferenceCacheScope({ NODE_ENV: "test" }).detail).toMatch(/cold start/);
  });
});

describe("GET /api/health reports cache scope", () => {
  it("distinguishes a disabled cache from an unused one", async () => {
    const { GET } = await import("@/app/api/health/route");

    vi.stubEnv("NODE_ENV", "production");
    const disabled = await (await GET()).json();

    expect(disabled.components.vaReferenceCache.scope).toBe("disabled");
    expect(disabled.components.vaReferenceCache.hits).toBe(0);
    expect(disabled.components.vaReferenceCache.misses).toBe(0);
    // A null hitRate alone is ambiguous; the scope is what resolves it.
    expect(disabled.components.vaReferenceCache.hitRate).toBeNull();
    expect(disabled.components.vaReferenceCache.detail).toMatch(/disabled/);

    vi.stubEnv("NODE_ENV", "test");
    const active = await (await GET()).json();

    expect(active.components.vaReferenceCache.scope).toBe("process-local");
  });
});

describe("POST /api/admin/cache-clear reports cache scope", () => {
  const authorizedRequest = () =>
    new Request("https://example.test/api/admin/cache-clear", {
      method: "POST",
      headers: { authorization: "Bearer test-cache-clear-secret-0123456789abcdef" },
    });

  it("says a disabled cache cleared nothing instead of reporting a bare success", async () => {
    vi.stubEnv("CRON_SECRET", "test-cache-clear-secret-0123456789abcdef");
    vi.stubEnv("NODE_ENV", "production");

    const { POST } = await import("@/app/api/admin/cache-clear/route");
    const response = await POST(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cleared).toBe(0);
    expect(body.scope).toBe("disabled");
    expect(body.message).toMatch(/disabled in this runtime/);
    expect(body.message).toMatch(/nothing was cleared/);
  });

  it("still reports a genuine clear when the cache is active", async () => {
    vi.stubEnv("CRON_SECRET", "test-cache-clear-secret-0123456789abcdef");
    vi.stubEnv("NODE_ENV", "test");
    writeVaReferenceCache("clear-me", { value: 1 });

    const { POST } = await import("@/app/api/admin/cache-clear/route");
    const body = await (await POST(authorizedRequest())).json();

    expect(body.scope).toBe("process-local");
    expect(body.cleared).toBeGreaterThanOrEqual(1);
    expect(body.message).toMatch(/^Cleared/);
  });

  it("keeps rejecting unauthorized callers regardless of scope", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { POST } = await import("@/app/api/admin/cache-clear/route");
    const response = await POST(
      new Request("https://example.test/api/admin/cache-clear", { method: "POST" }),
    );

    expect(response.status).toBe(401);
  });
});
