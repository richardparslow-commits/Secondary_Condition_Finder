import { afterEach, describe, it, expect, vi } from "vitest";
import { fetchSandboxVABits } from "../src/lib/va";

describe("Phase 2 VA Adapter Failure-Mode & Resilience Suite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("handles feature flag disabled state gracefully", async () => {
    const result = await fetchSandboxVABits("user-123", { enabled: false, timeoutMs: 1000 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("disabled");
  });

  it("fails closed when required upstream configuration is missing", async () => {
    const result = await fetchSandboxVABits("user-123", { enabled: true, timeoutMs: 1000 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("baseUrl is required");
  });

  it("recovers gracefully from simulated API timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("Aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
      ),
    );

    const result = await fetchSandboxVABits("user-123", {
      enabled: true,
      timeoutMs: 10,
      baseUrl: "https://sandbox.va.gov/disability-rating",
      apiKey: "sandbox-key",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Gateway Timeout");
  });

  it("recovers gracefully from simulated upstream server errors (500)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream failure", { status: 500 })),
    );

    const result = await fetchSandboxVABits("user-123", {
      enabled: true,
      timeoutMs: 1000,
      baseUrl: "https://sandbox.va.gov/disability-rating",
      apiKey: "sandbox-key",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("status 500");
  });

  it("returns validated upstream payloads when the configured request succeeds", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ratingPercentage: 70,
          effectiveDate: "2024-01-01",
          conditionsConnected: [
            {
              name: "Post-Traumatic Stress Disorder (PTSD)",
              diagnosticCode: "9411",
              serviceConnected: true,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchSandboxVABits("user-123", {
      enabled: true,
      timeoutMs: 1000,
      baseUrl: "https://sandbox.va.gov/disability-rating",
      apiKey: "sandbox-key",
    });

    expect(result.success).toBe(true);
    expect(result.data?.ratingPercentage).toBe(70);
    expect(result.source).toBe("va-sandbox-api");
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://sandbox.va.gov/disability-rating"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer " + "sandbox-key",
          "X-User-Id": "user-123",
        }),
      }),
    );
  });

  it("fails closed when the upstream payload shape is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ratingPercentage: "70" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    const result = await fetchSandboxVABits("user-123", {
      enabled: true,
      timeoutMs: 1000,
      baseUrl: "https://sandbox.va.gov/disability-rating",
      apiKey: "sandbox-key",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid disability rating payload");
  });

  it("refuses to follow an upstream redirect with the credential header", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://attacker.example/collect" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchSandboxVABits("user-123", {
      enabled: true,
      timeoutMs: 1000,
      baseUrl: "https://sandbox.va.gov/disability-rating",
      apiKey: "sandbox-key",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("status 302");
    // One request to the configured origin; the redirect is not followed.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://sandbox.va.gov/disability-rating"),
      expect.objectContaining({ redirect: "error" }),
    );
  });
});
