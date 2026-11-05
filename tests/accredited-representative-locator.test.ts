import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearAccreditedRepresentativeCache,
  loadAccreditedRepresentatives,
} from "@/lib/va/accredited-representatives";
import { getCircuitSnapshot } from "@/lib/va/circuit-breaker";
import {
  fetchVaAccreditedRepresentatives,
  normalizeAccreditedRepSearchParams,
  type VaApiConfig,
} from "@/lib/va/sandbox";

const baseConfig: VaApiConfig = {
  enabled: true,
  mode: "sandbox",
  modeReason: "Test fixture: sandbox mode.",
  environment: "sandbox",
  formsApiKey: "forms-key",
  benefitsReferenceDataApiKey: "reference-key",
  accreditedRepApiKey: "accredited-rep-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl: "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  accreditedRepBaseUrl: "https://sandbox-api.va.gov/services/accredited-representatives/v1",
  timeoutMs: 1000,
  accreditedRepEnabled: true,
};

const directoryPayload = {
  data: [
    {
      id: "rep-1",
      name: "Jane Representative",
      organization: "Veterans of Foreign Wars Post 1234",
      accreditationType: "VSO",
      specializations: ["PTSD claims", "Aid & Attendance"],
      phone: "555-0100",
      website: "https://vfw.example.org/post-1234",
      address: "100 Main St",
      zip: "12345",
      distanceMiles: 2.4,
    },
    {
      id: "rep-2",
      name: "Sam Attorney",
      accreditationType: "attorney",
      phone: null,
      website: null,
      zip: "12345",
      distanceMiles: null,
    },
  ],
};

function vaJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearAccreditedRepresentativeCache();
});

describe("accredited representative locator (Idea #8)", () => {
  it("rejects malformed search params fail-closed before any network use", () => {
    expect(normalizeAccreditedRepSearchParams({ zip: "1234" })).toBeNull();
    expect(normalizeAccreditedRepSearchParams({ zip: "abcde" })).toBeNull();
    expect(normalizeAccreditedRepSearchParams({ zip: "12345", radiusMiles: 999 })).toEqual({
      zip: "12345",
      radiusMiles: 50,
      type: undefined,
    });
    expect(normalizeAccreditedRepSearchParams({ zip: "12345", type: "notary" as never })).toEqual({
      zip: "12345",
      radiusMiles: 50,
      type: undefined,
    });
  });

  it("does not call the network when the accredited-rep feature flag is disabled", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaAccreditedRepresentatives(
      { zip: "12345" },
      { config: { ...baseConfig, accreditedRepEnabled: false } },
    );

    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back gracefully when the per-service flag is on but the sandbox key is not yet provisioned", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    clearAccreditedRepresentativeCache();

    // Rollout shape: generic VA gate + per-service flag on, key issuance
    // still pending. Must fail closed before any network use and must not
    // open the circuit breaker (no fetch attempt = no failure signal).
    const result = await fetchVaAccreditedRepresentatives(
      { zip: "12345" },
      {
        config: {
          ...baseConfig,
          enabled: true,
          accreditedRepEnabled: true,
          accreditedRepApiKey: undefined,
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(result.error).toContain("API key is required");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getCircuitSnapshot()["accredited-representatives"]?.state).toBe("closed");

    // End-to-end loader view stays the pinned local fallback with OGC guidance.
    const view = await loadAccreditedRepresentatives({ zip: "12345" }, async () => result);
    expect(view.live).toBe(false);
    expect(view.items).toEqual([]);
    expect(view.notice).toContain("va.gov/ogc/apps/accreditation");
  });

  it("maps directory results with distance sorting and provenance status", async () => {
    // A05: the loader's env-derived config is the source of truth, so the
    // live path requires both flags on — the mapping/sorting contract below
    // only applies when the directory is enabled.
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
    const fetchSpy = vi.fn().mockResolvedValue(vaJsonResponse(directoryPayload));
    vi.stubGlobal("fetch", fetchSpy);

    const view = await loadAccreditedRepresentatives({ zip: "12345", radiusMiles: 25 }, async () => {
      return fetchVaAccreditedRepresentatives({ zip: "12345", radiusMiles: 25 }, { config: baseConfig });
    });

    expect(view.live).toBe(true);
    expect(view.environment).toBe("sandbox");
    expect(view.items).toHaveLength(2);
    // Null distances sort after measured distances; names break remaining ties.
    expect(view.items[0].name).toBe("Jane Representative");
    expect(view.items[0].distanceMiles).toBe(2.4);
    expect(view.notice).toContain("verify");
    expect(view.sourceLabel).toContain("accredited-representative");
  });

  it("falls back to a local empty view with directory guidance when the API fails", async () => {
    // Same A05 note: reach the fetch-failure path with both flags on, so this
    // pins the API-failure fallback rather than passing vacuously while disabled.
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );

    const view = await loadAccreditedRepresentatives({ zip: "12345" }, async () => {
      return fetchVaAccreditedRepresentatives({ zip: "12345" }, { config: baseConfig });
    });

    expect(view.live).toBe(false);
    expect(view.source).toBe("local-fallback");
    expect(view.items).toEqual([]);
    expect(view.notice).toContain("va.gov/ogc/apps/accreditation");
  });

  it("keeps every readable representative when one record carries a ZIP+4", async () => {
    // Heal s3-one-odd-rep-hides-all-reps-1: the item schema accepted only five
    // digits, the array is validated as a whole, and one otherwise-valid record
    // with a ZIP+4 failed the entire payload — the loader then served its empty
    // fallback, which the finder rendered as "directory unavailable and none
    // found". The odd record is now shown rather than dropped.
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
    vi.stubEnv("VA_ACCREDITED_REP_SANDBOX_API_KEY", "test-key");
    clearAccreditedRepresentativeCache();
    const fetchSpy = vi.fn().mockResolvedValue(
      vaJsonResponse({
        data: [
          ...directoryPayload.data,
          {
            id: "rep-3",
            name: "Plus Four Representative",
            accreditationType: "VSO",
            zip: "12345-6789",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const view = await loadAccreditedRepresentatives({ zip: "12345", radiusMiles: 25 });

    expect(view.live).toBe(true);
    expect(view.items).toHaveLength(3);
    expect(view.items.map((item) => item.name)).toContain("Plus Four Representative");
    expect(view.items.find((item) => item.id === "rep-3")?.zip).toBe("12345-6789");

    // The cache DTO applies the same rule: a cache read must not degrade this
    // view to the empty fallback either.
    const cachedView = await loadAccreditedRepresentatives({ zip: "12345", radiusMiles: 25 });
    expect(cachedView.cacheStatus).toBe("hit");
    expect(cachedView.items).toHaveLength(3);
  });

  it("keeps every representative when one live record has a long free-form phone line", async () => {
    // Heal s7-long-phone-rep-hides-all-reps-1: the upstream schema accepts a
    // phone as free-form display text, but the cache DTO capped it at 50
    // characters. One record with two numbers and evening hours made the fresh
    // live view fail its own trust check, so the cache layer served the empty
    // degraded view and the finder reported an outage for a directory that had
    // answered. The long phone is now inside the DTO bound and the whole list
    // survives the write/read cycle.
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
    vi.stubEnv("VA_ACCREDITED_REP_SANDBOX_API_KEY", "test-key");
    clearAccreditedRepresentativeCache();
    const longPhone =
      "(202) 555-0100 ext. 4411, evenings (202) 555-0199 ext. 12";
    // Guards the regression: this value must be over the old 50-character cap
    // but within the display-text bound, or the test would not exercise the bug.
    expect(longPhone.length).toBeGreaterThan(50);
    expect(longPhone.length).toBeLessThanOrEqual(200);
    const fetchSpy = vi.fn().mockResolvedValue(
      vaJsonResponse({
        data: [
          ...directoryPayload.data,
          {
            id: "rep-3",
            name: "Ordinary Representative Three",
            accreditationType: "VSO",
            phone: "555-0103",
            zip: "12345",
            distanceMiles: 3.1,
          },
          {
            id: "rep-4",
            name: "Long Phone Representative",
            accreditationType: "VSO",
            phone: longPhone,
            zip: "12345",
            distanceMiles: 4.2,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const view = await loadAccreditedRepresentatives({ zip: "12345", radiusMiles: 25 });

    expect(view.live).toBe(true);
    expect(view.items).toHaveLength(4);
    expect(view.items.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "Jane Representative",
        "Sam Attorney",
        "Ordinary Representative Three",
        "Long Phone Representative",
      ]),
    );
    expect(view.items.find((item) => item.id === "rep-4")?.phone).toBe(longPhone);

    // The accepted view is cacheable, so a repeated lookup is a hit rather than
    // another upstream call or a degraded empty result.
    const cachedView = await loadAccreditedRepresentatives({ zip: "12345", radiusMiles: 25 });
    expect(cachedView.cacheStatus).toBe("hit");
    expect(cachedView.items).toHaveLength(4);
    expect(cachedView.items.find((item) => item.id === "rep-4")?.phone).toBe(longPhone);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the nearest representatives when a busy ZIP returns more than the cache bound", async () => {
    // Heal s1-many-reps-shown-as-none-found-1: a 250-record answer exceeded the
    // 200-item cache DTO, the fresh view failed its own trust policy, and the
    // cache layer served the empty degraded view — the finder claimed none
    // were nearby. The loader now sorts and bounds before building the view.
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
    vi.stubEnv("VA_ACCREDITED_REP_SANDBOX_API_KEY", "test-key");
    clearAccreditedRepresentativeCache();
    const fetchSpy = vi.fn().mockResolvedValue(
      vaJsonResponse({
        data: Array.from({ length: 250 }, (_, index) => ({
          id: `rep-${index}`,
          name: `Representative ${String(index).padStart(3, "0")}`,
          accreditationType: "VSO",
          zip: "12345",
          distanceMiles: index,
        })),
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const view = await loadAccreditedRepresentatives({ zip: "12345", radiusMiles: 50 });

    expect(view.live).toBe(true);
    expect(view.items).toHaveLength(200);
    // The list is sorted before it is bounded, so the nearest records survive.
    expect(view.items[0].distanceMiles).toBe(0);
    expect(view.items[199].distanceMiles).toBe(199);
    expect(view.items.some((item) => item.id === "rep-249")).toBe(false);

    // The bounded view is inside the cache DTO, so a repeated lookup stays
    // populated instead of degrading to the empty fallback.
    const cachedView = await loadAccreditedRepresentatives({ zip: "12345", radiusMiles: 50 });
    expect(cachedView.cacheStatus).toBe("hit");
    expect(cachedView.items).toHaveLength(200);
  });

  it("renders the search form with the VSO/agent/attorney filters (source pin)", () => {
    const source = readFileSync("src/components/va/AccreditedRepresentativeFinder.tsx", "utf8");
    expect(source).toContain("Find an accredited representative near you");
    expect(source).toContain('<option value="VSO">VSO representative</option>');
    expect(source).toContain('<option value="agent">Accredited agent</option>');
    expect(source).toContain('<option value="attorney">Attorney</option>');
    expect(source).toContain('name="zip"');
    expect(source).toContain('name="radiusMiles"');
    expect(source).toContain('name="type"');
  });

  it("pins the fee note, specializations, and accreditation badge contracts in the finder (source pin)", () => {
    const source = readFileSync("src/components/va/AccreditedRepresentativeFinder.tsx", "utf8");
    // Fee note: no upfront cost, fees only after claim approval (38 U.S.C. § 5904).
    expect(source).toContain("no upfront cost");
    expect(source).toContain("38 U.S.C. § 5904");
    // Accreditation status badge.
    expect(source).toContain("{item.accreditationType}");
    // Specializations render only when the directory supplies them.
    expect(source).toContain("item.specializations");
    expect(source).toContain("Specializations: ");
    // Distance, phone, website rendering.
    expect(source).toContain("distanceMiles");
    expect(source).toContain("tel:");
    expect(source).toContain('target="_blank"');
  });
});
