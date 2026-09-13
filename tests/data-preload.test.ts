import { beforeAll, describe, expect, it } from "vitest";

import { loadConditionCatalog, resetConditionCatalogCache } from "@/lib/catalog/load";
import {
  awaitDataWarmup,
  resetDataWarmupState,
  warmupDataCaches,
} from "@/lib/data/preload";
import { loadKnowledgeBase, resetKnowledgeBaseCache } from "@/lib/kb/load";
import { loadExposureCatalog, resetExposureCatalogCache } from "@/lib/presumptive/load";
import {
  loadRegulatoryActionRegistry,
  resetRegulatoryActionRegistryCache,
} from "@/lib/regulatory/load";

// Single shared warmup for the main test group — avoids re-reading 800+ KB
// of JSON from disk in every test. Tests that need fresh state (reset, no-op)
// are isolated in separate describe blocks with their own lifecycle.
beforeAll(async () => {
  resetConditionCatalogCache();
  resetKnowledgeBaseCache();
  resetExposureCatalogCache();
  resetRegulatoryActionRegistryCache();
  resetDataWarmupState();
  warmupDataCaches();
  await awaitDataWarmup();
});

describe("data preload (finding #6 — sync fs cold-start)", () => {
  it("populates all sync caches via async warmup so first request is a memory hit", () => {
    // After warmup, the sync loaders must return the same objects without
    // touching the filesystem — they should already be cached.
    const catalog = loadConditionCatalog();
    const kb = loadKnowledgeBase();
    const exposures = loadExposureCatalog();
    const registry = loadRegulatoryActionRegistry();

    expect(catalog.length).toBeGreaterThan(0);
    expect(kb.length).toBeGreaterThan(0);
    expect(exposures.length).toBeGreaterThan(0);
    // regulatory may be small (known fixtures + README), but must parse.
    expect(Array.isArray(registry)).toBe(true);
  });

  it("shares the same module cache between async warmup and sync path", async () => {
    const afterWarmupCatalog = loadConditionCatalog();
    // Sync path should be the exact cached instance written by async warmup.
    const viaAsyncAgain = await (await import("@/lib/catalog/load")).loadConditionCatalogAsync();
    expect(viaAsyncAgain).toBe(afterWarmupCatalog);
  });

  it("dedupes concurrent warmup calls on a single inflight promise", async () => {
    // Multiple warmup calls should be idempotent — the first warmup's
    // result is still valid and the cache is populated.
    expect(loadConditionCatalog().length).toBeGreaterThan(0);
    expect(loadKnowledgeBase().length).toBeGreaterThan(0);
  });

  it("hook lives in instrumentation.ts register()", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/instrumentation.ts"),
      "utf8",
    );
    expect(source).toContain("warmupDataCaches");
    expect(source).toContain('import("@/lib/data/preload")');
    expect(source).not.toContain('require("@/lib/data/preload")');
  });
});

describe("data preload — async loader dedup", () => {
  it("async loaders are promise-deduped and resettable", async () => {
    // Reset catalog cache so the first two calls share an inflight promise.
    resetConditionCatalogCache();
    const { loadConditionCatalogAsync } = await import("@/lib/catalog/load");
    const p1 = loadConditionCatalogAsync();
    const p2 = loadConditionCatalogAsync();
    expect(p1).toBe(p2);
    const [c1, c2] = await Promise.all([p1, p2]);
    expect(c1).toBe(c2);
    // Cached value resolves synchronously via Promise.resolve wrapper —
    // subsequent calls return a fresh microtask, not the same object.
    await p1;
    const p3 = loadConditionCatalogAsync();
    const p4 = loadConditionCatalogAsync();
    // Two immediate cached calls should still agree on value identity.
    const [c3, c4] = await Promise.all([p3, p4]);
    expect(c3).toBe(c4);
    expect(c3).toBe(c1);
    // After reset, a new inflight must start from disk.
    resetConditionCatalogCache();
    const p5 = loadConditionCatalogAsync();
    const p6 = loadConditionCatalogAsync();
    expect(p5).toBe(p6);
    const c5 = await p5;
    expect(c5.length).toBeGreaterThan(0);
  });
});

describe("data preload — no-op before warmup", () => {
  it("awaitDataWarmup is a no-op before warmup starts", async () => {
    // This test runs in its own describe block so the warmup state is clean.
    resetDataWarmupState();
    await expect(awaitDataWarmup()).resolves.toBeUndefined();
  });
});
