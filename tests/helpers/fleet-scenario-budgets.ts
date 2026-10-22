/**
 * Per-scenario wall-clock bounds for the VA fleet simulation.
 *
 * The `fleet` CI gate ratchets the suite as a whole (`scripts/run-fleet-simulation.mjs`):
 * the enforced limit is the tighter of a committed environment cap and a budget
 * derived from recent measured runs. A suite-level budget alone cannot say
 * which coordination path got slower, though — one path can regress into an
 * unbounded wait or a retry loop and still hide inside the total. These bounds
 * make every coordination path individually accountable, so the failure names
 * the path that broke its bound.
 *
 * The bounds are deliberately generous multiples of the local measurements
 * (the whole suite runs in about a second locally), so they trip on a genuine
 * regression — a lost fake timer, a serialized contender wait, an extra
 * deadline chain — long before the suite ratchet or the Vitest timeout, while
 * still leaving CI-runner headroom. They are pinned in
 * `tests/fleet-simulation-gate.test.ts`, so loosening one is a deliberate,
 * reviewed edit.
 */

export const FLEET_SCENARIO_BUDGETS_MS = {
  /** Shared consumer-budget reservation across a 40-instance unique-query storm. */
  "budget-reserve-storm": 2000,
  /** Fleet cooldown publication plus one half-open probe admission at the cooldown boundary. */
  "probe-admission": 1000,
  /** Contender wait around one cold key's single-flight lease. */
  "single-flight-wait": 2500,
  /** Fail-closed render cost against a degraded store (750 ms exchange deadline, never the 5 s response). */
  "degraded-store-fail-closed": 1000,
  /** Mid-storm coordination outage: fail closed without burning quota, then recover. */
  "outage-fail-closed": 1500,
  /** Split network partition: the dark half fails closed while the reachable half works, then heals. */
  "split-brain-fail-closed": 3000,
  /** Store-wide epoch bump propagating to every warmed instance. */
  "epoch-invalidation": 1500,
} as const;

export type FleetScenario = keyof typeof FLEET_SCENARIO_BUDGETS_MS;

export const FLEET_SCENARIO_KEYS = Object.keys(FLEET_SCENARIO_BUDGETS_MS) as FleetScenario[];

/**
 * A scenario this close to its bound is worth seeing in the log before it
 * fails. 75% leaves a quarter of the bound as headroom while still surfacing a
 * path that has drifted to within a rounding error of the limit.
 */
export const FLEET_SCENARIO_NEAR_LIMIT_RATIO = 0.75;

/**
 * One line per scenario, printed by the gate's shared enforcement path so every
 * bounded path is visible in CI output whether it passes or fails. The
 * percentage makes a near-limit path stand out before the bound is crossed;
 * the marker names the condition rather than leaving the reader to do the
 * division.
 */
export function formatScenarioBudgetLine(
  scenario: string,
  elapsedMs: number,
  budgetMs: number,
): string {
  const ratio = elapsedMs / budgetMs;
  const marker =
    ratio > 1
      ? " — OVER BOUND"
      : ratio >= FLEET_SCENARIO_NEAR_LIMIT_RATIO
        ? " — NEAR LIMIT"
        : "";
  return (
    `[fleet] ${scenario}: ${Math.round(elapsedMs)} ms / ${budgetMs} ms ` +
    `(${(ratio * 100).toFixed(1)}% of bound${marker})`
  );
}

/**
 * Fail closed on an over-budget scenario: returns a message naming the path,
 * the measured wall clock, and the bound, or null when the run stayed inside
 * the bound. Pure so the policy itself stays unit-testable.
 */
export function scenarioBudgetFailure(scenario: string, elapsedMs: number, budgetMs: number): string | null {
  if (elapsedMs <= budgetMs) return null;
  return (
    `${scenario} took ${Math.round(elapsedMs)} ms of wall clock, past its ${budgetMs} ms ` +
    "per-scenario bound — that coordination path is no longer individually bounded."
  );
}
