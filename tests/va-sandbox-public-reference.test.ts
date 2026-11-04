import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchVaDisabilityReference,
  fetchVaForms,
  fetchVaServiceBranches,
  loadVaApiConfig,
  loadVaSandboxConfig,
  VA_API_MAX_RESPONSE_BYTES,
  VA_API_MAX_TIMEOUT_MS,
  type VaSandboxConfig,
} from "@/lib/va/sandbox";

const config: VaSandboxConfig = {
  enabled: true,
  mode: "sandbox",
  modeReason: "Test fixture: sandbox mode.",
  environment: "sandbox",
  formsApiKey: "forms-sandbox-test-key",
  benefitsReferenceDataApiKey: "reference-sandbox-test-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl:
    "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public-reference VA API adapters", () => {
  it("keeps the Phase 2 sandbox environment variables backward compatible", () => {
    const loaded = loadVaSandboxConfig({
      VA_SANDBOX_ENABLED: "true",
      VA_FORMS_SANDBOX_API_KEY: " forms-key-from-env ",
      VA_BENEFITS_REFERENCE_SANDBOX_API_KEY: " reference-key-from-env ",
      VA_SANDBOX_TIMEOUT_MS: "2500",
      VA_FORMS_SANDBOX_BASE_URL: "https://example.test/forms/v0",
      VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL: "https://example.test/reference/v1",
    });

    expect(loaded).toEqual(expect.objectContaining({
      enabled: true,
      environment: "sandbox",
      formsApiKey: "forms-key-from-env",
      benefitsReferenceDataApiKey: "reference-key-from-env",
      timeoutMs: 2500,
      formsBaseUrl: "https://example.test/forms/v0",
      benefitsReferenceDataBaseUrl: "https://example.test/reference/v1",
    }));
  });

  it("requires an explicit generic enable flag before production mode can make requests", () => {
    const disabled = loadVaApiConfig({
      VA_API_ENV: "production",
      VA_FORMS_PRODUCTION_API_KEY: "forms-production-key",
      VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: "reference-production-key",
    });
    expect(disabled.enabled).toBe(false);
    expect(disabled.mode).toBe("disabled");
    expect(disabled.environment).toBe("production");

    // Issue #287: production mode is a deliberate tri-state decision, not a
    // two-variable switch. Without the access acknowledgement the resolver fails
    // closed and never serves production base URLs.
    const enabledWithoutAccessGrant = loadVaApiConfig({
      VA_API_ENV: "production",
      VA_API_ENABLED: "true",
      VA_FORMS_PRODUCTION_API_KEY: " forms-production-key ",
      VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: " reference-production-key ",
    });
    expect(enabledWithoutAccessGrant.enabled).toBe(false);
    expect(enabledWithoutAccessGrant.mode).toBe("disabled");
    expect(enabledWithoutAccessGrant.formsBaseUrl).not.toBe(
      "https://api.va.gov/services/va_forms/v0",
    );

    const enabled = loadVaApiConfig({
      VA_API_ENV: "production",
      VA_API_ENABLED: "true",
      VA_PRODUCTION_ACCESS_GRANTED: "true",
      VA_FORMS_PRODUCTION_API_KEY: " forms-production-key ",
      VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: " reference-production-key ",
    });
    expect(enabled).toEqual(
      expect.objectContaining({
        enabled: true,
        mode: "production",
        environment: "production",
        formsApiKey: "forms-production-key",
        benefitsReferenceDataApiKey: "reference-production-key",
        formsBaseUrl: "https://api.va.gov/services/va_forms/v0",
        benefitsReferenceDataBaseUrl: "https://api.va.gov/services/benefits-reference-data/v1",
      }),
    );
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

  it("uses only the VA Forms key for VA Forms requests", async () => {
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
      expect.objectContaining({ apikey: "forms-sandbox-test-key" }),
    );
    expect(JSON.stringify(init.headers)).not.toContain("reference-sandbox-test-key");
    expect(JSON.stringify(init.headers)).not.toContain("Authorization");
  });

  it("uses only the Benefits Reference Data key for disability and service-branch requests", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            totalItems: 1,
            totalPages: 1,
            items: [{ id: 30, name: "abnormal weight loss", endDateTime: null }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [{ code: "ARMY", description: "Army" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const disabilityResult = await fetchVaDisabilityReference({ config });
    const branchResult = await fetchVaServiceBranches({ config });

    expect(disabilityResult.success).toBe(true);
    expect(branchResult.success).toBe(true);
    expect(branchResult.data?.items[0]).toEqual({ code: "ARMY", description: "Army" });
    for (const call of fetchSpy.mock.calls) {
      const [, init] = call as [URL, RequestInit];
      expect(init.headers).toEqual(
        expect.objectContaining({ apikey: "reference-sandbox-test-key" }),
      );
      expect(JSON.stringify(init.headers)).not.toContain("forms-sandbox-test-key");
    }
  });

  it("follows disability reference pages instead of treating the first page as the whole list", async () => {
    const page = (items: Array<{ id: number; name: string }>) =>
      new Response(
        JSON.stringify({ totalItems: 3, totalPages: 3, items }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: 1, name: "Asthma" }]))
      .mockResolvedValueOnce(page([{ id: 2, name: "Migraine" }]))
      .mockResolvedValueOnce(page([{ id: 3, name: "Tinnitus" }]));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaDisabilityReference({ config });

    expect(result.success).toBe(true);
    expect(result.data?.items.map((item) => item.name)).toEqual([
      "Asthma",
      "Migraine",
      "Tinnitus",
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const urls = fetchSpy.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.map((url) => url.searchParams.get("page[number]"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(urls[0]?.searchParams.get("page[size]")).toBe("200");
  });

  it("fails closed per service when only that service key is missing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const formsResult = await fetchVaForms(undefined, {
      config: { ...config, formsApiKey: undefined },
    });
    expect(formsResult.success).toBe(false);
    expect(formsResult.error).toContain("va-forms sandbox API key");

    const referenceResult = await fetchVaDisabilityReference({
      config: { ...config, benefitsReferenceDataApiKey: undefined },
    });
    expect(referenceResult.success).toBe(false);
    expect(referenceResult.error).toContain(
      "benefits-reference-data sandbox API key",
    );

    expect(fetchSpy).not.toHaveBeenCalled();
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
    expect(JSON.stringify(observations)).not.toContain("forms-sandbox-test-key");
    expect(JSON.stringify(observations)).not.toContain("reference-sandbox-test-key");
  });

  it("clamps a misconfigured per-attempt timeout to the hard maximum", () => {
    const loaded = loadVaApiConfig({
      VA_API_ENABLED: "true",
      VA_FORMS_SANDBOX_API_KEY: "forms-key",
      VA_BENEFITS_REFERENCE_SANDBOX_API_KEY: "reference-key",
      VA_API_TIMEOUT_MS: "999999999",
    });
    expect(loaded.timeoutMs).toBe(VA_API_MAX_TIMEOUT_MS);
  });

  it("rejects an oversized response body instead of buffering it whole", async () => {
    // A single-megabyte-plus JSON string body exceeds the 2 MiB cap once the
    // JSON envelope is accounted for; the adapter must fail closed rather than
    // call response.json() on an unbounded stream.
    const oversized = `{"data":[{"id":"x","type":"va_form","attributes":{"form_name":"x","title":"${'a'.repeat(
      VA_API_MAX_RESPONSE_BYTES + 1024,
    )}","url":"https://example.test/x.pdf"}}]}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(oversized, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await fetchVaForms(undefined, { config });
    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
  });

  it("skips unreadable form records instead of failing the whole payload", async () => {
    // One odd record used to fail the array, which the finder rendered as "VA
    // Forms is down" even though the readable records were in the response.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "1",
                type: "va_form",
                attributes: {
                  form_name: "21-526EZ",
                  title: "Application for Disability Compensation",
                  url: "https://www.va.gov/vaforms/21-526EZ.pdf",
                },
              },
              {
                id: "2",
                type: "va_form",
                attributes: {
                  form_name: "21-0966",
                  title: "Bad link record",
                  url: "javascript:alert(1)",
                },
              },
              {
                id: "3",
                type: "va_form",
                attributes: {
                  form_name: "",
                  title: "Missing form name",
                  url: "https://www.va.gov/vaforms/21-0966.pdf",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await fetchVaForms("21", { config });

    expect(result.success).toBe(true);
    expect(result.data?.data).toHaveLength(1);
    expect(result.data?.data[0].attributes.form_name).toBe("21-526EZ");
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

  // Matching bound to the regulatory HTTP stack: an upstream that returns an
  // unbounded body must be refused rather than buffered. Previously this path
  // called a bare `response.json()`, so the VA adapter was the one outbound
  // family with no body-size limit at all.
  it("refuses an oversized response body instead of buffering it, and does not retry", async () => {
    const observations: Array<{ outcome?: string; path?: string }> = [];
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "content-length": String(VA_API_MAX_RESPONSE_BYTES + 1),
        },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaForms("21-526EZ", {
      config,
      observe: (observation) => observations.push(observation),
    });

    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(result.error).toContain("safety limit");
    expect(observations.at(-1)?.outcome).toBe("response-too-large");

    // A hostile upstream must not be retried with exponential backoff.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Neither the error nor the observation may carry the query string, which
    // can hold user-supplied search values.
    expect(JSON.stringify(result)).not.toContain("21-526EZ");
    expect(JSON.stringify(observations)).not.toContain("21-526EZ");
    expect(JSON.stringify(observations)).not.toContain("forms-sandbox-test-key");
  });
});
