import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VA_SHARED_FETCH_LEASE_MS,
  acquireVaSharedFetchLease,
  awaitVaSharedFetchOutcome,
  clearSharedSingleFlightStateForTests,
  releaseVaSharedFetchLease,
} from "@/lib/va/shared-single-flight";
import { clearVaReferenceCache, hashedCacheKeySegment } from "@/lib/va/reference-cache";
import { writeVaSharedReferenceCache } from "@/lib/va/reference-shared-cache";
import { clearVaApiOutboundRateLimitState } from "@/lib/va/sandbox";
import { clearCircuitBreakerState } from "@/lib/va/circuit-breaker";
import { clearSharedCircuitStateForTests } from "@/lib/va/shared-circuit";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";

import { createFakeSharedKv } from "./helpers/fake-shared-kv";

const KV_URL = "https://example.upstash.io";
const KEY = `forms:sandbox:q:${hashedCacheKeySegment("21-526ez")}`;
const LEASE_KEY = `va:ref:inflight:${KEY}`;

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
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

function stubKvFetch(kv: ReturnType<typeof createFakeSharedKv>, upstream?: (url: string) => Promise<Response> | Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const href = String(input);
      if (href.startsWith(KV_URL)) return kv.respond(init);
      if (upstream) return upstream(href);
      return okJson({ data: [] });
    }),
  );
}

afterEach(() => {
  clearVaReferenceCache();
  clearVaApiOutboundRateLimitState();
  clearCircuitBreakerState();
  clearSharedCircuitStateForTests();
  clearSharedSingleFlightStateForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("shared fetch lease — lifecycle", () => {
  it("grants one lease per key, reports contention, and frees the key on release", async () => {
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    stubKvFetch(kv);

    const first = await acquireVaSharedFetchLease(KEY);
    expect(first.status).toBe("acquired");
    expect(first.token).not.toBeNull();
    expect(kv.get(LEASE_KEY)).toBe(first.token);

    const second = await acquireVaSharedFetchLease(KEY);
    expect(second.status).toBe("contended");
    expect(second.token).toBeNull();

    // The claim is a `SET … NX PX` with the lease TTL.
    const claim = kv.executed.find((command) => command[0] === "SET");
    expect(claim?.slice(3)).toEqual(["NX", "PX", String(VA_SHARED_FETCH_LEASE_MS)]);

    await releaseVaSharedFetchLease(KEY, first.token);
    expect(kv.get(LEASE_KEY)).toBeNull();

    const third = await acquireVaSharedFetchLease(KEY);
    expect(third.status).toBe("acquired");
    await releaseVaSharedFetchLease(KEY, third.token);
  });

  it("re-claims an expired lease instead of blocking forever", async () => {
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    kv.seed(LEASE_KEY, "dead-instance-token", -1); // already expired

    const lease = await acquireVaSharedFetchLease(KEY);
    expect(lease.status).toBe("acquired");
    expect(kv.get(LEASE_KEY)).toBe(lease.token);
    await releaseVaSharedFetchLease(KEY, lease.token);
  });

  it("never deletes a lease another instance re-claimed after expiry", async () => {
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    stubKvFetch(kv);

    const lease = await acquireVaSharedFetchLease(KEY);
    expect(lease.status).toBe("acquired");
    // Simulate expiry + re-claim by another instance before our release.
    kv.seed(LEASE_KEY, "other-instance-token", 60_000);
    await releaseVaSharedFetchLease(KEY, lease.token);
    expect(kv.get(LEASE_KEY)).toBe("other-instance-token");
  });

  it("fails open (unavailable, no KV traffic) when the coordinator is absent, unreachable, or the key is off-policy", async () => {
    stubUnconfiguredSharedKvEnv();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(acquireVaSharedFetchLease(KEY)).resolves.toEqual({
      status: "unavailable",
      token: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    stubSharedKvEnv();
    await expect(acquireVaSharedFetchLease("budget:1")).resolves.toEqual({
      status: "unavailable",
      token: null,
    });
    expect(kv.executed).toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    await expect(acquireVaSharedFetchLease(KEY)).resolves.toEqual({
      status: "unavailable",
      token: null,
    });
  });
});

describe("shared fetch lease — bounded wait", () => {
  it("returns the winner's published value within the wait window", async () => {
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    stubKvFetch(kv);

    const lease = await acquireVaSharedFetchLease(KEY);
    expect(lease.status).toBe("acquired");
    const publish = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      await writeVaSharedReferenceCache(KEY, { live: "published" });
    })();

    const outcome = await awaitVaSharedFetchOutcome<{ live: string }>(KEY, {
      attempts: 3,
      intervalMs: 100,
    });
    expect(outcome).toEqual({ live: "published" });
    await publish;
    await releaseVaSharedFetchLease(KEY, lease.token);
  });

  it("gives up after the bounded window instead of waiting on a failed fetch", async () => {
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    stubKvFetch(kv);
    const started = Date.now();
    await expect(
      awaitVaSharedFetchOutcome(KEY, { attempts: 2, intervalMs: 40 }),
    ).resolves.toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(30);
  });
});

describe("shared fetch lease — loader dedupe", () => {
  it("issues one upstream request for two concurrent cold-key loads", async () => {
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-test-key");
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    let upstreamCalls = 0;
    stubKvFetch(kv, async () => {
      upstreamCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      return okJson({
        data: [
          {
            id: "21-526EZ",
            type: "va_form",
            attributes: {
              form_name: "21-526EZ",
              title: "Application for Disability Compensation and Related Compensation Benefits",
              url: "https://www.va.gov/find-forms/about-form-21-526ez/",
              last_revision_on: null,
              deleted_at: null,
            },
          },
        ],
      });
    });

    const [first, second] = await Promise.all([
      loadVaFormsFinder("21-526EZ"),
      loadVaFormsFinder("21-526EZ"),
    ]);

    expect(upstreamCalls).toBe(1);
    expect(first.source).toBe("va-sandbox-api");
    expect(second.source).toBe("va-sandbox-api");
    // Exactly one call fetched; the other served the published shared value.
    expect([first.cacheStatus, second.cacheStatus].sort()).toEqual(["hit", "miss"]);
    expect(second.items[0]?.formName).toBe("21-526EZ");
  });

  it("releases the lease after a failed fetch so the key is not blocked", async () => {
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-test-key");
    stubSharedKvEnv();
    const kv = createFakeSharedKv();
    stubKvFetch(kv, () => new Response("oops", { status: 400 }));

    const view = await loadVaFormsFinder("21-526EZ");
    expect(view.source).toBe("local-fallback");

    // The key is immediately re-claimable rather than locked for the TTL.
    const lease = await acquireVaSharedFetchLease(KEY);
    expect(lease.status).toBe("acquired");
    await releaseVaSharedFetchLease(KEY, lease.token);
  });
});
