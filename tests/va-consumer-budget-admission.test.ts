import { afterEach, describe, expect, it, vi } from "vitest";

import {
  reserveVaSharedConsumerSlot,
  SHARED_CONSUMER_WINDOW_SCRIPT,
  VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS,
  VA_SHARED_CONSUMER_DECISION,
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
 * The whole decision — the successor fence, the predecessor read, the increment,
 * the counter's lifetime, and the comparison — is one atomic server-side
 * operation (`SHARED_CONSUMER_WINDOW_SCRIPT`), so this suite also pins the shape
 * of the exchange: **one command per attempt**, never a read-then-decide pair.
 * Concurrency itself is proven separately, against the store's own recorded
 * timeline, in `tests/va-consumer-budget-concurrency.test.ts`.
 *
 * Each pre-fix defect owns a case below, and each case fails if its guard is
 * removed:
 *
 *   1. `floor(now / 60000)` admitted 60 reservations at 59,999 ms and 60 more
 *      at 60,000 ms — **120 admissions against a budget of 60, one millisecond
 *      apart**. The rolling rule refuses the burst and refills gradually
 *      (`boundary burst`, `pacing`, `absent predecessor`).
 *   2. `Number.isFinite` accepted a fractional counter — a synthetic `1.5`
 *      authorised a slot (`fractional and malformed counters`). The decision
 *      code must now be a known non-negative safe integer in either encoding, an
 *      erroring reply is refused rather than read, and an unreadable code is
 *      refused rather than defaulted.
 *   3. The predecessor read and the decision were separate commands, and a
 *      counter's lifetime was established by a *later* `EXPIRE` that could fail
 *      or never run. Both are now inside the one operation, so the lifetime is
 *      established atomically (`a counter's lifetime`) and a reservation for a
 *      window the store has already moved past is refused before anything is
 *      written (`a superseded window`).
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

    // An absent predecessor is a miss, not an error, and it costs no command of
    // its own: every attempt is exactly one atomic decision, and the skipped
    // window's own counter was never written.
    expect(kv.executed).toHaveLength(2 * VA_SHARED_CONSUMER_MAX_REQUESTS);
    expect(kv.executed.every((command) => command[0] === "EVAL")).toBe(true);
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

  it("establishes the counter's lifetime in the same atomic step as the increment", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    expect(await reserveVaSharedConsumerSlot(env, 1_000)).toBe(true);

    // One command produced both the counter and its lifetime: there is no
    // window in which a reservation has been made against a counter that the
    // store may keep forever.
    expect(kv.executed).toEqual([
      ["EVAL", SHARED_CONSUMER_WINDOW_SCRIPT, "3", budgetKey(0), budgetKey(-1), budgetKey(1),
        String(VA_SHARED_CONSUMER_MAX_REQUESTS), "1000", String(VA_SHARED_CONSUMER_WINDOW_MS),
        String(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS)],
    ]);
    expect(kv.remainingTtlMs(budgetKey(0))).toBe(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS * 1000);

    // Later reservations in the same window do not push the expiry out: the
    // lifetime is one bound per window, not a sliding extension.
    vi.advanceTimersByTime(5_000);
    expect(await reserveVaSharedConsumerSlot(env, 6_000)).toBe(true);
    expect(kv.remainingTtlMs(budgetKey(0))).toBe(
      VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS * 1000 - 5_000,
    );

    // The lifetime outlives the window so the next window can read this counter
    // as its predecessor, and still expires so keys cannot accumulate.
    expect(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS * 1000).toBeGreaterThan(
      VA_SHARED_CONSUMER_WINDOW_MS,
    );
  });

  it("refuses a reservation for a window the store has already moved past", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    // A window exists for the bucket after the one this reservation names: the
    // fleet has already moved on, so this call is a straggler (a stalled attempt
    // or a lagging clock). Deciding it would decide it against a predecessor
    // other instances are still writing — the latency-released version of the
    // boundary burst — so it is refused before anything is written.
    expect(await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS)).toBe(true);
    expect(await reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS - 1)).toBe(false);

    expect(kv.get(budgetKey(0))).toBeNull();
    expect(kv.scriptExecutions.at(-1)?.code).toBe(
      VA_SHARED_CONSUMER_DECISION.supersededWindow,
    );
    expect(kv.scriptExecutions.at(-1)?.count).toBe(0);
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

  it("accepts the admitted code in either Redis-REST encoding, wrapped or not", async () => {
    const admitted = VA_SHARED_CONSUMER_DECISION.admitted;
    for (const result of [admitted, String(admitted), [admitted], [String(admitted)]]) {
      stubCommandReplies(() => ({ result: result as unknown }));
      await expect(
        reserveVaSharedConsumerSlot(env, 0),
        `decision ${JSON.stringify(result)} must authorise a slot`,
      ).resolves.toBe(true);
    }
  });

  it("refuses an unknown decision code instead of defaulting it", async () => {
    // A code nobody defined is a store this module does not understand; the only
    // safe reading of it is "no slot".
    for (const result of [0, 9, 6, [1, 1], [], 1e9]) {
      stubCommandReplies(() => ({ result: result as unknown }));
      await expect(
        reserveVaSharedConsumerSlot(env, 0),
        `decision ${JSON.stringify(result)} must not authorise a slot`,
      ).resolves.toBe(false);
    }
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

  it("refuses when the store cannot execute the atomic decision", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.failCommand("EVAL");

    expect(await reserveVaSharedConsumerSlot(env, 0)).toBe(false);
    // Nothing was written: the whole decision is the one command that failed.
    expect(kv.get(budgetKey(0))).toBeNull();
    expect(kv.scriptExecutions).toEqual([]);
  });

  it("refuses when the predecessor counter is invalid or the exchange errors", async () => {
    // The predecessor's own validity is checked inside the decision, so a
    // corrupted counter cannot become arithmetic fuel.
    for (const corrupted of ["not-a-counter", "1.5", "-1", "0x2", " 1", "1 ", "1".repeat(16)]) {
      const kv = createFakeSharedKv();
      routeFetchTo(kv);
      kv.seed(budgetKey(0), corrupted, 600_000);
      await expect(
        reserveVaSharedConsumerSlot(env, VA_SHARED_CONSUMER_WINDOW_MS),
        `predecessor ${JSON.stringify(corrupted)} must not authorise a slot`,
      ).resolves.toBe(false);
      expect(kv.scriptExecutions.at(-1)?.code).toBe(
        VA_SHARED_CONSUMER_DECISION.predecessorInvalid,
      );
      // Refused before the increment, so the current window spent nothing.
      expect(kv.get(budgetKey(1))).toBeNull();
    }

    // An erroring reply is a refusal even when it also carries a decision code.
    stubCommandReplies((command) => ({
      result: VA_SHARED_CONSUMER_DECISION.admitted,
      ...(command[0] === "EVAL" ? { error: "ERR synthetic decision failure" } : {}),
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
