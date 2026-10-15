/**
 * Minimal Redis-REST fake for the VA shared-store tests.
 *
 * Covers the commands the coordination layer uses: `GET`, `SET` (`EX`/`PX`/
 * `NX`), `MGET`, `INCR`, `INCRBY`, `EXPIRE`, `DEL`, and the `EVAL` scripts from
 * `src/lib/va/shared-circuit.ts` (extend-only deadline publish, generation
 * compare-and-delete, and lease compare-and-delete) plus the one-shot rolling
 * consumer-budget decision from `src/lib/va/reference-shared-cache.ts`. Script
 * bodies are matched by exact string so a test exercises the same Lua the
 * production code sends.
 *
 * A script executes as one synchronous step, exactly as Redis executes it: the
 * `respond` call is the only scheduling point a caller can interleave at, so the
 * store's timeline is a faithful model of a real one for concurrency proofs.
 * `scriptExecutions` records what each budget decision measured inside the store
 * — the current count, the predecessor count it read, the carry it computed, the
 * budget it compared against, and the code it returned — so a test can assert the
 * fence from the store's own view rather than from the caller's expectations.
 *
 * `failCommand(name, error?)` makes the next matching command answer with a
 * Redis-style body error (`{ error: … }` at HTTP 200) so tests can prove that
 * transport success is not mistaken for command success (audit B07). A script is
 * a single command: it either runs or answers an error like any other.
 *
 * TTLs honor the live clock, so the same store can simulate multiple instances
 * across a shared cooldown or an invalidation epoch bump. Every executed
 * command is recorded so tests can assert on the exact wire traffic (e.g. that
 * a refused write issues no `SET`).
 */

import {
  SHARED_CONSUMER_WINDOW_SCRIPT,
  VA_SHARED_CONSUMER_DECISION,
} from "@/lib/va/reference-shared-cache";
import {
  SHARED_CIRCUIT_CLEAR_SCRIPT,
  SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT,
  SHARED_CIRCUIT_EXTEND_DEADLINE_SCRIPT,
} from "@/lib/va/shared-circuit";

export interface FakeKvEntry {
  value: string;
  expiresAt: number | null;
}

/** One recorded execution of the rolling consumer-budget script. */
export interface FakeBudgetDecision {
  /** The window bucket this decision was made for. */
  bucket: string;
  /** The counter's value after the script's own increment. */
  count: number;
  /** The predecessor counter as the script read it (`null` for a miss). */
  predecessor: string | null;
  /** The weighted carry the script computed from that predecessor. */
  carry: number;
  /** The budget the script compared `count + carry` against. */
  budget: number;
  /** The decision code the script returned. */
  code: number;
}

export interface FakeSharedKv {
  /** Every command received, in order. */
  executed: string[][];
  /**
   * What each consumer-budget decision measured inside the store, in order:
   * the window it decided for, the counts and carry it used, and the code it
   * returned. Only `SHARED_CONSUMER_WINDOW_SCRIPT` executions are recorded.
   */
  scriptExecutions: FakeBudgetDecision[];
  /** Remaining lifetime of a live key in milliseconds, or null when it has none. */
  remainingTtlMs(key: string): number | null;
  /** Route one fetch() against the store; returns the JSON `{ result }` reply. */
  respond(init?: RequestInit): Response;
  /** Insert a value with an optional TTL (null = no expiry). */
  seed(key: string, value: string, ttlMs?: number | null): void;
  /** Read a live value, respecting TTLs. */
  get(key: string): string | null;
  /**
   * Answer the next command with this name (e.g. `EVAL`, `SET`) using a Redis
   * body error at HTTP 200. Persists until `clearCommandFailures()`.
   */
  failCommand(name: string, error?: string): void;
  clearCommandFailures(): void;
}

export function createFakeSharedKv(): FakeSharedKv {
  const store = new Map<string, FakeKvEntry>();
  const executed: string[][] = [];
  const scriptExecutions: FakeBudgetDecision[] = [];
  const commandFailures = new Map<string, string>();

  const live = (key: string, now: number): FakeKvEntry | null => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  const respond = (init?: RequestInit): Response => {
    const command = JSON.parse(String(init?.body ?? "[]")) as string[];
    executed.push(command);
    const name = command[0] ?? "";
    const key = command[1] ?? "";
    const rest = command.slice(2);
    const now = Date.now();

    const failure = commandFailures.get(name);
    if (failure) {
      return new Response(JSON.stringify({ error: failure }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let result: unknown = null;

    switch (name) {
      case "GET": {
        const entry = live(key, now);
        result = entry ? entry.value : null;
        break;
      }
      case "MGET": {
        result = command
          .slice(1)
          .map((rawKey) => live(String(rawKey), now)?.value ?? null);
        break;
      }
      case "SET": {
        const value = String(rest[0]);
        let expiresAt: number | null = null;
        let nx = false;
        for (let i = 1; i < rest.length; i += 1) {
          const token = String(rest[i]).toUpperCase();
          if (token === "NX") nx = true;
          else if (token === "EX" || token === "PX") {
            const amount = Number(rest[i + 1]);
            expiresAt = now + (token === "EX" ? amount * 1000 : amount);
            i += 1;
          }
        }
        if (nx && live(key, now)) {
          result = null;
          break;
        }
        store.set(key, { value, expiresAt });
        result = "OK";
        break;
      }
      case "EVAL": {
        const script = String(command[1] ?? "");
        const numKeys = Number(command[2] ?? 0);
        const keys = command.slice(3, 3 + numKeys).map(String);
        const argv = command.slice(3 + numKeys).map(String);

        if (script === SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT) {
          const current = live(keys[0]!, now);
          if (current && current.value === argv[0]) {
            store.delete(keys[0]!);
            result = 1;
          } else {
            result = 0;
          }
          break;
        }

        if (script === SHARED_CIRCUIT_EXTEND_DEADLINE_SCRIPT) {
          const current = live(keys[1]!, now);
          if (current && Number.isFinite(Number(current.value)) && Number(current.value) >= Number(argv[0])) {
            result = 0;
            break;
          }
          const ttlMs = Number(argv[2]) * 1000;
          store.set(keys[0]!, { value: argv[1]!, expiresAt: now + ttlMs });
          store.set(keys[1]!, { value: argv[0]!, expiresAt: now + ttlMs });
          result = 1;
          break;
        }

        if (script === SHARED_CONSUMER_WINDOW_SCRIPT) {
          // The rolling consumer-budget decision: successor fence, strict
          // predecessor validation, increment, lifetime, fence. Same arithmetic
          // as the Lua, evaluated in one synchronous step.
          const [currentKey, previousKey, successorKey] = keys;
          const budget = Number(argv[0]);
          const elapsed = Number(argv[1]);
          const windowMs = Number(argv[2]);
          const ttlSeconds = Number(argv[3]);
          const bucket = String(currentKey).replace(/^.*budget:/, "");

          const record = (count: number, predecessor: string | null, carry: number, code: number) => {
            scriptExecutions.push({ bucket, count, predecessor, carry, budget, code });
            return code;
          };

          if (live(successorKey!, now) !== null) {
            result = record(0, null, 0, VA_SHARED_CONSUMER_DECISION.supersededWindow);
            break;
          }

          const previous = live(previousKey!, now);
          let carry = 0;
          if (previous !== null) {
            if (!/^\d{1,15}$/.test(previous.value)) {
              result = record(0, previous.value, 0, VA_SHARED_CONSUMER_DECISION.predecessorInvalid);
              break;
            }
            const weight = Math.min(1, Math.max(0, (windowMs - elapsed) / windowMs));
            carry = Math.ceil(Number(previous.value) * weight);
          }

          const current = live(currentKey!, now);
          const count = (current ? Number(current.value) : 0) + 1;
          store.set(currentKey!, { value: String(count), expiresAt: current?.expiresAt ?? null });
          // Redis reports a key with no timeout as TTL -1, which is the only
          // state the script sets a lifetime for.
          if (current === null || current.expiresAt === null) {
            if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) {
              store.delete(currentKey!);
              result = record(count, previous?.value ?? null, carry, VA_SHARED_CONSUMER_DECISION.counterLifetimeRefused);
              break;
            }
            store.set(currentKey!, { value: String(count), expiresAt: now + ttlSeconds * 1000 });
          }

          result = record(
            count,
            previous?.value ?? null,
            carry,
            count + carry <= budget
              ? VA_SHARED_CONSUMER_DECISION.admitted
              : VA_SHARED_CONSUMER_DECISION.exhausted,
          );
          break;
        }

        if (script === SHARED_CIRCUIT_CLEAR_SCRIPT) {
          const marker = live(keys[0]!, now);
          if (!marker) {
            result = 0;
            break;
          }
          if (marker.value !== argv[0]) {
            result = -1;
            break;
          }
          store.delete(keys[0]!);
          store.delete(keys[1]!);
          result = 1;
          break;
        }

        result = { error: "ERR unsupported script" };
        break;
      }
      case "INCR": {
        const entry = live(key, now);
        const next = entry ? Number(entry.value) + 1 : 1;
        store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
        result = next;
        break;
      }
      case "INCRBY": {
        // Redis answers INCRBY with the counter's new value, and a key it had to
        // create carries no lifetime — exactly the state the consumer budget
        // validates before it will pace on a charge (audit A03).
        const entry = live(key, now);
        const next = (entry ? Number(entry.value) : 0) + Number(rest[0]);
        store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
        result = next;
        break;
      }
      case "EXPIRE": {
        const entry = live(key, now);
        if (!entry) {
          result = 0;
          break;
        }
        entry.expiresAt = now + Number(rest[0]) * 1000;
        result = 1;
        break;
      }
      case "DEL": {
        const existed = live(key, now) !== null;
        store.delete(key);
        result = existed ? 1 : 0;
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    executed,
    scriptExecutions,
    respond,
    remainingTtlMs(key: string): number | null {
      const entry = live(key, Date.now());
      if (!entry || entry.expiresAt === null) return null;
      return entry.expiresAt - Date.now();
    },
    seed(key: string, value: string, ttlMs: number | null = null): void {
      store.set(key, {
        value,
        expiresAt: ttlMs === null ? null : Date.now() + ttlMs,
      });
    },
    get(key: string): string | null {
      return live(key, Date.now())?.value ?? null;
    },
    failCommand(name: string, error = "ERR synthetic failure"): void {
      commandFailures.set(name, error);
    },
    clearCommandFailures(): void {
      commandFailures.clear();
    },
  };
}
