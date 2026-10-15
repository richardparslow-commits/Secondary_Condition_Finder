import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyVaConsumerPacingGuidance,
  reserveVaSharedConsumerSlot,
  vaSharedConsumerBudgetScope,
  VA_SHARED_CONSUMER_BUDGET_VARIABLE,
  VA_SHARED_CONSUMER_MAX_REQUESTS,
  VA_SHARED_CONSUMER_WINDOW_MS,
} from "@/lib/va/reference-shared-cache";
import {
  clearVaConsumerBudgetPressureForTests,
  readVaConsumerBudgetPressure,
  VA_SHARED_CONSUMER_REFUSAL_REASONS,
} from "@/lib/va/consumer-budget-pressure";
import { runtimeCapabilities } from "@/lib/runtime-capabilities";

import { createFakeSharedKv } from "./helpers/fake-shared-kv";

/**
 * Pressure reporting for the shared VA consumer budget (audit A03).
 *
 * The budget bounds the fleet's upstream traffic, but a refusal used to be
 * invisible: an instance that had refused a hundred attempts looked exactly like
 * an idle one from `/api/health`, and the operator's first evidence of throttling
 * was VA answering `429`. These tests hold the report to the decision:
 *
 *   - every refusal path of the real `reserveVaSharedConsumerSlot` is driven and
 *     its reason is counted, so the vocabulary cannot silently drop a branch;
 *   - the counts are asserted to sum to the decisions made, so the report cannot
 *     drift from the code that decides;
 *   - the reader's windowed figure is pinned in both directions (current, and no
 *     longer current), because "is it throttling *now*" is the whole point;
 *   - the upstream's own pacing charge is counted separately from a refused
 *     charge, since one says the fleet is short and the other says the store
 *     would not take the correction;
 *   - `/api/health` renders all of it as `components.vaConsumerBudget`, with the
 *     budget's own bounds, the gate that decides whether it is enforced at all,
 *     and no store coordinates.
 */

const KV_URL = "https://synthetic-kv.invalid";
const KV_TOKEN = "synthetic-token-not-a-credential";
const BUDGET_PREFIX = "va:ref:budget:";

const env = {
  VA_REFERENCE_SHARED_CACHE_URL: KV_URL,
  VA_REFERENCE_SHARED_CACHE_TOKEN: KV_TOKEN,
  VA_REFERENCE_SHARED_CACHE_PREFIX: "va:ref:",
};

const BUCKET = 17;
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

function pressure(now = WINDOW_BASE) {
  return readVaConsumerBudgetPressure({ windowMs: VA_SHARED_CONSUMER_WINDOW_MS, now });
}

beforeEach(() => {
  clearVaConsumerBudgetPressureForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearVaConsumerBudgetPressureForTests();
});

describe("the report is written by the decision", () => {
  it("counts every refusal the reservation can make, under one reason each", async () => {
    // exhausted — a full window plus one more attempt.
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      await reserveVaSharedConsumerSlot(env, WINDOW_BASE);
    }
    await reserveVaSharedConsumerSlot(env, WINDOW_BASE);
    expect(pressure().refusals.exhausted).toBe(1);

    // superseded-window — a straggler whose window the store has moved past. The
    // next window's counter exists (the attempt against it was itself refused by
    // the carry), which is all the fence needs to see.
    await reserveVaSharedConsumerSlot(env, WINDOW_BASE + VA_SHARED_CONSUMER_WINDOW_MS);
    expect(await reserveVaSharedConsumerSlot(env, WINDOW_BASE)).toBe(false);
    expect(pressure().refusals["superseded-window"]).toBe(1);

    // predecessor-invalid — a corrupted counter cannot become arithmetic fuel.
    const corrupted = createFakeSharedKv();
    routeFetchTo(corrupted);
    corrupted.seed(budgetKey(BUCKET), "not-a-counter", 600_000);
    expect(await reserveVaSharedConsumerSlot(env, WINDOW_BASE + VA_SHARED_CONSUMER_WINDOW_MS)).toBe(
      false,
    );
    expect(pressure().refusals["predecessor-invalid"]).toBe(1);

    // unreadable-decision — a store that answers a code nobody defined.
    stubCommandReplies(() => ({ result: 9 }));
    expect(await reserveVaSharedConsumerSlot(env, WINDOW_BASE)).toBe(false);
    expect(pressure().refusals["unreadable-decision"]).toBe(1);

    // store-unconfigured — no coordinator at all.
    expect(await reserveVaSharedConsumerSlot({}, WINDOW_BASE)).toBe(false);
    expect(pressure().refusals["store-unconfigured"]).toBe(1);

    // store-unreachable — a coordinator that is configured but does not answer.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    expect(await reserveVaSharedConsumerSlot(env, WINDOW_BASE)).toBe(false);
    expect(pressure().refusals["store-unreachable"]).toBe(1);

    // clock-unusable — an instant no window can hold. Counted, because it is a
    // refusal of an upstream attempt like any other.
    vi.stubGlobal("fetch", vi.fn());
    expect(await reserveVaSharedConsumerSlot(env, Number.NaN)).toBe(false);
    expect(pressure().refusals["clock-unusable"]).toBe(1);

    // Every refusal is attributed, and the two counters are exactly the decisions
    // made: the 60 reservations the window admitted, and the 8 attempts refused
    // across the seven branches above.
    const snapshot = pressure(WINDOW_BASE + 1);
    expect(snapshot.admitted).toBe(VA_SHARED_CONSUMER_MAX_REQUESTS);
    expect(snapshot.refused).toBe(8);
    expect(snapshot.admitted + snapshot.refused).toBe(68);
    expect(snapshot.refusals.exhausted).toBe(2);
    expect(snapshot.refusals["counter-lifetime-refused"]).toBe(0);
    const attributed = VA_SHARED_CONSUMER_REFUSAL_REASONS.reduce(
      (total, reason) => total + snapshot.refusals[reason],
      0,
    );
    expect(attributed).toBe(snapshot.refused);
  });

  it("has a reason for every refusal the reservation can return, and no orphan reasons", () => {
    // The vocabulary is derived from the code rather than restated, so a new
    // refusal path cannot be added without a reason the report can carry.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/va/reference-shared-cache.ts"),
      "utf8",
    );
    const literals = [...source.matchAll(/decide\("([^"]+)"\)/g)].map((match) => match[1]);

    expect(new Set(literals)).toEqual(
      new Set(["admitted", ...VA_SHARED_CONSUMER_REFUSAL_REASONS]),
    );
  });

  it("reports a windowed reading that stops being current, while the total does not", () => {
    // Two refusals in one window, from a different instance's perspective: the
    // reader places them by the instant it is asked about.
    const window = WINDOW_BASE;
    for (let index = 0; index < 2; index += 1) {
      reserveVaSharedConsumerSlot({}, window); // store-unconfigured, no traffic
    }

    expect(pressure(window).refusedInLastWindow).toBe(2);
    // The predecessor window still overlaps the rolling rule at the next window's
    // start, so the refusals are still "now".
    expect(pressure(window + VA_SHARED_CONSUMER_WINDOW_MS).refusedInLastWindow).toBe(2);
    // Two windows later they are history: the total stands, the current reading is
    // zero, and the timestamps say why.
    const later = pressure(window + 2 * VA_SHARED_CONSUMER_WINDOW_MS);
    expect(later.refusedInLastWindow).toBe(0);
    expect(later.refused).toBe(2);
    expect(later.lastRefusalAt).not.toBeNull();
    expect(later.lastRefusalReason).toBe("store-unconfigured");
  });

  it("starts at zero and says so, rather than reporting a cold reading as throttling", () => {
    const snapshot = pressure();

    expect(snapshot.scope).toBe("per-instance");
    expect(snapshot.since).toBeNull();
    expect(snapshot.admitted).toBe(0);
    expect(snapshot.refused).toBe(0);
    expect(snapshot.refusedInLastWindow).toBe(0);
    expect(snapshot.lastRefusalAt).toBeNull();
    expect(snapshot.lastRefusalReason).toBeNull();
    expect(snapshot.detail).toMatch(/no reservation has been decided/);
    // Structurally zero, not "an instance that happened to be idle": every reason
    // is present so the absence is readable.
    for (const reason of VA_SHARED_CONSUMER_REFUSAL_REASONS) {
      expect(snapshot.refusals[reason]).toBe(0);
    }
  });
});

describe("the upstream's own pacing is reported beside it", () => {
  it("counts a charge the guidance justified, and the reservations it added", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    const outcome = await applyVaConsumerPacingGuidance(
      new Headers([["X-RateLimit-Remaining", "10"]]),
      env,
      WINDOW_BASE,
    );

    expect(outcome).toMatchObject({ applied: true, reason: "quota-deficit" });
    const snapshot = pressure();
    expect(snapshot.pacing.charges).toBe(1);
    expect(snapshot.pacing.chargedReservations).toBe(VA_SHARED_CONSUMER_MAX_REQUESTS - 10);
    expect(snapshot.pacing.refusedCharges).toBe(0);
    expect(snapshot.pacing.lastChargedAt).not.toBeNull();
    // The earliest warning is not a refusal: the upstream said the quota is short
    // before the fleet's own window would have refused anything.
    expect(snapshot.refused).toBe(0);
  });

  it("counts a charge the store refused without counting it as refused traffic", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    kv.failCommand("INCRBY", "ERR synthetic charge failure");

    const outcome = await applyVaConsumerPacingGuidance(
      new Headers([["X-RateLimit-Remaining", "0"]]),
      env,
      WINDOW_BASE,
    );

    expect(outcome).toMatchObject({ applied: false, reason: "charge-refused" });
    const snapshot = pressure();
    expect(snapshot.pacing.refusedCharges).toBe(1);
    expect(snapshot.pacing.charges).toBe(0);
    // The response that carried the guidance was still served: this is a charge
    // that did not land, not a request that was refused.
    expect(snapshot.refused).toBe(0);
    expect(snapshot.admitted).toBe(0);
  });

  it("does not count guidance that asked for nothing", async () => {
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    expect(
      await applyVaConsumerPacingGuidance(new Headers(), env, WINDOW_BASE),
    ).toMatchObject({ applied: false, reason: "no-guidance" });
    expect(
      await applyVaConsumerPacingGuidance(
        new Headers([["X-RateLimit-Remaining", String(VA_SHARED_CONSUMER_MAX_REQUESTS)]]),
        env,
        WINDOW_BASE,
      ),
    ).toMatchObject({ applied: false, reason: "headroom-ample" });

    const snapshot = pressure();
    expect(snapshot.pacing.charges).toBe(0);
    expect(snapshot.pacing.refusedCharges).toBe(0);
  });
});

describe("the gate the scope reports is the gate the reservation consults", () => {
  it("reports an unenforced budget exactly where every attempt is refused", async () => {
    const unenforced = vaSharedConsumerBudgetScope({ NODE_ENV: "production" });

    expect(unenforced).toMatchObject({
      scope: "unenforced",
      full: false,
      configured: false,
      optIn: false,
      blockedBy: "no-shared-budget-opt-in",
    });
    expect(unenforced.detail).toContain(`${VA_SHARED_CONSUMER_BUDGET_VARIABLE}=true`);

    // The same env in the same state: no reservation can succeed there, which is
    // why the scope must not read as "an idle fleet".
    await expect(
      reserveVaSharedConsumerSlot({ NODE_ENV: "production" }, WINDOW_BASE),
    ).resolves.toBe(false);
  });

  it("separates a missing opt-in from a missing coordinator", () => {
    const noCoordinator = vaSharedConsumerBudgetScope({
      NODE_ENV: "production",
      [VA_SHARED_CONSUMER_BUDGET_VARIABLE]: "true",
    });

    expect(noCoordinator).toMatchObject({
      scope: "unenforced",
      full: false,
      configured: false,
      optIn: true,
      blockedBy: "no-shared-coordinator-configured",
    });

    const enforced = vaSharedConsumerBudgetScope({
      NODE_ENV: "production",
      [VA_SHARED_CONSUMER_BUDGET_VARIABLE]: "true",
      ...env,
    });

    expect(enforced).toMatchObject({
      scope: "fleet-shared",
      full: true,
      configured: true,
      optIn: true,
      blockedBy: null,
    });
    expect(enforced.detail).toContain(String(VA_SHARED_CONSUMER_MAX_REQUESTS));
  });

  it("reads a single process as not requiring a shared budget at all", () => {
    const scope = vaSharedConsumerBudgetScope({ NODE_ENV: "test" });

    expect(scope).toMatchObject({
      scope: "not-required",
      full: true,
      blockedBy: null,
    });
    expect(scope.detail).toMatch(/whole fleet/);
  });

  it("is the one capability that can be at full strength while distributed", () => {
    const distributed = runtimeCapabilities({ NODE_ENV: "production" });

    // Without the coordinator, the budget joins the other controls as reduced —
    // and the summary counts five, not four.
    expect(distributed.capabilities.vaConsumerBudget.full).toBe(false);
    expect(distributed.summary.scopes.vaConsumerBudget).toBe("unenforced");
    expect([...distributed.summary.reduced].sort()).toEqual([
      "circuitBreaker",
      "rateLimit",
      "vaConsumerBudget",
      "vaLiveIntegration",
      "vaReferenceCache",
    ]);
    expect(distributed.summary.detail).toMatch(/5 of 5/);

    // With it, the shared window *is* the fleet-wide form of the budget, so it is
    // at full strength while every process-local control around it is not.
    const enforced = runtimeCapabilities({
      NODE_ENV: "production",
      [VA_SHARED_CONSUMER_BUDGET_VARIABLE]: "true",
      ...env,
    });

    expect(enforced.capabilities.vaConsumerBudget.full).toBe(true);
    expect(enforced.summary.scopes.vaConsumerBudget).toBe("fleet-shared");
    expect([...enforced.summary.reduced].sort()).toEqual([
      "circuitBreaker",
      "rateLimit",
      "vaLiveIntegration",
      "vaReferenceCache",
    ]);
    expect(enforced.summary.detail).toMatch(/4 of 5/);
    // The four process-local controls keep the invariant the module asserts.
    for (const id of ["vaLiveIntegration", "vaReferenceCache", "rateLimit", "circuitBreaker"] as const) {
      expect(enforced.capabilities[id].full, id).toBe(false);
    }
  });
});

describe("GET /api/health reports the pressure", () => {
  const stubEnforcedBudget = () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_URL);
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", KV_TOKEN);
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_PREFIX", "va:ref:");
    vi.stubEnv(VA_SHARED_CONSUMER_BUDGET_VARIABLE, "true");
  };

  it("shows the fleet being throttled before VA answers 429", async () => {
    stubEnforcedBudget();
    const kv = createFakeSharedKv();
    routeFetchTo(kv);

    const { GET } = await import("@/app/api/health/route");

    // A quiet fleet: nothing refused, and the reading says so without implying
    // anything about the fleet's headroom.
    const idle = (await (await GET()).json()).components.vaConsumerBudget;
    expect(idle.scope).toBe("fleet-shared");
    expect(idle.pressure.refused).toBe(0);
    expect(idle.pressure.detail).toMatch(/no reservation has been decided/);

    // Fill one window, then keep trying: the refusals are the throttling, and
    // they are readable here with no upstream 429 anywhere in the picture.
    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      await reserveVaSharedConsumerSlot(env, WINDOW_BASE);
    }
    for (let index = 0; index < 3; index += 1) {
      await reserveVaSharedConsumerSlot(env, WINDOW_BASE);
    }

    const throttled = (await (await GET()).json()).components.vaConsumerBudget;
    expect(throttled.pressure.refused).toBe(3);
    expect(throttled.pressure.refusals.exhausted).toBe(3);
    expect(throttled.pressure.lastRefusalReason).toBe("exhausted");
    expect(throttled.pressure.lastRefusalAt).not.toBeNull();
    expect(throttled.pressure.detail).toMatch(/3 of 63 reservation decisions/);
    // The reading is per instance and says so: two instances do not add up to a
    // fleet total on their own, but a non-zero count is true of the fleet.
    expect(throttled.pressure.scope).toBe("per-instance");
  });

  it("carries the budget's own bounds and the gate, and disagrees with nothing", async () => {
    stubEnforcedBudget();
    // A production run is 503 unless the workflow-session marker is usable, so it
    // is configured here to prove the new component leaves overall health alone.
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "health-probe-secret-long-enough-for-production");
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.components.vaConsumerBudget).toMatchObject({
      status: "ok",
      latencyMs: 0,
      scope: "fleet-shared",
      budget: {
        maxRequests: VA_SHARED_CONSUMER_MAX_REQUESTS,
        windowMs: VA_SHARED_CONSUMER_WINDOW_MS,
        optIn: true,
        variable: VA_SHARED_CONSUMER_BUDGET_VARIABLE,
      },
      store: { mode: "shared-coordinator", distributed: true, blockedBy: null },
    });
    // The component's regime and the aggregate's are the same report.
    expect(body.components.vaConsumerBudget.scope).toBe(
      body.components.runtime.capabilities.vaConsumerBudget,
    );
    expect(body.components.runtime.reduced).not.toContain("vaConsumerBudget");
    // An unenforced budget is reported, not hidden, and it is still `ok`: live VA
    // access falls back to local reference data rather than taking health down.
    const report = runtimeCapabilities({ NODE_ENV: "production" }).capabilities.vaConsumerBudget;
    expect(report.scope).toBe("unenforced");
  });

  it("keeps store coordinates out of the body", async () => {
    stubEnforcedBudget();
    const kv = createFakeSharedKv();
    routeFetchTo(kv);
    await reserveVaSharedConsumerSlot(env, WINDOW_BASE);
    await reserveVaSharedConsumerSlot({}, WINDOW_BASE);

    const { GET } = await import("@/app/api/health/route");
    const serialized = JSON.stringify(await (await GET()).json());

    expect(serialized).not.toContain(KV_URL);
    expect(serialized).not.toContain(KV_TOKEN);
    // No counter key material either, in case a future field is tempted to name
    // the window it counted.
    expect(serialized).not.toContain(BUDGET_PREFIX);
  });
});
