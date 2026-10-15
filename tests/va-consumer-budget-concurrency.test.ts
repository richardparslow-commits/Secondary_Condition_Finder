import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyVaConsumerPacingGuidance,
  reserveVaSharedConsumerSlot,
  VA_SHARED_CONSUMER_DECISION,
  VA_SHARED_CONSUMER_MAX_REQUESTS,
  VA_SHARED_CONSUMER_WINDOW_MS,
} from "@/lib/va/reference-shared-cache";

import { createFakeSharedKv } from "./helpers/fake-shared-kv";

/**
 * Concurrency proof for the shared VA consumer budget (audit A03).
 *
 * The budget stands between the fleet and VA's per-consumer quota, so the claim
 * that matters is not "it admits nothing extra in sequence" but **"no
 * interleaving of callers can put more than one window's budget past it"**. Both
 * halves of that claim are asserted here against the store's own view:
 *
 *   1. **One atomic decision.** Every attempt is exactly one command, and the
 *      store records what each decision measured *inside* it — the count after
 *      its own increment, the predecessor value it read, and the carry it
 *      computed. The fence `count + carry <= budget` is therefore checked from
 *      the store's timeline, not from the caller's expectations, and a decision
 *      can never be made against a predecessor that has since moved.
 *   2. **The straddle fence.** A reservation that arrives after the store has
 *      already opened the next window is refused before it writes anything. This
 *      is the failure the fences exist for: N callers admit a window's budget
 *      while the previous window's callers are still in flight, and then those
 *      callers admit theirs — the fixed-minute boundary burst, released by
 *      latency rather than by the clock. The last case here is that scenario,
 *      staged with a held response, and it asserts the fleet's total across the
 *      straddle is one budget.
 *
 * The storms are real interleavings — `Promise.all` over a store whose responses
 * are held, and a store with randomised latency — so a regression to
 * read-then-decide (or to a per-instance allowance) fails here rather than only
 * in production.
 */

const KV_URL = "https://synthetic-kv.invalid";
const BUDGET_PREFIX = "va:ref:budget:";

const env = {
  VA_REFERENCE_SHARED_CACHE_URL: KV_URL,
  VA_REFERENCE_SHARED_CACHE_TOKEN: "synthetic-token-not-a-credential",
  VA_REFERENCE_SHARED_CACHE_PREFIX: "va:ref:",
};

/** A window index far from zero, so no case can depend on bucket 0's edge. */
const BUCKET = 40;
const WINDOW_BASE = BUCKET * VA_SHARED_CONSUMER_WINDOW_MS;

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

/**
 * Route to the store, holding the first command the predicate matches until
 * `release()` is called — a coordinator that has received the command but not
 * answered it, which is how a straggling caller is staged.
 */
function createHeldStore(
  kv: ReturnType<typeof createFakeSharedKv>,
  shouldHold: (command: string[]) => boolean,
): { release: () => void; heldCommands: string[][] } {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const heldCommands: string[][] = [];
  let holding = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body ?? "[]")) as string[];
      if (!holding && shouldHold(command)) {
        holding = true;
        heldCommands.push(command);
        await gate;
      }
      return kv.respond(init);
    }),
  );
  return { release, heldCommands };
}

/** Every decision the store recorded for one window bucket. */
function decisionsFor(
  kv: ReturnType<typeof createFakeSharedKv>,
  bucket: number,
): ReturnType<typeof createFakeSharedKv>["scriptExecutions"] {
  return kv.scriptExecutions.filter((entry) => entry.bucket === String(bucket));
}

function admittedCount(decisions: { code: number }[]): number {
  return decisions.filter((entry) => entry.code === VA_SHARED_CONSUMER_DECISION.admitted).length;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("VA shared consumer budget — concurrency", () => {
  it("admits exactly one window's budget when 200 attempts race", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    const attempts = 200;

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, index) =>
        // All inside bucket 40: elapsed 0–199 ms, so the predecessor term is a
        // miss for every caller and the budget is the only bound.
        reserveVaSharedConsumerSlot(env, WINDOW_BASE + (index % 200)),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);

    // The store's own account of the storm: one command per attempt, every
    // admission inside the fence, and no more admissions than the budget.
    expect(kv.executed).toHaveLength(attempts);
    expect(kv.executed.every((command) => command[0] === "EVAL")).toBe(true);
    const decisions = decisionsFor(kv, BUCKET);
    expect(decisions).toHaveLength(attempts);
    expect(admittedCount(decisions)).toBe(VA_SHARED_CONSUMER_MAX_REQUESTS);
    for (const decision of decisions) {
      if (decision.code !== VA_SHARED_CONSUMER_DECISION.admitted) continue;
      expect(decision.count + decision.carry).toBeLessThanOrEqual(
        VA_SHARED_CONSUMER_MAX_REQUESTS,
      );
    }
    // Every attempt counted: the increment precedes the decision.
    expect(kv.get(budgetKey(BUCKET))).toBe(String(attempts));
  });

  it("cannot double-spend a saturated predecessor's weight under concurrency", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    // A full budget spent at the start of bucket 39, so at half a window into
    // bucket 40 the predecessor still weighs half its value.
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      await reserveVaSharedConsumerSlot(env, WINDOW_BASE - VA_SHARED_CONSUMER_WINDOW_MS);
    }
    const half = VA_SHARED_CONSUMER_WINDOW_MS / 2;
    const now = WINDOW_BASE + half;

    const results = await Promise.all(
      Array.from({ length: 200 }, () => reserveVaSharedConsumerSlot(env, now)),
    );

    // Half the predecessor still counts, so half a budget is available — no
    // matter how many callers race, and never a second full one.
    expect(results.filter(Boolean)).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS / 2);
    const decisions = decisionsFor(kv, BUCKET);
    expect(new Set(decisions.map((decision) => decision.carry))).toEqual(
      new Set([VA_SHARED_CONSUMER_MAX_REQUESTS / 2]),
    );
    expect(admittedCount(decisions)).toBe(VA_SHARED_CONSUMER_MAX_REQUESTS / 2);
  });

  it("holds the fence when the store answers out of order", async () => {
    const kv = createFakeSharedKv();
    // Randomised latency, so decisions are applied in an order unrelated to the
    // order the callers made them — the interleaving a fleet sees when instances
    // are on different hosts.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input).startsWith(KV_URL)).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 5)));
        return kv.respond(init);
      }),
    );

    const results = await Promise.all(
      Array.from({ length: 240 }, () => reserveVaSharedConsumerSlot(env, WINDOW_BASE + 1)),
    );

    expect(results.filter(Boolean)).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);
    // Reordered arrival is still arrival: the count is the store's, not a
    // caller's copy of it.
    expect(kv.get(budgetKey(BUCKET))).toBe("240");
  });

  it("keeps the fleet under the budget when a tightening charge races the storm", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    // The upstream says it has 20 left, so 40 of the local window are charged.
    const outcome = await applyVaConsumerPacingGuidance(
      new Headers([["X-RateLimit-Remaining", "20"]]),
      env,
      WINDOW_BASE,
    );
    expect(outcome).toMatchObject({ applied: true, extraReservations: 40 });

    const results = await Promise.all(
      Array.from({ length: 120 }, () => reserveVaSharedConsumerSlot(env, WINDOW_BASE + 1)),
    );

    // Only what the upstream said remained, and the fence still holds.
    expect(results.filter(Boolean)).toHaveLength(20);
    for (const decision of kv.scriptExecutions) {
      if (decision.code !== VA_SHARED_CONSUMER_DECISION.admitted) continue;
      expect(decision.count + decision.carry).toBeLessThanOrEqual(
        VA_SHARED_CONSUMER_MAX_REQUESTS,
      );
    }
  });

  it("refuses a straggler whose window the fleet has already left", async () => {
    const kv = createFakeSharedKv();
    // Hold the straggler's decision on arrival: the call is in flight, and the
    // store has not executed it yet.
    const held = createHeldStore(kv, (command) => String(command[3]).endsWith(`:${BUCKET}`));

    const straggler = reserveVaSharedConsumerSlot(env, WINDOW_BASE + VA_SHARED_CONSUMER_WINDOW_MS - 1);
    await Promise.resolve();
    expect(held.heldCommands).toHaveLength(1);

    // The fleet moves into the next window while that call is still in flight.
    // Its own budget there is legitimately free: the predecessor has written
    // nothing yet.
    const nextWindow: boolean[] = [];
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      nextWindow.push(
        await reserveVaSharedConsumerSlot(env, WINDOW_BASE + VA_SHARED_CONSUMER_WINDOW_MS + index),
      );
    }
    expect(nextWindow.filter(Boolean)).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);

    // Release the straggler. It may not add a second budget to the interval it
    // straddles, and it writes nothing.
    held.release();
    await expect(straggler).resolves.toBe(false);
    expect(kv.get(budgetKey(BUCKET))).toBeNull();

    // The fleet's total across the boundary is one budget, not two — which is
    // precisely what a read-then-decide reservation would have released.
    const admittedAcrossTheStraddle =
      admittedCount(decisionsFor(kv, BUCKET)) + admittedCount(decisionsFor(kv, BUCKET + 1));
    expect(admittedAcrossTheStraddle).toBe(VA_SHARED_CONSUMER_MAX_REQUESTS);
  });
});
