import { afterEach, describe, expect, it, vi } from "vitest";

import {
  reserveVaSharedConsumerSlot,
  VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS,
  VA_SHARED_CONSUMER_MAX_REQUESTS,
  VA_SHARED_CONSUMER_WINDOW_MS,
} from "@/lib/va/reference-shared-cache";

import { createFakeSharedKv } from "./helpers/fake-shared-kv";

/**
 * Admission contract for the shared VA consumer budget (audit A03).
 *
 * The budget is the safety control that stands between the fleet and VA's
 * per-consumer quota, and it is consulted before **every** upstream attempt
 * including retries. Its two jobs are to never admit more than the configured
 * budget and to fail closed on anything it cannot read as a counter. Both jobs
 * are driven here through the real `reserveVaSharedConsumerSlot` against the
 * real Redis-REST fake, so the pinned behaviour is the function's, not a
 * restatement of it.
 *
 * Three pre-fix defects each own a case below, and each case fails if its guard
 * is removed:
 *
 *   1. `floor(now / 60000)` admitted 60 reservations at 59,999 ms and 60 more
 *      at 60,000 ms — **120 admissions against a budget of 60, one millisecond
 *      apart**. The rolling window charges the current bucket together with a
 *      weighted overlap of its predecessor, so the boundary burst is refused
 *      and refills gradually (`boundary burst`, `pacing`, `absent predecessor`).
 *   2. `Number.isFinite` accepted a fractional counter — a synthetic `1.5`
 *      authorised a slot (`fractional and malformed counters`). Counters must
 *      now be non-negative safe integers, and an erroring reply is refused
 *      rather than read.
 *   3. The `EXPIRE` reply was never inspected, so a counter that could never be
 *      given a lifetime still authorised a slot — and the store kept one
 *      permanent key per window. A refused lifetime now refuses the slot and
 *      removes the key (`a counter without a lifetime`).
 *
 * A fresh window with an absent predecessor counter is a positive control: the
 * full budget is available, so these cases cannot pass by refusing everything.
 */

const KV_URL = "https://synthetic-kv.invalid";
const BUDGET_PREFIX = "va:ref:budget:";

const env = {
  VA_REFERENCE_SHARED_CACHE_URL: KV_URL,
  VA_REFERENCE_SHARED_CACHE_TOKEN: "synthetic-token-not-a-credential",
  VA_REFERENCE_SHARED_CACHE_PREFIX: "va:ref:",
};

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

/** Answer every command with a synthetic Redis-REST body. */
function stubCommandReplies(
  reply: (command: string[]) => Record<string, unknown>,
): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const command = JSON.parse(String(init?.body ?? "[]")) as string[];
    return new Response(JSON.stringify(reply(command)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("VA shared consumer budget — conservative rolling admission", () => {
  it("refuses the boundary burst a fixed-minute window admitted", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    // The last millisecond of the window: a full budget is legitimately free.
    const firstWindow: boolean[] = [];
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      firstWindow.push(await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS - 1));
    }
    expect(firstWindow.filter(Boolean)).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);

    // One millisecond later, the adjacent bucket. The pre-fix fixed-window
    // counter admitted another full budget here (120 total); the predecessor's
    // overlap weight is still 1, so nothing is admitted.
    const nextWindow: boolean[] = [];
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      nextWindow.push(await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS));
    }
    expect(nextWindow.filter(Boolean)).toHaveLength(0);

    // The budget is a rate over time, not a per-bucket allowance: no more than
    // the configured maximum is ever admitted across the boundary interval.
    const admitted = firstWindow.filter(Boolean).length + nextWindow.filter(Boolean).length;
    expect(admitted).toBeLessThanOrEqual(VA_SHARED_CONSUMER_MAX_REQUESTS);
  });

  it("paces recovery as the predecessor overlap decays", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS - 1);
    }

    // Half a window into the next bucket the predecessor still counts for half
    // its value, so exactly half a budget is available — not a fresh 60.
    const half = VA_SHARED_CONSUMER_MAX_REQUESTS / 2;
    const admitted: boolean[] = [];
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      admitted.push(
        await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS + half * 1000),
      );
    }
    expect(admitted.filter(Boolean)).toHaveLength(half);
  });

  it("carries nothing when the predecessor bucket has no counter", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS - 1);
    }

    // Two buckets later the intervening bucket was never reserved, so its
    // absent counter carries nothing and the full budget is available again —
    // the rolling rule must not permanently throttle a quiet fleet.
    const admitted: boolean[] = [];
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      admitted.push(
        await reserveVaSharedConsumerSlot(env, 2 * VA_SHARED_CONSUMER_WINDOW_MS),
      );
    }
    expect(admitted.filter(Boolean)).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);

    // An absent predecessor is a read miss, not an error: the counter starts at
    // one and no `INCR` is spent on the predecessor key.
    expect(kv.executed.some((command) => command[0] === "GET")).toBe(true);
    expect(kv.get(budgetKey(1))).toBeNull();
  });

  it("documents that a refused reservation still consumes its slot", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS - 1);
    }
    expect(await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS)).toBe(false);

    // The counter increments before the decision, so a refusal counts. That is
    // deliberate: a refused attempt may only reduce traffic against VA, never
    // increase it.
    expect(kv.get(budgetKey(1))).toBe("1");
  });

  it("applies one bounded counter lifetime per window, longer than the window", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    for (let index = 0; index < 5; index += 1) {
      expect(await reserveVaSharedConsumerSlot(env, 1_000)).toBe(true);
    }

    const expirations = kv.executed.filter((command) => command[0] === "EXPIRE");
    expect(expirations).toHaveLength(1);
    expect(expirations[0][1]).toBe(budgetKey(0));
    expect(expirations[0][2]).toBe(String(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS));
    // The lifetime outlives the window so the next window can read this counter
    // as its predecessor, and still expires so keys cannot accumulate.
    expect(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS * 1000).toBeGreaterThan(
      VA_SHARED_CONSUMER_WINDOW_MS,
    );
  });

  it("lets an abandoned window expire instead of accumulating in the store", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    expect(await reserveVaSharedConsumerSlot(env, 1_000)).toBe(true);
    expect(kv.get(budgetKey(0))).toBe("1");

    vi.advanceTimersByTime(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS * 1000 + 1);
    expect(kv.get(budgetKey(0))).toBeNull();
  });
});

describe("VA shared consumer budget — strict command validation", () => {
  it("refuses fractional, negative, unsafe, and non-numeric counters", async () => {
    for (const result of [1.5, "1.5", -1, 2 ** 53, "0x2", "one", null, undefined, {}, []]) {
      stubCommandReplies(() => ({ result: result as unknown }));
      await expect(
        reserveVaSharedConsumerSlot(env, 0),
        `INCR ${JSON.stringify(result) ?? "undefined"} must not authorise a slot`,
      ).resolves.toBe(false);
    }
  });

  it("accepts an integer counter encoded as a number or a digit string", async () => {
    stubCommandReplies(() => ({ result: 3 }));
    await expect(reserveVaSharedConsumerSlot(env, 0)).resolves.toBe(true);

    // Redis-REST replies are integers in either encoding; the confirmation of a
    // counter's lifetime is held to the same rule.
    stubCommandReplies((command) => ({ result: command[0] === "EXPIRE" ? "1" : "1" }));
    await expect(reserveVaSharedConsumerSlot(env, 0)).resolves.toBe(true);
  });

  it("refuses a counter reply that carries a Redis body error at HTTP 200", async () => {
    // Transport success is not command success (audit B07): an error body must
    // never be read as a count, even when it also carries a numeric result.
    for (const payload of [
      { error: "ERR synthetic budget failure" },
      { error: "ERR synthetic budget failure", result: 1 },
      { error: "ERR synthetic budget failure", result: "1" },
    ]) {
      stubCommandReplies(() => payload);
      await expect(reserveVaSharedConsumerSlot(env, 0)).resolves.toBe(false);
    }
  });

  it("refuses a counter it cannot give a lifetime, and removes the key", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.failCommand("EXPIRE");

    expect(await reserveVaSharedConsumerSlot(env, 0)).toBe(false);
    // The lifetime-less counter is deleted rather than left to accumulate.
    expect(kv.get(budgetKey(0))).toBeNull();
    expect(kv.executed.some((command) => command[0] === "DEL")).toBe(true);
  });

  it("refuses a lifetime the store did not confirm", async () => {
    // `EXPIRE` answers 0 when it set no timeout; that is not a confirmed
    // lifetime, so the slot is refused.
    stubCommandReplies((command) => ({
      result: command[0] === "INCR" ? 1 : command[0] === "EXPIRE" ? 0 : null,
    }));
    await expect(reserveVaSharedConsumerSlot(env, 0)).resolves.toBe(false);
  });

  it("refuses when the predecessor counter is unreadable, invalid, or erroring", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.seed(budgetKey(0), "not-a-counter", 600_000);
    await expect(
      reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS),
    ).resolves.toBe(false);

    const unreadable = createFakeSharedKv();
    routeFetchTo(unreadable);
    unreadable.failCommand("GET");
    await expect(
      reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS),
    ).resolves.toBe(false);

    stubCommandReplies((command) => ({
      result: command[0] === "INCR" ? 1 : null,
      ...(command[0] === "GET" ? { error: "ERR synthetic read failure" } : {}),
    }));
    await expect(
      reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS),
    ).resolves.toBe(false);
  });

  it("refuses a clock it cannot bucket, without touching the coordinator", async () => {
    for (const now of [Number.NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 2, Number.POSITIVE_INFINITY]) {
      const spy = stubCommandReplies(() => ({ result: 1 }));
      await expect(
        reserveVaSharedConsumerSlot(env, now),
        `now=${String(now)} must be refused`,
      ).resolves.toBe(false);
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("fails closed when the coordinator is unconfigured or unreachable", async () => {
    await expect(reserveVaSharedConsumerSlot({}, 0)).resolves.toBe(false);

    const spy = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.stubGlobal("fetch", spy);
    await expect(reserveVaSharedConsumerSlot(env, 0)).resolves.toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
