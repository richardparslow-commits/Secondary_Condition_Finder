import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Next builds server components and route handlers as separate module graphs,
 * so `let`/`Map` state declared in a shared module can exist once per graph
 * within the same process. The admin cache-clear route then clears a different
 * map from the one the reference pages use, and `/api/health` reads counters
 * that never move. Reloading the module here reproduces that boundary.
 */
describe("VA reference cache process state", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { clearVaReferenceCache, consumeCacheCounters } = await import(
      "@/lib/va/reference-cache"
    );
    clearVaReferenceCache();
    consumeCacheCounters();
  });

  it("shares entries and counters across separately evaluated module instances", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const first = await import("@/lib/va/reference-cache");
    first.clearVaReferenceCache();
    first.consumeCacheCounters();
    first.writeVaReferenceCache("module-boundary-key", { value: 1 });
    expect(first.readVaReferenceCache("module-boundary-key")).toEqual({ value: 1 });

    vi.resetModules();
    const second = await import("@/lib/va/reference-cache");

    expect(second.readVaReferenceCache("module-boundary-key")).toEqual({ value: 1 });
    expect(second.peekCacheCounters().hits).toBeGreaterThanOrEqual(2);
    expect(second.clearVaReferenceCache().cleared).toBe(1);
    expect(first.readVaReferenceCache("module-boundary-key")).toBeNull();
  });
});
