import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Cloudflare Workers — the Sites target — runs the Next.js server bundle with
 * no filesystem: every read under `data/` throws ENOENT. The loaders choose the
 * build-time embedded artifact in that runtime (`hasDataFilesystem()` reads
 * workerd's `navigator.userAgent`), and this suite is the contract that the
 * fallback is complete.
 *
 * `node:fs` and `node:fs/promises` are mocked to refuse every `data/` path
 * exactly as workerd does. A loader that still reached for disk would throw
 * instead of returning data, so passing here also proves the embedded path
 * performs no filesystem reads. The expected values come from the artifact
 * itself; `embedded-data-artifact.test.ts` separately pins the artifact to the
 * authored files, so the two suites together cover both hops.
 */

const realFs = createRequire(import.meta.url)("node:fs") as typeof import("node:fs");
const DATA_ROOT = path.resolve("data") + path.sep;
const inData = (target: unknown) => path.resolve(String(target)).startsWith(DATA_ROOT);
const missing = (target: unknown) =>
  Object.assign(new Error(`ENOENT: no such file or directory, ${String(target)}`), {
    code: "ENOENT",
  });

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mock = {
    ...actual,
    existsSync: (target: unknown) => (inData(target) ? false : actual.existsSync(target as never)),
    readdirSync: (target: unknown) => {
      if (inData(target)) throw missing(target);
      return actual.readdirSync(target as never);
    },
    readFileSync: (target: unknown, options?: unknown) => {
      if (inData(target)) throw missing(target);
      return actual.readFileSync(target as never, options as never);
    },
  };
  return { default: mock, ...mock };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const mock = {
    ...actual,
    readdir: async (target: unknown) => {
      if (inData(target)) throw missing(target);
      return actual.readdir(target as never);
    },
    readFile: async (target: unknown, options?: unknown) => {
      if (inData(target)) throw missing(target);
      return actual.readFile(target as never, options as never);
    },
    access: async (target: unknown) => {
      if (inData(target)) throw missing(target);
      return actual.access(target as never);
    },
  };
  return { default: mock, ...mock };
});

interface Artifact {
  domains: Record<string, Record<string, string>>;
}
const artifact = JSON.parse(
  realFs.readFileSync(path.join(".data-bundle", "embedded-data.generated.json"), "utf8"),
) as Artifact;

const expectedConditions = Object.values(artifact.domains.catalog).flatMap(
  (raw) => (JSON.parse(raw) as { conditions: unknown[] }).conditions,
).length;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Enter the embedded runtime the way a Worker does: workerd's user agent first,
 * then the instrumentation hook Next calls before dispatch. Going through
 * `register()` rather than importing the installer directly keeps this suite
 * pinned to the production wiring — a loader wired to the bundle without the
 * startup install would fail here.
 */
async function startWorkersRuntime(): Promise<void> {
  vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
  const { register } = await import("@/instrumentation");
  register();
}

describe("Workers data fallback", () => {
  it("loads all four domains and the adjacency graph without touching data/", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync(path.join("data", "conditions"))).toBe(false);

    await startWorkersRuntime();

    const [{ loadConditionCatalog }, { loadKnowledgeBase }, { loadExposureCatalog }, { loadRegulatoryActionRegistry }, { loadKbGraph }] =
      await Promise.all([
        import("@/lib/catalog/load"),
        import("@/lib/kb/load"),
        import("@/lib/presumptive/load"),
        import("@/lib/regulatory/load"),
        import("@/lib/kb/graph"),
      ]);

    const catalog = loadConditionCatalog();
    expect(catalog).toHaveLength(expectedConditions);
    expect(loadConditionCatalog()).toBe(catalog); // cached, not re-read

    const kb = loadKnowledgeBase();
    expect(kb).toHaveLength(Object.keys(artifact.domains.knowledgeBase).length);
    expect(kb.every((mapping) => !mapping.draft || mapping.draft === true)).toBe(true);

    const exposures = loadExposureCatalog();
    expect(exposures).toHaveLength(Object.keys(artifact.domains.presumptives).length);

    const regulatory = loadRegulatoryActionRegistry();
    expect(regulatory).toHaveLength(Object.keys(artifact.domains.regulatoryActions).length);

    const graph = loadKbGraph();
    expect(graph.size).toBe(Object.keys(artifact.domains.graph).length);
    for (const nodeId of graph.keys()) {
      expect(catalog.some((condition) => condition.id === nodeId)).toBe(true);
    }
  });

  it("async loaders return the same values as the sync path", async () => {
    await startWorkersRuntime();

    const catalogModule = await import("@/lib/catalog/load");
    const kbModule = await import("@/lib/kb/load");
    const presumptiveModule = await import("@/lib/presumptive/load");
    const regulatoryModule = await import("@/lib/regulatory/load");

    expect(await catalogModule.loadConditionCatalogAsync()).toBe(catalogModule.loadConditionCatalog());
    expect(await kbModule.loadKnowledgeBaseAsync()).toBe(kbModule.loadKnowledgeBase());
    expect(await presumptiveModule.loadExposureCatalogAsync()).toBe(presumptiveModule.loadExposureCatalog());
    expect(await regulatoryModule.loadRegulatoryActionRegistryAsync()).toBe(
      regulatoryModule.loadRegulatoryActionRegistry(),
    );
  });

  it("published mapping ids come from the embedded mappings", async () => {
    await startWorkersRuntime();

    const { loadPublishedMappingIds } = await import("@/lib/kb/load");
    const expected = new Set(
      Object.values(artifact.domains.knowledgeBase)
        .map((raw) => JSON.parse(raw) as { id: string; draft?: boolean })
        .filter((mapping) => mapping.draft !== true)
        .map((mapping) => mapping.id),
    );

    expect(loadPublishedMappingIds()).toEqual(expected);
  });
});
