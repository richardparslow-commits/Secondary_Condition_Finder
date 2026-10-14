import { AsyncLocalStorage } from "node:async_hooks";

import { afterEach, describe, expect, it, vi } from "vitest";

import { HALF_OPEN_PROBE_AFTER_MS } from "@/lib/va/circuit-breaker";
import { clearVaReferenceCache, hashedCacheKeySegment } from "@/lib/va/reference-cache";
import {
  VA_SHARED_CACHE_ENVELOPE_VERSION,
  VA_SHARED_CACHE_EPOCH_DEFAULT,
  VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS,
  VA_SHARED_CONSUMER_MAX_REQUESTS,
  VA_SHARED_KEY_WRITE_MAX_PER_WINDOW,
  bumpVaSharedCacheEpoch,
  readVaSharedReferenceCache,
  writeVaSharedReferenceCache,
} from "@/lib/va/reference-shared-cache";
import { clearVaApiOutboundRateLimitState } from "@/lib/va/sandbox";
import { clearCircuitBreakerState } from "@/lib/va/circuit-breaker";
import {
  SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT,
  SHARED_CIRCUIT_EXTEND_DEADLINE_SCRIPT,
  clearSharedCircuitStateForTests,
} from "@/lib/va/shared-circuit";
import { clearSharedSingleFlightStateForTests } from "@/lib/va/shared-single-flight";

import { createFakeSharedKv } from "./helpers/fake-shared-kv";
import {
  FLEET_SCENARIO_BUDGETS_MS,
  FLEET_SCENARIO_KEYS,
  scenarioBudgetFailure,
} from "./helpers/fleet-scenario-budgets";
import type { FleetScenario } from "./helpers/fleet-scenario-budgets";

/**
 * Multi-instance fleet simulation: every "instance" gets its own module
 * registry (`vi.resetModules()` + dynamic import), so its local circuit state,
 * probe claims, fetch leases, and rate-limit counters are independent exactly
 * as separate lambda instances would be. All instances share one fake KV —
 * the fleet's only cross-instance authority.
 */

const KV_URL = "https://example.upstash.io";
const CIRCUIT_MARKER_KEY = "va:ref:circuit:va-forms";
const CIRCUIT_DEADLINE_KEY = "va:ref:circuit-deadline:va-forms";
/** Bucket-aligned fixed clock so budget/cardinality windows cannot roll over mid-test. */
const FIXED_NOW = 1_700_000_040_000;

type FleetEvent =
  | { kind: "kv"; command: string[] }
  | { kind: "kv-abort"; command: string[] }
  | { kind: "upstream"; url: string; status: number };

interface UpstreamReply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  delayMs?: number;
}

interface Fleet {
  events: FleetEvent[];
  kv: ReturnType<typeof createFakeSharedKv>;
  /** Runs `fn` inside a labelled network partition; the harness's `kvDown` sees the label. */
  asPartition<T>(partition: string, fn: () => T): T;
  upstreamEvents(): Array<{ url: string; status: number }>;
  kvCommandsNamed(name: string): string[][];
}

function stubDistributedEnv(): void {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_API_ENV", "sandbox");
  vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-test-key");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_URL);
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
  vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "true");
}

function createFleetHarness(options: {
  upstream: (url: string) => UpstreamReply;
  /**
   * When it returns true for the caller's network partition (the label set by
   * `asPartition`), the shared store refuses the connection: the command is
   * logged, then the request fails. Without a partition label it applies to
   * every caller.
   */
  kvDown?: (partition?: string) => boolean;
  /**
   * When set, the shared store answers after this many milliseconds. The
   * response races the caller's AbortController deadline, exactly like a real
   * degraded store, and an aborted exchange never reaches the store.
   */
  kvDelayMs?: () => number;
}): Fleet {
  const kv = createFakeSharedKv();
  const events: FleetEvent[] = [];
  const partitionStore = new AsyncLocalStorage<string>();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const href = String(input);
      if (href.startsWith(KV_URL)) {
        const command = JSON.parse(String(init?.body ?? "[]")) as string[];
        events.push({ kind: "kv", command });
        if (options.kvDown?.(partitionStore.getStore())) throw new TypeError("fetch failed");
        const delayMs = options.kvDelayMs?.() ?? 0;
        if (delayMs <= 0) return kv.respond(init);
        return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(kv.respond(init)), delayMs);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            events.push({ kind: "kv-abort", command });
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        });
      }
      const reply = options.upstream(href);
      if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
      events.push({ kind: "upstream", url: href, status: reply.status });
      return new Response(JSON.stringify(reply.body ?? {}), {
        status: reply.status,
        headers: { "Content-Type": "application/json", ...(reply.headers ?? {}) },
      });
    }),
  );
  return {
    events,
    kv,
    asPartition: (partition, fn) => partitionStore.run(partition, fn),
    upstreamEvents: () =>
      events.filter((event): event is Extract<FleetEvent, { kind: "upstream" }> => event.kind === "upstream"),
    kvCommandsNamed: (name) => {
      const commands: string[][] = [];
      for (const event of events) {
        if (event.kind === "kv" && event.command[0] === name) commands.push(event.command);
      }
      return commands;
    },
  };
}

async function createFleetInstance() {
  vi.resetModules();
  const sandbox = await import("@/lib/va/sandbox");
  const formsFinder = await import("@/lib/va/forms-finder");
  const circuit = await import("@/lib/va/circuit-breaker");
  const outbound = await import("@/lib/va/outbound-circuit");
  return { sandbox, formsFinder, circuit, outbound };
}

type FleetInstance = Awaited<ReturnType<typeof createFleetInstance>>;

async function createFleet(count: number): Promise<FleetInstance[]> {
  const instances: FleetInstance[] = [];
  for (let i = 0; i < count; i += 1) instances.push(await createFleetInstance());
  return instances;
}

function formsPayload(
  count = 1,
  title = "Application for Disability Compensation and Related Compensation Benefits",
): unknown {
  return {
    data: Array.from({ length: count }, (_, i) => ({
      id: `21-526EZ-${i}`,
      type: "va_form",
      attributes: {
        form_name: "21-526EZ",
        title,
        url: "https://www.va.gov/find-forms/about-form-21-526ez/",
        last_revision_on: null,
        deleted_at: null,
      },
    })),
  };
}

const SHARED_PREFIX = "va:ref:";

/** The unprefixed cache key the loaders and the shared-cache module use. */
function formsKey(query: string): string {
  return `forms-finder:sandbox:q:${hashedCacheKeySegment(query.toLowerCase())}`;
}

/** The same key as it is stored (with the operator prefix) for direct reads. */
function storedFormsKey(query: string): string {
  return `${SHARED_PREFIX}${formsKey(query)}`;
}

/** A live view shaped exactly as the loader writes it, for warming the store. */
function warmFormsView(query: string, title: string) {
  return {
    query: "",
    lookupKey: formsKey(query),
    items: [
      {
        formName: "21-526EZ",
        title,
        url: "https://www.va.gov/find-forms/about-form-21-526ez/",
        lastRevisionOn: null,
        pages: null,
        validPdf: true,
      },
    ],
    source: "va-sandbox-api" as const,
    sourceLabel: "VA Forms sandbox",
    notice:
      "Results came from the VA Forms sandbox. Sandbox data is for testing and may not be current; confirm forms on VA.gov before filing.",
    live: true as const,
    environment: "sandbox" as const,
    retrievedAt: "2026-10-03T00:00:00.000Z",
    cacheStatus: "miss" as const,
  };
}

/** Scenarios that completed or failed their bounded run, for the coverage guard. */
const observedScenarios = new Set<FleetScenario>();

/**
 * Enforcement core: measures one body against one real-time bound. The clock
 * is `process.hrtime`, which fake timers never touch, so the bound measures
 * real wall clock even in scenarios that advance simulated time.
 */
async function enforceScenarioBudget<T>(scenario: string, budgetMs: number, body: () => Promise<T>): Promise<T> {
  const startedAt = process.hrtime.bigint();
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await body() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const failure = scenarioBudgetFailure(scenario, elapsedMs, budgetMs);
  if (!outcome.ok) throw outcome.error; // Preserve the original failure over the bound message.
  if (failure) throw new Error(failure);
  return outcome.value;
}

/** Runs one scenario under its committed real-time bound. */
async function withinScenarioBudget<T>(scenario: FleetScenario, body: () => Promise<T>): Promise<T> {
  observedScenarios.add(scenario);
  return enforceScenarioBudget(scenario, FLEET_SCENARIO_BUDGETS_MS[scenario], body);
}

/**
 * `it`, but the scenario body is held to its own committed wall-clock bound in
 * addition to the outer Vitest timeout and the suite-level ratchet.
 */
function boundedTest(scenario: FleetScenario, title: string, body: () => Promise<void>, timeoutMs: number): void {
  it(title, () => withinScenarioBudget(scenario, body), timeoutMs);
}

afterEach(() => {
  vi.useRealTimers();
  clearVaReferenceCache();
  clearVaApiOutboundRateLimitState();
  clearCircuitBreakerState();
  clearSharedCircuitStateForTests();
  clearSharedSingleFlightStateForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VA fleet simulation — unique-query storm", () => {
  boundedTest(
    "budget-reserve-storm",
    "holds the shared consumer budget, cardinality budget, and lease invariants across 40 instances",
    async () => {
      stubDistributedEnv();
      vi.useFakeTimers({ now: FIXED_NOW });
      const fleet = createFleetHarness({ upstream: () => ({ status: 200, body: { data: [] } }) });

      const instanceCount = 40;
      const perInstance = 5;
      const totalRequests = instanceCount * perInstance;
      const instances = await createFleet(instanceCount);

      const results = await Promise.all(
        instances.flatMap((instance, index) =>
          Array.from({ length: perInstance }, (_, offset) =>
            instance.formsFinder.loadVaFormsFinder(`storm-query-${index * perInstance + offset}`),
          ),
        ),
      );

      expect(results).toHaveLength(totalRequests);
      const live = results.filter((result) => result.source === "va-sandbox-api");
      const fallback = results.filter((result) => result.source === "local-fallback");
      expect(live.length + fallback.length).toBe(totalRequests);

      // Exactly one budget window's worth of requests may reach VA, no matter
      // how many instances (or how many unique keys) storm at once.
      expect(live).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);
      expect(fallback).toHaveLength(totalRequests - VA_SHARED_CONSUMER_MAX_REQUESTS);
      const upstream = fleet.upstreamEvents();
      expect(upstream).toHaveLength(VA_SHARED_CONSUMER_MAX_REQUESTS);

      // No upstream request may start before a budget reservation, and every
      // reservation uses the same window bucket with a bounded counter lifetime.
      // The storm runs at one instant, so the rolling window's predecessor term
      // is read at most — never incremented — and one bucket holds the whole
      // storm.
      const firstBudgetIncr = fleet.events.findIndex(
        (event) =>
          event.kind === "kv" &&
          event.command[0] === "INCR" &&
          String(event.command[1]).startsWith("va:ref:budget:"),
      );
      const firstUpstream = fleet.events.findIndex((event) => event.kind === "upstream");
      expect(firstBudgetIncr).toBeGreaterThanOrEqual(0);
      expect(firstUpstream).toBeGreaterThan(firstBudgetIncr);
      const budgetKeys = new Set(
        fleet
          .kvCommandsNamed("INCR")
          .map((command) => String(command[1]))
          .filter((key) => key.startsWith("va:ref:budget:")),
      );
      expect(budgetKeys.size).toBe(1);
      expect(
        fleet
          .kvCommandsNamed("EXPIRE")
          .some(
            (command) =>
              command[1] === [...budgetKeys][0] &&
              command[2] === String(VA_SHARED_CONSUMER_COUNTER_TTL_SECONDS),
          ),
      ).toBe(true);

      // Finite cardinality: one admitted write per live view, no more than the
      // namespace cap, and no raw query ever becomes key material.
      const valueWrites = fleet
        .kvCommandsNamed("SET")
        .filter((command) => /^va:ref:forms-finder:/.test(String(command[1])));
      expect(valueWrites).toHaveLength(live.length);
      expect(valueWrites.length).toBeLessThanOrEqual(VA_SHARED_KEY_WRITE_MAX_PER_WINDOW);
      for (const command of fleet.events) {
        if (command.kind !== "kv") continue;
        for (const part of command.command.slice(0, 2)) {
          expect(String(part)).not.toContain("storm-query-");
        }
      }

      // Single-flight: every request claimed its own key's lease and released
      // it — no stranded in-flight key after the storm.
      const leaseClaims = fleet
        .kvCommandsNamed("SET")
        .filter((command) => String(command[1]).startsWith("va:ref:inflight:forms-finder:"));
      const leaseReleases = fleet
        .kvCommandsNamed("EVAL")
        .filter(
          (command) =>
            command[1] === SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT &&
            String(command[3]).startsWith("va:ref:inflight:forms-finder:"),
        );
      expect(leaseClaims).toHaveLength(totalRequests);
      expect(leaseReleases).toHaveLength(leaseClaims.length);
    },
    20_000,
  );
});

describe("VA fleet simulation — 429 flare, cooldown, and single probe", () => {
  boundedTest(
    "probe-admission",
    "publishes one fleet cooldown, blocks fresh instances, and admits exactly one probe after the cooldown",
    async () => {
      stubDistributedEnv();
      vi.useFakeTimers({ now: FIXED_NOW });
      const fleet = createFleetHarness({
        upstream: () => ({ status: 429, headers: { "retry-after": "30" }, body: {} }),
      });

      // Phase 1 — ten instances race before any cooldown exists.
      const flare = await createFleet(10);
      const flareResults = await Promise.all(
        flare.map((instance, i) => instance.sandbox.fetchVaForms(`flare-${i}`)),
      );
      expect(flareResults.every((result) => result.success === false)).toBe(true);
      // A 429 whose Retry-After is a whole-second instruction is never retried
      // in-request: one upstream attempt per request, then the fleet cooldown.
      // (`Retry-After: 0` is the one exception — see `va/api.ts`.)
      expect(fleet.upstreamEvents()).toHaveLength(10);

      const markerPublishes = fleet
        .kvCommandsNamed("EVAL")
        .filter(
          (command) =>
            command[1] === SHARED_CIRCUIT_EXTEND_DEADLINE_SCRIPT &&
            command[3] === CIRCUIT_MARKER_KEY &&
            command[4] === CIRCUIT_DEADLINE_KEY,
        );
      expect(markerPublishes.length).toBeGreaterThanOrEqual(1);
      // The marker and the authoritative deadline share one TTL that outlives
      // the cooldown itself.
      expect(markerPublishes.every((command) => Number(command[7]) >= 3600)).toBe(true);
      // Read the published marker straight from the shared store.
      const published = JSON.parse(String(fleet.kv.get(CIRCUIT_MARKER_KEY))) as {
        state: string;
        openedAt: number;
      };
      expect(published.state).toBe("open");

      // Every instance that saw the 429 opened its own breaker for the clamped
      // Retry-After window (30s), and the shared store carries the cooldown.
      for (const instance of flare) {
        const state = instance.circuit.readCircuitState("va-forms");
        expect(state.state).toBe("open");
        expect(state.cooldownMs).toBe(30_000);
      }

      // Phase 2 — brand-new instances see the fleet cooldown and never fetch.
      const upstreamBefore = fleet.upstreamEvents().length;
      const budgetIncrsBefore = fleet
        .kvCommandsNamed("INCR")
        .filter((command) => String(command[1]).startsWith("va:ref:budget:")).length;
      const steady = await createFleet(10);
      const steadyResults = await Promise.all(
        steady.map((instance, i) => instance.sandbox.fetchVaForms(`steady-${i}`)),
      );
      expect(fleet.upstreamEvents()).toHaveLength(upstreamBefore);
      expect(
        fleet.kvCommandsNamed("INCR").filter((command) => String(command[1]).startsWith("va:ref:budget:")),
      ).toHaveLength(budgetIncrsBefore); // a blocked request spends no quota
      for (const result of steadyResults) {
        expect(result.success).toBe(false);
        expect(result.error).toContain("circuit open");
      }

      // Phase 3 — after the cooldown, exactly one probe is admitted fleet-wide.
      const probeNow = published.openedAt + HALF_OPEN_PROBE_AFTER_MS + 1;
      const probes = await createFleet(20);
      const decisions = await Promise.all(
        probes.map((instance) =>
          instance.outbound.evaluateVaOutboundCircuit({
            service: "va-forms",
            distributed: true,
            now: probeNow,
          }),
        ),
      );
      expect(decisions.filter((admission) => admission.decision === "probe")).toHaveLength(1);
      expect(decisions.filter((admission) => admission.decision === "blocked")).toHaveLength(19);
      expect(
        decisions.filter((admission) => admission.decision === "unavailable"),
      ).toHaveLength(0);

      // Phase 4 — the single probe succeeds and clears the fleet cooldown. The
      // admission it observed is passed back so recovery can only clear the
      // generation that was actually admitted (audit B06 fencing).
      const winnerIndex = decisions.findIndex((admission) => admission.decision === "probe");
      const winner = probes[winnerIndex]!;
      await winner.outbound.recordVaOutboundCircuitOutcome({
        service: "va-forms",
        distributed: true,
        success: true,
        probeAdmitted: true,
        admission: decisions[winnerIndex]!,
      });
      expect(fleet.kv.get(CIRCUIT_MARKER_KEY)).toBeNull();

      // Phase 5 — a newer, longer cooldown lands before the old probe's success
      // is recorded again; the stale success may only clear the generation it
      // observed, so the newer cooldown survives and keeps the fleet down.
      await winner.outbound.recordVaOutboundCircuitOutcome({
        service: "va-forms",
        distributed: true,
        success: false,
        rateLimited: true,
        retryAfterMs: 600_000,
      });
      const newerMarker = fleet.kv.get(CIRCUIT_MARKER_KEY);
      expect(newerMarker).not.toBeNull();
      await winner.outbound.recordVaOutboundCircuitOutcome({
        service: "va-forms",
        distributed: true,
        success: true,
        probeAdmitted: true,
        admission: decisions[winnerIndex]!,
      });
      expect(fleet.kv.get(CIRCUIT_MARKER_KEY)).toBe(newerMarker);
    },
    20_000,
  );
});

describe("VA fleet simulation — single-flight storm on one cold key", () => {
  boundedTest(
    "single-flight-wait",
    "serves one cold key with exactly one upstream fetch across 30 concurrent instances",
    async () => {
      stubDistributedEnv();
      const fleet = createFleetHarness({
        upstream: () => ({ status: 200, body: formsPayload(), delayMs: 60 }),
      });

      const instances = await createFleet(30);
      const results = await Promise.all(
        instances.map((instance) => instance.formsFinder.loadVaFormsFinder("21-526EZ")),
      );

      expect(fleet.upstreamEvents()).toHaveLength(1);
      expect(results.every((result) => result.source === "va-sandbox-api")).toBe(true);
      expect(results.filter((result) => result.cacheStatus === "miss")).toHaveLength(1);
      expect(results.filter((result) => result.cacheStatus === "hit")).toHaveLength(29);
      expect(results.every((result) => result.items[0]?.formName === "21-526EZ")).toBe(true);

      // The lease was claimed, serialized through `SET … NX`, and released.
      const leaseKey = `va:ref:inflight:forms-finder:sandbox:q:${hashedCacheKeySegment("21-526ez")}`;
      const claims = fleet.kvCommandsNamed("SET").filter((command) => command[1] === leaseKey);
      expect(claims.length).toBe(30);
      expect(claims.every((command) => command[3] === "NX" && command[4] === "PX")).toBe(true);
      expect(fleet.kv.get(leaseKey)).toBeNull();
    },
    20_000,
  );
});

describe("VA fleet simulation — degraded shared store (slow, near the deadline)", () => {
  boundedTest(
    "degraded-store-fail-closed",
    "caps every exchange at the 750 ms deadline and stays fail-closed with bounded render cost",
    async () => {
      stubDistributedEnv();
      vi.useFakeTimers({ now: FIXED_NOW });
      // The store would answer in 5s — far beyond the 750 ms exchange deadline.
      const fleet = createFleetHarness({
        upstream: () => ({ status: 200, body: formsPayload() }),
        kvDelayMs: () => 5_000,
      });

      const instances = await createFleet(5);
      const budgetKey = `va:ref:budget:${Math.floor(FIXED_NOW / 60_000)}`;

      // Wave 1: four loader renders plus one direct fetch, all against the
      // degraded store. Each request performs at most three KV exchanges
      // (cache read, single-flight lease claim, circuit gate).
      const started = Date.now();
      let viewsSettledAt = Number.POSITIVE_INFINITY;
      let probeSettledAt = Number.POSITIVE_INFINITY;
      const viewsPromise = Promise.all(
        instances
          .slice(0, 4)
          .map((instance, index) => instance.formsFinder.loadVaFormsFinder(`degraded-${index}`)),
      ).then((views) => {
        viewsSettledAt = Date.now();
        return views;
      });
      const probePromise = instances[4]!.sandbox.fetchVaForms("degraded-probe").then((result) => {
        probeSettledAt = Date.now();
        return result;
      });

      // After 1s the single-exchange probe has already failed closed at its
      // 750 ms deadline, while the loader chain (three exchanges) is still
      // waiting — the store's 5 s response never arrives in time.
      await vi.advanceTimersByTimeAsync(1_000);
      expect(probeSettledAt).toBeGreaterThanOrEqual(started + 750);
      expect(probeSettledAt).toBeLessThan(started + 1_000);
      expect(viewsSettledAt).toBe(Number.POSITIVE_INFINITY);
      await vi.advanceTimersByTimeAsync(2_000);
      const views = await viewsPromise;
      const probe = await probePromise;

      // Fail closed: labelled local fallback, no live data, no quota burned.
      for (const view of views) {
        expect(view.source).toBe("local-fallback");
        expect(view.live).toBe(false);
        expect(view.cacheStatus).toBe("miss");
      }
      expect(probe.success).toBe(false);
      expect(probe.error).toMatch(/shared rate-limit\/cache coordinator/);
      expect(fleet.upstreamEvents()).toHaveLength(0);
      expect(
        fleet
          .kvCommandsNamed("INCR")
          .filter((command) => String(command[1]).startsWith("va:ref:budget:")),
      ).toHaveLength(0);
      expect(fleet.kv.get(budgetKey)).toBeNull();

      // Bounded cost: three exchanges × the 750 ms deadline (~2.25s), not the
      // store's 5 s response — every exchange was aborted at the deadline and
      // no retry or poll loop amplified the count.
      const loaderElapsed = viewsSettledAt - started;
      expect(loaderElapsed).toBeGreaterThanOrEqual(2_250);
      expect(loaderElapsed).toBeLessThan(3_000);
      // Four loader chains × three exchanges (cache read, lease claim, circuit
      // gate) plus the direct fetch's single gate exchange.
      expect(fleet.events.filter((event) => event.kind === "kv")).toHaveLength(13);
      expect(fleet.events.filter((event) => event.kind === "kv-abort")).toHaveLength(13);

      // Wave 2: the degradation persists — same bound, still fail-closed, and
      // nothing accumulates in the store or in process state.
      const secondStarted = Date.now();
      let secondSettledAt = Number.POSITIVE_INFINITY;
      const secondWave = Promise.all(
        instances.map((instance, index) =>
          instance.formsFinder.loadVaFormsFinder(`degraded-second-${index}`),
        ),
      ).then((secondViews) => {
        secondSettledAt = Date.now();
        return secondViews;
      });
      await vi.advanceTimersByTimeAsync(3_000);
      const secondResults = await secondWave;
      const secondElapsed = secondSettledAt - secondStarted;
      expect(secondElapsed).toBeGreaterThanOrEqual(2_250);
      expect(secondElapsed).toBeLessThan(3_000);
      expect(secondResults.every((view) => view.source === "local-fallback")).toBe(true);
      expect(fleet.events.filter((event) => event.kind === "kv-abort")).toHaveLength(28);
      expect(fleet.upstreamEvents()).toHaveLength(0);
      expect(fleet.kv.get(budgetKey)).toBeNull();
    },
    20_000,
  );
});

describe("VA fleet simulation — shared-store outage mid-storm", () => {
  boundedTest(
    "outage-fail-closed",
    "fails the fleet closed without burning or misreporting quota, then recovers",
    async () => {
      stubDistributedEnv();
      vi.useFakeTimers({ now: FIXED_NOW });
      let storeDown = false;
      const fleet = createFleetHarness({
        upstream: () => ({ status: 200, body: formsPayload() }),
        kvDown: () => storeDown,
      });

      const instanceCount = 20;
      const instances = await createFleet(instanceCount);
      const queryFor = (index: number) => `outage-query-${index}`;
      const budgetKey = `va:ref:budget:${Math.floor(FIXED_NOW / 60_000)}`;

      // Phase 1 — healthy storm: every request goes live and is accounted for.
      const warm = await Promise.all(
        instances.map((instance, index) => instance.formsFinder.loadVaFormsFinder(queryFor(index))),
      );
      expect(warm.every((view) => view.source === "va-sandbox-api" && view.cacheStatus === "miss")).toBe(true);
      expect(fleet.upstreamEvents()).toHaveLength(instanceCount);
      expect(Number(fleet.kv.get(budgetKey))).toBe(instanceCount);

      // Phase 2 — the shared store dies mid-storm; the same (warm) keys are read.
      storeDown = true;
      const outageStart = fleet.events.length;
      const outageReads = await Promise.all(
        instances.map((instance, index) => instance.formsFinder.loadVaFormsFinder(queryFor(index))),
      );
      expect(
        outageReads.every(
          (view) => view.source === "local-fallback" && view.live === false && view.cacheStatus === "miss",
        ),
      ).toBe(true);
      const outageProbe = await instances[0]!.sandbox.fetchVaForms("outage-direct-0");
      expect(outageProbe.success).toBe(false);
      expect(outageProbe.source).toBe("local-fallback");
      // The failure is reported as a coordination outage, not an upstream error.
      expect(outageProbe.error).toMatch(/shared rate-limit\/cache coordinator/);
      const outageEnd = fleet.events.length;

      const outageEvents = fleet.events.slice(outageStart, outageEnd);
      // The coordinator was consulted (gate read attempted) before failing closed.
      expect(outageEvents.some((event) => event.kind === "kv")).toBe(true);
      expect(
        outageEvents.some(
          (event) =>
            event.kind === "kv" &&
            event.command[0] === "GET" &&
            (event.command[1] === CIRCUIT_DEADLINE_KEY ||
              event.command[1] === CIRCUIT_MARKER_KEY),
        ),
      ).toBe(true);
      // No live traffic, no quota reservation, no cache writes during the outage.
      expect(outageEvents.filter((event) => event.kind === "upstream")).toHaveLength(0);
      expect(
        outageEvents.filter(
          (event) =>
            event.kind === "kv" &&
            event.command[0] === "INCR" &&
            String(event.command[1]).startsWith("va:ref:budget:"),
        ),
      ).toHaveLength(0);
      expect(
        outageEvents.filter(
          (event) =>
            event.kind === "kv" &&
            event.command[0] === "SET" &&
            String(event.command[1]).startsWith("va:ref:forms-finder:"),
        ),
      ).toHaveLength(0);
      expect(Number(fleet.kv.get(budgetKey))).toBe(instanceCount);
      expect(fleet.upstreamEvents()).toHaveLength(instanceCount);

      // Phase 3 — recovery: live traffic resumes and the quota counter still
      // matches the number of admitted attempts exactly.
      storeDown = false;
      const recovered = await Promise.all(
        instances.map((instance, index) =>
          instance.formsFinder.loadVaFormsFinder(`outage-query-recovered-${index}`),
        ),
      );
      expect(recovered.every((view) => view.source === "va-sandbox-api")).toBe(true);
      expect(fleet.upstreamEvents()).toHaveLength(instanceCount * 2);
      expect(Number(fleet.kv.get(budgetKey))).toBe(instanceCount * 2);
    },
    20_000,
  );
});

describe("VA fleet simulation — split-brain network partition", () => {
  boundedTest(
    "split-brain-fail-closed",
    "keeps the partitioned half fail-closed on stale values and honors the reachable half's invalidation after healing",
    async () => {
      stubDistributedEnv();
      vi.useFakeTimers({ now: FIXED_NOW });
      let upstreamTitle = "warm";
      let darkBlocked = false;
      const fleet = createFleetHarness({
        upstream: () => ({ status: 200, body: formsPayload(1, upstreamTitle) }),
        kvDown: (partition) => partition === "dark" && darkBlocked,
      });

      const half = 10;
      const lightQueries = Array.from({ length: half }, (_, i) => `split-light-${i}`);
      const darkQueries = Array.from({ length: half }, (_, i) => `split-dark-${i}`);
      const light = await createFleet(half);
      const dark = await createFleet(half);
      const budgetKey = `va:ref:budget:${Math.floor(FIXED_NOW / 60_000)}`;

      // Phase 1 — both halves warm their own keys through the shared tier.
      const [lightWarm, darkWarm] = await Promise.all([
        Promise.all(light.map((instance, i) => instance.formsFinder.loadVaFormsFinder(lightQueries[i]!))),
        Promise.all(dark.map((instance, i) => instance.formsFinder.loadVaFormsFinder(darkQueries[i]!))),
      ]);
      expect(
        lightWarm.every((view) => view.source === "va-sandbox-api" && view.items[0]?.title === "warm"),
      ).toBe(true);
      expect(darkWarm.every((view) => view.source === "va-sandbox-api" && view.items[0]?.title === "warm")).toBe(
        true,
      );
      expect(fleet.upstreamEvents()).toHaveLength(half * 2);
      expect(Number(fleet.kv.get(budgetKey))).toBe(half * 2);
      const darkStoreBefore = JSON.parse(String(fleet.kv.get(storedFormsKey(darkQueries[0]!)))) as {
        epoch: string;
      };
      expect(darkStoreBefore.epoch).toBe(VA_SHARED_CACHE_EPOCH_DEFAULT);

      // Phase 2 — the network splits: the dark half loses the store, while the
      // reachable half invalidates it and refetches fresh values.
      darkBlocked = true;
      upstreamTitle = "post-bump";
      await expect(fleet.asPartition("light", () => bumpVaSharedCacheEpoch())).resolves.toBe("1");
      const lightAfterBump = await Promise.all(
        light.map((instance, i) => instance.formsFinder.loadVaFormsFinder(lightQueries[i]!)),
      );
      expect(
        lightAfterBump.every((view) => view.cacheStatus === "miss" && view.items[0]?.title === "post-bump"),
      ).toBe(true);

      // The dark half cannot observe the invalidation, so it must not serve
      // its warm value — not through the loader, not even on a raw read.
      await expect(
        fleet.asPartition("dark", () => readVaSharedReferenceCache(formsKey(darkQueries[0]!))),
      ).resolves.toBeNull();
      const upstreamBeforeDarkOutage = fleet.upstreamEvents().length;
      const budgetBeforeDarkOutage = Number(fleet.kv.get(budgetKey));
      const darkOutage = await Promise.all(
        fleet.asPartition("dark", () =>
          dark.map((instance, i) => instance.formsFinder.loadVaFormsFinder(darkQueries[i]!)),
        ),
      );
      expect(
        darkOutage.every(
          (view) =>
            view.source === "local-fallback" &&
            view.live === false &&
            view.cacheStatus === "miss" &&
            view.items.every((item) => item.title !== "warm"),
        ),
      ).toBe(true);
      // No live fetch and no quota reservation from the partitioned half.
      expect(fleet.upstreamEvents()).toHaveLength(upstreamBeforeDarkOutage);
      expect(Number(fleet.kv.get(budgetKey))).toBe(budgetBeforeDarkOutage);

      // Phase 3 — the partition heals. The pre-bump bytes are still physically
      // in the store, so only the epoch check can reject them: every dark
      // instance must refetch the post-bump value instead of serving stale
      // warm data as live.
      darkBlocked = false;
      const darkHealed = await Promise.all(
        dark.map((instance, i) => instance.formsFinder.loadVaFormsFinder(darkQueries[i]!)),
      );
      expect(
        darkHealed.every(
          (view) =>
            view.source === "va-sandbox-api" &&
            view.live === true &&
            view.cacheStatus === "miss" &&
            view.items[0]?.title === "post-bump",
        ),
      ).toBe(true);
      expect(fleet.upstreamEvents()).toHaveLength(upstreamBeforeDarkOutage + half);
      expect(Number(fleet.kv.get(budgetKey))).toBe(budgetBeforeDarkOutage + half);
      expect(fleet.kv.get(storedFormsKey(darkQueries[0]!))).not.toBeNull();
      expect(
        fleet
          .kvCommandsNamed("DEL")
          .filter((command) => /^va:ref:forms-finder:/.test(String(command[1]))),
      ).toHaveLength(0);
      const darkStoreAfter = JSON.parse(String(fleet.kv.get(storedFormsKey(darkQueries[0]!)))) as { epoch: string };
      expect(darkStoreAfter.epoch).toBe("1");
      const rewarm = await dark[0]!.formsFinder.loadVaFormsFinder(darkQueries[0]!);
      expect(rewarm.cacheStatus).toBe("hit");
      expect(rewarm.items[0]?.title).toBe("post-bump");
      expect(fleet.upstreamEvents()).toHaveLength(upstreamBeforeDarkOutage + half);
    },
    20_000,
  );
});

describe("VA fleet simulation — epoch invalidation propagation", () => {
  boundedTest(
    "epoch-invalidation",
    "makes every warmed instance discard its shared value after a single epoch bump",
    async () => {
      stubDistributedEnv();
      vi.useFakeTimers({ now: FIXED_NOW });
      // Every upstream response after the bump is distinguishable from the
      // warmed values, so a served-stale cache value cannot masquerade as fresh.
      const fleet = createFleetHarness({
        upstream: () => ({ status: 200, body: formsPayload(1, "post-bump") }),
      });

      const instanceCount = 40;
      const queryFor = (index: number) => `epoch-query-${index}`;
      const instances = await createFleet(instanceCount);

      // Warm the shared tier through the application's own write path.
      for (let index = 0; index < instanceCount; index += 1) {
        await writeVaSharedReferenceCache(
          formsKey(queryFor(index)),
          warmFormsView(queryFor(index), "warm"),
        );
      }
      const sampleStored = JSON.parse(String(fleet.kv.get(storedFormsKey(queryFor(0))))) as {
        envelopeVersion: number;
        epoch: string;
      };
      expect(sampleStored.envelopeVersion).toBe(VA_SHARED_CACHE_ENVELOPE_VERSION);
      expect(sampleStored.epoch).toBe(VA_SHARED_CACHE_EPOCH_DEFAULT);

      // Control: the whole fleet is warm — served from the shared tier with no
      // upstream traffic and no consumer-budget quota spent.
      const warmReads = await Promise.all(
        instances.map((instance, index) => instance.formsFinder.loadVaFormsFinder(queryFor(index))),
      );
      expect(warmReads.every((view) => view.cacheStatus === "hit")).toBe(true);
      expect(warmReads.every((view) => view.items[0]?.title === "warm")).toBe(true);
      expect(fleet.upstreamEvents()).toHaveLength(0);

      // One atomic, store-wide bump invalidates every warmed value.
      await expect(bumpVaSharedCacheEpoch()).resolves.toBe("1");
      expect(
        fleet.kvCommandsNamed("INCR").filter((command) => command[1] === "va:ref:cache-epoch"),
      ).toHaveLength(1);

      // A version marker, not a delete sweep: the stale bytes are still in the
      // store, but no reader under the new epoch will accept them.
      expect(fleet.kv.get(storedFormsKey(queryFor(0)))).not.toBeNull();
      await expect(readVaSharedReferenceCache(formsKey(queryFor(0)))).resolves.toBeNull();
      expect(
        fleet
          .kvCommandsNamed("DEL")
          .filter((command) => /^va:ref:forms-finder:/.test(String(command[1]))),
      ).toHaveLength(0);

      // Every instance must discard its stale value and refetch; all 40
      // distinct queries hit the upstream again and get the new payload.
      const afterBump = await Promise.all(
        instances.map((instance, index) => instance.formsFinder.loadVaFormsFinder(queryFor(index))),
      );
      expect(afterBump.every((view) => view.cacheStatus === "miss")).toBe(true);
      expect(afterBump.every((view) => view.items[0]?.title === "post-bump")).toBe(true);
      expect(fleet.upstreamEvents()).toHaveLength(instanceCount);
      expect(new Set(fleet.upstreamEvents().map((event) => event.url)).size).toBe(instanceCount);

      // The rewritten values are stamped with the new epoch, so the fleet is
      // warm again under it.
      const rewritten = JSON.parse(String(fleet.kv.get(storedFormsKey(queryFor(0))))) as {
        epoch: string;
      };
      expect(rewritten.epoch).toBe("1");
      const rewarm = await instances[0]!.formsFinder.loadVaFormsFinder(queryFor(0));
      expect(rewarm.cacheStatus).toBe("hit");
      expect(rewarm.items[0]?.title).toBe("post-bump");
      expect(fleet.upstreamEvents()).toHaveLength(instanceCount);
    },
    20_000,
  );
});

describe("VA fleet simulation — per-scenario wall-clock bounds", () => {
  it("exercises every committed per-scenario bound", () => {
    // A scenario that is renamed or dropped without its bound being removed
    // would leave an unexercised budget behind — fail instead of drifting.
    expect([...observedScenarios].sort()).toEqual([...FLEET_SCENARIO_KEYS].sort());
  });

  it("fails a body that overruns its bound instead of passing silently", async () => {
    await expect(
      enforceScenarioBudget(
        "self-check",
        5,
        () => new Promise((resolve) => setTimeout(resolve, 25)),
      ),
    ).rejects.toThrow(/self-check took \d+ ms of wall clock, past its 5 ms per-scenario bound/);
    await expect(enforceScenarioBudget("self-check", 1_000, async () => "ok")).resolves.toBe("ok");
  });
});
