import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VA_SHARED_CACHE_EPOCH_DEFAULT,
  VA_SHARED_KEY_WRITE_MAX_PER_WINDOW,
  VA_SHARED_KEY_WRITE_WINDOW_SECONDS,
  writeVaSharedReferenceCache,
} from "@/lib/va/reference-shared-cache";

import { createFakeSharedKv, type FakeSharedKv } from "./helpers/fake-shared-kv";

/**
 * Admission contract for the shared cache's per-namespace write budget.
 *
 * The budget is what bounds how much of a shared store this application can
 * occupy: the process-local LRU does not constrain another instance's writes, so
 * every write is charged to `cardinality:{namespace}:{window}` and refused past
 * `VA_SHARED_KEY_WRITE_MAX_PER_WINDOW`. That bound only holds while the counter
 * is a counter and has a lifetime, so the window reservation now applies the
 * same two rules as the distributed consumer budget (audit A03) — and each
 * pre-fix defect owns a case below:
 *
 *   1. The reply was read with `Number(...)`, which coerces: a JSON `true` or
 *      `[1]` became `1`, `"0x2"` became `2`, `"1e3"` became `1000`, and
 *      `" 2 "`/`"2\n"` were accepted. Counters must be non-negative safe
 *      integers in either Redis-REST encoding (`3` or `"3"`), so no coerced
 *      value can authorise a write (`strict counter`).
 *   2. The `EXPIRE` reply was never inspected. A counter that could never be
 *      given a lifetime still admitted the write and left one permanent key per
 *      window in the store. An unconfirmed lifetime now marks the budget
 *      unavailable, removes the counter, and issues no value `SET`
 *      (`validated lifetime`).
 *   3. A Redis body error at HTTP 200 was already refused, but the same reply
 *      *carrying* a numeric result is refused here too, for the counter and for
 *      the lifetime confirmation (`error bodies`).
 *
 * Every case drives the real `writeVaSharedReferenceCache` against the real
 * Redis-REST fake, so what is pinned is the shipped path: the observation is
 * whether a value `SET` was issued at all, and every refusal must issue none.
 * The positive controls — an integer counter, an in-window counter that needs no
 * second lifetime check, and an exhausted window — keep these cases from passing
 * by refusing everything.
 */

const KV_URL = "https://synthetic-kv.invalid";
const KEY = "forms-finder:sandbox:q";
const VALUE_KEY = `va:ref:${KEY}`;
const TTL_MS = 300_000;

const env = {
  VA_REFERENCE_SHARED_CACHE_URL: KV_URL,
  VA_REFERENCE_SHARED_CACHE_TOKEN: "synthetic-token-not-a-credential",
  VA_REFERENCE_SHARED_CACHE_PREFIX: "va:ref:",
};

function cardinalityBucketKey(namespace: string, now = Date.now()): string {
  return `va:ref:cardinality:${namespace}:${Math.floor(
    now / (VA_SHARED_KEY_WRITE_WINDOW_SECONDS * 1000),
  )}`;
}

function routeFetchTo(kv: FakeSharedKv): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input).startsWith(KV_URL)).toBe(true);
      return kv.respond(init);
    }),
  );
}

/** Answer every command with a synthetic Redis-REST body. */
function stubReplies(
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

/** Reply set of a store that reads, counts, bounds and stores successfully. */
function healthyReplies(
  overrides: (command: string[]) => Record<string, unknown> = () => ({}),
): (command: string[]) => Record<string, unknown> {
  return (command) => {
    const override = overrides(command);
    if (Object.keys(override).length > 0) return override;
    if (command[0] === "GET") return { result: VA_SHARED_CACHE_EPOCH_DEFAULT };
    if (command[0] === "INCR") return { result: 1 };
    return { result: 1 };
  };
}

function valueWrites(spy: ReturnType<typeof vi.fn>): string[][] {
  return spy.mock.calls
    .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "[]")) as string[])
    .filter((command) => command[0] === "SET" && command[1] === VALUE_KEY);
}

function commandsFrom(kv: FakeSharedKv, name: string): string[][] {
  return kv.executed.filter((command) => command[0] === name);
}

function describeReply(result: unknown): string {
  return result === undefined ? "undefined" : JSON.stringify(result);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VA shared cache write budget — strict counter validation", () => {
  it("refuses every reply a coerced Number() accepted, and issues no value SET", async () => {
    const coerced = [
      true, // Number(true) === 1
      [1], // Number([1]) === 1
      "0x2", // Number("0x2") === 2
      "1e3", // Number("1e3") === 1000
      " 2 ", // whitespace padding
      "2\n", // trailing newline
      1.5,
      "1.5",
      -1,
      2 ** 53, // unsafe integer
      "one",
      {},
      null,
      undefined,
      "",
    ];

    for (const result of coerced) {
      const spy = stubReplies(
        healthyReplies((command) => (command[0] === "INCR" ? { result } : {})),
      );
      await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
      expect(
        valueWrites(spy),
        `INCR ${describeReply(result)} must not admit a write`,
      ).toHaveLength(0);
    }
  });

  it("accepts an integer counter encoded as a number or a digit string", async () => {
    for (const result of [3, "3"]) {
      const spy = stubReplies(
        healthyReplies((command) => (command[0] === "INCR" ? { result } : {})),
      );
      await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
      expect(valueWrites(spy), `INCR ${describeReply(result)} must admit a write`).toHaveLength(1);
    }
  });

  it("refuses a counter reply that carries a Redis body error, even with a numeric result", async () => {
    // Transport success is not command success (audit B07): an error body must
    // never be read as a count, nor as a confirmed lifetime.
    for (const payload of [
      { error: "ERR synthetic budget failure" },
      { error: "ERR synthetic budget failure", result: 1 },
      { error: "ERR synthetic budget failure", result: "1" },
    ]) {
      const counter = stubReplies(
        healthyReplies((command) => (command[0] === "INCR" ? payload : {})),
      );
      await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
      // The budget was actually reached — otherwise this case would pass by
      // never asking the counter at all.
      expect(
        counter.mock.calls.some(
          ([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "[]"))[0] === "INCR",
        ),
      ).toBe(true);
      expect(valueWrites(counter), `INCR error body ${describeReply(payload)}`).toHaveLength(0);

      const lifetime = stubReplies(
        healthyReplies((command) => (command[0] === "EXPIRE" ? payload : {})),
      );
      await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
      expect(valueWrites(lifetime), `EXPIRE error body ${describeReply(payload)}`).toHaveLength(0);
    }
  });

  it("refuses writes once the namespace window budget is exhausted, without a value SET", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.seed(cardinalityBucketKey("forms-finder"), String(VA_SHARED_KEY_WRITE_MAX_PER_WINDOW));

    await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
    expect(commandsFrom(kv, "INCR")).toHaveLength(1);
    expect(commandsFrom(kv, "SET")).toHaveLength(0);
  });
});

describe("VA shared cache write budget — validated counter lifetime", () => {
  it("refuses the write and removes the counter when the store cannot apply a lifetime", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.failCommand("EXPIRE");

    await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);

    // The admission decision runs before any value write, and the lifetime-less
    // counter is deleted rather than left to accumulate in the store.
    expect(kv.executed.map((command) => command[0])).toEqual(["GET", "INCR", "EXPIRE", "DEL"]);
    expect(kv.get(cardinalityBucketKey("forms-finder"))).toBeNull();
    expect(kv.get(VALUE_KEY)).toBeNull();
  });

  it("refuses a lifetime the store did not confirm with a 1", async () => {
    for (const result of [0, "0", "OK", true, null, undefined]) {
      const spy = stubReplies(
        healthyReplies((command) => (command[0] === "EXPIRE" ? { result } : {})),
      );
      await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
      expect(
        valueWrites(spy),
        `EXPIRE ${describeReply(result)} is not a confirmed lifetime`,
      ).toHaveLength(0);
    }
  });

  it("does not re-check the lifetime for later writes in the same window", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    // A counter that already exists means an earlier write in this window
    // applied the lifetime; the window must not pay a second EXPIRE per write.
    kv.seed(cardinalityBucketKey("forms-finder"), "3");

    await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);

    expect(commandsFrom(kv, "EXPIRE")).toHaveLength(0);
    expect(commandsFrom(kv, "SET").map((command) => command[1])).toEqual([VALUE_KEY]);
  });

  it("does not leave the window permanently blocked after a refused lifetime", async () => {
    let expirations = 0;
    const spy = stubReplies(
      healthyReplies((command) => {
        if (command[0] !== "EXPIRE") return {};
        expirations += 1;
        return expirations === 1 ? { error: "ERR synthetic expire failure" } : { result: 1 };
      }),
    );

    // First write: the store refuses the lifetime, so the counter is removed and
    // no value is stored.
    await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
    expect(valueWrites(spy)).toHaveLength(0);

    // Second write: the counter was removed, so it is re-created and can now be
    // bounded — a refused window is not a wedged one.
    await writeVaSharedReferenceCache(KEY, { live: true }, TTL_MS, env);
    expect(valueWrites(spy)).toHaveLength(1);
    expect(expirations).toBe(2);
  });
});
