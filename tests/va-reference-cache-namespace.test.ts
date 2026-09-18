import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearVaReferenceCache,
  readVaReferenceCache,
  writeVaReferenceCache,
} from "@/lib/va/reference-cache";
import {
  clearVaReferenceNamespace,
  VA_REFERENCE_NAMESPACES,
  vaReferenceCacheKey,
  vaReferenceNamespacePrefix,
  withVaReferenceCache,
} from "@/lib/va/reference-cache-access";
import { clearVaFormsFinderCache } from "@/lib/va/forms-finder";

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Stand-in for `VaReferenceSourceStatus`, whose `cacheStatus` is the union
 * `"hit" | "miss"`. A `as const` literal here would narrow `T` and make a
 * `decorateHit` that returns `"hit"` unassignable — which is the type system
 * correctly rejecting a decorator that changes the view's type.
 */
interface TestView {
  items: Array<{ id: string; name: string }>;
  cacheStatus: "hit" | "miss";
}

beforeEach(() => {
  // The process-local tier is gated off under NODE_ENV=production and under any
  // distributed-runtime marker; pin a plain runtime so these tests exercise it.
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
  vi.stubEnv("FUNCTIONS_WORKER_RUNTIME", "");
  vi.stubEnv("K_SERVICE", "");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "");
  clearVaReferenceCache();
});

afterEach(() => {
  clearVaReferenceCache();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VA reference cache namespaces", () => {
  it("keeps every namespace disjoint, so no clear call can span two owners", () => {
    const namespaces = Object.values(VA_REFERENCE_NAMESPACES);

    for (const a of namespaces) {
      for (const b of namespaces) {
        if (a === b) continue;
        const prefixA = vaReferenceNamespacePrefix(a);
        const prefixB = vaReferenceNamespacePrefix(b);
        expect(prefixA.startsWith(prefixB)).toBe(false);
        expect(prefixB.startsWith(prefixA)).toBe(false);
      }
    }
  });

  it("builds namespaced keys with the separator, never a bare concatenation", () => {
    expect(
      vaReferenceCacheKey(VA_REFERENCE_NAMESPACES.formsFinder, "sandbox", "21-526ez"),
    ).toBe("forms-finder:sandbox:21-526ez");
    expect(
      vaReferenceCacheKey(VA_REFERENCE_NAMESPACES.formReference, "sandbox"),
    ).toBe("forms-reference:sandbox");
  });

  // Regression: `clearVaFormsFinderCache()` used to clear the `"forms:"` prefix,
  // which also matched `form-reference`'s `forms:reference:` keys. One module
  // silently invalidated another's cache, and `form-reference` never grew a
  // clear function of its own because it appeared to work by accident.
  it("clears only the calling module's entries — forms-finder must not evict form-reference", () => {
    const formsFinderKey = vaReferenceCacheKey(
      VA_REFERENCE_NAMESPACES.formsFinder,
      "sandbox",
      "21-526ez",
    );
    const formReferenceKey = vaReferenceCacheKey(
      VA_REFERENCE_NAMESPACES.formReference,
      "sandbox",
    );

    writeVaReferenceCache(formsFinderKey, { owner: "forms-finder" });
    writeVaReferenceCache(formReferenceKey, { owner: "form-reference" });

    expect(clearVaFormsFinderCache()).toBe(1);

    expect(readVaReferenceCache(formReferenceKey)).toEqual({
      owner: "form-reference",
    });
    expect(readVaReferenceCache(formsFinderKey)).toBeNull();
  });

  it("clears the other direction too — form-reference must not evict forms-finder", () => {
    const formsFinderKey = vaReferenceCacheKey(
      VA_REFERENCE_NAMESPACES.formsFinder,
      "sandbox",
      "21-526ez",
    );
    const formReferenceKey = vaReferenceCacheKey(
      VA_REFERENCE_NAMESPACES.formReference,
      "sandbox",
    );

    writeVaReferenceCache(formsFinderKey, { owner: "forms-finder" });
    writeVaReferenceCache(formReferenceKey, { owner: "form-reference" });

    expect(
      clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.formReference),
    ).toBe(1);

    expect(readVaReferenceCache(formsFinderKey)).toEqual({
      owner: "forms-finder",
    });
    expect(readVaReferenceCache(formReferenceKey)).toBeNull();
  });

  // Drift guard: `form-reference` was the one module of five with no clear
  // export. Parity is now pinned so copy-paste drift cannot remove it again.
  it("exports a cache-clear function from every VA reference module", async () => {
    const [branches, formsFinder, formReference, disabilities, reps] =
      await Promise.all([
        import("@/lib/va/service-branches"),
        import("@/lib/va/forms-finder"),
        import("@/lib/va/form-reference"),
        import("@/lib/va/disability-reference"),
        import("@/lib/va/accredited-representatives"),
      ]);

    const clearFunctions: Array<[Record<string, unknown>, string]> = [
      [branches, "clearServiceBranchReferenceCache"],
      [formsFinder, "clearVaFormsFinderCache"],
      [formReference, "clearClaimFormReferenceCache"],
      [disabilities, "clearDisabilityReferenceCache"],
      [reps, "clearAccreditedRepresentativeCache"],
    ];

    for (const [module, name] of clearFunctions) {
      expect(typeof module[name]).toBe("function");
    }
  });
});

describe("withVaReferenceCache", () => {
  const key = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.disabilityReference,
    "sandbox",
  );

  it("serves a process-local hit, decorates it, and never calls the loader", async () => {
    const cachedView: TestView = { items: [], cacheStatus: "miss" };
    writeVaReferenceCache(key, cachedView);
    const load = vi.fn(async () => ({ view: cachedView, cacheable: true }));

    const result = await withVaReferenceCache(key, load, {
      decorateHit: (view: TestView): TestView => ({ ...view, cacheStatus: "hit" }),
    });

    expect(result.cacheStatus).toBe("hit");
    expect(load).not.toHaveBeenCalled();
  });

  it("caches a live view so the second call is served without re-loading", async () => {
    const view = { items: [], cacheStatus: "miss" as const };
    const load = vi.fn(async () => ({ view, cacheable: true }));

    const first = await withVaReferenceCache(key, load);
    const second = await withVaReferenceCache(key, load);

    expect(first).toEqual(view);
    expect(second).toEqual(view);
    expect(load).toHaveBeenCalledTimes(1);
  });

  // The invariant that was previously unstated across five hand-rolled copies:
  // a degraded local fallback must never be cached, or a VA outage would keep
  // showing "unavailable" for a full TTL after the upstream recovered.
  it("never caches a degraded fallback (cacheable: false)", async () => {
    const fallback = {
      items: [],
      source: "local-fallback",
      cacheStatus: "miss" as const,
    };
    const load = vi.fn(async () => ({ view: fallback, cacheable: false }));

    await withVaReferenceCache(key, load);
    await withVaReferenceCache(key, load);

    expect(load).toHaveBeenCalledTimes(2);
    expect(readVaReferenceCache(key)).toBeNull();
  });

  it("promotes a shared-tier hit into the process-local tier", async () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "https://example.upstash.io");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");

    const sharedView: TestView = {
      items: [{ id: "1", name: "Migraine" }],
      cacheStatus: "miss",
    };
    const fetchSpy = vi.fn(async () =>
      okJson({ result: JSON.stringify(sharedView) }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const load = vi.fn(async () => ({ view: sharedView, cacheable: true }));
    const options = {
      decorateHit: (view: TestView): TestView => ({ ...view, cacheStatus: "hit" }),
    };

    const first = await withVaReferenceCache(key, load, options);
    expect(first.cacheStatus).toBe("hit");
    expect(load).not.toHaveBeenCalled();
    const fetchesAfterFirst = fetchSpy.mock.calls.length;

    // Second call must be answered from the rehydrated process-local tier.
    const second = await withVaReferenceCache(key, load, options);
    expect(second.cacheStatus).toBe("hit");
    expect(fetchSpy.mock.calls.length).toBe(fetchesAfterFirst);
    expect(load).not.toHaveBeenCalled();
  });

  it("bypasses both tiers entirely when enabled is false", async () => {
    writeVaReferenceCache(key, { stale: true });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const fresh = { items: [], cacheStatus: "miss" as const };
    const load = vi.fn(async () => ({ view: fresh, cacheable: true }));

    const result = await withVaReferenceCache(key, load, { enabled: false });

    expect(result).toEqual(fresh);
    expect(load).toHaveBeenCalledTimes(1);
    // The injected-fetcher path must not probe the shared tier either.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
