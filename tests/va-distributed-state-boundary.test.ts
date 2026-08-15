import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearVaApiOutboundRateLimitState,
  fetchVaForms,
  type VaApiConfig,
} from "@/lib/va/sandbox";
import {
  clearVaReferenceCache,
  readVaReferenceCache,
  writeVaReferenceCache,
} from "@/lib/va/reference-cache";
import { vaProcessLocalStateAllowed } from "@/lib/va/runtime-state";

const config: VaApiConfig = {
  enabled: true,
  environment: "sandbox",
  formsApiKey: "forms-test-key",
  benefitsReferenceDataApiKey: "reference-test-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl:
    "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

afterEach(() => {
  clearVaApiOutboundRateLimitState();
  clearVaReferenceCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VA process-local state boundary", () => {
  it("blocks live VA traffic in production before any credentialed network call", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(vaProcessLocalStateAllowed()).toBe(false);

    const result = await fetchVaForms("21-526EZ", { config });

    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(result.error).toContain("shared rate-limit/cache coordinator");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks known serverless runtimes even when NODE_ENV is not production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "1");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(vaProcessLocalStateAllowed()).toBe(false);

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(false);
    expect(result.error).toContain("shared rate-limit/cache coordinator");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("disables the process-local reference cache in distributed runtimes", () => {
    vi.stubEnv("VERCEL", "1");

    writeVaReferenceCache("forms:sandbox:test", { value: "live" }, 1000, 5000);

    expect(readVaReferenceCache("forms:sandbox:test", 1001)).toBeNull();
  });

  it("retains bounded process-local state for single-process non-production execution", () => {
    vi.stubEnv("NODE_ENV", "test");

    expect(vaProcessLocalStateAllowed()).toBe(true);
    writeVaReferenceCache("forms:sandbox:test", { value: "live" }, 1000, 5000);
    expect(readVaReferenceCache("forms:sandbox:test", 1001)).toEqual({ value: "live" });
  });
});
