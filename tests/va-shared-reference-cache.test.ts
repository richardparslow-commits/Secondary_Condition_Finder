import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VA_SHARED_CACHE_ENVELOPE_VERSION,
  VA_SHARED_CACHE_EPOCH_DEFAULT,
  VA_SHARED_KEY_WRITE_MAX_PER_WINDOW,
  VA_SHARED_KEY_WRITE_WINDOW_SECONDS,
  bumpVaSharedCacheEpoch,
  isAllowedVaSharedCacheKey,
  isVaSharedCacheConfigured,
  loadVaSharedCacheConfig,
  readVaSharedReferenceCache,
  vaSharedCacheKeyNamespace,
  writeVaSharedReferenceCache,
} from "@/lib/va/reference-shared-cache";
import { clearVaReferenceCache, hashedCacheKeySegment } from "@/lib/va/reference-cache";
import {
  clearVaApiOutboundRateLimitState,
  fetchVaForms,
  type VaApiConfig,
} from "@/lib/va/sandbox";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";
import { loadDisabilityReference } from "@/lib/va/disability-reference";

import { createFakeSharedKv, type FakeSharedKv } from "./helpers/fake-shared-kv";

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

const KV_URL = "https://example.upstash.io";

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Versioned envelope as it appears on the wire (`MGET` result element). */
function envelope(value: unknown, epoch: string = VA_SHARED_CACHE_EPOCH_DEFAULT): string {
  return JSON.stringify({
    envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
    epoch,
    value,
  });
}

function stubSharedKvEnv(): void {
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_URL);
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
}

function stubUnconfiguredSharedKvEnv(): void {
  for (const name of [
    "VA_REFERENCE_SHARED_CACHE_URL",
    "VA_REFERENCE_SHARED_CACHE_TOKEN",
    "VA_REFERENCE_KV_REST_URL",
    "VA_REFERENCE_KV_REST_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
  ]) {
    vi.stubEnv(name, "");
  }
}

function stubKvFetch(kv: FakeSharedKv): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: string | URL | Request, init?: RequestInit) => kv.respond(init)),
  );
}

function cardinalityBucketKey(namespace: string, now = Date.now()): string {
  return `va:ref:cardinality:${namespace}:${Math.floor(
    now / (VA_SHARED_KEY_WRITE_WINDOW_SECONDS * 1000),
  )}`;
}

afterEach(() => {
  clearVaReferenceCache();
  clearVaApiOutboundRateLimitState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// Envelope validation: a bare string, a foreign envelope, or a pre-invalidation
// envelope must not be cast into the caller's view type.
describe("VA shared reference cache — envelope validation", () => {
  it("rejects bare-string, unversioned, wrong-version, and non-object values instead of casting them", async () => {
    stubSharedKvEnv();
    const cases: unknown[][] = [
      [VA_SHARED_CACHE_EPOCH_DEFAULT, JSON.stringify({ live: true })], // unversioned object
      [
        VA_SHARED_CACHE_EPOCH_DEFAULT,
        JSON.stringify({ envelopeVersion: 1, epoch: "0", value: { live: true } }),
      ], // legacy pre-epoch version
      [
        VA_SHARED_CACHE_EPOCH_DEFAULT,
        JSON.stringify({ envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION, value: { live: true } }),
      ], // no epoch stamp
      [
        VA_SHARED_CACHE_EPOCH_DEFAULT,
        JSON.stringify({
          envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
          epoch: "0",
          value: "raw",
        }),
      ], // non-object value
      [
        VA_SHARED_CACHE_EPOCH_DEFAULT,
        JSON.stringify({
          envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
          epoch: "0",
          value: [1, 2],
        }),
      ], // array value
      [VA_SHARED_CACHE_EPOCH_DEFAULT, "NOT_A_VIEW"], // bare string, not JSON
      ["1", envelope({ live: true }, "0")], // stale epoch after a bump
      ["not-a-number", envelope({ live: true }, "0")], // unreadable epoch marker
    ];
    for (const [epochRaw, value] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson({ result: [epochRaw, value] })));
      await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();
    }
  });

  it("accepts a value only when the observed epoch matches the envelope's", async () => {
    stubSharedKvEnv();
    // Absent marker = epoch "0"; an envelope stamped "0" is current.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okJson({ result: [null, envelope({ live: true })] })),
    );
    await expect(readVaSharedReferenceCache<{ live: boolean }>("forms:sandbox:q")).resolves.toEqual({
      live: true,
    });

    // Explicit marker "7" and an envelope stamped "7" match.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okJson({ result: ["7", envelope({ live: true }, "7")] })),
    );
    await expect(readVaSharedReferenceCache<{ live: boolean }>("forms:sandbox:q")).resolves.toEqual({
      live: true,
    });
  });

  it("discards an oversized KV reply instead of buffering it whole", async () => {
    stubSharedKvEnv();
    const huge = okJson({
      result: [
        VA_SHARED_CACHE_EPOCH_DEFAULT,
        envelope({ blob: "x".repeat(200_000) }),
      ],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(huge));
    await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();
  });

  it("treats a reply that is not an [epoch, value] pair as a miss", async () => {
    stubSharedKvEnv();
    for (const result of ["OK", [], [VA_SHARED_CACHE_EPOCH_DEFAULT], [null, null, null]]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson({ result })));
      await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();
    }
  });
});

describe("VA shared reference cache — finding #3 (multi-instance miss rate)", () => {
  it("stays disabled until a valid https URL + token pair is configured (fail-closed)", () => {
    stubUnconfiguredSharedKvEnv();
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

  it("restricts reads and writes to the allowlisted key namespaces", async () => {
    expect(vaSharedCacheKeyNamespace("forms:sandbox:q:0123456789abcdef")).toBe("forms:");
    expect(vaSharedCacheKeyNamespace("forms:reference:sandbox")).toBe("forms:");
    expect(vaSharedCacheKeyNamespace("accredited-rep:sandbox:0123456789abcdef")).toBe(
      "accredited-rep:",
    );
    expect(vaSharedCacheKeyNamespace("disabilities:sandbox")).toBe("disabilities:");
    expect(vaSharedCacheKeyNamespace("service-branches:sandbox")).toBe("service-branches:");
    for (const key of [
      "budget:1",
      "circuit:va-forms",
      "circuit-probe:va-forms",
      "cache-epoch",
      "unknown:thing",
      "forms:UPPER",
      "forms:spaced key",
      "",
      "f".repeat(257),
    ]) {
      expect(isAllowedVaSharedCacheKey(key)).toBe(false);
    }

    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    stubSharedKvEnv();
    await expect(readVaSharedReferenceCache("budget:1")).resolves.toBeNull();
    await writeVaSharedReferenceCache("budget:1", { live: true });
    // No KV round-trip at all — the key never leaves the process.
    expect(kv.executed).toEqual([]);
  });

  it("reads and writes through the Redis-REST command contract (MGET epoch+value, GET epoch, SET … EX on write)", async () => {
    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    stubSharedKvEnv();

    await expect(readVaSharedReferenceCache<{ live: boolean }>("forms:sandbox:q")).resolves.toBeNull();
    expect(kv.executed).toEqual([["MGET", "va:ref:cache-epoch", "va:ref:forms:sandbox:q"]]);

    await writeVaSharedReferenceCache("forms:sandbox:q", { live: true }, 5 * 60 * 1000);
    expect(kv.executed.map((command) => command[0])).toEqual(["MGET", "GET", "INCR", "EXPIRE", "SET"]);
    expect(kv.executed[1]).toEqual(["GET", "va:ref:cache-epoch"]);
    expect(kv.executed[2]![1]).toBe(cardinalityBucketKey("forms"));
    expect(kv.executed[3]).toEqual([
      "EXPIRE",
      cardinalityBucketKey("forms"),
      String(VA_SHARED_KEY_WRITE_WINDOW_SECONDS),
    ]);
    const write = kv.executed[4]!;
    expect(write[1]).toBe("va:ref:forms:sandbox:q");
    expect(JSON.parse(String(write[2]))).toEqual({
      envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
      epoch: VA_SHARED_CACHE_EPOCH_DEFAULT,
      value: { live: true },
    });
    expect(write.slice(3)).toEqual(["EX", "300"]);

    // Round-trip: the value written through the fake store is now a hit.
    await expect(readVaSharedReferenceCache<{ live: boolean }>("forms:sandbox:q")).resolves.toEqual({
      live: true,
    });
  });

  it("degrades gracefully on KV timeout / http error / payload error (never throws)", async () => {
    stubSharedKvEnv();
    // timeout case → catch + null / skipped write
    {
      const fetchSpy = vi.fn().mockImplementation(() => {
        const error = Object.assign(new Error("aborted"), { name: "AbortError" });
        return Promise.reject(error);
      });
      vi.stubGlobal("fetch", fetchSpy);
      await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();
      await expect(
        writeVaSharedReferenceCache("forms:sandbox:q", { x: 1 }),
      ).resolves.toBeUndefined();
    }
    // http error
    {
      const fetchSpy = vi.fn().mockResolvedValue(new Response("err", { status: 500 }));
      vi.stubGlobal("fetch", fetchSpy);
      await expect(readVaSharedReferenceCache("forms:sandbox:q2")).resolves.toBeNull();
    }
    // { error } payload
    {
      const fetchSpy = vi.fn().mockResolvedValue(okJson({ error: "WRONGPASS" }));
      vi.stubGlobal("fetch", fetchSpy);
      await expect(readVaSharedReferenceCache("forms:sandbox:q3")).resolves.toBeNull();
    }
  });

  it("ignores a cached live view while the integration is disabled (activation first)", async () => {
    vi.stubEnv("VA_API_ENABLED", "");
    stubSharedKvEnv();
    const liveView = {
      query: "21-526EZ",
      items: [],
      source: "va-production-api",
      sourceLabel: "VA Forms production",
      notice: "production",
      live: true,
      environment: "production",
      retrievedAt: "2026-09-13T00:00:00.000Z",
      cacheStatus: "miss",
    };
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(okJson({ result: [VA_SHARED_CACHE_EPOCH_DEFAULT, envelope(liveView)] }));
    vi.stubGlobal("fetch", fetchSpy);

    const view = await loadVaFormsFinder("21-526EZ");
    // A disabled deployment must not label KV data as live production.
    expect(view.source).toBe("local-fallback");
    expect(view.live).toBe(false);
    expect(view.cacheStatus).toBe("miss");
    // No KV probe at all while disabled.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rehydrates the process-local cache on a shared-cache hit so the next hit is fast", async () => {
    vi.stubEnv("VA_API_ENABLED", "true");
    stubSharedKvEnv();
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
      .mockResolvedValueOnce(okJson({ result: [VA_SHARED_CACHE_EPOCH_DEFAULT, envelope(view)] }));
    vi.stubGlobal("fetch", fetchSpy);

    const first = await loadVaFormsFinder("21-526EZ");
    expect(first.cacheStatus).toBe("hit"); // served from shared
    expect(first.items[0]!.formName).toBe("21-526EZ");
    // Only one KV round-trip on first hit (MGET). A second call should be served
    // from the rehydrated process-local cache with no extra fetch.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Replace fetch with a spy that would be called only on a miss
    const secondFetchSpy = vi.fn();
    vi.stubGlobal("fetch", secondFetchSpy);
    const second = await loadVaFormsFinder("21-526EZ");
    expect(second.cacheStatus).toBe("hit");
    expect(secondFetchSpy).not.toHaveBeenCalled();
  });

  it("treats a provenance-forged shared value as a miss and refetches instead of serving it", async () => {
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-test-key");
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    const key = `forms:sandbox:q:${hashedCacheKeySegment("21-526ez")}`;
    kv.seed(
      `va:ref:${key}`,
      JSON.stringify({
        envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
        epoch: VA_SHARED_CACHE_EPOCH_DEFAULT,
        value: {
          query: "21-526EZ",
          items: [],
          source: "va-production-api",
          sourceLabel: "VA Forms production",
          notice: "production",
          live: true,
          environment: "production",
          retrievedAt: "2026-09-13T00:00:00.000Z",
          cacheStatus: "miss",
        },
      }),
    );
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      String(input).startsWith(KV_URL) ? kv.respond(init) : okJson({ data: [] }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const view = await loadVaFormsFinder("21-526EZ");
    // The forged production-labelled value is discarded (guard), so the loader
    // refetches against the configured sandbox API instead of serving it.
    expect(view.source).toBe("va-sandbox-api");
    expect(view.cacheStatus).toBe("miss");
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("sandbox-api.va.gov"))).toBe(true);
  });

  it("blocks live VA fetches in a distributed runtime when the shared KV is not configured", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "test");
    stubUnconfiguredSharedKvEnv();
    vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const blocked = await fetchVaForms("21-526EZ", { config });
    expect(blocked.success).toBe(false);
    expect(blocked.source).toBe("local-fallback");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks live VA fetches when a KV is configured but the consumer budget is not explicitly enabled", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", KV_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const blocked = await fetchVaForms("21-526EZ", { config });
    expect(blocked.success).toBe(false);
    expect(blocked.source).toBe("local-fallback");
    expect(blocked.error).toContain("shared rate-limit/cache coordinator");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks live VA fetches when the consumer-budget coordinator is unreachable (fail closed)", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", KV_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "true");
    const fetchSpy = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.stubGlobal("fetch", fetchSpy);
    const blocked = await fetchVaForms("21-526EZ", { config });
    expect(blocked.success).toBe(false);
    expect(blocked.source).toBe("local-fallback");
    // The only attempted network call was the budget reservation.
    expect(fetchSpy.mock.calls.every(([u]) => String(u).includes("example.upstash.io"))).toBe(true);
  });

  it("allows live VA fetches in a distributed runtime when the shared consumer budget is configured and reachable", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", KV_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "true");
    const fetchSpy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("example.upstash.io")) {
        const command = JSON.parse(String(init?.body ?? "[]")) as unknown[];
        if (command[0] === "INCR") return okJson({ result: 1 });
        // Shared cache probe: no epoch marker and no cached value.
        if (command[0] === "MGET") return okJson({ result: [null, null] });
        // Shared circuit coordination read: no cooldown marker is published.
        if (command[0] === "GET") return okJson({ result: null });
        return okJson({ result: "OK" });
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
    // Every upstream attempt was preceded by a budget reservation.
    expect(fetchSpy.mock.calls.some(([, init]) => String(init?.body ?? "").includes("INCR"))).toBe(true);
  });

  it("still falls back to local reference when the live fetch fails in distributed with shared KV", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", KV_URL);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "true");
    const fetchSpy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("example.upstash.io")) {
        const command = JSON.parse(String(init?.body ?? "[]")) as unknown[];
        if (command[0] === "INCR") return okJson({ result: 1 });
        if (command[0] === "MGET") return okJson({ result: [null, null] });
        return okJson({ result: null });
      }
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

// Audit A-03 item 3: the admin route only clears the process-local map, so a
// shared deployment needs a store-wide invalidation signal.
describe("VA shared reference cache — global invalidation epoch", () => {
  it("advances the epoch on bump and immediately invalidates entries written under the old one", async () => {
    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    stubSharedKvEnv();

    await writeVaSharedReferenceCache("forms:sandbox:q", { live: "before-bump" });
    await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toEqual({
      live: "before-bump",
    });

    await expect(bumpVaSharedCacheEpoch()).resolves.toBe("1");
    expect(kv.get("va:ref:cache-epoch")).toBe("1");
    // Same bytes in the store, but unreadable fleet-wide after the bump.
    await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();

    // A fresh write is stamped with the new epoch and reads back as a hit.
    await writeVaSharedReferenceCache("forms:sandbox:q", { live: "after-bump" });
    const stored = JSON.parse(String(kv.get("va:ref:forms:sandbox:q")));
    expect(stored.epoch).toBe("1");
    await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toEqual({
      live: "after-bump",
    });

    // A second bump (atomic INCR) invalidates that entry too.
    await expect(bumpVaSharedCacheEpoch()).resolves.toBe("2");
    await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();
  });

  it("fails closed for reads and skips writes when the epoch marker is unreadable", async () => {
    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    stubSharedKvEnv();
    kv.seed("va:ref:cache-epoch", "not-a-number");
    kv.seed("va:ref:forms:sandbox:q", envelope({ live: true }));

    await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();
    await writeVaSharedReferenceCache("forms:sandbox:q", { live: true });
    expect(kv.executed.some((command) => command[0] === "SET")).toBe(false);
  });

  it("reports a failed bump instead of pretending it was applied", async () => {
    stubUnconfiguredSharedKvEnv();
    const unconfiguredFetch = vi.fn();
    vi.stubGlobal("fetch", unconfiguredFetch);
    await expect(bumpVaSharedCacheEpoch()).resolves.toBeNull();
    expect(unconfiguredFetch).not.toHaveBeenCalled();

    const kv = createFakeSharedKv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    stubSharedKvEnv();
    await expect(bumpVaSharedCacheEpoch()).resolves.toBeNull();
    expect(kv.executed).toEqual([]);
  });
});

// Audit A-03 item 5: the local LRU limit does not bound the shared store, so
// writes are admitted against a finite per-namespace window budget.
describe("VA shared reference cache — finite key/cardinality policy", () => {
  it("refuses writes once the namespace window budget is exhausted, without issuing SET", async () => {
    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    stubSharedKvEnv();
    kv.seed(cardinalityBucketKey("forms"), String(VA_SHARED_KEY_WRITE_MAX_PER_WINDOW));

    await writeVaSharedReferenceCache("forms:sandbox:q", { live: true });
    expect(kv.executed.some((command) => command[0] === "INCR")).toBe(true);
    expect(kv.executed.some((command) => command[0] === "SET")).toBe(false);
  });

  it("bounds each namespace counter with one EXPIRE per window and keeps namespaces separate", async () => {
    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    stubSharedKvEnv();

    await writeVaSharedReferenceCache("forms:sandbox:q", { live: true });
    await writeVaSharedReferenceCache("forms:sandbox:q2", { live: true });
    await writeVaSharedReferenceCache("accredited-rep:sandbox:abc", { live: true });

    const expirations = kv.executed.filter((command) => command[0] === "EXPIRE");
    expect(expirations).toHaveLength(2); // once per namespace window, not per write
    expect(
      expirations.every((command) => command[2] === String(VA_SHARED_KEY_WRITE_WINDOW_SECONDS)),
    ).toBe(true);

    const counters = kv.executed
      .filter((command) => command[0] === "INCR")
      .map((command) => command[1]);
    expect(new Set(counters)).toEqual(new Set([cardinalityBucketKey("forms"), cardinalityBucketKey("accredited-rep")]));
  });

  it("skips the write (fail closed) when the cardinality coordinator is unreachable", async () => {
    const kv = createFakeSharedKv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const command = JSON.parse(String(init?.body ?? "[]")) as unknown[];
        if (command[0] === "INCR" && String(command[1]).includes("cardinality:")) {
          return new Response("err", { status: 500 });
        }
        return kv.respond(init);
      }),
    );
    stubSharedKvEnv();

    await writeVaSharedReferenceCache("forms:sandbox:q", { live: true });
    expect(kv.executed.some((command) => command[0] === "SET")).toBe(false);
  });
});

describe("global invalidation via /api/admin/cache-clear", () => {
  const secret = "s".repeat(40);

  async function callRoute(): Promise<{ status: number; body: Record<string, unknown> }> {
    const { POST } = await import("@/app/api/admin/cache-clear/route");
    const response = await POST(
      new Request("https://example.test/api/admin/cache-clear", {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it("advances the shared invalidation epoch and reports the new epoch", async () => {
    vi.stubEnv("REGULATORY_SYNC_SECRET", secret);
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    stubKvFetch(kv);

    const { status, body } = await callRoute();
    expect(status).toBe(200);
    expect(body.sharedInvalidation).toBe("applied");
    expect(body.sharedEpoch).toBe("1");
    expect(kv.executed.some(([name, key]) => name === "INCR" && key === "va:ref:cache-epoch")).toBe(
      true,
    );
  });

  it("reports not-configured and touches no KV when no shared store is configured", async () => {
    vi.stubEnv("REGULATORY_SYNC_SECRET", secret);
    stubUnconfiguredSharedKvEnv();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { status, body } = await callRoute();
    expect(status).toBe(200);
    expect(body.sharedInvalidation).toBe("not-configured");
    expect(body.sharedEpoch).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports failed shared invalidation when the coordinator is unreachable", async () => {
    vi.stubEnv("REGULATORY_SYNC_SECRET", secret);
    stubSharedKvEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    const { status, body } = await callRoute();
    expect(status).toBe(200); // the local clear still succeeded
    expect(body.sharedInvalidation).toBe("failed");
    expect(body.sharedEpoch).toBeNull();
  });
});

describe("VA shared reference cache — credential transport", () => {
  it("refuses to follow a store redirect instead of replaying the KV token to another origin", async () => {
    stubSharedKvEnv();
    const storeExchanges: Array<{ url: string; redirect: string | undefined }> = [];
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      storeExchanges.push({ url: String(input), redirect: init?.redirect });
      return new Response(null, {
        status: 302,
        headers: { Location: "https://attacker.example/collect" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    // Both the read and the write path's epoch check are store exchanges; a
    // redirect is a failed exchange, so the read misses and the write is
    // skipped rather than replayed against the redirect target.
    await expect(readVaSharedReferenceCache("forms:sandbox:q")).resolves.toBeNull();
    await writeVaSharedReferenceCache("forms:sandbox:q", { live: true });

    expect(storeExchanges.length).toBeGreaterThanOrEqual(2);
    expect(fetchSpy).toHaveBeenCalledTimes(storeExchanges.length);
    for (const exchange of storeExchanges) {
      expect(exchange.url).toBe(KV_URL);
      expect(exchange.redirect).toBe("error");
    }
  });
});
