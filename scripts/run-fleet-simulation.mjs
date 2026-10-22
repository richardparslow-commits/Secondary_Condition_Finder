#!/usr/bin/env node
/**
 * Run the VA fleet simulation under a wall-clock budget that ratchets down as
 * the suite's measured timing stabilizes, and fail the gate when the budget is
 * exceeded.
 *
 * WHY THIS EXISTS
 * `tests/va-fleet-simulation.test.ts` asserts the distributed VA coordination
 * invariants (shared consumer budget, circuit cooldown and single probe lease,
 * per-key single-flight leases, epoch invalidation, coordinated store outage,
 * degraded store). Those are also *latency* properties: a regression that
 * turns bounded coordination into unbounded retries, polling, or waits can
 * still satisfy every assertion while making the request path arbitrarily
 * slow, and vitest's per-test timeouts alone would let it pass slowly. CI
 * therefore runs the simulation as the named `fleet` gate through this
 * wrapper; an overrun kills the suite and exits with the conventional timeout
 * status (124), which fails the step and, via the aggregator, the build.
 *
 * WHY A RATCHET INSTEAD OF A CONSTANT
 * A hardcoded budget is not a gate on drift: it tolerates any slowdown below
 * the constant, and it only changes if someone remembers to lower it — which
 * nobody does, so the effective gate gets looser every time the suite grows.
 * The budget is therefore *derived* from committed measurements of this suite
 * (`.github/fleet-budget-ratchet.json`) instead of remembered:
 *
 *   enforced = min(ratchet cap for this environment, evidence-derived budget)
 *   derived  = clamp(ceil(slowest recent measurement × tightenFactor), floor, ceiling)
 *
 * - The **ratchet cap** is the tightest budget ever ratified for an
 *   environment. `--record` only ever lowers it, so a slow or noisy run can
 *   never silently loosen the gate.
 * - The **evidence window** keeps only the most recent `windowSize`
 *   measurements, so as timing stabilizes the derived budget falls and the
 *   gate tightens by itself — nobody has to re-tune a constant.
 * - **`ceilingMs` is a hard cap**, and the whole policy (ceiling, floor,
 *   factor, window size) is pinned as literals by
 *   `tests/fleet-simulation-gate.test.ts`, so the budget cannot be loosened
 *   without an explicit, reviewable change.
 * - An environment with no measurements is budgeted at the ceiling: a machine
 *   class is only tightened once it has real evidence. The first CI run prints
 *   its own measurement, which can be recorded the same way, so the CI budget
 *   tightens as CI timing stabilizes.
 *
 * Usage:
 *   node scripts/run-fleet-simulation.mjs               # enforce the ratchet
 *   npm run test:fleet -- --record                      # record this run and ratchet down
 *   FLEET_SIMULATION_BUDGET_MS=120000 npm run test:fleet # operator override (bypasses the ratchet)
 *   FLEET_GATE_ENV=local-arm64 npm run test:fleet        # name this machine class
 *
 * WHY THE PASS LINE NAMES THE TIGHTEST PATH
 * A suite-level PASS says the total fit; it does not say which coordination
 * path has the least room left. Seven paths sharing one budget can each sit at
 * 20% while the total is comfortable, and the one that is one CI-runner hiccup
 * from failing is the one a reader needs to see. The suite therefore reports
 * every bounded scenario's measurement to a file this gate reads, and the PASS
 * line ends with the scenario closest to its bound (with its percentage and a
 * NEAR LIMIT marker). The gate fails closed when that report is missing or
 * unreadable: a PASS that cannot name its tightest path is not the evidence
 * this gate claims.
 *
 * Debugging knobs, never used by CI: `FLEET_SIMULATION_BUDGET_MS` bypasses the
 * ratchet for one run, `FLEET_GATE_RATCHET_PATH` points at a different state
 * file, and `FLEET_SCENARIO_REPORT_PATH` redirects the per-scenario report. An
 * overridden run is never recorded as evidence.
 *
 * Exit codes:
 *   0   suite passed within budget, and its tightest path was identified
 *   1   suite failed, could not start, was terminated by a signal, or passed
 *       without a readable per-scenario report
 *   2   invalid override, unusable or loosened ratchet state, or an unratified
 *       environment (the state file is committed, so this is a fail-closed
 *       configuration error, never an infrastructure one)
 *   124 wall-clock budget exceeded (suite killed)
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUITE_PATH = "tests/va-fleet-simulation.test.ts";
const VITEST_ENTRY = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
const DEFAULT_RATCHET_PATH = path.join(repoRoot, ".github", "fleet-budget-ratchet.json");
const TIMEOUT_EXIT_CODE = 124;
/** Set by this gate on the suite's environment; the suite appends JSON Lines. */
const SCENARIO_REPORT_ENV = "FLEET_SCENARIO_REPORT_PATH";

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Read the per-scenario report the suite wrote. Absent, unreadable or
 * malformed is a failure, not an empty list: the caller must not turn "no
 * measurements" into a PASS line that simply omits its summary.
 */
export function readScenarioReport(file) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const measurements = [];
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  for (const [index, line] of lines.entries()) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { ok: false, reason: `line ${index + 1} is not JSON` };
    }
    const usable =
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.scenario === "string" &&
      parsed.scenario.length > 0 &&
      Number.isFinite(parsed.elapsedMs) &&
      parsed.elapsedMs >= 0 &&
      isPositiveNumber(parsed.budgetMs);
    if (!usable) {
      return { ok: false, reason: `line ${index + 1} is not a scenario measurement` };
    }
    measurements.push({
      scenario: parsed.scenario,
      elapsedMs: parsed.elapsedMs,
      budgetMs: parsed.budgetMs,
      nearLimit: parsed.nearLimit === true,
    });
  }
  return { ok: true, measurements };
}

/**
 * The measurement closest to its bound, by ratio rather than absolute time: a
 * 900 ms path under a 1,000 ms bound is tighter than a 2,000 ms path under a
 * 3,000 ms one, even though it is faster in milliseconds. Ties keep the first
 * reported path, which is the suite's own order.
 */
export function selectTightestScenario(measurements) {
  let tightest = null;
  for (const measurement of measurements ?? []) {
    if (!measurement || !isPositiveNumber(measurement.budgetMs)) continue;
    if (!Number.isFinite(measurement.elapsedMs) || measurement.elapsedMs < 0) continue;
    const ratio = measurement.elapsedMs / measurement.budgetMs;
    if (!tightest || ratio > tightest.ratio) tightest = { ...measurement, ratio };
  }
  return tightest;
}

/** The PASS-line suffix: named path, its measurement, and how close it is. */
export function formatTightestPath(measurement) {
  const ratio = Number.isFinite(measurement.ratio)
    ? measurement.ratio
    : measurement.elapsedMs / measurement.budgetMs;
  const marker = measurement.nearLimit ? " — NEAR LIMIT" : "";
  return (
    `tightest path: ${measurement.scenario} at ${Math.round(measurement.elapsedMs)} ms / ` +
    `${measurement.budgetMs} ms (${(ratio * 100).toFixed(1)}% of bound${marker})`
  );
}

/** `FLEET_SIMULATION_BUDGET_MS`: null when unset, `{ok:false}` when unusable. */
export function parseOverride(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { ok: true, ms: null };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      ok: false,
      reason: `FLEET_SIMULATION_BUDGET_MS must be a positive number of milliseconds, got "${raw}".`,
    };
  }
  return { ok: true, ms: Math.floor(parsed) };
}

/**
 * Machine class the measurement belongs to. Explicit `FLEET_GATE_ENV` wins;
 * otherwise CI and a developer checkout are separate windows, because their
 * startup costs differ and a budget must never be tightened from a slower
 * machine class's evidence.
 */
export function resolveEnvironment(env) {
  const explicit = typeof env.FLEET_GATE_ENV === "string" ? env.FLEET_GATE_ENV.trim() : "";
  if (explicit) return explicit;
  return env.CI ? "ci" : "local";
}

/** Read the committed ratchet state; a missing or unreadable file fails closed. */
export function loadRatchetState(filePath = DEFAULT_RATCHET_PATH) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    return {
      ok: false,
      reason:
        `cannot read the ratchet state at ${path.relative(repoRoot, filePath)} ` +
        `(${String(code ?? (error instanceof Error ? error.message : error))}) — restore it: ` +
        "the gate refuses to run without a provable budget.",
    };
  }
  try {
    return { ok: true, state: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      reason: `the ratchet state at ${path.relative(repoRoot, filePath)} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Structural validation plus the anti-loosening rule: no environment may carry
 * a ratchet cap above the hard ceiling, so an edit that loosens the gate fails
 * the step instead of silently buying headroom.
 */
export function validateRatchetState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { ok: false, reason: "the ratchet state is not a JSON object." };
  }
  if (state.schemaVersion !== 1) {
    return {
      ok: false,
      reason: `unsupported ratchet schemaVersion ${JSON.stringify(state.schemaVersion)} (expected 1).`,
    };
  }
  if (state.suitePath !== SUITE_PATH) {
    return {
      ok: false,
      reason: `the ratchet budgets ${JSON.stringify(state.suitePath)} but this gate runs ${JSON.stringify(SUITE_PATH)}.`,
    };
  }
  if (!isPositiveNumber(state.ceilingMs)) {
    return { ok: false, reason: `ceilingMs must be a positive number, got ${JSON.stringify(state.ceilingMs)}.` };
  }
  if (!isPositiveNumber(state.floorMs) || state.floorMs > state.ceilingMs) {
    return {
      ok: false,
      reason: `floorMs must be positive and at or below ceilingMs, got ${JSON.stringify(state.floorMs)}.`,
    };
  }
  if (!isPositiveNumber(state.tightenFactor) || state.tightenFactor < 1) {
    return {
      ok: false,
      reason: `tightenFactor must be a number of at least 1, got ${JSON.stringify(state.tightenFactor)}.`,
    };
  }
  if (!isPositiveNumber(state.windowSize) || !Number.isInteger(state.windowSize)) {
    return { ok: false, reason: `windowSize must be a positive integer, got ${JSON.stringify(state.windowSize)}.` };
  }
  const environments = state.environments;
  if (!environments || typeof environments !== "object" || Array.isArray(environments)) {
    return { ok: false, reason: "the ratchet state has no environments object." };
  }
  if (Object.keys(environments).length === 0) {
    // An empty table would let every machine class run at the ceiling: deleting
    // an environment must never be a way to buy headroom.
    return { ok: false, reason: "the ratchet state lists no environments." };
  }
  for (const [name, entry] of Object.entries(environments)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, reason: `environment ${JSON.stringify(name)} is not an object.` };
    }
    if (!isPositiveNumber(entry.maxBudgetMs)) {
      return { ok: false, reason: `environment ${JSON.stringify(name)} has no positive maxBudgetMs.` };
    }
    if (entry.maxBudgetMs > state.ceilingMs) {
      return {
        ok: false,
        reason:
          `environment ${JSON.stringify(name)} carries maxBudgetMs ${entry.maxBudgetMs} above the ` +
          `${state.ceilingMs} ms hard ceiling — the ratchet may not be loosened.`,
      };
    }
    if (!Array.isArray(entry.observations)) {
      return { ok: false, reason: `environment ${JSON.stringify(name)} has no observations array.` };
    }
    for (const observation of entry.observations) {
      if (!observation || typeof observation !== "object" || !isPositiveNumber(observation.ms)) {
        return {
          ok: false,
          reason: `environment ${JSON.stringify(name)} has a malformed observation (expected a positive ms).`,
        };
      }
      if (typeof observation.at !== "string" || observation.at.trim() === "") {
        return {
          ok: false,
          reason: `environment ${JSON.stringify(name)} has an observation without a recorded date.`,
        };
      }
    }
  }
  return { ok: true };
}

/**
 * Evidence-derived budget: the slowest recent measurement for this environment
 * times the tighten factor, clamped to the floor (so one very fast measurement
 * cannot buy a flaky micro-budget) and the hard ceiling. Returns `null` when
 * the environment has no measurements — no evidence, no tightening.
 */
export function deriveBudgetMs(state, environment) {
  const observations = state.environments?.[environment]?.observations;
  if (!Array.isArray(observations) || observations.length === 0) return null;
  const slowestMs = Math.max(...observations.map((observation) => observation.ms));
  const derived = Math.ceil(slowestMs * state.tightenFactor);
  return Math.min(Math.max(derived, state.floorMs), state.ceilingMs);
}

/**
 * The enforced budget: the tighter of this environment's ratified cap and its
 * evidence-derived budget, unless an operator override bypasses both. An
 * environment with no ratified cap (an unlisted machine class) is budgeted at
 * the hard ceiling — the loosest the gate is ever allowed to be; the CLI
 * refuses to run an unlisted environment at all unless it is recording.
 *
 * @param {object} state
 * @param {string} environment
 * @param {number | null} [overrideMs]
 * @returns {{ ms: number, source: string, capMs: number, derivedMs: number | null }}
 */
export function resolveBudget(state, environment, overrideMs = null) {
  const entry = state.environments?.[environment];
  const capMs = isPositiveNumber(entry?.maxBudgetMs) ? entry.maxBudgetMs : state.ceilingMs;
  const derivedMs = deriveBudgetMs(state, environment);
  if (overrideMs !== null) {
    return { ms: overrideMs, source: "operator-override", capMs, derivedMs };
  }
  return { ms: Math.min(capMs, derivedMs ?? capMs), source: "ratchet", capMs, derivedMs };
}

/**
 * Pure ratchet step: append a measurement to this environment's window (trimmed
 * to `windowSize`) and lower the cap to the derived budget. The cap can never
 * rise — that is the property that stops the gate drifting looser.
 */
export function recordObservation(state, environment, measuredMs, at) {
  const existing = state.environments?.[environment];
  const previousCapMs = isPositiveNumber(existing?.maxBudgetMs) ? existing.maxBudgetMs : state.ceilingMs;
  const previousObservations = Array.isArray(existing?.observations) ? existing.observations : [];
  const observations = [...previousObservations, { ms: Math.round(measuredMs), at }].slice(-state.windowSize);
  const nextState = {
    ...state,
    environments: {
      ...state.environments,
      [environment]: { maxBudgetMs: previousCapMs, observations },
    },
  };
  const derivedMs = deriveBudgetMs(nextState, environment) ?? previousCapMs;
  const maxBudgetMs = Math.min(previousCapMs, derivedMs);
  return {
    state: {
      ...nextState,
      environments: { ...nextState.environments, [environment]: { maxBudgetMs, observations } },
    },
    previousCapMs,
    maxBudgetMs,
    derivedMs,
  };
}

export function formatState(state) {
  return `${JSON.stringify(state, null, 2)}\n`;
}

function fail(message) {
  console.error(`[fleet-gate] FAIL: ${message}`);
  process.exit(2);
}

function printUsage() {
  console.log("Usage: node scripts/run-fleet-simulation.mjs [--record]");
  console.log("");
  console.log("  --record   append this run's measured duration to the committed ratchet state");
  console.log("             and lower this environment's budget cap to the derived value.");
  console.log("");
  console.log("Environment:");
  console.log("  FLEET_GATE_ENV               machine class for the measurement window");
  console.log("                               (default: ci when CI is set, else local)");
  console.log("  FLEET_SIMULATION_BUDGET_MS   operator override, bypasses the ratchet (debugging only)");
  console.log("  FLEET_GATE_RATCHET_PATH      alternate ratchet state file (debugging only)");
  console.log(`  ${SCENARIO_REPORT_ENV} redirect the per-scenario report (set by this gate)`);
}

/* ─── main ────────────────────────────────────────────────────────────────── */

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exitCode = 0;
    return;
  }
  const unknownArgs = argv.filter((arg) => arg !== "--record");
  if (unknownArgs.length > 0) {
    fail(`unknown argument(s): ${unknownArgs.join(", ")} (try --help).`);
  }
  const record = argv.includes("--record");

  const ratchetPath = process.env.FLEET_GATE_RATCHET_PATH?.trim() || DEFAULT_RATCHET_PATH;
  const environment = resolveEnvironment(process.env);

  const override = parseOverride(process.env.FLEET_SIMULATION_BUDGET_MS);
  if (!override.ok) fail(override.reason);
  if (record && override.ms !== null) {
    fail("--record cannot be combined with FLEET_SIMULATION_BUDGET_MS: an overridden run is not evidence.");
  }

  const loaded = loadRatchetState(ratchetPath);
  if (!loaded.ok) fail(loaded.reason);
  const validation = validateRatchetState(loaded.state);
  if (!validation.ok) fail(`unusable ratchet state: ${validation.reason}`);

  const listedEnvironment = Object.prototype.hasOwnProperty.call(loaded.state.environments, environment);
  if (!listedEnvironment && !record && override.ms === null) {
    // Running an unlisted machine class would silently use the hard ceiling.
    // Ratify a window instead: `--record` seeds it from this machine's real
    // measurement, so the first run is evidence rather than a blank cheque.
    fail(
      `no ratchet window is ratified for environment ${JSON.stringify(environment)}. ` +
        `Record this machine's real measurement first: FLEET_GATE_ENV=${environment} ` +
        "npm run test:fleet -- --record",
    );
  }

  const budget = resolveBudget(loaded.state, environment, override.ms);
  const observationsCount = loaded.state.environments?.[environment]?.observations?.length ?? 0;
  const stateLabel = path.relative(repoRoot, ratchetPath) || ratchetPath;

  console.log(`[fleet-gate] environment: ${environment}`);
  console.log(
    `[fleet-gate] running ${SUITE_PATH} with a ${budget.ms} ms wall-clock budget ` +
      (budget.source === "operator-override"
        ? `(operator override; ratchet bypassed, cap ${budget.capMs} ms, evidence-derived ${
            budget.derivedMs ?? "none"
          } ms)`
        : `(ratchet: cap ${budget.capMs} ms, evidence-derived ${budget.derivedMs ?? "none"} ms from ` +
          `${observationsCount} observation(s), hard ceiling ${loaded.state.ceilingMs} ms)`),
  );

  // The suite reports every bounded scenario's measurement here, so the PASS
  // line can name the one with the least room left. An injected path (debugging)
  // is used as-is; otherwise a private temp directory is cleaned up on exit.
  const reportOverride = process.env[SCENARIO_REPORT_ENV]?.trim();
  const reportDirectory = reportOverride
    ? null
    : mkdtempSync(path.join(os.tmpdir(), "fleet-scenario-report-"));
  const reportPath = reportOverride || path.join(reportDirectory, "report.jsonl");
  rmSync(reportPath, { force: true });
  const cleanupReport = () => {
    if (reportDirectory) rmSync(reportDirectory, { recursive: true, force: true });
  };

  const startedAt = process.hrtime.bigint();
  const child = spawn(process.execPath, [VITEST_ENTRY, "run", SUITE_PATH], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, [SCENARIO_REPORT_ENV]: reportPath },
  });

  let budgetExceeded = false;
  const budgetTimer = setTimeout(() => {
    budgetExceeded = true;
    console.error(
      `[fleet-gate] FAIL: ${SUITE_PATH} exceeded its ${budget.ms} ms wall-clock budget — ` +
        "coordination work is no longer bounded. Killing the suite.",
    );
    child.kill("SIGKILL");
  }, budget.ms);

  child.on("error", (error) => {
    cleanupReport();
    console.error(`[fleet-gate] FAIL: could not start the suite: ${error.message}`);
  });

  child.on("close", (code, signal) => {
    clearTimeout(budgetTimer);
    // Read before cleaning up: every branch of this handler may return.
    const scenarioReport = readScenarioReport(reportPath);
    cleanupReport();
    if (budgetExceeded) {
      process.exitCode = TIMEOUT_EXIT_CODE;
      return;
    }
    if (signal) {
      console.error(`[fleet-gate] FAIL: suite terminated by ${signal}.`);
      process.exitCode = 1;
      return;
    }
    if (code !== 0) {
      process.exitCode = code ?? 1;
      return;
    }

    if (!scenarioReport.ok) {
      console.error(
        `[fleet-gate] FAIL: the suite passed but its per-scenario measurements could not be ` +
          `read from ${reportPath} (${scenarioReport.reason}). A PASS that cannot name the ` +
          `tightest path is not the evidence this gate claims; nothing was ratcheted.`,
      );
      process.exitCode = 1;
      return;
    }
    const tightest = selectTightestScenario(scenarioReport.measurements);
    if (!tightest) {
      console.error(
        "[fleet-gate] FAIL: the suite passed but reported no per-scenario measurements, so the " +
          "gate cannot name the tightest path. Scenarios must run through withinScenarioBudget().",
      );
      process.exitCode = 1;
      return;
    }

    const measuredMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    console.log(
      `[fleet-gate] PASS: measured ${measuredMs} ms against a ${budget.ms} ms budget ` +
        `(${environment} environment); ${formatTightestPath(tightest)}.`,
    );

    if (!record) {
      if (budget.source === "ratchet") {
        console.log(
          "[fleet-gate] ratchet this environment with: npm run test:fleet -- --record " +
            "(the cap only ever moves down).",
        );
      }
      process.exitCode = 0;
      return;
    }

    const recorded = recordObservation(loaded.state, environment, measuredMs, new Date().toISOString().slice(0, 10));
    const serialized = formatState(recorded.state);
    let wrote = true;
    try {
      writeFileSync(ratchetPath, serialized, "utf8");
    } catch (error) {
      // The suite passed inside its budget: that is the gate's contract. A
      // read-only or full workspace must not fail the build, but losing the
      // evidence silently would stop the ratchet tightening, so say so loudly
      // and print the tightened state for a human to paste in.
      wrote = false;
      console.error(
        `[fleet-gate] WARNING: could not write ${stateLabel} ` +
          `(${error instanceof Error ? error.message : String(error)}). ` +
          "The suite passed, so the gate still passes, but this measurement was not persisted.",
      );
    }
    console.log(
      `[fleet-gate] recorded ${environment} observation ${Math.round(measuredMs)} ms ` +
        `(window ${recorded.state.environments[environment].observations.length}); ` +
        `cap ${recorded.previousCapMs} ms -> ${recorded.maxBudgetMs} ms; ` +
        (wrote ? `commit ${stateLabel} to ratchet the gate.` : `apply this state to ${stateLabel}:`),
    );
    if (!wrote) console.log(serialized);
    if (environment === "ci") {
      console.log(
        "[fleet-gate] note: a CI workspace is discarded, so the tightened state reaches the repository " +
          "only through the uploaded ci-diagnostics artifact; committing it ratifies the CI window.",
      );
    }
    process.exitCode = 0;
  });
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main();
}