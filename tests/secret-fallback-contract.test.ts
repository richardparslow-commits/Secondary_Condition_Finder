import { afterEach, describe, expect, it, vi } from "vitest";

import {
  workflowSessionRuntimeReady,
  workflowSessionSecret,
} from "@/lib/workflow-session-crypto";

/**
 * Completes the secret-fallback contract (audit finding #9 series; core
 * fail-fast already pinned in deployment-readiness.test.ts):
 *
 * 1. A CONFIGURED-but-too-short secret must also throw in production — the
 *    length gate and the production gate are independent, so there is no path
 *    where production returns DEVELOPMENT_ONLY_SECRET.
 * 2. The dev fallback is loud (console.warn) in non-test, non-production.
 * 3. It stays silent under test (no warn spam in CI).
 * 4. The throw happens BEFORE any fallback return, so production never sees
 *    the hardcoded secret.
 * 5. The legacy `SECONDARY_WORKFLOW_SESSION_SECRET` fallback is retired
 *    (REL-04 follow-up): it is never returned in any environment, so the
 *    seal/open path and the production readiness probe resolve identically.
 */
const DEV_SECRET =
  "development-only-workflow-session-secret-not-for-production";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("workflow session secret fallback contract", () => {
  it("throws in production when the only configured secret is below the length floor", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "short");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");

    expect(() => workflowSessionSecret()).toThrow(
      /WORKFLOW_SESSION_SECRET must be configured with at least 32 characters in production/,
    );
  });

  it("throws in production even when a short legacy fallback is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "also-too-short");

    expect(() => workflowSessionSecret()).toThrow(
      /must be configured with at least 32 characters in production/,
    );
  });

  it("retired the legacy secondary fallback: a long legacy-only value still fails closed in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv(
      "SECONDARY_WORKFLOW_SESSION_SECRET",
      "legacy-fallback-secret-that-is-long-enough-for-tests",
    );

    expect(() => workflowSessionSecret()).toThrow(
      /WORKFLOW_SESSION_SECRET must be configured with at least 32 characters in production/,
    );
    expect(workflowSessionRuntimeReady()).toBe(false);
  });

  it("never returns the legacy secondary value outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv(
      "SECONDARY_WORKFLOW_SESSION_SECRET",
      "legacy-fallback-secret-that-is-long-enough-for-tests",
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(workflowSessionSecret()).toBe(DEV_SECRET);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("development-only session secret"),
    );
  });

  it("never returns the development-only secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");

    let result: string | null = null;
    try {
      result = workflowSessionSecret();
    } catch {
      // expected: fail-fast wins
    }
    expect(result).not.toBe(DEV_SECRET);
  });

  it("warns when the dev fallback is used outside test and production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const secret = workflowSessionSecret();

    expect(secret).toBe(DEV_SECRET);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("development-only session secret"),
    );
  });

  it("stays silent under the test environment", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const secret = workflowSessionSecret();

    expect(secret).toBe(DEV_SECRET);
    expect(warn).not.toHaveBeenCalled();
  });
});
