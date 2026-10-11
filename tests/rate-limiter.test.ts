import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  UNATTRIBUTED_ADMISSION_KEY,
  UNATTRIBUTED_ADMISSION_MAX_DEFAULT,
  chargeAdmission,
  createRateLimiter,
  isIpLiteral,
  rateLimitIdentityPolicy,
  rateLimitScope,
  resolveClientKey,
  unattributedAdmissionLimiter,
  unattributedAdmissionMax,
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

describe("resolveClientKey", () => {
  it("takes the first hop from X-Forwarded-For and records the source", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(resolveClientKey(headers)).toEqual({
      key: "1.2.3.4",
      source: "x-forwarded-for",
    });
  });

  it("returns a single IP when no commas", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1" });
    expect(resolveClientKey(headers)).toEqual({
      key: "10.0.0.1",
      source: "x-forwarded-for",
    });
  });

  it("trims whitespace from IPs", () => {
    const headers = new Headers({ "x-forwarded-for": "  1.2.3.4 , 5.6.7.8" });
    expect(resolveClientKey(headers).key).toBe("1.2.3.4");
  });

  it("falls through to X-Real-IP when X-Forwarded-For is absent", () => {
    const headers = new Headers({ "x-real-ip": "10.0.0.9" });
    expect(resolveClientKey(headers)).toEqual({ key: "10.0.0.9", source: "x-real-ip" });
  });

  it("ignores an empty first X-Forwarded-For hop and still uses X-Real-IP", () => {
    const headers = new Headers({
      "x-forwarded-for": " , 5.6.7.8",
      "x-real-ip": "10.0.0.9",
    });
    expect(resolveClientKey(headers)).toEqual({ key: "10.0.0.9", source: "x-real-ip" });
  });

  // The regression this replaced, stated as a contract: an unattributable request
  // is reported as unattributable, never as one shared bucket every client draws
  // from — that silently converted a per-IP allowance into a global cap.
  it("reports a null key rather than a shared bucket when identity is absent", () => {
    expect(resolveClientKey(new Headers())).toEqual({ key: null, source: "none" });
    expect(resolveClientKey(new Headers({ "x-forwarded-for": "   " })).key).toBeNull();
  });

  // The second regression: a forwarding header is a *string the client can
  // send*. Bucketing on whatever arrived let a request mint a private bucket
  // per request (fresh random value) or pick a victim's bucket (their IP), so
  // the limiter could be avoided on demand. Only an IP literal is an identity.
  it("refuses to bucket on a token that is not an IP literal", () => {
    for (const hostile of [
      "not-an-ip",
      "example.com",
      "/etc/passwd",
      "1.2.3",
      "256.1.1.1",
      "01.2.3.4",
      "1.2.3.4:8080",
      "999.999.999.999",
      "1.2.3.4%eth0",
      "203.0.113.5 203.0.113.6",
      "::gggg",
      "'; DROP TABLE buckets; --",
    ]) {
      expect(resolveClientKey(new Headers({ "x-forwarded-for": hostile }))).toEqual({
        key: null,
        source: "invalid",
      });
    }
  });

  it("prefers X-Forwarded-For over X-Real-IP when both are usable", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4",
      "x-real-ip": "10.0.0.9",
    });
    expect(resolveClientKey(headers)).toEqual({ key: "1.2.3.4", source: "x-forwarded-for" });
  });

  // An unusable X-Forwarded-For must not discard a usable X-Real-IP: the same
  // admission charge is paid either way, so reporting "unattributed" where a
  // real observation exists is strictly less information for no benefit.
  it("still uses X-Real-IP when the X-Forwarded-For hop is not an IP literal", () => {
    const headers = new Headers({
      "x-forwarded-for": "unknown, 5.6.7.8",
      "x-real-ip": "10.0.0.9",
    });
    expect(resolveClientKey(headers)).toEqual({ key: "10.0.0.9", source: "x-real-ip" });
  });
});

describe("isIpLiteral", () => {
  it("accepts IPv4 and IPv6 literals", () => {
    for (const value of [
      "1.2.3.4",
      "0.0.0.0",
      "255.255.255.255",
      "::1",
      "2001:db8::1",
      "2001:0db8:0000:0000:0000:0000:0000:0001",
      "::ffff:1.2.3.4",
      "[::1]",
    ]) {
      expect(isIpLiteral(value), value).toBe(true);
    }
  });

  it("rejects non-literals, ambiguous forms and interface-local addresses", () => {
    for (const value of [
      "",
      "   ",
      "host",
      "1.2.3",
      "1.2.3.4.5",
      "01.2.3.4",
      "256.0.0.1",
      "fe80::1%eth0",
      "[fe80::1%eth0]",
      "1.2.3.4:80",
      "2001:db8:::1",
    ]) {
      expect(isIpLiteral(value), value).toBe(false);
    }
  });
});

describe("rateLimitIdentityPolicy", () => {
  it("treats identity as self-declared until an operator asserts an ingress", () => {
    const policy = rateLimitIdentityPolicy({});
    expect(policy.trustedIngress).toBe(false);
    expect(policy.identity).toBe("self-declared");
    expect(policy.variable).toBe("RATE_LIMIT_TRUSTED_INGRESS");
    // The assertion is a deployment claim, so the report says what is *not*
    // verified rather than only naming the flag.
    expect(policy.detail).toMatch(/only as trustworthy as the header/);
  });

  it("records the assertion when the operator makes it explicitly", () => {
    for (const raw of ["true", " TRUE ", "True"]) {
      const policy = rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: raw });
      expect(policy.trustedIngress, raw).toBe(true);
      expect(policy.identity, raw).toBe("asserted");
    }
  });

  it("does not read a placeholder as an assertion", () => {
    for (const raw of ["", " ", "1", "yes", "false", "0"]) {
      expect(rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: raw }).trustedIngress, raw).toBe(
        false,
      );
    }
  });
});

describe("unattributedAdmissionMax", () => {
  it("defaults to the shipped ceiling", () => {
    expect(unattributedAdmissionMax({})).toBe(UNATTRIBUTED_ADMISSION_MAX_DEFAULT);
  });

  it("honours a configured ceiling", () => {
    expect(unattributedAdmissionMax({ RATE_LIMIT_UNATTRIBUTED_MAX: "25" })).toBe(25);
  });

  // A value that cannot be applied must never be *weaker* than the default, and
  // it must not throw inside a request path.
  it("falls back to the default for unusable values", () => {
    for (const raw of ["", " ", "0", "-5", "1.5", "many", "1e9", "0x10", "5 (see runbook)", "  "]) {
      expect(unattributedAdmissionMax({ RATE_LIMIT_UNATTRIBUTED_MAX: raw }), raw).toBe(
        UNATTRIBUTED_ADMISSION_MAX_DEFAULT,
      );
    }
  });
});

describe("chargeAdmission", () => {
  const ceilingEnv = { RATE_LIMIT_UNATTRIBUTED_MAX: "5" };
  const ceiling = () => unattributedAdmissionLimiter(ceilingEnv);
  // A per-client budget wide enough that only the specific cases below can
  // exhaust it — so a failure always names the budget that actually refused.
  let perClient: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    // The ceiling is memoized per configured max, so this is the real enforced
    // limiter for `ceilingEnv` — not a stand-in.
    ceiling().reset();
    perClient = createRateLimiter({ windowMs: 60_000, max: 1000, name: "test-per-client" });
  });

  it("charges a request with no identity to the shared ceiling, never to nothing", () => {
    for (let i = 0; i < 5; i += 1) {
      const result = chargeAdmission(perClient, null, ceilingEnv);
      expect(result.limited).toBe(false);
      expect(result.refusedBy).toBeNull();
    }
    const refused = chargeAdmission(perClient, null, ceilingEnv);
    expect(refused.limited).toBe(true);
    expect(refused.refusedBy).toBe("ceiling");
  });

  it("charges an attributed request to the ceiling as well as its own bucket", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(chargeAdmission(perClient, "1.2.3.4", ceilingEnv).limited).toBe(false);
    }
    // The per-client bucket is nowhere near exhausted; the aggregate ceiling is
    // what refuses here, so rotation cannot buy unlimited headroom.
    const refused = chargeAdmission(perClient, "1.2.3.4", ceilingEnv);
    expect(refused.limited).toBe(true);
    expect(refused.refusedBy).toBe("ceiling");
  });

  it("bounds a client that rotates keys instead of presenting a usable one", () => {
    let limited = 0;
    for (let i = 0; i < 50; i += 1) {
      // A fresh random identity per request — the historical bypass.
      if (chargeAdmission(perClient, `203.0.113.${i}`, ceilingEnv).limited) limited += 1;
    }
    expect(limited).toBe(45);
  });

  it("refuses on the per-client bucket once that bucket is exhausted", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, name: "test" });
    expect(chargeAdmission(limiter, "1.2.3.4", ceilingEnv).limited).toBe(false);
    expect(chargeAdmission(limiter, "1.2.3.4", ceilingEnv).limited).toBe(false);
    const refused = chargeAdmission(limiter, "1.2.3.4", ceilingEnv);
    expect(refused.limited).toBe(true);
    expect(refused.refusedBy).toBe("per-client");
  });

  // A refused request must still be counted, or the ceiling would let an
  // attacker past it for free as soon as the window is saturated. The probe
  // itself charges the ceiling, so one admission charge moves the observed
  // count by two.
  it("keeps charging the ceiling after it has refused", () => {
    for (let i = 0; i < 6; i += 1) chargeAdmission(perClient, null, ceilingEnv);
    const firstProbe = ceiling().check(UNATTRIBUTED_ADMISSION_KEY).count;
    chargeAdmission(perClient, null, ceilingEnv);
    const secondProbe = ceiling().check(UNATTRIBUTED_ADMISSION_KEY).count;
    expect(secondProbe - firstProbe).toBe(2);
  });
});

describe("rateLimitScope", () => {
  it("declares limits as per-instance in production and known distributed runtimes", () => {
    expect(rateLimitScope({ NODE_ENV: "production" }).scope).toBe("per-instance");
    expect(rateLimitScope({ NODE_ENV: "test", VERCEL: "1" }).scope).toBe("per-instance");
    expect(rateLimitScope({ NODE_ENV: "test", K_SERVICE: "svc" }).scope).toBe("per-instance");
  });

  it("declares limits as deployment-wide where one process owns the buckets", () => {
    expect(rateLimitScope({ NODE_ENV: "test" }).scope).toBe("single-process");
    // A marker explicitly switched off is not a distributed runtime.
    expect(rateLimitScope({ NODE_ENV: "test", VERCEL: "0" }).scope).toBe("single-process");
  });

  it("explains the consequence rather than only naming the regime", () => {
    expect(rateLimitScope({ NODE_ENV: "production" }).detail).toMatch(/instance count/);
  });

  // SEC-02's reporting half: an operator must be able to read the trust decision
  // and the enforced ceiling off the deployment instead of inferring them from
  // source comments, and the reported ceiling must be the one that is applied.
  it("reports the identity policy, the enforced ceiling and the store regime", () => {
    const env = { NODE_ENV: "production", RATE_LIMIT_UNATTRIBUTED_MAX: "42" };
    const scope = rateLimitScope(env);

    expect(scope.identity.identity).toBe("self-declared");
    expect(scope.identity.trustedIngress).toBe(false);
    expect(scope.store.mode).toBe("process-local");
    expect(scope.store.distributed).toBe(false);

    // Read off the limiter object, so it cannot describe a different budget.
    const enforced = unattributedAdmissionLimiter(env);
    expect(scope.ceiling.max).toBe(enforced.max);
    expect(scope.ceiling.windowMs).toBe(enforced.windowMs);
    expect(scope.ceiling.key).toBe(UNATTRIBUTED_ADMISSION_KEY);
    expect(scope.ceiling.variable).toBe("RATE_LIMIT_UNATTRIBUTED_MAX");

    // And the number that is reported is the number of requests that pass.
    enforced.reset();
    const perClient = createRateLimiter({ windowMs: 60_000, max: 1000 });
    let allowed = 0;
    while (!chargeAdmission(perClient, null, env).limited) allowed += 1;
    expect(allowed).toBe(scope.ceiling.max);
  });

  it("says identity is asserted when the operator asserts an ingress", () => {
    const scope = rateLimitScope({ NODE_ENV: "production", RATE_LIMIT_TRUSTED_INGRESS: "true" });
    expect(scope.identity.identity).toBe("asserted");
    expect(scope.detail).toMatch(/per-validated-client/);
  });
});
