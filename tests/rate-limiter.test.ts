import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  UNATTRIBUTED_ADMISSION_KEY,
  UNATTRIBUTED_ADMISSION_MAX_DEFAULT,
  INGRESS_APPEND_MAX_HOPS,
  UNIDENTIFIED_ADMISSION_KEY_PREFIX,
  chargeAdmission,
  createRateLimiter,
  isIpLiteral,
  rateLimitIdentityPolicy,
  resolveIngressClaim,
  unidentifiedAdmissionKey,
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

/**
 * The declared ingress model decides *which hop* is an identity (SEC-02).
 *
 * Every case above relies on the default `unasserted` claim and is unchanged by
 * this: the model is opt-in, and each model's rule is asserted here rather than
 * inferred from the deployment.
 */
describe("resolveClientKey under a declared ingress model", () => {
  const claim = (value: string) => resolveIngressClaim({ RATE_LIMIT_TRUSTED_INGRESS: value });

  it("reads the leftmost hop for an ingress that sets the header", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(resolveClientKey(headers, claim("set"))).toEqual({
      key: "203.0.113.7",
      source: "x-forwarded-for",
    });
    // `true` is the legacy spelling of the same model.
    expect(resolveClientKey(headers, claim("true"))).toEqual({
      key: "203.0.113.7",
      source: "x-forwarded-for",
    });
  });

  it("reads the declared hop from the right for an appending ingress", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1, 10.0.0.2, 203.0.113.7" });
    expect(resolveClientKey(headers, claim("append"))).toEqual({
      key: "203.0.113.7",
      source: "x-forwarded-for",
    });
    expect(resolveClientKey(headers, claim("append:2"))).toEqual({
      key: "10.0.0.2",
      source: "x-forwarded-for",
    });
  });

  // The defect the append model exists to close: with the unconditional leftmost
  // rule, the hop the client writes is the bucket key, so rotating it mints a
  // fresh allowance per request.
  it("ignores every client-supplied hop in front of the appended peer", () => {
    for (let index = 0; index < 5; index += 1) {
      const headers = new Headers({ "x-forwarded-for": `198.51.100.${index}, 203.0.113.7` });
      expect(resolveClientKey(headers, claim("append")).key).toBe("203.0.113.7");
    }
    // A client that pads with a blank entry cannot shift the declared position:
    // positions count raw entries, one per appender.
    const padded = new Headers({ "x-forwarded-for": "198.51.100.9, , 203.0.113.7" });
    expect(resolveClientKey(padded, claim("append")).key).toBe("203.0.113.7");
    // A blank entry *at* the declared position is not an identity: the ingress
    // wrote nothing there, so the request is unattributed rather than keyed on
    // whatever the client left behind.
    const blankLast = new Headers({ "x-forwarded-for": "198.51.100.9, 203.0.113.7," });
    expect(resolveClientKey(blankLast, claim("append"))).toEqual({ key: null, source: "invalid" });
  });

  it("does not read X-Real-IP under an appending ingress", () => {
    // An appending ingress does not set X-Real-IP, so a value there is
    // client-supplied: reading it would let a client choose its own bucket, or a
    // victim's.
    expect(resolveClientKey(new Headers({ "x-real-ip": "203.0.113.99" }), claim("append"))).toEqual(
      { key: null, source: "none" },
    );
    // The single-hop caveat, stated as a contract rather than left implicit: with
    // one hop there is nothing to distinguish an ingress-written value from a
    // client-sent one, so `append` reads it (as the unasserted rule would) and
    // `append:N` for N>1 is what makes the position checkable. A valid
    // X-Real-IP is still never read.
    const singleHop = new Headers({
      "x-forwarded-for": "198.51.100.9",
      "x-real-ip": "203.0.113.99",
    });
    expect(resolveClientKey(singleHop, claim("append"))).toEqual({
      key: "198.51.100.9",
      source: "x-forwarded-for",
    });
  });

  // `append:2` declares two appenders (a CDN and the app proxy). A one-hop
  // request did not traverse both, so its single value is not an identity — the
  // property that makes a multi-appender claim falsifiable.
  it("refuses a single-hop request under a declared multi-appender ingress", () => {
    const single = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(resolveClientKey(single, claim("append:2"))).toEqual({ key: null, source: "invalid" });
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

  // The claim is a model, so the report names the hop enforcement reads. That is
  // what makes the claim auditable against what the ingress actually writes.
  it("reports the asserted model and the hop it reads", () => {
    expect(rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: "overwrite" })).toMatchObject({
      trustedIngress: true,
      identity: "asserted",
      model: "set",
      header: "x-forwarded-for",
      hop: "leftmost",
      hopsFromRight: null,
      fallback: "x-real-ip",
    });

    const append = rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: "append" });
    expect(append).toMatchObject({
      trustedIngress: true,
      identity: "asserted",
      model: "append",
      hop: "nth-from-right",
      hopsFromRight: 1,
      fallback: null,
    });

    const two = rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: " append:2 " });
    expect(two).toMatchObject({ model: "append", hopsFromRight: 2 });
    expect(two.detail).toMatch(/hop 2 from the right/);
  });

  it("reports the unasserted model with the hop it still reads", () => {
    expect(rateLimitIdentityPolicy({})).toMatchObject({
      model: "unasserted",
      hop: "leftmost",
      hopsFromRight: null,
      fallback: "x-real-ip",
    });
  });

  it("accepts the documented append hop range and refuses anything outside it", () => {
    expect(resolveIngressClaim({ RATE_LIMIT_TRUSTED_INGRESS: "append" })).toEqual({
      model: "append",
      hopsFromRight: 1,
    });
    expect(
      resolveIngressClaim({ RATE_LIMIT_TRUSTED_INGRESS: `append:${INGRESS_APPEND_MAX_HOPS}` }),
    ).toEqual({ model: "append", hopsFromRight: INGRESS_APPEND_MAX_HOPS });
    for (const raw of ["append:0", `append:${INGRESS_APPEND_MAX_HOPS + 1}`, "append:", "append:1.5"]) {
      expect(resolveIngressClaim({ RATE_LIMIT_TRUSTED_INGRESS: raw }), raw).toEqual({
        model: "unasserted",
        hopsFromRight: null,
      });
    }
  });

  // An unusable claim must never read as a verified ingress.
  it("falls back to the unasserted model for an unrecognised claim", () => {
    for (const raw of ["APPEND:X", "appended", "overwritten", "maybe", "trusted"]) {
      expect(rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: raw }), raw).toMatchObject({
        trustedIngress: false,
        identity: "self-declared",
        model: "unasserted",
      });
    }
  });

  // What an identity-less request gets is part of the promise, so it is reported
  // rather than left to be discovered from behaviour.
  it("reports what a request with no identity gets, per model", () => {
    const declared = rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: "append:2" });
    expect(declared.unidentified.policy).toBe("shared-per-client-bucket");
    expect(declared.unidentified.keyTemplate).toBe(`${UNIDENTIFIED_ADMISSION_KEY_PREFIX}<limiter>`);

    const fallback = rateLimitIdentityPolicy({ RATE_LIMIT_TRUSTED_INGRESS: "maybe" });
    expect(fallback.unidentified.policy).toBe("ceiling");
    expect(fallback.unidentified.keyTemplate).toBeNull();
    expect(fallback.unidentified.detail).toMatch(/cannot be told apart from an honest client/);
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
    expect(scope.identity.model).toBe("set");
    expect(scope.detail).toMatch(/per-validated-client/);
  });

  it("describes an appending ingress as per-ingress-observed-client", () => {
    const scope = rateLimitScope({ NODE_ENV: "production", RATE_LIMIT_TRUSTED_INGRESS: "append:2" });
    expect(scope.identity.model).toBe("append");
    expect(scope.identity.hopsFromRight).toBe(2);
    expect(scope.detail).toMatch(/per-ingress-observed-client/);
  });
});

/**
 * The identity-less path must not be *cheaper* than the identified one.
 *
 * The defect this pins: with only the shared ceiling bounding it, a request that
 * presented a valid key got that surface's per-client limit (5–30 a minute as
 * shipped) while the same request with a junk or absent header got the whole
 * ceiling (6000 by default) — so declining to be identified was the best strategy
 * available to a caller, and it spent the budget honest requests also pay into.
 */
describe("chargeAdmission with no usable identity", () => {
  const declared = { RATE_LIMIT_TRUSTED_INGRESS: "set", RATE_LIMIT_UNATTRIBUTED_MAX: "1000" };
  const undeclared = { RATE_LIMIT_UNATTRIBUTED_MAX: "1000" };

  beforeEach(() => {
    unattributedAdmissionLimiter(declared).reset();
    unattributedAdmissionLimiter(undeclared).reset();
  });

  it("gives the class no more than the surface gives one client", () => {
    const surface = createRateLimiter({ windowMs: 60_000, max: 3, name: "surface-x" });

    let anonymous = 0;
    while (!chargeAdmission(surface, null, declared).limited) anonymous += 1;
    const refused = chargeAdmission(surface, null, declared);
    expect(anonymous).toBe(3);
    expect(refused.refusedBy).toBe("unidentified");

    // The inversion, stated as a test: presenting an identity buys exactly what
    // declining to present one buys, so there is nothing to gain by hiding.
    surface.reset();
    let identified = 0;
    while (!chargeAdmission(surface, "1.2.3.4", declared).limited) identified += 1;
    expect(identified).toBe(anonymous);

    // Both are still charged to the aggregate ceiling as well.
    const ceiling = unattributedAdmissionLimiter(declared);
    expect(ceiling.check(UNATTRIBUTED_ADMISSION_KEY).count).toBeGreaterThan(anonymous);
  });

  it("shares one class bucket per surface, not one for the whole deployment", () => {
    const first = createRateLimiter({ windowMs: 60_000, max: 2, name: "surface-one" });
    const second = createRateLimiter({ windowMs: 60_000, max: 2, name: "surface-two" });

    expect(chargeAdmission(first, null, declared).limited).toBe(false);
    expect(chargeAdmission(first, null, declared).limited).toBe(false);
    expect(chargeAdmission(first, null, declared).limited).toBe(true);
    // Another surface's limited budget is its own: a class exhausted on one route
    // does not spend the next route's allowance.
    expect(chargeAdmission(second, null, declared).limited).toBe(false);
  });

  // The unasserted default is unchanged on purpose: without a declared ingress, an
  // identity-less request cannot be told apart from an honest client of a
  // deployment whose headers never arrive, so the class bucket would cap exactly
  // that traffic.
  it("leaves the unasserted default bounded by the ceiling, as before", () => {
    const surface = createRateLimiter({ windowMs: 60_000, max: 1, name: "surface-y" });

    let allowed = 0;
    while (!chargeAdmission(surface, null, undeclared).limited) allowed += 1;
    expect(allowed).toBe(unattributedAdmissionLimiter(undeclared).max);
    expect(chargeAdmission(surface, null, undeclared).refusedBy).toBe("ceiling");
  });

  // A class key must be impossible to reach from a request, or a client could join
  // (or exhaust) the shared bucket by sending the key's own text.
  it("cannot collide a class bucket with a client key", () => {
    const key = unidentifiedAdmissionKey("health");
    expect(key).toBe(`${UNIDENTIFIED_ADMISSION_KEY_PREFIX}health`);
    expect(isIpLiteral(key)).toBe(false);
    expect(resolveClientKey(new Headers({ "x-forwarded-for": key }))).toEqual({
      key: null,
      source: "invalid",
    });
    expect(resolveClientKey(new Headers({ "x-real-ip": key }))).toEqual({
      key: null,
      source: "invalid",
    });
  });
});
