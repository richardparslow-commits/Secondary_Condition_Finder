import { afterEach, describe, expect, it, vi } from "vitest";

const mockGetCircuitSnapshot = vi.fn().mockReturnValue({
  "va-forms": { state: "closed", failures: 0, lastFailureAt: null },
  "benefits-reference-data": { state: "closed", failures: 0, lastFailureAt: null },
  "accredited-representatives": { state: "closed", failures: 0, lastFailureAt: null },
});

const mockPeekCacheCounters = vi.fn().mockReturnValue({ hits: 0, misses: 0 });

const mockVaReferenceCacheScope = vi.fn().mockReturnValue({
  scope: "process-local",
  detail: "test fixture",
});

const mockCircuitBreakerScope = vi.fn().mockReturnValue({
  scope: "single-process",
  detail: "test fixture",
});

vi.mock("@/lib/va/circuit-breaker", () => ({
  getCircuitSnapshot: (...args: unknown[]) => mockGetCircuitSnapshot(...args),
  circuitBreakerScope: (...args: unknown[]) => mockCircuitBreakerScope(...args),
}));

// These are full module mocks, so every export the health route reaches for has to
// be listed here — including the ones it reaches only transitively, through
// `runtime-capabilities.ts`. A missing entry throws at call time and turns every
// health assertion into a 503, which looks like a health regression rather than a
// stale mock.
vi.mock("@/lib/va/reference-cache", () => ({
  peekCacheCounters: (...args: unknown[]) => mockPeekCacheCounters(...args),
  vaReferenceCacheScope: (...args: unknown[]) => mockVaReferenceCacheScope(...args),
}));

afterEach(() => {
  mockGetCircuitSnapshot.mockReset();
  mockGetCircuitSnapshot.mockReturnValue({
    "va-forms": { state: "closed", failures: 0, lastFailureAt: null },
    "benefits-reference-data": { state: "closed", failures: 0, lastFailureAt: null },
    "accredited-representatives": { state: "closed", failures: 0, lastFailureAt: null },
  });
  mockPeekCacheCounters.mockReset();
  mockPeekCacheCounters.mockReturnValue({ hits: 0, misses: 0 });
  mockVaReferenceCacheScope.mockReset();
  mockVaReferenceCacheScope.mockReturnValue({
    scope: "process-local",
    detail: "test fixture",
  });
  mockCircuitBreakerScope.mockReset();
  mockCircuitBreakerScope.mockReturnValue({
    scope: "single-process",
    detail: "test fixture",
  });
});

describe("health endpoint crash resilience", () => {
  it("returns 200 healthy when all checks pass", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.components.catalog.status).toBe("ok");
    expect(body.components.sessionCrypto.status).toBe("ok");
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });

  it("returns 503 degraded status instead of crashing when getCircuitSnapshot throws", async () => {
    mockGetCircuitSnapshot.mockImplementation(() => {
      throw new Error("Circuit breaker state unavailable");
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.error).toBe("Circuit breaker state unavailable");
    expect(body.timestamp).toBeDefined();
  });

  it("returns 503 degraded status instead of crashing when peekCacheCounters throws", async () => {
    mockPeekCacheCounters.mockImplementation(() => {
      throw new Error("Cache counter unavailable");
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.error).toBe("Cache counter unavailable");
    expect(body.timestamp).toBeDefined();
  });
});
