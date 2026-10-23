import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  deriveBudgetMs,
  formatState,
  formatTightestPath,
  loadRatchetState,
  parseOverride,
  readScenarioReport,
  recordObservation,
  resolveBudget,
  resolveEnvironment,
  selectTightestScenario,
  validateRatchetState,
} from "../scripts/run-fleet-simulation.mjs";
import {
  FLEET_SCENARIO_BUDGETS_MS,
  FLEET_SCENARIO_KEYS,
  FLEET_SCENARIO_NEAR_LIMIT_RATIO,
  formatScenarioBudgetLine,
  scenarioBudgetFailure,
} from "./helpers/fleet-scenario-budgets";

/**
 * Contracts for scripts/run-fleet-simulation.mjs, the wall-clock budget around
 * the VA fleet simulation gate.
 *
 * The simulation asserts distributed coordination invariants that are also
 * latency properties: a regression can keep every assertion passing while
 * turning bounded waits into unbounded ones. The wrapper gives the gate an
 * explicit budget so such a regression fails the build — but a constant budget
 * is not a gate on drift, because it tolerates any slowdown below the constant
 * and only changes when someone remembers to lower it.
 *
 * These tests pin the ratchet that replaces the constant:
 *
 * 1. the budget is derived from committed measurements, clamped to a floor and
 *    a hard ceiling;
 * 2. the recorded cap can only ever move down, so no run can loosen the gate;
 * 3. state that has been loosened above the ceiling, or that cannot be read,
 *    fails the gate instead of running unbudgeted;
 * 4. the real suite still passes inside the ratcheted budget, and an overrun
 *    still dies with the timeout exit code.
 *
 * The policy literals (ceiling, floor, factor, window) are asserted here so a
 * change to the ratchet's tightness is an explicit, reviewable edit rather
 * than a quiet one.
 */

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "run-fleet-simulation.mjs");
const STATE_PATH = path.join(ROOT, ".github", "fleet-budget-ratchet.json");
const SUITE = "tests/va-fleet-simulation.test.ts";

// The nested vitest run inherits the parent's color settings, so assertions
// match against an ANSI-free copy of the output.
const ANSI_ESCAPE = /\u001B\[[0-9;]*m/g;

const PINNED_CEILING_MS = 60_000;
const PINNED_FLOOR_MS = 5000;
const PINNED_TIGHTEN_FACTOR = 4;
const PINNED_WINDOW_SIZE = 5;

function readState(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as Record<string, unknown>;
}

type RatchetState = Parameters<typeof deriveBudgetMs>[0];

/** Write a state file to a temp dir and return its path (tests never mutate the committed one). */
function writeTempState(state: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-ratchet-"));
  const file = path.join(dir, "fleet-budget-ratchet.json");
  fs.writeFileSync(file, JSON.stringify(state), "utf8");
  return file;
}

function runFleetGate(env: Record<string, string> = {}, args: string[] = []) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    // Pin the ratified `local` window. These assertions read the committed
    // local budget, but the child process inherits the ambient environment —
    // on CI, `CI=true` would resolve an unratified "ci" window and the gate
    // would refuse to run before the suite could start. Explicit per-test
    // environment names below still override this default.
    env: { ...process.env, FLEET_GATE_ENV: "local", ...env },
  });
  return {
    status: result.status ?? -1,
    stdout: (result.stdout ?? "").replace(ANSI_ESCAPE, ""),
    stderr: (result.stderr ?? "").replace(ANSI_ESCAPE, ""),
  };
}

describe("fleet-simulation CI gate wiring", () => {
  it("is registered as the npm test:fleet entry point", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["test:fleet"]).toBe("node scripts/run-fleet-simulation.mjs");
  });
});

describe("fleet budget ratchet policy", () => {
  it("pins the committed policy literals so the gate cannot be loosened quietly", () => {
    const state = readState();

    expect(state.schemaVersion).toBe(1);
    expect(state.suitePath).toBe(SUITE);
    expect(state.ceilingMs).toBe(PINNED_CEILING_MS);
    expect(state.floorMs).toBe(PINNED_FLOOR_MS);
    expect(state.tightenFactor).toBe(PINNED_TIGHTEN_FACTOR);
    expect(state.windowSize).toBe(PINNED_WINDOW_SIZE);
    expect(validateRatchetState(state)).toEqual({ ok: true });
  });

  it("caps every committed environment at the hard ceiling", () => {
    const state = readState() as {
      ceilingMs: number;
      environments: Record<string, { maxBudgetMs: number }>;
    };
    expect(Object.keys(state.environments).length).toBeGreaterThan(0);
    for (const [name, entry] of Object.entries(state.environments)) {
      expect(entry.maxBudgetMs, `${name} exceeds the hard ceiling`).toBeLessThanOrEqual(state.ceilingMs);
    }
  });

  it("keeps the committed local budget far below the old fixed ceiling", () => {
    // The ratchet only means something if it is actually tighter than the
    // constant it replaced. The measured suite runs in about a second, so the
    // local cap is at the floor; a 60 s budget would tolerate a 60x regression.
    const state = readState();
    const local = (state as { environments: Record<string, { maxBudgetMs: number }> }).environments.local;
    expect(local?.maxBudgetMs).toBeDefined();
    expect(local!.maxBudgetMs).toBe(PINNED_FLOOR_MS);
    expect(local!.maxBudgetMs).toBeLessThan(PINNED_CEILING_MS / 10);
  });

  it("derives the budget from the slowest recent measurement times the factor", () => {
    const state: RatchetState = {
      schemaVersion: 1,
      suitePath: SUITE,
      ceilingMs: PINNED_CEILING_MS,
      floorMs: 1000,
      tightenFactor: PINNED_TIGHTEN_FACTOR,
      windowSize: PINNED_WINDOW_SIZE,
      environments: {
        local: { maxBudgetMs: PINNED_CEILING_MS, observations: [{ ms: 1000, at: "2026-10-03" }] },
      },
    };

    expect(deriveBudgetMs(state, "local")).toBe(4000);
    // The derivation takes the SLOWEST measurement in the window, so one slow
    // run cannot be averaged away by faster ones (clamped to the ceiling)...
    const noisy: RatchetState = {
      ...state,
      environments: {
        local: { maxBudgetMs: PINNED_CEILING_MS, observations: [{ ms: 1000, at: "x" }, { ms: 50_000, at: "x" }] },
      },
    };
    expect(deriveBudgetMs(noisy, "local")).toBe(PINNED_CEILING_MS);
    // ...and never tightens below the floor.
    const fast: RatchetState = {
      ...state,
      environments: { local: { maxBudgetMs: PINNED_CEILING_MS, observations: [{ ms: 10, at: "x" }] } },
    };
    expect(deriveBudgetMs(fast, "local")).toBe(1000);
  });

  it("budgets an environment with no evidence at the hard ceiling, never tighter", () => {
    const state = readState() as RatchetState;
    // No evidence, no tightening: the derivation reports "none" and the
    // unlisted environment falls back to the ratified cap (the hard ceiling).
    expect(deriveBudgetMs(state, "a-machine-class-never-seen-before")).toBeNull();
    expect(resolveBudget(state, "a-machine-class-never-seen-before").ms).toBe(PINNED_CEILING_MS);
  });

  it("records a measurement without ever raising the cap", () => {
    const base: RatchetState = {
      schemaVersion: 1,
      suitePath: SUITE,
      ceilingMs: PINNED_CEILING_MS,
      floorMs: PINNED_FLOOR_MS,
      tightenFactor: PINNED_TIGHTEN_FACTOR,
      windowSize: PINNED_WINDOW_SIZE,
      environments: {
        local: { maxBudgetMs: 40_000, observations: [{ ms: 10_000, at: "2026-10-01" }] },
      },
    };

    // One fast run cannot tighten past the slowest measurement still in the
    // window: the cap stays where it was, so a single lucky run is not evidence
    // that the suite got faster.
    const once = recordObservation(base, "local", 1000, "2026-10-03");
    expect(once.maxBudgetMs).toBe(40_000);
    expect(once.previousCapMs).toBe(40_000);

    // Once the slow observation ages out of the window, the cap ratchets down
    // to the derived value — 1 s x 4 = 4 s, clamped up to the 5 s floor.
    let state = base;
    for (let i = 0; i < PINNED_WINDOW_SIZE; i++) {
      state = recordObservation(state, "local", 1000, `2026-10-0${(i % 9) + 1}`).state;
    }
    const tightened = state as { environments: Record<string, { maxBudgetMs: number; observations: unknown[] }> };
    expect(tightened.environments.local.maxBudgetMs).toBe(PINNED_FLOOR_MS);
    expect(tightened.environments.local.observations).toHaveLength(PINNED_WINDOW_SIZE);

    // A slow run cannot loosen it: the cap is already the tighter of the two.
    const slow = recordObservation(state, "local", 20_000, "2026-10-04");
    expect(slow.maxBudgetMs).toBe(PINNED_FLOOR_MS);
    expect(validateRatchetState(slow.state)).toEqual({ ok: true });
  });

  it("round-trips state through formatState without losing the policy", () => {
    const state = readState() as RatchetState;
    expect(JSON.parse(formatState(state))).toEqual(state);
  });

  it("resolves the enforced budget as the tighter of cap and evidence", () => {
    const state: RatchetState = {
      schemaVersion: 1,
      suitePath: SUITE,
      ceilingMs: PINNED_CEILING_MS,
      floorMs: PINNED_FLOOR_MS,
      tightenFactor: PINNED_TIGHTEN_FACTOR,
      windowSize: PINNED_WINDOW_SIZE,
      environments: {
        local: { maxBudgetMs: 12_000, observations: [{ ms: 5000, at: "2026-10-03" }] },
      },
    };

    // Evidence (20 s) is looser than the ratified cap, so the cap wins.
    expect(resolveBudget(state, "local").ms).toBe(12_000);
    // A tighter cap from an earlier ratification also wins over fresh evidence.
    const ratified: RatchetState = {
      ...state,
      environments: { local: { maxBudgetMs: 8000, observations: [{ ms: 5000, at: "2026-10-03" }] } },
    };
    expect(resolveBudget(ratified, "local").ms).toBe(8000);
    // The override bypasses the ratchet but is labelled as such.
    const overridden = resolveBudget(state, "local", 120_000);
    expect(overridden.ms).toBe(120_000);
    expect(overridden.source).toBe("operator-override");
  });

  it("separates CI and local measurement windows", () => {
    expect(resolveEnvironment({})).toBe("local");
    expect(resolveEnvironment({ CI: "true" })).toBe("ci");
    expect(resolveEnvironment({ CI: "true", FLEET_GATE_ENV: " local-arm64 " })).toBe("local-arm64");
  });

  it("accepts only positive overrides", () => {
    expect(parseOverride(undefined)).toEqual({ ok: true, ms: null });
    expect(parseOverride("")).toEqual({ ok: true, ms: null });
    expect(parseOverride("1500")).toEqual({ ok: true, ms: 1500 });
    expect(parseOverride("0").ok).toBe(false);
    expect(parseOverride("-5").ok).toBe(false);
    expect(parseOverride("soon").ok).toBe(false);
  });
});

describe("fleet per-scenario report and PASS summary", () => {
  it("names the scenario closest to its bound by ratio, not by absolute time", () => {
    const tightest = selectTightestScenario([
      // 900 ms of 3,000 is 30%; 700 ms of 1,000 is 70% and is the one to surface.
      { scenario: "budget-reserve-storm", elapsedMs: 900, budgetMs: 3_000, nearLimit: false },
      { scenario: "probe-admission", elapsedMs: 700, budgetMs: 1_000, nearLimit: true },
      { scenario: "single-flight-wait", elapsedMs: 100, budgetMs: 2_500, nearLimit: false },
    ]);

    expect(tightest?.scenario).toBe("probe-admission");
    expect(formatTightestPath(tightest)).toBe(
      "tightest path: probe-admission at 700 ms / 1000 ms (70.0% of bound — NEAR LIMIT)",
    );
  });

  it("has no tightest path when nothing was measured", () => {
    expect(selectTightestScenario([])).toBeNull();
    expect(selectTightestScenario(undefined)).toBeNull();
  });

  it("treats an unreadable or malformed report as a failure, never as an empty pass", () => {
    const missing = readScenarioReport(
      path.join(os.tmpdir(), `no-such-fleet-report-${process.pid}.jsonl`),
    );
    expect(missing.ok).toBe(false);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-report-"));
    const file = path.join(directory, "report.jsonl");

    fs.writeFileSync(file, "{ not json\n", "utf8");
    expect(readScenarioReport(file).ok).toBe(false);

    // A line without a bound is not a measurement.
    fs.writeFileSync(file, `${JSON.stringify({ scenario: "probe-admission" })}\n`, "utf8");
    expect(readScenarioReport(file).ok).toBe(false);

    fs.writeFileSync(
      file,
      `${JSON.stringify({ scenario: "probe-admission", elapsedMs: 10, budgetMs: 1000, nearLimit: false })}\n`,
      "utf8",
    );
    expect(readScenarioReport(file)).toMatchObject({
      ok: true,
      measurements: [{ scenario: "probe-admission", elapsedMs: 10, budgetMs: 1000 }],
    });
  });

  it("reports every bounded scenario to the gate, and no synthetic self-check", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-report-run-"));
    const report = path.join(directory, "report.jsonl");

    const result = runFleetGate({ FLEET_SCENARIO_REPORT_PATH: report });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tightest path:");
    const reported = fs
      .readFileSync(report, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as { scenario: string; budgetMs: number });
    // The suite's self-checks deliberately overrun 5 ms budgets to prove the
    // enforcement path; they must never compete for "closest to its bound".
    expect(reported.map((entry) => entry.scenario).sort()).toEqual([...FLEET_SCENARIO_KEYS].sort());
    for (const entry of reported) {
      expect(entry.budgetMs, entry.scenario).toBe(
        FLEET_SCENARIO_BUDGETS_MS[entry.scenario as keyof typeof FLEET_SCENARIO_BUDGETS_MS],
      );
    }
  }, 60_000);

  it("fails the gate when the suite passes but reports no scenario measurements", () => {
    // A directory that does not exist makes every report write fail, which is
    // the same state as a writer regression: the suite itself still passes.
    const unwritable = path.join(os.tmpdir(), `no-such-fleet-dir-${process.pid}`, "report.jsonl");

    const result = runFleetGate({ FLEET_SCENARIO_REPORT_PATH: unwritable });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("per-scenario measurements could not be read");
    expect(result.stderr).toContain("tightest path is not the evidence this gate claims");
    expect(result.stdout).not.toContain("[fleet-gate] PASS");
  }, 60_000);
});

describe("fleet budget ratchet state validation", () => {
  const valid: RatchetState = {
    schemaVersion: 1,
    suitePath: SUITE,
    ceilingMs: PINNED_CEILING_MS,
    floorMs: PINNED_FLOOR_MS,
    tightenFactor: PINNED_TIGHTEN_FACTOR,
    windowSize: PINNED_WINDOW_SIZE,
    environments: { local: { maxBudgetMs: 20_000, observations: [{ ms: 3000, at: "2026-10-03" }] } },
  };

  it("accepts the committed shape", () => {
    expect(validateRatchetState(valid)).toEqual({ ok: true });
  });

  it("rejects an environment whose cap was loosened above the ceiling", () => {
    const loosened: RatchetState = {
      ...valid,
      environments: { local: { maxBudgetMs: PINNED_CEILING_MS + 1, observations: [] } },
    };
    const result = validateRatchetState(loosened);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("may not be loosened");
  });

  it("rejects a missing ratchet state instead of running unbudgeted", () => {
    const result = loadRatchetState(path.join(os.tmpdir(), "fleet-ratchet-does-not-exist.json"));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("cannot read the ratchet state");
  });

  it("rejects malformed policy fields and observations", () => {
    for (const mutation of [
      { ...valid, schemaVersion: 2 },
      { ...valid, suitePath: "tests/other.test.ts" },
      { ...valid, ceilingMs: 0 },
      { ...valid, floorMs: PINNED_CEILING_MS + 1 },
      { ...valid, tightenFactor: 0.5 },
      { ...valid, windowSize: 2.5 },
      { ...valid, environments: {} as Record<string, never>, },
      // A deleted environment must not become a way to buy headroom: with the
      // table empty every machine class would silently run at the ceiling.
      { ...valid, environments: { local: { maxBudgetMs: 20_000 } } },
      { ...valid, environments: { local: { maxBudgetMs: 20_000, observations: "nope" } } },
      { ...valid, environments: { local: "nope" } },
      { ...valid, environments: { local: { maxBudgetMs: 10_000, observations: [{ ms: 0, at: "x" }] } } },
      { ...valid, environments: { local: { maxBudgetMs: 10_000, observations: [{ ms: 10, at: "" }] } } },
    ]) {
      const result = validateRatchetState(mutation);
      expect(result.ok, JSON.stringify(mutation)).toBe(false);
    }
  });

  it("fails the gate before running the suite when the state file is unusable", () => {
    const emptyState = writeTempState({ schemaVersion: 1, suitePath: SUITE, ceilingMs: 60_000 });
    const result = runFleetGate({ FLEET_GATE_RATCHET_PATH: emptyState });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unusable ratchet state");
    expect(result.stdout).not.toContain("running tests/va-fleet-simulation.test.ts");
  });

  it("refuses to run an unratified machine class at the loose ceiling", () => {
    const result = runFleetGate({ FLEET_GATE_ENV: "never-ratified-runner" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('no ratchet window is ratified for environment "never-ratified-runner"');
    expect(result.stdout).not.toContain("running tests/va-fleet-simulation.test.ts");
  });

  it("ratifies a new machine class from its own real measurement", () => {
    const statePath = writeTempState(readState());
    const result = runFleetGate(
      { FLEET_GATE_ENV: "fresh-runner", FLEET_GATE_RATCHET_PATH: statePath },
      ["--record"],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("cap 60000 ms ->");

    const written = JSON.parse(fs.readFileSync(statePath, "utf8")) as {
      environments: Record<string, { maxBudgetMs: number; observations: { ms: number }[] }>;
    };
    expect(written.environments["fresh-runner"]?.observations).toHaveLength(1);
    expect(written.environments["fresh-runner"]!.maxBudgetMs).toBeLessThan(PINNED_CEILING_MS);
    expect(validateRatchetState(written)).toEqual({ ok: true });
  }, 60_000);
});

describe("fleet-simulation wall-clock budget", () => {
  it("kills the suite and fails with the timeout exit code when the budget is exceeded", () => {
    const result = runFleetGate({ FLEET_SIMULATION_BUDGET_MS: "1" });
    expect(result.status).toBe(124);
    expect(result.stderr).toContain("exceeded its 1 ms wall-clock budget");
  }, 20_000);

  it("runs the real suite to a passing summary inside the ratcheted budget", () => {
    const state = readState() as {
      ceilingMs: number;
      environments: { local: { maxBudgetMs: number } };
    };
    const expectedBudgetMs = state.environments.local.maxBudgetMs;

    const result = runFleetGate();

    expect(result.stdout).toContain(
      `[fleet-gate] running ${SUITE} with a ${expectedBudgetMs} ms wall-clock budget`,
    );
    expect(result.stdout).toContain("ratchet:");
    expect(result.stdout).toContain(`hard ceiling ${state.ceilingMs} ms`);
    expect(result.stdout).toContain("✓ " + SUITE);
    expect(result.stdout).toContain("Test Files  1 passed (1)");
    expect(result.stdout).toContain("measured");
    expect(result.status).toBe(0);
  }, 60_000);

  it("records a run into the ratchet and reports the tightened cap", () => {
    const seeded: RatchetState = {
      schemaVersion: 1,
      suitePath: SUITE,
      ceilingMs: PINNED_CEILING_MS,
      floorMs: PINNED_FLOOR_MS,
      tightenFactor: PINNED_TIGHTEN_FACTOR,
      windowSize: PINNED_WINDOW_SIZE,
      environments: { local: { maxBudgetMs: 30_000, observations: [] } },
    };
    const statePath = writeTempState(seeded);

    const result = runFleetGate({ FLEET_GATE_RATCHET_PATH: statePath }, ["--record"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("cap 30000 ms ->");
    expect(result.stdout).toContain("commit ");
    expect(result.stdout).toContain("fleet-budget-ratchet.json to ratchet the gate");

    const written = JSON.parse(fs.readFileSync(statePath, "utf8")) as {
      environments: { local: { maxBudgetMs: number; observations: { ms: number; at: string }[] } };
    };
    expect(written.environments.local.observations).toHaveLength(1);
    expect(written.environments.local.observations[0]!.ms).toBeGreaterThan(0);
    expect(written.environments.local.maxBudgetMs).toBeLessThan(30_000);
    expect(validateRatchetState(written)).toEqual({ ok: true });
  }, 60_000);

  it("refuses to record an overridden run as evidence", () => {
    const result = runFleetGate({ FLEET_SIMULATION_BUDGET_MS: "60000" }, ["--record"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("an overridden run is not evidence");
  });

  it("rejects an unusable budget override with the invalid-input exit code", () => {
    const result = runFleetGate({ FLEET_SIMULATION_BUDGET_MS: "0" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("must be a positive number of milliseconds");
  });

  // The suite ratchet bounds the whole run; these per-scenario bounds are the
  // inner layer that keeps one coordination path from consuming it unnoticed.
  // Pinning the literals makes a change to a path's tightness an explicit,
  // reviewable edit rather than a quiet one.
  it("pins a committed real-time bound for every coordination path", () => {
    expect(FLEET_SCENARIO_KEYS).toEqual([
      "budget-reserve-storm",
      "probe-admission",
      "single-flight-wait",
      "degraded-store-fail-closed",
      "outage-fail-closed",
      "split-brain-fail-closed",
      "epoch-invalidation",
    ]);
    expect(FLEET_SCENARIO_BUDGETS_MS).toEqual({
      "budget-reserve-storm": 2_000,
      "probe-admission": 1_000,
      "single-flight-wait": 2_500,
      "degraded-store-fail-closed": 1_000,
      "outage-fail-closed": 1_500,
      "split-brain-fail-closed": 3_000,
      "epoch-invalidation": 1_500,
    });
  });

  it("keeps every scenario bound inside the ratified local suite budget", () => {
    const localBudgetMs = resolveBudget(loadRatchetState().state, "local").ms;
    for (const scenario of FLEET_SCENARIO_KEYS) {
      const boundMs = FLEET_SCENARIO_BUDGETS_MS[scenario];
      expect(Number.isInteger(boundMs) && boundMs > 0, scenario).toBe(true);
      // No single path may be allowed to consume the whole suite budget.
      expect(boundMs, scenario).toBeLessThan(localBudgetMs);
    }
  });

  it("prints each scenario's measurement against its bound, marking near-limit paths", () => {
    expect(FLEET_SCENARIO_NEAR_LIMIT_RATIO).toBe(0.75);

    expect(formatScenarioBudgetLine("probe-admission", 100, 1_000)).toBe(
      "[fleet] probe-admission: 100 ms / 1000 ms (10.0% of bound)",
    );
    // The marker is the point: a path inside the bound but with little headroom
    // must stand out before it becomes a failure.
    expect(formatScenarioBudgetLine("probe-admission", 750, 1_000)).toBe(
      "[fleet] probe-admission: 750 ms / 1000 ms (75.0% of bound — NEAR LIMIT)",
    );
    expect(formatScenarioBudgetLine("single-flight-wait", 1_200, 2_500)).toContain(
      "(48.0% of bound)",
    );
    expect(formatScenarioBudgetLine("probe-admission", 1_201, 1_000)).toBe(
      "[fleet] probe-admission: 1201 ms / 1000 ms (120.1% of bound — OVER BOUND)",
    );
  });

  it("prints through the shared enforcement path, before the failure decision", () => {
    const suite = fs.readFileSync(path.join(ROOT, "tests", "va-fleet-simulation.test.ts"), "utf8");
    const logging = suite.indexOf(
      "console.log(formatScenarioBudgetLine(scenario, elapsedMs, budgetMs));",
    );
    expect(logging).toBeGreaterThan(-1);
    // Every bounded test reaches this path through withinScenarioBudget, so no
    // scenario can be measured without also being printed *and* reported to the
    // gate — the PASS-line summary reads the same chokepoint, not a parallel one.
    expect(suite).toContain("return enforceScenarioBudget(");
    expect(suite).toContain("FLEET_SCENARIO_BUDGETS_MS[scenario],");
    expect(suite).toContain("recordScenarioMeasurement,");
    const reported = suite.indexOf("onMeasured?.({");
    expect(reported).toBeGreaterThan(logging);
    // Like the printed line, the measurement is reported before the decision, so
    // an over-budget path still reaches the gate's summary.
    expect(suite.indexOf("if (failure) throw new Error(failure);")).toBeGreaterThan(reported);
  });

  it("names the overrunning path in the failure message", () => {
    expect(scenarioBudgetFailure("single-flight-wait", 2_500, 2_500)).toBeNull();
    const failure = scenarioBudgetFailure("single-flight-wait", 2_501, 2_500);
    expect(failure).toContain("single-flight-wait");
    expect(failure).toContain("2501 ms");
    expect(failure).toContain("2500 ms per-scenario bound");
  });
});