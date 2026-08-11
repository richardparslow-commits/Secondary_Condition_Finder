import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchVaDisabilityReference,
  fetchVaForms,
  loadVaSandboxConfig,
  type VaSandboxConfig,
} from "@/lib/va/sandbox";

const config: VaSandboxConfig = {
  enabled: true,
  apiKey: "sandbox-test-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl:
    "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Phase 2 public-reference VA sandbox adapters", () => {
  it("loads sandbox configuration from server-side environment variables", () => {
    const loaded = loadVaSandboxConfig({
      VA_SANDBOX_ENABLED: "true",
      VA_SANDBOX_API_KEY: " key-from-env ",
      VA_SANDBOX_TIMEOUT_MS: "2500",
      VA_FORMS_SANDBOX_BASE_URL: "https://example.test/forms/v0",
      VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL: "https://example.test/reference/v1",
    });

    expect(loaded).toEqual({
      enabled: true,
      apiKey: "key-from-env",
      timeoutMs: 2500,
      formsBaseUrl: "https://example.test/forms/v0",
      benefitsReferenceDataBaseUrl: "https://example.test/reference/v1",
    });
  });

  it("does not call the network when the feature flag is disabled", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaForms(undefined, {
      config: { ...config, enabled: false },
    });

    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(result.error).toContain("disabled");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses the official apikey header and validates VA Forms responses", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "5403",
              type: "va_form",
              attributes: {
                form_name: "21-526EZ",
                url: "https://www.va.gov/vaforms/21-526EZ.pdf",
                title: "Application for Disability Compensation",
                last_revision_on: "2024-01-01",
                valid_pdf: true,
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaForms("21-526EZ", { config });

    expect(result.success).toBe(true);
    expect(result.data?.data[0].attributes.form_name).toBe("21-526EZ");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain("/forms?query=21-526EZ");
    expect(init.headers).toEqual(
      expect.objectContaining({ apikey: "sandbox-test-key" }),
    );
    expect(JSON.stringify(init.headers)).not.toContain("Authorization");
  });

  it("validates Benefits Reference Data disability responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            totalItems: 1,
            totalPages: 1,
            items: [{ id: 30, name: "abnormal weight loss", endDateTime: null }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await fetchVaDisabilityReference({ config });

    expect(result.success).toBe(true);
    expect(result.data?.items).toEqual([
      { id: 30, name: "abnormal weight loss", endDateTime: null },
    ]);
  });

  it("retries one transient sandbox failure and emits payload-free observations", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    const observations: unknown[] = [];

    const result = await fetchVaForms("claim form", {
      config,
      observe: (entry) => observations.push(entry),
    });

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(observations).toHaveLength(2);
    expect(observations[0]).toEqual(
      expect.objectContaining({
        service: "va-forms",
        path: "/services/va_forms/v0/forms",
        attempt: 1,
        outcome: "http-error",
        status: 503,
      }),
    );
    expect(JSON.stringify(observations)).not.toContain("claim form");
    expect(JSON.stringify(observations)).not.toContain("sandbox-test-key");
  });

  it("fails closed on invalid payloads and invalid non-HTTPS endpoint configuration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: "not-an-array" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const invalidPayload = await fetchVaForms(undefined, { config });
    expect(invalidPayload.success).toBe(false);
    expect(invalidPayload.error).toContain("invalid response payload");

    const insecureConfig = await fetchVaForms(undefined, {
      config: { ...config, formsBaseUrl: "http://example.test/forms" },
    });
    expect(insecureConfig.success).toBe(false);
    expect(insecureConfig.error).toContain("valid HTTPS URL");
  });
});
