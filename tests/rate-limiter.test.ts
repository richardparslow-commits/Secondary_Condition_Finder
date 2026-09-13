import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  createRateLimiter,
  extractClientKey,
  workflowSessionLimiter,
  regulatoryPreflightLimiter,
  healthLimiter,
} from "@/lib/rate-limiter";

describe("createRateLimiter", () => {
  it("allows requests within the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("ip-1");
      expect(result.limited).toBe(false);
      expect(result.remaining).toBe(5 - i - 1);
    }
  });

  it("rejects requests over the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    limiter.check("ip-1"); // 1
    limiter.check("ip-1"); // 2
    limiter.check("ip-1"); // 3
    const result = limiter.check("ip-1"); // 4 — over limit
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.check("ip-a");
    limiter.check("ip-a");
    expect(limiter.check("ip-a").limited).toBe(true);
    expect(limiter.check("ip-b").limited).toBe(false);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

    limiter.check("ip-1");
    limiter.check("ip-1");
    expect(limiter.check("ip-1").limited).toBe(true);

    // Advance past the window
    vi.advanceTimersByTime(1001);
    expect(limiter.check("ip-1").limited).toBe(false);

    vi.useRealTimers();
  });

  it("reset() clears all state", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("ip-1");
    expect(limiter.check("ip-1").limited).toBe(true);
    limiter.reset();
    expect(limiter.check("ip-1").limited).toBe(false);
  });

  it("reports correct count and remaining", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
    const r1 = limiter.check("ip-1");
    expect(r1.count).toBe(1);
    expect(r1.remaining).toBe(9);

    const r2 = limiter.check("ip-1");
    expect(r2.count).toBe(2);
    expect(r2.remaining).toBe(8);
  });

  it("returns increasing count when limited", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("ip-1"); // count=1
    const r2 = limiter.check("ip-1"); // count=2, limited
    expect(r2.count).toBe(2);
    expect(r2.limited).toBe(true);
    const r3 = limiter.check("ip-1"); // count=3, still limited
    expect(r3.count).toBe(3);
    expect(r3.limited).toBe(true);
  });
});

describe("pre-configured limiters", () => {
  beforeEach(() => {
    workflowSessionLimiter.reset();
    regulatoryPreflightLimiter.reset();
    healthLimiter.reset();
  });

  it("workflowSessionLimiter allows 30 requests per minute", () => {
    for (let i = 0; i < 30; i++) {
      expect(workflowSessionLimiter.check("test").limited).toBe(false);
    }
    expect(workflowSessionLimiter.check("test").limited).toBe(true);
  });

  it("regulatoryPreflightLimiter allows 5 requests per minute", () => {
    for (let i = 0; i < 5; i++) {
      expect(regulatoryPreflightLimiter.check("test").limited).toBe(false);
    }
    expect(regulatoryPreflightLimiter.check("test").limited).toBe(true);
  });

  it("healthLimiter allows 30 requests per minute", () => {
    for (let i = 0; i < 30; i++) {
      expect(healthLimiter.check("test").limited).toBe(false);
    }
    expect(healthLimiter.check("test").limited).toBe(true);
  });
});

describe("extractClientKey", () => {
  it("extracts the first IP from X-Forwarded-For", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(extractClientKey(headers)).toBe("1.2.3.4");
  });

  it("returns a single IP when no commas", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1" });
    expect(extractClientKey(headers)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when header is absent", () => {
    const headers = new Headers();
    expect(extractClientKey(headers)).toBe("unknown");
  });

  it("trims whitespace from IPs", () => {
    const headers = new Headers({ "x-forwarded-for": "  1.2.3.4 , 5.6.7.8" });
    expect(extractClientKey(headers)).toBe("1.2.3.4");
  });
});
