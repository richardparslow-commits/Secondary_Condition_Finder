import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  clampRetryAfterCooldownMs as apiClampRetryAfterCooldownMs,
  parseRetryAfterMs as apiParseRetryAfterMs,
  parseVaApiPayload,
  planVaApiRateLimitRetry,
  vaApiRetryDelayMs,
  VA_API_MAX_RETRIES,
  VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS,
  VA_API_RATE_LIMIT_STATUS,
  VA_API_RETRY_BASE_DELAY_MS,
  VA_API_RETRY_DELAY_MS,
  VA_API_RETRY_JITTER_RATIO,
  VA_API_RETRY_MAX_DELAY_MS,
  VA_API_TRANSIENT_RETRY_STATUS,
} from "@/lib/va/api";
import {
  clampRetryAfterCooldownMs as circuitClampRetryAfterCooldownMs,
  clearCircuitBreakerState,
  parseRetryAfterMs as circuitParseRetryAfterMs,
  readCircuitState,
} from "@/lib/va/circuit-breaker";
import {
  clearVaApiOutboundRateLimitState,
  fetchVaForms,
  type VaApiConfig,
} from "@/lib/va/sandbox";
import * as sandboxModule from "@/lib/va/sandbox";

/**
 * Contracts for the outbound resilience policy (`src/lib/va/api.ts`).
 *
 * The policy decides whether another attempt reaches VA and how long it waits
 * first, so these tests are about *decisions*, not about the transport's
 * plumbing. Two boundaries carry the weight:
 *
 *   - `VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS` sits below one second, so every
 *     whole-second `Retry-After` takes the audited path (immediate labelled
 *     fallback plus a circuit opened for the upstream's own window) and only an
 *     explicitly-immediate authorization is retried in-request. The
 *     `Retry-After: 1` case is pinned here because it is the boundary itself.
 *   - a declined 429 decision is the *expected* outcome, not a failure; the
 *     fallback it produces is asserted to be a value, never an exception.
 */

const config: VaApiConfig = {
  enabled: true,
  mode: "sandbox",
  modeReason: "Test fixture: sandbox mode.",
  environment: "sandbox",
  formsApiKey: "synthetic-forms-fixture-key",
  benefitsReferenceDataApiKey: "synthetic-reference-fixture-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl: "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Smallest payload the forms index schema accepts, so a retry can succeed. */
function vaFormsPayload(): Response {
  return okJson({ data: [] });
}

beforeEach(() => {
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
});

afterEach(() => {
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VA retry backoff policy", () => {
  it("backs off exponentially and caps the exponential term", () => {
    const noJitter = () => 0;

    expect(vaApiRetryDelayMs(1, noJitter)).toBe(VA_API_RETRY_BASE_DELAY_MS);
    expect(vaApiRetryDelayMs(2, noJitter)).toBe(200);
    expect(vaApiRetryDelayMs(3, noJitter)).toBe(VA_API_RETRY_MAX_DELAY_MS);
    // The cap holds however many attempts a caller asks about.
    expect(vaApiRetryDelayMs(9, noJitter)).toBe(VA_API_RETRY_MAX_DELAY_MS);
    expect(vaApiRetryDelayMs(2, noJitter)).toBe(2 * VA_API_RETRY_BASE_DELAY_MS);
  });

  it("adds jitter on top of the exponential term and never subtracts it", () => {
    const maxJitter = () => 1;
    const maxAllowed =
      VA_API_RETRY_MAX_DELAY_MS +
      Math.floor(VA_API_RETRY_MAX_DELAY_MS * VA_API_RETRY_JITTER_RATIO);

    expect(vaApiRetryDelayMs(1, maxJitter)).toBe(
      VA_API_RETRY_BASE_DELAY_MS +
        Math.floor(VA_API_RETRY_BASE_DELAY_MS * VA_API_RETRY_JITTER_RATIO),
    );
    expect(vaApiRetryDelayMs(3, maxJitter)).toBe(maxAllowed);

    // The floor is the un-jittered exponential term: no draw can collapse a
    // retry into a hot loop.
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const floor = Math.min(
        VA_API_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
        VA_API_RETRY_MAX_DELAY_MS,
      );
      for (const random of [0, 0.5, 0.999]) {
        const delayMs = vaApiRetryDelayMs(attempt, () => random);
        expect(delayMs).toBeGreaterThanOrEqual(floor);
        expect(delayMs).toBeLessThanOrEqual(maxAllowed);
      }
    }
  });

  it("retries only the transient statuses that carry no retry instruction", () => {
    expect(VA_API_TRANSIENT_RETRY_STATUS.has(503)).toBe(true);
    expect(VA_API_TRANSIENT_RETRY_STATUS.has(504)).toBe(true);
    // 500 is an unhandled server error, not evidence that an immediate repeat
    // succeeds; 429 has its own decision path.
    expect(VA_API_TRANSIENT_RETRY_STATUS.has(500)).toBe(false);
    expect(VA_API_TRANSIENT_RETRY_STATUS.has(VA_API_RATE_LIMIT_STATUS)).toBe(false);
  });

  it("keeps the deprecated alias and the public retry budget stable", () => {
    expect(VA_API_RETRY_DELAY_MS).toBe(VA_API_RETRY_BASE_DELAY_MS);
    expect(VA_API_MAX_RETRIES).toBe(2);
    // Raising the in-request budget past one second would start retrying
    // whole-second instructions, which the circuit and fleet suites pin as
    // single-attempt. Losing that property must break a test, not a review.
    expect(VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS).toBeLessThan(1000);
  });
});

describe("VA 429 Retry-After decision", () => {
  it("declines every whole-second instruction, leaving the circuit to serve it", () => {
    for (const retryAfterMs of [1000, 5_000, 30_000, 600_000]) {
      expect(planVaApiRateLimitRetry({ attempt: 1, retryAfterMs })).toEqual({
        retry: false,
        reason: "retry-after-exceeds-budget",
      });
    }
  });

  it("retries when the upstream authorizes an immediate retry", () => {
    const plan = planVaApiRateLimitRetry({
      attempt: 1,
      retryAfterMs: 0,
      random: () => 0,
    });

    expect(plan).toEqual({
      retry: true,
      delayMs: VA_API_RETRY_BASE_DELAY_MS,
      retryAfterMs: 0,
    });
  });

  it("waits at least as long as the upstream asked", () => {
    const plan = planVaApiRateLimitRetry({
      attempt: 1,
      retryAfterMs: 250,
      random: () => 1,
    });

    expect(plan.retry).toBe(true);
    if (!plan.retry) throw new Error("expected a retry decision");
    // The instructed delay is the floor; jitter may only add to it.
    expect(plan.delayMs).toBeGreaterThanOrEqual(250);
  });

  it("declines rather than guessing when the response gives no usable window", () => {
    for (const retryAfterMs of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(planVaApiRateLimitRetry({ attempt: 1, retryAfterMs })).toEqual({
        retry: false,
        reason: "retry-after-unusable",
      });
    }
  });

  it("declines once the attempt cap is reached, even for an immediate authorization", () => {
    expect(
      planVaApiRateLimitRetry({ attempt: VA_API_MAX_RETRIES + 1, retryAfterMs: 0 }),
    ).toEqual({ retry: false, reason: "attempts-exhausted" });
    // The cap is inclusive: the last legal retry still succeeds at the boundary.
    expect(planVaApiRateLimitRetry({ attempt: VA_API_MAX_RETRIES, retryAfterMs: 0 }).retry).toBe(
      true,
    );
  });

  it("would retry a one-second instruction if the budget allowed it", () => {
    // Proves the boundary is a deliberate policy setting rather than a
    // limitation of the mechanism, so a future raise is a bounded change.
    const plan = planVaApiRateLimitRetry({
      attempt: 1,
      retryAfterMs: 1_000,
      budgetMs: 1_000,
      random: () => 0,
    });

    expect(plan.retry).toBe(true);
    if (!plan.retry) throw new Error("expected a retry decision");
    expect(plan.delayMs).toBe(1_000);
  });

  it("re-exports the one Retry-After implementation instead of forking it", () => {
    // A second parser would let the retry budget and the circuit window
    // disagree about what the upstream asked for.
    expect(apiParseRetryAfterMs).toBe(circuitParseRetryAfterMs);
    expect(apiClampRetryAfterCooldownMs).toBe(circuitClampRetryAfterCooldownMs);
    expect(apiParseRetryAfterMs("120")).toBe(120_000);
    expect(apiClampRetryAfterCooldownMs(0)).toBe(1_000);
  });
});

describe("VA payload fallback handler", () => {
  const schema = z.object({ data: z.array(z.object({ id: z.string() })) }).passthrough();

  it("returns parsed data for a matching payload", () => {
    const result = parseVaApiPayload(schema, { data: [{ id: "a" }], total: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a successful parse");
    expect(result.data.data).toEqual([{ id: "a" }]);
  });

  it("turns a shape the caller did not expect into a value, never a throw", () => {
    const upstreamShapes: unknown[] = [
      {},
      { data: "not-an-array" },
      { data: [{ id: 42 }] },
      null,
      "unexpected-string",
    ];

    for (const payload of upstreamShapes) {
      let result: ReturnType<typeof parseVaApiPayload<z.infer<typeof schema>>> | null = null;
      expect(() => {
        result = parseVaApiPayload(schema, payload);
      }).not.toThrow();
      expect(result).toEqual({ ok: false });
    }
  });

  it("discards the Zod issue list so an upstream document cannot shape a log line", () => {
    const failure = parseVaApiPayload(schema, { data: [{ id: 42 }] });

    // The failure carries no detail at all: issue paths and "received"
    // descriptions are derived from the upstream payload.
    expect(Object.keys(failure)).toEqual(["ok"]);
    expect(JSON.stringify(failure)).toBe('{"ok":false}');
  });
});

describe("VA transport — graceful degradation through the policy", () => {
  it("retries an explicitly-immediate 429 in-request and leaves the breaker closed", async () => {
    const upstreamSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429, headers: { "Retry-After": "0" } }),
      )
      .mockResolvedValueOnce(vaFormsPayload());
    vi.stubGlobal("fetch", upstreamSpy);

    const result = await fetchVaForms("21-526EZ", { config });

    expect(result.success).toBe(true);
    expect(result.source).toBe("va-sandbox-api");
    expect(upstreamSpy).toHaveBeenCalledTimes(2);
    // The request recovered, so nothing should be backing off.
    expect(readCircuitState("va-forms").state).toBe("closed");
  });

  it("serves a one-second 429 through the circuit rather than holding the request open", async () => {
    const upstreamSpy = vi
      .fn()
      .mockResolvedValue(new Response("slow down", { status: 429, headers: { "Retry-After": "1" } }));
    vi.stubGlobal("fetch", upstreamSpy);

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
    expect(readCircuitState("va-forms")).toEqual(
      expect.objectContaining({ state: "open", cooldownMs: 1_000 }),
    );
  });

  it("honors a long 429 window as an absolute cooldown and answers without touching the network", async () => {
    const upstreamSpy = vi
      .fn()
      .mockResolvedValue(
        new Response("slow down", { status: 429, headers: { "Retry-After": "600" } }),
      );
    vi.stubGlobal("fetch", upstreamSpy);

    const first = await fetchVaForms(undefined, { config });
    expect(first.success).toBe(false);
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
    expect(readCircuitState("va-forms").cooldownMs).toBe(600_000);

    const second = await fetchVaForms(undefined, { config });

    expect(second.success).toBe(false);
    expect(second.source).toBe("local-fallback");
    expect(second.error).toContain("circuit open");
    // The whole point of the breaker: a follow-up is refused before the call.
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
  });

  it("retries transient 503s with backoff and recovers", async () => {
    const upstreamSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(vaFormsPayload());
    vi.stubGlobal("fetch", upstreamSpy);

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(true);
    expect(upstreamSpy).toHaveBeenCalledTimes(2);
  });

  it("caps total upstream attempts and returns a labelled fallback when every attempt fails", async () => {
    const upstreamSpy = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", upstreamSpy);

    const result = await fetchVaForms(undefined, { config });

    expect(upstreamSpy).toHaveBeenCalledTimes(VA_API_MAX_RETRIES + 1);
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.source).toBe("local-fallback");
    expect(result.error).toContain("status 503");
  });

  it("degrades an unexpected payload to a fallback instead of throwing into the router", async () => {
    const upstreamSpy = vi.fn().mockResolvedValue(okJson({ data: [{ id: 1 }] }));
    vi.stubGlobal("fetch", upstreamSpy);

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.source).toBe("local-fallback");
    expect(result.error).toBe("VA API returned an invalid response payload.");
    // An unexpected shape is terminal: it is not retried.
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
  });

  it("logs the rejection as a sanitized fact, with none of the upstream document", async () => {
    // A distinctive sentinel stands in for whatever an unexpected payload might
    // carry. The adapter must record *that* validation failed and nothing about
    // the document that failed it.
    const SENTINEL = "sentinel-must-never-be-logged-4c1f";
    const upstreamSpy = vi.fn().mockResolvedValue(okJson({ data: SENTINEL }));
    vi.stubGlobal("fetch", upstreamSpy);

    const captured: string[] = [];
    const record = (...args: unknown[]): void => {
      captured.push(args.map((value) => String(value)).join(" "));
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(record);
    const logSpy = vi.spyOn(console, "log").mockImplementation(record);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(record);

    try {
      const result = await fetchVaForms(undefined, { config });
      expect(result.success).toBe(false);
      expect(result.source).toBe("local-fallback");
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }

    // The rejection is recorded under an allowlisted message. An unlisted
    // message is rewritten to `OPERATIONAL_EVENT` by the logger, so this also
    // fails if the wording drifts away from the reviewed vocabulary.
    const rejected = captured.filter((line) => line.includes("va request invalid payload"));
    expect(rejected.length).toBeGreaterThan(0);
    const first = JSON.parse(rejected[0] ?? "{}") as { message?: string };
    expect(first.message).toBe("va request invalid payload");

    // ...and nothing from the document reaches any sink on any channel.
    expect(captured.join("\n")).not.toContain(SENTINEL);
  });

  it("degrades a malformed body to a fallback rather than escaping as an exception", async () => {
    const upstreamSpy = vi.fn().mockResolvedValue(
      new Response("not json at all", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", upstreamSpy);

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.source).toBe("local-fallback");
    expect(upstreamSpy).toHaveBeenCalledTimes(VA_API_MAX_RETRIES + 1);
  });

  it("keeps the adapter's published retry constants importable from sandbox", () => {
    // The policy moved, the public name did not: documentation and phase-3
    // notes reference these under `sandbox.ts`.
    expect(sandboxModule.VA_API_MAX_RETRIES).toBe(VA_API_MAX_RETRIES);
    expect(sandboxModule.VA_API_RETRY_BASE_DELAY_MS).toBe(VA_API_RETRY_BASE_DELAY_MS);
    expect(sandboxModule.VA_API_RETRY_MAX_DELAY_MS).toBe(VA_API_RETRY_MAX_DELAY_MS);
    expect(sandboxModule.VA_API_RETRY_DELAY_MS).toBe(VA_API_RETRY_BASE_DELAY_MS);
  });
});
