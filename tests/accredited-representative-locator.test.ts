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
