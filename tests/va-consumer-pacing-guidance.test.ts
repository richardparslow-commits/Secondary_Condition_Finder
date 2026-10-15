import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VA_API_RATE_LIMIT_RESET_MAX_SECONDS,
  parseVaApiRateLimitGuidance,
  planVaApiConsumerPacing,
  type VaApiRateLimitGuidance,
} from "@/lib/va/api";
import { clearCircuitBreakerState } from "@/lib/va/circuit-breaker";
import {
  applyVaConsumerPacingGuidance,
  reserveVaSharedConsumerSlot,
  VA_SHARED_CONSUMER_MAX_REQUESTS,
  VA_SHARED_CONSUMER_WINDOW_MS,
} from "@/lib/va/reference-shared-cache";
import {
  clearVaApiOutboundRateLimitState,
  fetchVaForms,
  type VaApiConfig,
} from "@/lib/va/sandbox";
import { clearSharedCircuitStateForTests } from "@/lib/va/shared-circuit";

import { createFakeSharedKv } from "./helpers/fake-shared-kv";

/**
 * Upstream rate-limit guidance → shared consumer budget pacing (audit A03).
 *
 * The shared consumer budget approximates VA's per-consumer quota with a local
 * rolling window. The upstream's own `ratelimit-remaining`/`reset` headers are
 * the only statement anyone has about the real quota, so they are fed into that
 * budget — but only ever in the tightening direction, and only when they can be
 * read exactly. This suite pins both halves of that sentence, because each is a
 * separate way the control can be wrong:
 *
 *   1. **Every response shape is decided here.** A response with no guidance
 *      headers, with one header, with both spellings, with a malformed /
 *      fractional / negative / padded / epoch-encoded / self-contradictory
 *      value, and with a reset inside or outside the readable horizon each has
 *      its own case. An unreadable header must produce **no** action rather than
 *      a guessed number.
 *   2. **The arithmetic is one-way.** Every guidance input either charges a
 *      positive number of reservations or does nothing; no input reduces the
 *      charge, grants headroom, or can be read as permission to exceed the local
 *      budget. The unknown-reset case takes the *more* restrictive branch.
 *   3. **The charge is a strict store operation.** It lands on the same window
 *      key the reservations use, its reply is read as a counter or the charge is
 *      refused, a counter it creates still gets a validated lifetime, and a
 *      store that refuses everything leaves a live response usable instead of
 *      turning it into a fallback.
 *   4. **It reaches the budget through the real adapter.** The last block drives
 *      `fetchVaForms` in a distributed runtime against the real Redis-REST fake,
 *      so "the guidance arrived on a real response" is proven end to end and not
 *      only at the seam.
 */

const KV_URL = "https://synthetic-kv.invalid";
const BUDGET_PREFIX = "va:ref:budget:";
const WINDOW_INDEX = 20;
const WINDOW_BASE = WINDOW_INDEX * VA_SHARED_CONSUMER_WINDOW_MS;

const env = {
  VA_REFERENCE_SHARED_CACHE_URL: KV_URL,
  VA_REFERENCE_SHARED_CACHE_TOKEN: "synthetic-token-not-a-credential",
  VA_REFERENCE_SHARED_CACHE_PREFIX: "va:ref:",
};

const budget = {
  maxRequests: VA_SHARED_CONSUMER_MAX_REQUESTS,
  windowMs: VA_SHARED_CONSUMER_WINDOW_MS,
};

const config: VaApiConfig = {
  enabled: true,
  mode: "sandbox",
  modeReason: "Test fixture: sandbox mode.",
  environment: "sandbox",
  formsApiKey: "forms-test-key",
  benefitsReferenceDataApiKey: "reference-test-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl: "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

/** Build response headers under one prefix, as a response would carry them. */
function guide(
  entries: Record<string, string>,
  prefix = "x-ratelimit-",
): Headers {
  const headers = new Headers();
  for (const [field, value] of Object.entries(entries)) headers.set(`${prefix}${field}`, value);
  return headers;
}

function guidance(
  overrides: Partial<VaApiRateLimitGuidance> = {},
): VaApiRateLimitGuidance {
  return { remaining: 0, limit: null, resetSeconds: null, ...overrides };
}

function budgetKey(bucket: number): string {
  return `${BUDGET_PREFIX}${bucket}`;
}

function routeFetchTo(kv: ReturnType<typeof createFakeSharedKv>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input).startsWith(KV_URL)).toBe(true);
      return kv.respond(init);
    }),
  );
}

function commandsOf(kv: ReturnType<typeof createFakeSharedKv>): string[] {
  return kv.executed.map(([name]) => name);
}

function stubDistributedEnv(): void {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_URL);
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "synthetic-token-not-a-credential");
  vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "true");
}

function stubSandboxFetch(kv: ReturnType<typeof createFakeSharedKv>, upstream: () => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const href = String(input);
      if (href.startsWith(KV_URL)) return kv.respond(init);
      return upstream();
    }),
  );
}

beforeEach(() => {
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
  clearSharedCircuitStateForTests();
});

afterEach(() => {
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
  clearSharedCircuitStateForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("upstream rate-limit guidance — reading each response shape", () => {
  it("reads a lone remaining counter under either documented spelling", () => {
    expect(parseVaApiRateLimitGuidance(guide({ remaining: "12" }))).toEqual({
      remaining: 12,
      limit: null,
      resetSeconds: null,
    });
    expect(parseVaApiRateLimitGuidance(guide({ remaining: "12" }, "ratelimit-"))).toEqual({
      remaining: 12,
      limit: null,
      resetSeconds: null,
    });
  });

  it("reads the full trio when the upstream discloses limit and reset", () => {
    expect(
      parseVaApiRateLimitGuidance(
        guide({ remaining: "12", limit: "6000", reset: "30" }),
      ),
    ).toEqual({ remaining: 12, limit: 6000, resetSeconds: 30 });
  });

  it("normalizes header-name case and accepts a numeric value from a plain map", () => {
    // `Headers` is case-insensitive; the record form is normalized here so a
    // fixture cannot accidentally make the upstream look silent.
    expect(
      parseVaApiRateLimitGuidance(new Headers([["X-RateLimit-Remaining", "7"]])),
    ).toMatchObject({ remaining: 7 });
    expect(
      parseVaApiRateLimitGuidance({ "RATELIMIT-REMAINING": "7" }),
    ).toMatchObject({ remaining: 7 });
    expect(parseVaApiRateLimitGuidance({ "ratelimit-remaining": 7 })).toMatchObject({
      remaining: 7,
    });
  });

  it("trims surrounding whitespace but never coerces a value", () => {
    expect(parseVaApiRateLimitGuidance(guide({ remaining: " 12 " }))).toMatchObject({
      remaining: 12,
    });
    expect(parseVaApiRateLimitGuidance(guide({ remaining: "+12" }))).toBeNull();
    expect(parseVaApiRateLimitGuidance({ "ratelimit-remaining": 1.5 })).toBeNull();
  });

  it("refuses every shape it cannot read exactly", () => {
    const unusable: Array<[string, Headers]> = [
      ["no rate-limit headers at all", guide({})],
      ["a limit and reset but no remaining", guide({ limit: "6000", reset: "30" })],
      ["a fractional remaining", guide({ remaining: "1.5" })],
      ["a negative remaining", guide({ remaining: "-1" })],
      ["a hex remaining", guide({ remaining: "0x2" })],
      ["an exponent remaining", guide({ remaining: "1e3" })],
      ["a word for remaining", guide({ remaining: "many" })],
      ["an empty remaining", guide({ remaining: "" })],
      ["an unsafe remaining", guide({ remaining: "9007199254740993" })],
      ["a remaining above the disclosed limit", guide({ remaining: "61", limit: "60" })],
      ["a zero limit", guide({ remaining: "0", limit: "0" })],
      ["a fractional limit", guide({ remaining: "3", limit: "60.5" })],
      ["an empty limit", guide({ remaining: "3", limit: "" })],
      ["a reset in epoch seconds", guide({ remaining: "3", reset: "1760000000" })],
      [
        "a reset beyond the readable horizon",
        guide({ remaining: "3", reset: String(VA_API_RATE_LIMIT_RESET_MAX_SECONDS + 1) }),
      ],
      ["a negative reset", guide({ remaining: "3", reset: "-1" })],
      ["an HTTP-date reset", guide({ remaining: "3", reset: "Wed, 21 Oct 2026 07:28:00 GMT" })],
      ["an empty reset", guide({ remaining: "3", reset: "" })],
    ];

    for (const [label, headers] of unusable) {
      expect(
        parseVaApiRateLimitGuidance(headers),
        `${label} must not be read as usable guidance`,
      ).toBeNull();
    }
  });

  it("accepts the boundary values of the readable reset horizon", () => {
    expect(
      parseVaApiRateLimitGuidance(guide({ remaining: "3", reset: "0" }))?.resetSeconds,
    ).toBe(0);
    expect(
      parseVaApiRateLimitGuidance(
        guide({ remaining: "3", reset: String(VA_API_RATE_LIMIT_RESET_MAX_SECONDS) }),
      )?.resetSeconds,
    ).toBe(VA_API_RATE_LIMIT_RESET_MAX_SECONDS);
  });
});

describe("consumer pacing plan — the charge arithmetic", () => {
  it("charges the whole deficit when the upstream discloses no reset", () => {
    expect(
      planVaApiConsumerPacing({ ...budget, guidance: guidance({ remaining: 3, limit: 6000 }) }),
    ).toEqual({ adapt: true, reason: "quota-deficit", extraReservations: 57 });
  });

  it("scales the charge by the part of the window the upstream is still short for", () => {
    const charge = (resetSeconds: number) =>
      planVaApiConsumerPacing({
        ...budget,
        guidance: guidance({ remaining: 6, resetSeconds }),
      });

    // 54 short, refilled in half the window → charge about half.
    expect(charge(30)).toMatchObject({ adapt: true, extraReservations: 27 });
    // A full window's worth of reset charges the whole deficit.
    expect(charge(60)).toMatchObject({ adapt: true, extraReservations: 54 });
    // A quarter → ceil(54 × 0.25), rounded up so the charge is never softer.
    expect(charge(15)).toMatchObject({ adapt: true, extraReservations: 14 });
  });

  it("rounds a one-slot deficit up rather than down", () => {
    expect(
      planVaApiConsumerPacing({
        ...budget,
        guidance: guidance({
          remaining: VA_SHARED_CONSUMER_MAX_REQUESTS - 1,
          resetSeconds: 30,
        }),
      }),
    ).toMatchObject({ adapt: true, extraReservations: 1 });
  });

  it("never charges more than one window's budget", () => {
    expect(
      planVaApiConsumerPacing({ ...budget, guidance: guidance({ remaining: 0 }) }),
    ).toMatchObject({ adapt: true, extraReservations: VA_SHARED_CONSUMER_MAX_REQUESTS });
  });

  it("does nothing when the upstream's remaining meets the local budget", () => {
    for (const remaining of [VA_SHARED_CONSUMER_MAX_REQUESTS, 6_000]) {
      expect(
        planVaApiConsumerPacing({ ...budget, guidance: guidance({ remaining }) }),
      ).toEqual({ adapt: false, reason: "headroom-ample" });
    }
  });

  it("does nothing when the upstream says its window resets immediately", () => {
    expect(
      planVaApiConsumerPacing({
        ...budget,
        guidance: guidance({ remaining: 0, resetSeconds: 0 }),
      }),
    ).toEqual({ adapt: false, reason: "reset-imminent" });
  });

  it("does nothing when there is no guidance to act on", () => {
    expect(planVaApiConsumerPacing({ ...budget, guidance: null })).toEqual({
      adapt: false,
      reason: "no-guidance",
    });
    expect(planVaApiConsumerPacing({ ...budget, guidance: undefined })).toEqual({
      adapt: false,
      reason: "no-guidance",
    });
  });

  it("is one-way: no remainder grants headroom and no charge is zero or negative", () => {
    for (let remaining = 0; remaining <= 200; remaining += 1) {
      const decision = planVaApiConsumerPacing({ ...budget, guidance: guidance({ remaining }) });
      if (decision.adapt) {
        expect(decision.extraReservations).toBeGreaterThanOrEqual(1);
        expect(decision.extraReservations).toBeLessThanOrEqual(VA_SHARED_CONSUMER_MAX_REQUESTS);
      } else {
        // A non-adaptation is only ever "the upstream has at least what we may
        // spend" or "its window has already refilled" — never a grant.
        expect(decision.reason).toBe("headroom-ample");
      }
    }

    // More remaining can never charge more.
    const charges = [0, 1, 5, 30, 59, 60].map((remaining) => {
      const decision = planVaApiConsumerPacing({ ...budget, guidance: guidance({ remaining }) });
      return decision.adapt ? decision.extraReservations : 0;
    });
    expect(charges).toEqual([...charges].sort((a, b) => b - a));
  });
});

describe("consumer budget pacing — against the real store", () => {
  it("charges the window's counter and confirms a lifetime for a counter it created", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    const outcome = await applyVaConsumerPacingGuidance(
      guide({ remaining: "0" }),
      env,
      WINDOW_BASE,
    );

    expect(outcome).toEqual({
      applied: true,
      reason: "quota-deficit",
      extraReservations: VA_SHARED_CONSUMER_MAX_REQUESTS,
    });
    // The charge lands on the very key the reservations consult.
    expect(kv.executed[0]).toEqual([
      "INCRBY",
      budgetKey(WINDOW_INDEX),
      String(VA_SHARED_CONSUMER_MAX_REQUESTS),
    ]);
    expect(commandsOf(kv)).toEqual(["INCRBY", "EXPIRE"]);
    expect(kv.executed[1][1]).toBe(budgetKey(WINDOW_INDEX));
    expect(kv.get(budgetKey(WINDOW_INDEX))).toBe(String(VA_SHARED_CONSUMER_MAX_REQUESTS));
  });

  it("does not re-charge a lifetime on a counter the reservations already own", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    await expect(reserveVaSharedConsumerSlot(env, WINDOW_BASE)).resolves.toBe(true);
    kv.executed.length = 0;

    const outcome = await applyVaConsumerPacingGuidance(guide({ remaining: "0" }), env, WINDOW_BASE);

    expect(outcome.applied).toBe(true);
    // The charge is the only command: the reservation already gave the counter
    // its lifetime inside its own atomic decision.
    expect(commandsOf(kv)).toEqual(["INCRBY"]);
    expect(kv.get(budgetKey(WINDOW_INDEX))).toBe(
      String(VA_SHARED_CONSUMER_MAX_REQUESTS + 1),
    );
  });

  it("reads a digit-string charge reply and applies the scaled charge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const command = JSON.parse(String(init?.body ?? "[]")) as string[];
        // A store that answers with the counter's new value as a string.
        return new Response(JSON.stringify({ result: command[0] === "INCRBY" ? "27" : 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const outcome = await applyVaConsumerPacingGuidance(
      guide({ remaining: "6", reset: "30" }),
      env,
      WINDOW_BASE,
    );

    expect(outcome).toEqual({ applied: true, reason: "quota-deficit", extraReservations: 27 });
  });

  it("sends no command at all when the guidance is absent or ample", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    expect(await applyVaConsumerPacingGuidance(new Headers(), env, WINDOW_BASE)).toMatchObject({
      applied: false,
      reason: "no-guidance",
    });
    expect(await applyVaConsumerPacingGuidance(guide({}), env, WINDOW_BASE)).toMatchObject({
      applied: false,
      reason: "no-guidance",
    });
    expect(
      await applyVaConsumerPacingGuidance(
        guide({ remaining: String(VA_SHARED_CONSUMER_MAX_REQUESTS) }),
        env,
        WINDOW_BASE,
      ),
    ).toMatchObject({ applied: false, reason: "headroom-ample" });
    expect(
      await applyVaConsumerPacingGuidance(
        guide({ remaining: "0", reset: "0" }),
        env,
        WINDOW_BASE,
      ),
    ).toMatchObject({ applied: false, reason: "reset-imminent" });

    expect(kv.executed).toEqual([]);
  });

  it("sends no command when no shared store is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(
      await applyVaConsumerPacingGuidance(guide({ remaining: "0" }), {}, WINDOW_BASE),
    ).toMatchObject({ applied: false, reason: "store-unconfigured", extraReservations: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses, without throwing, when the store refuses the charge", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.failCommand("INCRBY", "ERR synthetic charge failure");

    const outcome = await applyVaConsumerPacingGuidance(
      guide({ remaining: "0" }),
      env,
      WINDOW_BASE,
    );

    expect(outcome).toEqual({
      applied: false,
      reason: "charge-refused",
      extraReservations: 0,
    });
    // The fail-closed reservation path is untouched by a failed charge.
    kv.clearCommandFailures();
    await expect(reserveVaSharedConsumerSlot(env, WINDOW_BASE)).resolves.toBe(true);
  });

  it("removes a charged counter whose lifetime the store will not confirm", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.failCommand("EXPIRE", "ERR synthetic expiry failure");

    const outcome = await applyVaConsumerPacingGuidance(
      guide({ remaining: "0" }),
      env,
      WINDOW_BASE,
    );

    expect(outcome).toMatchObject({ applied: false, reason: "charge-refused" });
    // A counter that can never expire is not a bounded budget: remove it.
    expect(kv.executed.some(([name]) => name === "DEL")).toBe(true);
    expect(kv.get(budgetKey(WINDOW_INDEX))).toBeNull();
  });

  it("refuses a charge reply it cannot read as a counter", async () => {
    for (const result of [1.5, "1.5", 1, null, {}, []]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(JSON.stringify({ result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );
      expect(
        await applyVaConsumerPacingGuidance(guide({ remaining: "0" }), env, WINDOW_BASE),
        `INCRBY ${JSON.stringify(result) ?? "undefined"} must not be counted as applied`,
      ).toMatchObject({ applied: false, reason: "charge-refused", extraReservations: 0 });
    }
  });

  it("holds the fleet to the remaining quota the upstream reported", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    const outcome = await applyVaConsumerPacingGuidance(
      guide({ remaining: "2" }),
      env,
      WINDOW_BASE,
    );
    expect(outcome).toMatchObject({ applied: true, extraReservations: 58 });

    const admitted: boolean[] = [];
    for (let index = 0; index < 10; index += 1) {
      admitted.push(await reserveVaSharedConsumerSlot(env, WINDOW_BASE + index));
    }

    // Exactly the two the upstream said were left, then nothing — the budget now
    // expresses the upstream's own statement instead of the local estimate.
    expect(admitted).toEqual([true, true, false, false, false, false, false, false, false, false]);
  });

  it("leaves the full conservative budget available when guidance is unreadable", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    expect(
      await applyVaConsumerPacingGuidance(guide({ remaining: "550e8400" }), env, WINDOW_BASE),
    ).toMatchObject({ applied: false, reason: "no-guidance" });
    expect(kv.executed).toEqual([]);

    // The positive control: with nothing to act on, a quiet window still
    // admits the whole budget, so the case above cannot pass by refusing all.
    const admitted: boolean[] = [];
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      admitted.push(await reserveVaSharedConsumerSlot(env, WINDOW_BASE + index));
    }
    expect(admitted.filter(Boolean)).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);
  });
});

describe("consumer budget pacing — through the VA adapter", () => {
  /**
   * The adapter reads the guidance from a *live* response, before judging its
   * status, so every shape below is exercised through the real `fetchVaForms`
   * with the real Redis-REST fake rather than at the seam.
   */
  it("charges the budget from a successful response's own headers", async () => {
    stubDistributedEnv();
    vi.useFakeTimers({ now: WINDOW_BASE });
    const kv = createFakeSharedKv();
    stubSandboxFetch(
      kv,
      () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
          },
        }),
    );

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(true);
    const charge = kv.executed.find(([name]) => name === "INCRBY");
    expect(charge, "a live response carrying guidance must charge the budget").toBeDefined();
    expect(charge?.[1]).toBe(budgetKey(WINDOW_INDEX));
    expect(charge?.[2]).toBe(String(VA_SHARED_CONSUMER_MAX_REQUESTS));
  });

  it("charges the budget from a 429's headers as well", async () => {
    stubDistributedEnv();
    vi.useFakeTimers({ now: WINDOW_BASE });
    const kv = createFakeSharedKv();
    stubSandboxFetch(
      kv,
      () =>
        new Response("slow down", {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Remaining": "0",
          },
        }),
    );

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(false);
    expect(kv.executed.some((command) => command[0] === "INCRBY")).toBe(true);
  });

  it("sends no charge when the response carries no guidance", async () => {
    stubDistributedEnv();
    vi.useFakeTimers({ now: WINDOW_BASE });
    const kv = createFakeSharedKv();
    stubSandboxFetch(kv, () => new Response(JSON.stringify({ data: [] }), { status: 200 }));

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(true);
    // The reservation still happened (one atomic decision); only the guidance
    // charge is absent.
    expect(kv.scriptExecutions).toHaveLength(1);
    expect(kv.executed.some((command) => command[0] === "INCRBY")).toBe(false);
  });

  it("keeps a usable response usable when the coordinator refuses the charge", async () => {
    stubDistributedEnv();
    vi.useFakeTimers({ now: WINDOW_BASE });
    const kv = createFakeSharedKv();
    // The store answers the charge with a body error at HTTP 200.
    kv.failCommand("INCRBY", "ERR synthetic charge failure");
    let seenIncrby = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const href = String(input);
        if (!href.startsWith(KV_URL)) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "X-RateLimit-Remaining": "0" },
          });
        }
        const command = JSON.parse(String(init?.body ?? "[]")) as string[];
        if (command[0] === "INCRBY") seenIncrby = true;
        return kv.respond(init);
      }),
    );

    const result = await fetchVaForms(undefined, { config });

    expect(seenIncrby).toBe(true);
    // A pacing failure is never a request failure.
    expect(result.success).toBe(true);
    expect(result.source).toBe("va-sandbox-api");
  });
});
