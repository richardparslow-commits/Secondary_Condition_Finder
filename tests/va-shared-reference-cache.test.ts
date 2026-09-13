import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isVaSharedCacheConfigured,
  loadVaSharedCacheConfig,
  readVaSharedReferenceCache,
  writeVaSharedReferenceCache,
} from "@/lib/va/reference-shared-cache";
import { clearVaReferenceCache } from "@/lib/va/reference-cache";
import {
  clearVaApiOutboundRateLimitState,
  fetchVaForms,
  type VaApiConfig,
} from "@/lib/va/sandbox";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";
import { loadDisabilityReference } from "@/lib/va/disability-reference";

const config: VaApiConfig = {
  enabled: true,
  mode: "sandbox",
  modeReason: "Test fixture: sandbox mode.",
  environment: "sandbox",
  formsApiKey: "forms-test-key",
  benefitsReferenceDataApiKey: "reference-test-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl:
    "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  clearVaReferenceCache();
  clearVaApiOutboundRateLimitState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VA shared reference cache — finding #3 (multi-instance miss rate)", () => {
  it("stays disabled until a valid https URL + token pair is configured (fail-closed)", () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    expect(isVaSharedCacheConfigured()).toBe(false);
    expect(loadVaSharedCacheConfig()).toBeNull();
  });

  it("rejects non-https KV URLs (server-only origin guard)", () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "http://evil.example.com");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
    expect(isVaSharedCacheConfigured()).toBe(false);
  });

  it("accepts the canonical VA_REFERENCE_* pair and any vendor alias, and defaults the key prefix", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    expect(isVaSharedCacheConfigured()).toBe(true);
    expect(loadVaSharedCacheConfig()!.prefix).toBe("va:ref:");
  });

  it("honors an explicit shared-cache prefix when provided", () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "https://example.upstash.io");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_PREFIX", "custom:prefix:");
    expect(loadVaSharedCacheConfig()!.prefix).toBe("custom:prefix:");
  });

  it("reads and writes a value via the Upstash REST-compatible POST command (GET / SET … EX)", async () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "https://example.upstash.io/");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
    const fetchSpy = vi
      .fn()
      // read path: POST { GET key } → { result: json string }
      .mockResolvedValueOnce(okJson({ result: JSON.stringify({ live: true }) }))
      // write path: POST { SET key json EX sec } → { result: \"OK\" }
      .mockResolvedValueOnce(okJson({ result: "OK" }));
    vi.stubGlobal("fetch", fetchSpy);

    const read = await readVaSharedReferenceCache<{ live: boolean }>("forms:sandbox:q");
    expect(read).toEqual({ live: true });

    await writeVaSharedReferenceCache("forms:sandbox:q", { live: true }, 5 * 60 * 1000);

    // Read call
    expect(fetchSpy.mock.calls[0]![0]).toBe("https://example.upstash.io");
    const readBody = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
    expect(readBody).toEqual(["GET", "va:ref:forms:sandbox:q"]);

    // Write call — EX is TTL in seconds
    const writeBody = JSON.parse((fetchSpy.mock.calls[1]![1] as RequestInit).body as string);
    expect(writeBody).toEqual(["SET", "va:ref:forms:sandbox:q", JSON.stringify({ live: true }), "EX", "300"]);
  });

  it("degrades gracefully on KV timeout / http error / payload error (never throws)", async () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "https://example.upstash.io");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
    // timeout case → catch + null
    {
      const fetchSpy = vi.fn().mockImplementation(() => {
        const error = Object.assign(new Error("aborted"), { name: "AbortError" });
        return Promise.reject(error);
      });
      vi.stubGlobal("fetch", fetchSpy);
      await expect(readVaSharedReferenceCache("k")).resolves.toBeNull();
      await expect(writeVaSharedReferenceCache("k", { x: 1 })).resolves.toBeUndefined();
    }
    // http error
    {
      const fetchSpy = vi.fn().mockResolvedValue(new Response("err", { status: 500 }));
      vi.stubGlobal("fetch", fetchSpy);
      await expect(readVaSharedReferenceCache("k2")).resolves.toBeNull();
    }
    // { error } payload
    {
      const fetchSpy = vi.fn().mockResolvedValue(okJson({ error: "WRONGPASS" }));
      vi.stubGlobal("fetch", fetchSpy);
      await expect(readVaSharedReferenceCache("k3")).resolves.toBeNull();
    }
  });

  it("rehydrates the process-local cache on a shared-cache hit so the next hit is fast", async () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "https://example.upstash.io");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
    const view = {
      query: "21-526EZ",
      items: [
        { formName: "21-526EZ", title: "t", url: "https://x", lastRevisionOn: null, pages: null, validPdf: true },
      ],
      source: "va-sandbox-api" as const,
      sourceLabel: "VA Forms sandbox",
      notice: "sandbox notice",
      live: true as const,
      environment: "sandbox" as const,
      retrievedAt: "2026-09-13T00:00:00.000Z",
      cacheStatus: "miss" as const,
    };
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(okJson({ result: JSON.stringify(view) }));
    vi.stubGlobal("fetch", fetchSpy);

    const first = await loadVaFormsFinder("21-526EZ");
    expect(first.cacheStatus).toBe("hit"); // served from shared
    expect(first.items[0]!.formName).toBe("21-526EZ");
    // Only one KV round-trip on first hit (GET). A second call should be served
    // from the rehydrated process-local cache with no extra fetch.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Replace fetch with a spy that would be called only on a miss
    const secondFetchSpy = vi.fn();
    vi.stubGlobal("fetch", secondFetchSpy);
    const second = await loadVaFormsFinder("21-526EZ");
    expect(second.cacheStatus).toBe("hit");
    expect(secondFetchSpy).not.toHaveBeenCalled();
  });

  it("allows live VA fetches in a distributed runtime only when the shared KV is configured", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "test");
    // Without shared KV: still blocked
    {
      vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "");
      vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const blocked = await fetchVaForms("21-526EZ", { config });
      expect(blocked.success).toBe(false);
      expect(blocked.source).toBe("local-fallback");
      expect(fetchSpy).not.toHaveBeenCalled();
    }
    // With shared KV + a mock VA 200: allowed through (integration still does the real VA fetch)
    {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
      const fetchSpy = vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        // Shared-cache probe must not be mistaken for the VA API; that probe
        // is skipped here. This spy is only hit by the VA fetch after the gate.
        if (href.includes("example.upstash.io")) {
          return okJson({ result: null });
        }
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      vi.stubGlobal("fetch", fetchSpy);
      const allowed = await fetchVaForms("21-526EZ", { config });
      // With an empty data set it succeeds (contract: success=true even when empty)
      expect(allowed.success).toBe(true);
      expect(allowed.source).toBe("va-sandbox-api");
      // At least one call to the VA Forms base URL happened
      expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("sandbox-api.va.gov"))).toBe(true);
    }
  });

  it("still falls back to local reference when the live fetch fails in distributed with shared KV", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchSpy = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("example.upstash.io")) return okJson({ result: null });
      return new Response("oops", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await loadDisabilityReference(async () => ({
      success: false,
      data: null,
      source: "local-fallback",
      environment: "sandbox",
      error: "unavailable",
    }));
    // Disability loader uses the injected fetcher — still falls back either way
    expect(result.source).toBe("local-fallback");
  });
});
