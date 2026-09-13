import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearVaApiOutboundRateLimitState,
  fetchVaDisabilityReference,
  fetchVaForms,
  type VaApiConfig,
} from "@/lib/va/sandbox";

const sandboxConfig: VaApiConfig = {
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

const productionConfig: VaApiConfig = {
  enabled: true,
  mode: "production",
  modeReason: "Test fixture: acknowledged production mode.",
  environment: "production",
  formsApiKey: "forms-production-test-key",
  benefitsReferenceDataApiKey: "reference-production-test-key",
  formsBaseUrl: "https://api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl:
    "https://api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

afterEach(() => {
  clearVaApiOutboundRateLimitState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("VA API trusted-origin enforcement", () => {
  it("never sends VA API keys to an arbitrary HTTPS host", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const formsResult = await fetchVaForms(undefined, {
      config: {
        ...sandboxConfig,
        formsBaseUrl: "https://attacker.example/services/va_forms/v0",
      },
    });
    const referenceResult = await fetchVaDisabilityReference({
      config: {
        ...sandboxConfig,
        benefitsReferenceDataBaseUrl:
          "https://attacker.example/services/benefits-reference-data/v1",
      },
    });

    expect(formsResult.success).toBe(false);
    expect(referenceResult.success).toBe(false);
    expect(formsResult.error).toContain("expected VA API origin");
    expect(referenceResult.error).toContain("expected VA API origin");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps sandbox and production credentials pinned to their matching VA origins", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const productionToSandbox = await fetchVaForms(undefined, {
      config: {
        ...productionConfig,
        formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
      },
    });
    const sandboxToProduction = await fetchVaDisabilityReference({
      config: {
        ...sandboxConfig,
        benefitsReferenceDataBaseUrl:
          "https://api.va.gov/services/benefits-reference-data/v1",
      },
    });

    expect(productionToSandbox.success).toBe(false);
    expect(sandboxToProduction.success).toBe(false);
    expect(productionToSandbox.error).toContain("expected VA API origin");
    expect(sandboxToProduction.error).toContain("expected VA API origin");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects credential-bearing base URLs even when the hostname is trusted", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaForms(undefined, {
      config: {
        ...sandboxConfig,
        formsBaseUrl:
          "https://embedded:secret@sandbox-api.va.gov/services/va_forms/v0",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("expected VA API origin");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
