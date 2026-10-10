import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAccreditedRepresentativeCache,
  loadAccreditedRepresentatives,
  type AccreditedRepresentativeView,
} from "@/lib/va/accredited-representatives";
import {
  hashedCacheKeySegment,
  writeVaReferenceCache,
} from "@/lib/va/reference-cache";
import {
  VA_REFERENCE_NAMESPACES,
  vaReferenceCacheKey,
} from "@/lib/va/reference-cache-access";
import type {
  AccreditedRepresentativeSearchParams,
  VaAccreditedRepresentative,
} from "@/lib/va/sandbox";

type Fetcher = Parameters<typeof loadAccreditedRepresentatives>[1];

const PARAMS: AccreditedRepresentativeSearchParams = {
  zip: "20001",
  radiusMiles: 50,
  type: "VSO",
};

const REP: VaAccreditedRepresentative = {
  id: "rep-1",
  name: "Alpha VSO Post",
  accreditationType: "VSO",
  zip: "20001",
  distanceMiles: 3,
};

function cacheKeyForTest(): string {
  return vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.accreditedRepresentatives,
    "sandbox",
    hashedCacheKeySegment(`${PARAMS.zip}:${PARAMS.radiusMiles}:${PARAMS.type}`),
  );
}

function seededLiveView(): AccreditedRepresentativeView {
  return {
    params: PARAMS,
    items: [REP],
    source: "va-sandbox-api",
    sourceLabel: "seeded live directory",
    notice: "seeded",
    live: true,
    environment: "sandbox",
    retrievedAt: new Date().toISOString(),
    cacheStatus: "miss",
  };
}

function liveFetcher(): Fetcher {
  return vi.fn(async () => ({
    success: true,
    data: { data: [REP] },
    source: "va-sandbox-api" as const,
    environment: "sandbox" as const,
  }));
}

function stubFlags(global: string, service: string): void {
  vi.stubEnv("VA_API_ENABLED", global);
  vi.stubEnv("VA_API_ENV", "sandbox");
  vi.stubEnv("VA_ACCREDITED_REP_ENABLED", service);
}

beforeEach(() => {
  clearAccreditedRepresentativeCache();
});

afterEach(() => {
  clearAccreditedRepresentativeCache();
  vi.unstubAllEnvs();
});

/**
 * A05: disable means "show no live data". The directory loader must evaluate
 * the effective service flag (global AND `VA_ACCREDITED_REP_ENABLED`) before
 * every cache tier, wait path, and transport — a disabled directory returns
 * the clearly labeled local fallback with no directory results, matching the
 * privacy page contract the finder UI already renders.
 */
describe("accredited-representative disable semantics", () => {
  it("serves no cached live view when the service flag is off (audit repro)", async () => {
    stubFlags("true", "");
    writeVaReferenceCache(cacheKeyForTest(), seededLiveView());
    const fetch = vi.fn(async (): Promise<never> => {
      throw new Error("must not fetch while disabled");
    });

    const view = await loadAccreditedRepresentatives(PARAMS, fetch);

    expect(fetch).not.toHaveBeenCalled();
    expect(view.live).toBe(false);
    expect(view.source).toBe("local-fallback");
    expect(view.items).toEqual([]);
  });

  it("skips the fetch when the service flag is off", async () => {
    stubFlags("true", "false");
    const fetch = liveFetcher();

    const view = await loadAccreditedRepresentatives(PARAMS, fetch);

    expect(fetch).not.toHaveBeenCalled();
    expect(view.live).toBe(false);
    expect(view.source).toBe("local-fallback");
    expect(view.items).toEqual([]);
    expect(view.notice).toContain("unavailable or disabled");
  });

  it("stays disabled when the global flag is off even with the service flag on", async () => {
    stubFlags("", "true");
    const fetch = liveFetcher();

    const view = await loadAccreditedRepresentatives(PARAMS, fetch);

    expect(fetch).not.toHaveBeenCalled();
    expect(view.live).toBe(false);
    expect(view.items).toEqual([]);
  });

  it("fetches and serves live data when both flags are on", async () => {
    stubFlags("true", "true");
    const fetch = liveFetcher();

    const view = await loadAccreditedRepresentatives(PARAMS, fetch);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(view.live).toBe(true);
    expect(view.items).toHaveLength(1);
  });

  it("still falls back when the fetch fails while enabled", async () => {
    stubFlags("true", "true");
    const fetch: Fetcher = vi.fn(async () => ({
      success: false,
      data: null,
      source: "va-sandbox-api" as const,
      environment: "sandbox" as const,
    }));

    const view = await loadAccreditedRepresentatives(PARAMS, fetch);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(view.live).toBe(false);
    expect(view.items).toEqual([]);
  });
});
