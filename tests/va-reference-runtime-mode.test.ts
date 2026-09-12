import { describe, expect, it } from "vitest";

import { loadVaApiConfig } from "@/lib/va/sandbox";
import {
  VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE,
  resolveVaReferenceMode,
} from "@/lib/va/runtime-state";

const PRODUCTION_FORMS_URL = "https://api.va.gov/services/va_forms/v0";
const PRODUCTION_REFERENCE_URL =
  "https://api.va.gov/services/benefits-reference-data/v1";
const SANDBOX_FORMS_URL = "https://sandbox-api.va.gov/services/va_forms/v0";
const SANDBOX_REFERENCE_URL =
  "https://sandbox-api.va.gov/services/benefits-reference-data/v1";

const PRODUCTION_CREDENTIALS = {
  VA_FORMS_PRODUCTION_API_KEY: "forms-production-key",
  VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: "reference-production-key",
} as const;

/**
 * Issue #287 gate rule, enforced in code:
 * "Do not switch the application to VA production endpoints or label data as
 * production-sourced until VA production access is granted and live production
 * connectivity is objectively verified."
 */
describe("VA public-reference runtime mode (issue #287)", () => {
  describe("fail-closed default", () => {
    it("resolves disabled with no environment configuration", () => {
      const resolution = resolveVaReferenceMode({});

      expect(resolution.mode).toBe("disabled");
      expect(resolution.enabled).toBe(false);
      expect(resolution.environment).toBe("sandbox");
    });

    it("keeps the loaded configuration disabled and on sandbox endpoints by default", () => {
      const config = loadVaApiConfig({});

      expect(config.enabled).toBe(false);
      expect(config.mode).toBe("disabled");
      expect(config.environment).toBe("sandbox");
      expect(config.formsBaseUrl).toBe(SANDBOX_FORMS_URL);
      expect(config.benefitsReferenceDataBaseUrl).toBe(SANDBOX_REFERENCE_URL);
    });

    it("treats an unrecognised enable value as disabled rather than enabled", () => {
      for (const value of ["maybe", "TRUEISH", "on", "2", "yes-please"]) {
        expect(resolveVaReferenceMode({ VA_API_ENABLED: value }).mode).toBe("disabled");
      }
    });

    it("treats explicit falsy values as disabled", () => {
      for (const value of ["false", "0", "no"]) {
        expect(resolveVaReferenceMode({ VA_API_ENABLED: value }).mode).toBe("disabled");
      }
    });
  });

  describe("sandbox mode", () => {
    it("enables sandbox mode from the generic flag", () => {
      const resolution = resolveVaReferenceMode({ VA_API_ENABLED: "true" });

      expect(resolution).toEqual(
        expect.objectContaining({ mode: "sandbox", environment: "sandbox", enabled: true }),
      );
    });

    it("preserves the Phase 2 VA_SANDBOX_ENABLED compatibility flag", () => {
      const resolution = resolveVaReferenceMode({ VA_SANDBOX_ENABLED: "true" });

      expect(resolution.mode).toBe("sandbox");
      expect(resolution.enabled).toBe(true);
    });

    it("accepts case and whitespace variants of the enable flag", () => {
      expect(resolveVaReferenceMode({ VA_API_ENABLED: "  TRUE  " }).mode).toBe("sandbox");
      expect(resolveVaReferenceMode({ VA_API_ENABLED: "1" }).mode).toBe("sandbox");
      expect(resolveVaReferenceMode({ VA_API_ENABLED: "yes" }).mode).toBe("sandbox");
    });

    it("does not let VA_SANDBOX_ENABLED enable a production selection", () => {
      const resolution = resolveVaReferenceMode({
        VA_API_ENV: "production",
        VA_SANDBOX_ENABLED: "true",
      });

      expect(resolution.mode).toBe("disabled");
      expect(resolution.enabled).toBe(false);
    });

    it("never serves production URLs in sandbox mode", () => {
      const config = loadVaApiConfig({ VA_API_ENABLED: "true" });

      expect(config.formsBaseUrl).toBe(SANDBOX_FORMS_URL);
      expect(config.benefitsReferenceDataBaseUrl).toBe(SANDBOX_REFERENCE_URL);
      expect(config.formsBaseUrl).not.toContain("://api.va.gov");
    });
  });

  describe("production gate", () => {
    it("stays disabled when production is selected but not enabled", () => {
      const resolution = resolveVaReferenceMode({
        VA_API_ENV: "production",
        ...PRODUCTION_CREDENTIALS,
      });

      expect(resolution.mode).toBe("disabled");
      expect(resolution.enabled).toBe(false);
      // The requested environment is still reported so operators can see that a
      // production selection was made and refused, rather than implying sandbox.
      expect(resolution.environment).toBe("production");
    });

    it("stays disabled when enabled with credentials but without the access acknowledgement", () => {
      const resolution = resolveVaReferenceMode({
        VA_API_ENV: "production",
        VA_API_ENABLED: "true",
        ...PRODUCTION_CREDENTIALS,
      });

      expect(resolution.mode).toBe("disabled");
      expect(resolution.enabled).toBe(false);
      expect(resolution.reason).toContain(VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE);
      expect(resolution.reason).toContain("#287");
    });

    it("does not treat the acknowledgement alone as enablement", () => {
      const resolution = resolveVaReferenceMode({
        VA_API_ENV: "production",
        [VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE]: "true",
        ...PRODUCTION_CREDENTIALS,
      });

      expect(resolution.mode).toBe("disabled");
      expect(resolution.enabled).toBe(false);
    });

    it("fails closed when acknowledged but service-specific credentials are missing", () => {
      const resolution = resolveVaReferenceMode({
        VA_API_ENV: "production",
        VA_API_ENABLED: "true",
        [VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE]: "true",
        VA_FORMS_PRODUCTION_API_KEY: "forms-production-key",
      });

      expect(resolution.mode).toBe("disabled");
      expect(resolution.enabled).toBe(false);
      expect(resolution.reason).toContain("Benefits Reference Data");
    });

    it("never carries production endpoints or keys when production failed closed", () => {
      const config = loadVaApiConfig({
        VA_API_ENV: "production",
        VA_API_ENABLED: "true",
        ...PRODUCTION_CREDENTIALS,
      });

      expect(config.mode).toBe("disabled");
      expect(config.enabled).toBe(false);
      // Defense in depth: even a caller that ignores `enabled` cannot reach
      // production, and no production key is loaded into the configuration.
      expect(config.formsBaseUrl).not.toBe(PRODUCTION_FORMS_URL);
      expect(config.benefitsReferenceDataBaseUrl).not.toBe(PRODUCTION_REFERENCE_URL);
      expect(config.formsBaseUrl).toBe(SANDBOX_FORMS_URL);
      expect(config.formsApiKey).toBeUndefined();
      expect(config.benefitsReferenceDataApiKey).toBeUndefined();
    });

    it("enables production mode only with enablement, acknowledgement, and credentials", () => {
      const resolution = resolveVaReferenceMode({
        VA_API_ENV: "production",
        VA_API_ENABLED: "true",
        [VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE]: "true",
        ...PRODUCTION_CREDENTIALS,
      });

      expect(resolution).toEqual(
        expect.objectContaining({
          mode: "production",
          environment: "production",
          enabled: true,
        }),
      );

      const config = loadVaApiConfig({
        VA_API_ENV: "production",
        VA_API_ENABLED: "true",
        [VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE]: "true",
        ...PRODUCTION_CREDENTIALS,
      });

      expect(config.mode).toBe("production");
      expect(config.formsBaseUrl).toBe(PRODUCTION_FORMS_URL);
      expect(config.benefitsReferenceDataBaseUrl).toBe(PRODUCTION_REFERENCE_URL);
      expect(config.formsApiKey).toBe("forms-production-key");
      expect(config.benefitsReferenceDataApiKey).toBe("reference-production-key");
    });

    it("rejects a falsy acknowledgement value", () => {
      const resolution = resolveVaReferenceMode({
        VA_API_ENV: "production",
        VA_API_ENABLED: "true",
        [VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE]: "false",
        ...PRODUCTION_CREDENTIALS,
      });

      expect(resolution.mode).toBe("disabled");
    });
  });

  describe("mode reporting", () => {
    it("exposes a non-sensitive auditable reason for every mode", () => {
      const cases = [
        {},
        { VA_API_ENABLED: "true" },
        { VA_API_ENV: "production", VA_API_ENABLED: "true" },
        {
          VA_API_ENV: "production",
          VA_API_ENABLED: "true",
          [VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE]: "true",
          ...PRODUCTION_CREDENTIALS,
        },
      ];

      for (const env of cases) {
        const { reason } = resolveVaReferenceMode(env);
        expect(typeof reason).toBe("string");
        expect(reason.length).toBeGreaterThan(0);
        // Reasons reach operator diagnostics, so they must not echo credentials.
        expect(reason).not.toContain("forms-production-key");
        expect(reason).not.toContain("reference-production-key");
      }
    });

    it("surfaces mode and reason on the loaded configuration", () => {
      const config = loadVaApiConfig({ VA_API_ENABLED: "true" });

      expect(config.mode).toBe("sandbox");
      expect(typeof config.modeReason).toBe("string");
      expect(config.modeReason).toContain("sandbox");
    });

    it("keeps the backward-compatible sandbox loader on the same mode", () => {
      const config = loadVaApiConfig({
        VA_SANDBOX_ENABLED: "true",
        VA_FORMS_SANDBOX_API_KEY: "forms-key",
        VA_BENEFITS_REFERENCE_SANDBOX_API_KEY: "reference-key",
      });

      expect(config.mode).toBe("sandbox");
      expect(config.enabled).toBe(true);
      expect(config.formsApiKey).toBe("forms-key");
    });
  });
});
