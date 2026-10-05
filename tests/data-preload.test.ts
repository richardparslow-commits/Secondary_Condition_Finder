import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Data-preload suite — testing strategy
 * =====================================
 *
 * The system under test is four filesystem-backed loaders (condition catalog,
 * knowledge base, presumptive exposures, regulatory actions) plus the
 * `@/lib/data/preload` warmup orchestrator. All five share one contract:
 * a module-level `cached` value + a single `inflight` promise per domain, so
 * cold-start bursts dedupe and a completed warmup turns the sync request path
 * into a pure memory hit.
 *
 * Instead of testing against the real `data/` tree, this suite replaces
 * `node:fs` and `node:fs/promises` with an in-memory **virtual filesystem**
 * (VFS) seeded from the real files. The seed is read through Node's native
 * `createRequire(...)` so the mock does not intercept it. Seeding from real
 * data means every fixture satisfies the real Zod schemas by construction —
 * no hand-maintained fixtures — while the VFS makes disk I/O:
 *
 *   - **countable** — `readCount` increments on every attempted read, so
 *     "concurrent warmups share one in-flight pass" is provable as an exact
 *     read total (a race or fan-out would double it), replacing the old test
 *     that only checked array lengths;
 *   - **injectable** — malformed JSON, wrong-shape JSON, and EIO read errors
 *     can be planted per-domain to pin the fail-closed contract: loaders
 *     reject, caches stay empty, the in-flight promise is cleared (no
 *     poisoned promise), and a retry after healing succeeds;
 *   - **hermetic** — no test touches the real filesystem at runtime, so the
 *     suite is order-independent and safe under parallel file execution
 *     (each vitest worker gets its own module registry and mock state).
 *
 * The `instrumentation.ts` hook contract is verified at **runtime**: with no
 * OTel SDK dependency installed (automatic trace export is disabled by policy),
 * `register()` is called for real and must trigger the fire-and-forget warmup
 * (no static source-string sniffing).
 *
 * Isolation: `freshState()` restores the VFS, zeroes the read counter, resets
 * every loader cache and the warmup flag; a global `afterEach` repeats the
 * cleanup even on failure, so no test can leak module state into another.
 */

/* ── Real-fs escape hatch (seed only — never used inside tests) ────────────── */

type NodeFs = typeof import("node:fs");
const realFs: NodeFs = createRequire(import.meta.url)("node:fs");

const DATA_DIRS = {
  catalog: "data/conditions",
  kb: "data/knowledge-base",
  presumptive: "data/presumptives",
  regulatory: "data/regulatory-actions",
} as const;
type DomainKey = keyof typeof DATA_DIRS;
const DOMAIN_KEYS = Object.keys(DATA_DIRS) as DomainKey[];

const seedDirs = new Set(Object.values(DATA_DIRS).map((dir) => path.resolve(dir)));
const seedFiles = (() => {
  const files = new Map<string, string>();
  for (const dir of seedDirs) {
    for (const entry of realFs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (realFs.statSync(full).isFile()) files.set(full, realFs.readFileSync(full, "utf8"));
    }
  }
  return files;
})();

/* ── Virtual filesystem state + shared mock implementations ────────────────── */

interface VfsState {
  dirs: Set<string>;
  files: Map<string, string>;
  /** Paths whose next read throws EIO (read-error injection). */
  failReads: Set<string>;
  /** Every attempted read, successful or not — the disk-race detector. */
  readCount: number;
}

const vfs: VfsState = {
  dirs: seedDirs,
  files: seedFiles,
  failReads: new Set(),
  readCount: 0,
};

const CORRUPT_FILE = "0000-corrupt.json"; // sorts first in every domain dir → fast, deterministic failures
const MALFORMED_JSON = "{ this is not valid json";
const WRONG_SHAPE_JSON = '{"unexpected": true}';

function enoent(what: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, ${what}`), { code: "ENOENT" });
}

function readOne(target: unknown): string {
  const key = path.resolve(String(target));
  vfs.readCount += 1;
  if (vfs.failReads.has(key)) {
    throw Object.assign(new Error(`EIO: injected read failure for ${key}`), { code: "EIO" });
  }
  const content = vfs.files.get(key);
  if (content === undefined) throw enoent(key);
  return content;
}

function listDir(target: unknown): string[] {
  const dir = path.resolve(String(target));
  if (!vfs.dirs.has(dir)) throw enoent(dir);
  const names: string[] = [];
  for (const key of vfs.files.keys()) {
    if (path.dirname(key) === dir) names.push(path.basename(key));
  }
  return names.sort();
}

vi.mock("node:fs", () => {
  const mock = {
    existsSync: (target: unknown) => vfs.dirs.has(path.resolve(String(target))),
    readdirSync: (target: unknown) => listDir(target),
    readFileSync: (target: unknown) => readOne(target),
  };
  return { default: mock, ...mock };
});

vi.mock("node:fs/promises", () => {
  const mock = {
    readFile: async (target: unknown) => readOne(target),
    readdir: async (target: unknown) => listDir(target),
    access: async (target: unknown) => {
      if (!vfs.dirs.has(path.resolve(String(target)))) throw enoent(String(target));
    },
  };
  return { default: mock, ...mock };
});

/* ── Module registry (imported lazily AFTER the fs mocks are armed) ───────── */

type CatalogModule = typeof import("@/lib/catalog/load");
type KbModule = typeof import("@/lib/kb/load");
type PresumptiveModule = typeof import("@/lib/presumptive/load");
type RegulatoryModule = typeof import("@/lib/regulatory/load");
type PreloadModule = typeof import("@/lib/data/preload");

interface Modules {
  catalog: CatalogModule;
  kb: KbModule;
  presumptive: PresumptiveModule;
  regulatory: RegulatoryModule;
  preload: PreloadModule;
}

let mod: Modules;

interface Domain {
  key: DomainKey;
  dir: string;
  loadSync: () => unknown[];
  loadAsync: () => Promise<unknown[]>;
  resetCache: () => void;
}

function getDomain(key: DomainKey): Domain {
  switch (key) {
    case "catalog":
      return {
        key,
        dir: DATA_DIRS.catalog,
        loadSync: () => mod.catalog.loadConditionCatalog(),
        loadAsync: () => mod.catalog.loadConditionCatalogAsync(),
        resetCache: mod.catalog.resetConditionCatalogCache,
      };
    case "kb":
      return {
        key,
        dir: DATA_DIRS.kb,
        loadSync: () => mod.kb.loadKnowledgeBase(),
        loadAsync: () => mod.kb.loadKnowledgeBaseAsync(),
        resetCache: mod.kb.resetKnowledgeBaseCache,
      };
    case "presumptive":
      return {
        key,
        dir: DATA_DIRS.presumptive,
        loadSync: () => mod.presumptive.loadExposureCatalog(),
        loadAsync: () => mod.presumptive.loadExposureCatalogAsync(),
        resetCache: mod.presumptive.resetExposureCatalogCache,
      };
    case "regulatory":
      return {
        key,
        dir: DATA_DIRS.regulatory,
        loadSync: () => mod.regulatory.loadRegulatoryActionRegistry(),
        loadAsync: () => mod.regulatory.loadRegulatoryActionRegistryAsync(),
        resetCache: mod.regulatory.resetRegulatoryActionRegistryCache,
      };
  }
}

/* ── State helpers ─────────────────────────────────────────────────────────── */

/** Restores the VFS, zeroes the read counter, and resets every module cache. */
function freshState(): void {
  vfs.dirs = new Set(seedDirs);
  vfs.files = new Map(seedFiles);
  vfs.failReads = new Set();
  vfs.readCount = 0;
  for (const key of DOMAIN_KEYS) getDomain(key).resetCache();
  mod.preload.resetDataWarmupState();
}

function countJsonFiles(dir: string): number {
  const resolved = path.resolve(dir);
  let count = 0;
  for (const key of vfs.files.keys()) {
    if (path.dirname(key) === resolved && key.endsWith(".json")) count += 1;
  }
  return count;
}

function totalJsonFiles(): number {
  return DOMAIN_KEYS.reduce((sum, key) => sum + countJsonFiles(DATA_DIRS[key]), 0);
}

/**
 * Expected read total for one cold pass of a domain. The KB is the one
 * domain with a transitive dependency: its load validates every mapping
 * against the condition catalog, so an uncached KB pass also reads the
 * catalog. Ledger assertions use this cost instead of the bare per-domain
 * file count.
 */
function readCost(key: DomainKey): number {
  const base = countJsonFiles(DATA_DIRS[key]);
  return key === "kb" ? base + countJsonFiles(DATA_DIRS.catalog) : base;
}

function injectCorruptFile(dir: string, content: string): string {
  const full = path.resolve(dir, CORRUPT_FILE);
  vfs.files.set(full, content);
  return full;
}

function firstJsonFile(dir: string): string {
  const resolved = path.resolve(dir);
  const names = [...vfs.files.keys()]
    .filter((key) => path.dirname(key) === resolved && key.endsWith(".json"))
    .sort();
  const first = names[0];
  if (!first) throw new Error(`no json files in ${dir}`);
  return first;
}

/* ── Lifecycle ─────────────────────────────────────────────────────────────── */

beforeAll(async () => {
  // Imported here (not statically) so the VFS seed exists before any mocked
  // module — and therefore any loader — is first evaluated.
  mod = {
    catalog: await import("@/lib/catalog/load"),
    kb: await import("@/lib/kb/load"),
    presumptive: await import("@/lib/presumptive/load"),
    regulatory: await import("@/lib/regulatory/load"),
    preload: await import("@/lib/data/preload"),
  };
});

beforeEach(() => {
  // Silence the warmup's own success logging; warn spying stays per-test.
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  // Parallel-safety: even a failing test must not leak caches, warmup state,
  // or spies into the next test.
  vi.restoreAllMocks();
  if (mod) {
    for (const key of DOMAIN_KEYS) getDomain(key).resetCache();
    mod.preload.resetDataWarmupState();
  }
});

/* ── Warmup orchestration ──────────────────────────────────────────────────── */

describe("data preload — warmup orchestration", () => {
  it("populates all four sync caches via one async warmup pass; sync reads afterwards touch zero files", async () => {
    freshState();
    mod.preload.warmupDataCaches();
    await mod.preload.awaitDataWarmup();

    // Exactly one read per seeded file — no duplicates, no races.
    expect(vfs.readCount).toBe(totalJsonFiles());

    // Sync loaders are pure memory hits: populated values, zero extra IO.
    const readsAfterWarmup = vfs.readCount;
    expect(mod.catalog.loadConditionCatalog().length).toBeGreaterThan(0);
    expect(mod.kb.loadKnowledgeBase().length).toBeGreaterThan(0);
    expect(mod.presumptive.loadExposureCatalog().length).toBeGreaterThan(0);
    expect(Array.isArray(mod.regulatory.loadRegulatoryActionRegistry())).toBe(true);
    expect(vfs.readCount).toBe(readsAfterWarmup);

    // Async and sync paths hand out the exact same cached instance per domain.
    for (const key of DOMAIN_KEYS) {
      const domain = getDomain(key);
      expect(await domain.loadAsync()).toBe(domain.loadSync());
    }
  });

  it("dedupes concurrent warmupDataCaches() invocations onto a single in-flight warmup pass", async () => {
    freshState();
    const total = totalJsonFiles();

    mod.preload.warmupDataCaches(); // call 1: starts the single async pass
    mod.preload.warmupDataCaches(); // call 2: must no-op against the in-flight pass
    mod.preload.warmupDataCaches(); // call 3: ditto

    await mod.preload.awaitDataWarmup();

    // A racing warmup that had fanned out would re-read every file; exactly
    // `total` reads proves the calls shared one in-flight pass.
    expect(vfs.readCount).toBe(total);
    expect(mod.catalog.loadConditionCatalog().length).toBeGreaterThan(0);
    expect(mod.kb.loadKnowledgeBase().length).toBeGreaterThan(0);

    // Resetting makes warmup re-runnable: with all caches also cleared, a
    // second warmup performs exactly one more full pass.
    for (const key of DOMAIN_KEYS) getDomain(key).resetCache();
    mod.preload.resetDataWarmupState();
    mod.preload.warmupDataCaches();
    await mod.preload.awaitDataWarmup();
    expect(vfs.readCount).toBe(total * 2);
  });

  it("awaitDataWarmup() is a no-op before warmup starts and triggers zero IO", async () => {
    freshState();
    await expect(mod.preload.awaitDataWarmup()).resolves.toBeUndefined();
    expect(vfs.readCount).toBe(0);
  });

  it("warmup failures are best-effort: resolved await, logged warning, fail-closed sync path, retryable", async () => {
    freshState();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const corruptPath = injectCorruptFile(DATA_DIRS.kb, MALFORMED_JSON);
    const kbBase = countJsonFiles(DATA_DIRS.kb);
    const total = totalJsonFiles();

    // Fire-and-forget contract: warmup never throws synchronously and its
    // await resolves even when a loader failed underneath.
    expect(() => mod.preload.warmupDataCaches()).not.toThrow();
    await expect(mod.preload.awaitDataWarmup()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled(); // failure logged, not hidden

    // The request path still fails closed with the real error — the failed
    // warmup must not leave a half-populated cache that "works".
    expect(() => mod.kb.loadKnowledgeBase()).toThrow();

    // Heal the corruption and retry: a fresh warmup pass completes and the
    // KB becomes loadable again.
    vfs.files.delete(corruptPath);
    for (const key of DOMAIN_KEYS) getDomain(key).resetCache();
    mod.preload.resetDataWarmupState();
    mod.preload.warmupDataCaches();
    await mod.preload.awaitDataWarmup();
    expect(mod.kb.loadKnowledgeBase().length).toBeGreaterThan(0);

    // Read ledger: pass 1 = every domain fully read except KB (aborted after
    // its first, corrupt file); pass 2 = full. 2×total − kbBase + 1 exactly.
    expect(vfs.readCount).toBe(total * 2 - kbBase + 1);
  });
});

/* ── Per-domain in-flight dedup, reset, and fail-closed errors ─────────────── */

describe("data preload — per-domain in-flight dedup, reset, and fail-closed errors", () => {
  it.each(DOMAIN_KEYS)(
    "cold-start burst [%s] dedupes onto one in-flight promise with a single disk pass",
    async (key) => {
      freshState();
      const domain = getDomain(key);
      const cost = readCost(key); // kb's pass transitively reads the catalog

      const p1 = domain.loadAsync();
      const p2 = domain.loadAsync();
      const p3 = domain.loadAsync();
      expect(p2).toBe(p1); // same in-flight Promise object — no fan-out
      expect(p3).toBe(p1);

      const [a, b, c] = await Promise.all([p1, p2, p3]);
      expect(a).toBe(b);
      expect(b).toBe(c);
      expect(vfs.readCount).toBe(cost); // one pass, not three

      // Cached path: fresh promise per call, identical shared value.
      const [again1, again2] = await Promise.all([domain.loadAsync(), domain.loadAsync()]);
      expect(again1).toBe(again2);
      expect(again1).toBe(a);
      expect(domain.loadSync()).toBe(a);
    },
  );

  it.each(DOMAIN_KEYS)(
    "cache reset [%s] forces a fresh disk pass and a new instance",
    async (key) => {
      freshState();
      const domain = getDomain(key);
      const cost = readCost(key);

      const first = await domain.loadAsync();
      domain.resetCache();

      const p1 = domain.loadAsync();
      const p2 = domain.loadAsync();
      expect(p2).toBe(p1); // reset re-arms in-flight dedupe
      const second = await p1;
      expect(second).not.toBe(first); // genuinely re-read, not the stale cache
      // Pass 2 costs only this domain's own files: the KB reset seam is
      // per-domain, so the catalog that pass 1 loaded transitively (kb case)
      // stays cached.
      expect(vfs.readCount).toBe(cost + countJsonFiles(domain.dir));
    },
  );

  const corruptionFlavors = [
    { flavorName: "malformed JSON", content: MALFORMED_JSON },
    { flavorName: "wrong-shape JSON", content: WRONG_SHAPE_JSON },
  ] as const;

  it.each(
    DOMAIN_KEYS.flatMap((key) =>
      corruptionFlavors.map(({ flavorName, content }) => ({ key, flavorName, content })),
    ),
  )(
    "parse failure [$key / $flavorName] fails closed: rejects, keeps cache empty, no poisoned in-flight, retryable",
    async ({ key, content }) => {
      freshState();
      const domain = getDomain(key);
      const corruptPath = injectCorruptFile(domain.dir, content);

      // Async path rejects with the loader's parse/validation error.
      await expect(domain.loadAsync()).rejects.toThrow();

      // Sync request path also fails closed — no half-populated cache.
      expect(() => domain.loadSync()).toThrow();

      // The in-flight promise was cleared on failure: an immediate retry runs
      // a fresh pass (exactly one more read — it fails on the same first
      // file) rather than awaiting the poisoned promise forever.
      const readsAfterFirstFailure = vfs.readCount;
      await expect(domain.loadAsync()).rejects.toThrow();
      expect(vfs.readCount).toBe(readsAfterFirstFailure + 1);

      // Heal and retry — the domain loads normally, cache fully repopulated.
      vfs.files.delete(corruptPath);
      const healed = await domain.loadAsync();
      expect(vfs.readCount).toBe(readsAfterFirstFailure + 1 + readCost(key));
      expect(healed.length).toBeGreaterThan(0);
      expect(healed).toBe(domain.loadSync());
    },
  );

  it.each(DOMAIN_KEYS)(
    "read error [%s] (EIO) fails closed identically to parse errors",
    async (key) => {
      freshState();
      const domain = getDomain(key);
      const victim = firstJsonFile(domain.dir);
      vfs.failReads.add(victim);

      await expect(domain.loadAsync()).rejects.toThrow(/EIO|read failure/);
      expect(() => domain.loadSync()).toThrow();

      // No poisoned in-flight: the retry re-attempts the read and fails again.
      const readsAfterFirstFailure = vfs.readCount;
      await expect(domain.loadAsync()).rejects.toThrow(/EIO|read failure/);
      expect(vfs.readCount).toBe(readsAfterFirstFailure + 1);

      // Clear the fault and the domain recovers with a full fresh pass.
      vfs.failReads.delete(victim);
      const healed = await domain.loadAsync();
      expect(vfs.readCount).toBe(readsAfterFirstFailure + 1 + readCost(key));
      expect(healed.length).toBeGreaterThan(0);
      expect(healed).toBe(domain.loadSync());
    },
  );
});

/* ── Domain-specific graceful degradation ──────────────────────────────────── */

describe("data preload — regulatory graceful degradation", () => {
  it("missing regulatory-actions directory degrades to an empty registry on both paths with zero IO", async () => {
    freshState();
    vfs.dirs.delete(path.resolve(DATA_DIRS.regulatory));

    expect(mod.regulatory.loadRegulatoryActionRegistry()).toEqual([]);
    await expect(mod.regulatory.loadRegulatoryActionRegistryAsync()).resolves.toEqual([]);
    expect(vfs.readCount).toBe(0); // existence is checked before any read
  });
});

/* ── Instrumentation registration hook (runtime contract) ──────────────────── */

describe("data preload — instrumentation registration hook", () => {
  it("register() fires a non-blocking warmup that turns later loads into memory hits; double register dedupes", async () => {
    freshState();
    const instrumentation = await import("@/instrumentation");
    const total = totalJsonFiles();

    // The real register() runs — with no OTel SDK in the process — and must
    // not throw or block: it returns synchronously while the warmup proceeds.
    expect(() => instrumentation.register()).not.toThrow();

    // The warmup promise is intentionally not returned; join it by waiting
    // for the first disk read, then awaiting the orchestrator's seam.
    await vi.waitFor(() => expect(vfs.readCount).toBeGreaterThan(0), {
      timeout: 5_000,
      interval: 25,
    });
    await mod.preload.awaitDataWarmup();
    expect(vfs.readCount).toBe(total); // exactly one full warmup pass

    // A second register() (e.g. hot reload / duplicate invocation) must not
    // re-trigger the warmup — the single-shot flag dedupes it.
    instrumentation.register();
    await mod.preload.awaitDataWarmup();
    expect(vfs.readCount).toBe(total);

    // End state: the request path is a memory hit.
    expect(mod.catalog.loadConditionCatalog().length).toBeGreaterThan(0);
    expect(mod.kb.loadKnowledgeBase().length).toBeGreaterThan(0);
  });
});
