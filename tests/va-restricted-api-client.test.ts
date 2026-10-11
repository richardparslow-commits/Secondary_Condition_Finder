import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  backoffDelayMs,
  createInMemoryTokenStore,
  retryWaitMs,
  VA_SANDBOX_TOKEN_URL,
  VaRestrictedApiClient,
  type VaStoredTokens,
} from "@/lib/va/api-client";

/**
 * Permanent regression suite for the restricted VA API client
 * (`src/lib/va/api-client.ts`): 401 single-flight refresh-and-replay and
 * 429/503 honour-and-backoff.
 *
 * Deliberate departures from an MSW-based sketch, each load-bearing:
 *
 * - No MSW: it is not installed, and in this Node suite fetch-layer stubbing
 *   (`vi.stubGlobal("fetch", …)`) subsumes it — the client takes no other
 *   transport, so a stubbed `fetch` observes every byte the client sends,
 *   including stateful per-call scripts. Adding an unaudited network
 *   dependency would buy no additional proof.
 * - `tests/` location, not `src/lib/va/__tests__/`: the 332-file suite lives
 *   here by convention, which the source-scanning gates assume.
 * - Failures are values, not throws: the client returns
 *   `{ ok: false, reason, status, attempts }` by repository contract, so
 *   exhaustion is asserted on the outcome, never on a thrown error.
 * - Deterministic timing without slow CI: the client's jitter source is
 *   injectable, so `random: () => 0` pins the exact 1s/2s/4s/8s schedule and
 *   only the multi-second cases need fake timers (`advanceTimersByTimeAsync`
 *   flushes the microtasks the mocked fetch resolves on, so no deadlock).
 */

const schema = z.object({ ok: z.boolean() });
const TOKEN = {
  access_token: "NEW-ACCESS",
  token_type: "Bearer",
  expires_in: 900,
  refresh_token: "NEXT-REFRESH",
};

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function client(store: VaStoredTokens | null, opts: { maxRetries?: number } = {}) {
  return new VaRestrictedApiClient({
    clientId: "synthetic-client",
    store: createInMemoryTokenStore(store),
    timeoutMs: 2_000,
    random: () => 0,
    ...opts,
  });
}

const PATH = "/services/claims/v1/claims" as const;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("happy path", () => {
  it("returns validated data without touching the token endpoint", async () => {
    const fetcher = vi.fn(async () => json(200, { ok: true }));
    vi.stubGlobal("fetch", fetcher);
    const outcome = await client({ accessToken: "live" }).request({ path: PATH, schema });
    expect(outcome).toMatchObject({ ok: true, status: 200, data: { ok: true }, attempts: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const calls = fetcher.mock.calls as unknown as Array<[unknown, RequestInit?]>;
    expect(String(calls[0]![0])).toBe(`https://sandbox-api.va.gov${PATH}`);
  });
});

describe("401 single-flight refresh-and-replay", () => {
  it("refreshes once on 401 and replays the original request", async () => {
    let tokenCalls = 0;
    const fetcher = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url === VA_SANDBOX_TOKEN_URL) {
        tokenCalls += 1;
        const body = new URLSearchParams(String((init?.body ?? "") as string));
        expect(body.get("grant_type")).toBe("refresh_token");
        expect(body.get("refresh_token")).toBe("refresh-1");
        return json(200, TOKEN);
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.["Authorization"];
      return auth === "Bearer old-token"
        ? json(401, { errors: [] })
        : json(200, { ok: true });
    });
    vi.stubGlobal("fetch", fetcher);

    const outcome = await client({ accessToken: "old-token", refreshToken: "refresh-1" }).request({
      path: PATH,
      schema,
    });
    expect(outcome).toMatchObject({ ok: true, status: 200, attempts: 2 });
    expect(tokenCalls).toBe(1);
  });

  it("a second 401 after refresh is the answer, not a loop", async () => {
    const fetcher = vi.fn(async (input: unknown) =>
      String(input) === VA_SANDBOX_TOKEN_URL ? json(200, TOKEN) : json(401, { errors: [] }),
    );
    vi.stubGlobal("fetch", fetcher);
    const outcome = await client({ accessToken: "old", refreshToken: "r" }).request({
      path: PATH,
      schema,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "unauthorized", status: 401 });
  });

  it("concurrent 401s share one token exchange", async () => {
    let tokenCalls = 0;
    const fetcher = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url === VA_SANDBOX_TOKEN_URL) {
        tokenCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return json(200, TOKEN);
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.["Authorization"];
      return auth === "Bearer old-token" ? json(401, { errors: [] }) : json(200, { ok: true });
    });
    vi.stubGlobal("fetch", fetcher);
    const shared = client({ accessToken: "old-token", refreshToken: "refresh-1" });
    const [first, second] = await Promise.all([
      shared.request({ path: PATH, schema }),
      shared.request({ path: PATH, schema }),
    ]);
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    expect(tokenCalls).toBe(1);
  });
});

describe("429 honour-and-backoff", () => {
  it("waits out Retry-After exactly, then replays", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? json(429, { errors: [] }, { "retry-after": "1" })
          : json(200, { ok: true });
      }),
    );
    const started = Date.now();
    const outcome = await client({ accessToken: "t" }).request({ path: PATH, schema });
    expect(outcome).toMatchObject({ ok: true, status: 200, attempts: 2 });
    // "Retry-After: 1" is one second; the replay must not precede it.
    expect(Date.now() - started).toBeGreaterThanOrEqual(1_000);
  });

  it("stops retrying instead of holding the request open past the wait cap", async () => {
    const fetcher = vi.fn(async () => json(429, { errors: [] }, { "retry-after": "3600" }));
    vi.stubGlobal("fetch", fetcher);
    const started = Date.now();
    const outcome = await client({ accessToken: "t" }).request({ path: PATH, schema });
    expect(outcome).toMatchObject({ ok: false, reason: "rate_limited", status: 429, attempts: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe("503 exponential backoff (fake timers)", () => {
  it("waits 1s, 2s, 4s across three failures, then succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls < 4 ? json(503, { errors: [] }) : json(200, { ok: true });
      }),
    );
    vi.useFakeTimers();
    const pending = client({ accessToken: "t" }).request({ path: PATH, schema });
    // The fetch mock resolves on microtasks, so each advance both sleeps the
    // backoff and lets the replayed attempt complete — no deadlock, no wall
    // clock. With jitter pinned to zero the schedule is exact.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toBe(3);
    await vi.advanceTimersByTimeAsync(4_000);
    const outcome = await pending;
    expect(outcome).toMatchObject({ ok: true, status: 200, attempts: 4 });
    expect(calls).toBe(4);
  });

  it("gives up after the retry budget with a value, never a throw", async () => {
    const fetcher = vi.fn(async () => json(503, { errors: [] }));
    vi.stubGlobal("fetch", fetcher);
    vi.useFakeTimers();
    const pending = client({ accessToken: "t" }).request({ path: PATH, schema });
    // maxRetries 4 → initial attempt + 4 replays, then the outcome.
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 8_000 + 1_000);
    const outcome = await pending;
    expect(outcome).toMatchObject({
      ok: false,
      reason: "unavailable",
      status: 503,
      attempts: 5,
    });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});

describe("backoff math", () => {
  it("follows the documented 1s/2s/4s/8s schedule with additive-only jitter", () => {
    expect(backoffDelayMs(0, () => 0)).toBe(1_000);
    expect(backoffDelayMs(1, () => 0)).toBe(2_000);
    expect(backoffDelayMs(2, () => 0)).toBe(4_000);
    expect(backoffDelayMs(3, () => 0)).toBe(8_000);
    expect(backoffDelayMs(9, () => 0)).toBe(8_000);
    expect(backoffDelayMs(0, () => 1)).toBe(1_250);
  });

  it("honours short instructions and declines unbounded ones", () => {
    expect(retryWaitMs(0, 500, () => 0)).toBe(500);
    expect(retryWaitMs(0, 60_000, () => 0)).toBeNull();
    expect(retryWaitMs(0, undefined, () => 0)).toBe(1_000);
  });
});
