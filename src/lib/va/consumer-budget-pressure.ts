import "server-only";

/**
 * The shared consumer budget's own admit/refuse pressure, as a reported fact.
 *
 * The budget in `reference-shared-cache.ts` bounds the whole fleet's upstream
 * traffic (audit A03), but until now nothing said how close the fleet was to that
 * bound: an instance that had refused a hundred upstream attempts looked exactly
 * like an idle one from the outside, and the operator's first evidence of
 * throttling was VA answering `429`. The reservation now records each of its
 * decisions here, and `/api/health` renders the result as
 * `components.vaConsumerBudget.pressure`, so "the fleet is being throttled" is
 * readable *before* upstream throttling says so.
 *
 * Three properties make these counters trustworthy as a reported fact:
 *
 *   1. **Written by the decision, not by an observer.** Every return path of
 *      `reserveVaSharedConsumerSlot` records exactly one outcome, so `admitted`
 *      and `refused` always sum to the number of decisions this instance made,
 *      and a report cannot drift from the code that decides. The reason
 *      vocabulary below is the list the reservation branches on — a refusal that
 *      no reason names would be a decision that went unrecorded, which
 *      `tests/va-consumer-budget-pressure.test.ts` drives through every branch.
 *   2. **Per instance, and said to be.** These are this process's decisions since
 *      it started; a cold start resets them, and two instances' counters do not
 *      add up to a fleet total without the operator adding them. A *refusal* is
 *      an event rather than a rate, though, so the reading is a lower bound that
 *      is true as stated: any non-zero `refused` means the budget refused
 *      upstream traffic somewhere in the fleet.
 *   3. **No identity, no store coordinates.** Counts, fixed reason labels, epoch
 *      milliseconds, and the window's own length. Nothing here came from a
 *      request, a cache key, or the coordinator's URL and token, so rendering the
 *      snapshot on a public endpoint adds no new disclosure.
 *
 * The pacing counters are the earliest signal of all: a charge is applied only
 * when the upstream itself reported less quota remaining than the fleet's own
 * window believes (`applyVaConsumerPacingGuidance`), so a non-zero
 * `pacing.chargedReservations` means VA has already said the fleet is short.
 */

/**
 * Every way the reservation can refuse an upstream attempt, in the reservation's
 * own vocabulary. `store-unconfigured` and `store-unreachable` are separated
 * because they need different operator responses — a missing coordinator was
 * never able to serve, a broken one stopped serving — while `exhausted` is the
 * only reason that means the budget is doing its job.
 */
export const VA_SHARED_CONSUMER_REFUSAL_REASONS = [
  /** This window's budget is spent; the fleet is being paced. */
  "exhausted",
  /** The store already holds a later window, so this call arrived too late. */
  "superseded-window",
  /** The predecessor counter is not a valid non-negative integer. */
  "predecessor-invalid",
  /** The window's counter could not be given the lifetime it must have. */
  "counter-lifetime-refused",
  /** The store's reply was not a decision code this module knows. */
  "unreadable-decision",
  /** No shared coordinator is configured, so no reservation is possible. */
  "store-unconfigured",
  /** The coordinator is configured but did not answer a readable reply. */
  "store-unreachable",
  /** The instant handed to the reservation cannot be placed in any window. */
  "clock-unusable",
] as const;

export type VaSharedConsumerBudgetRefusalReason =
  (typeof VA_SHARED_CONSUMER_REFUSAL_REASONS)[number];

/** One reservation outcome: admitted, or refused for exactly one named reason. */
export type VaSharedConsumerBudgetOutcome = "admitted" | VaSharedConsumerBudgetRefusalReason;

/**
 * The upstream's guidance was applied as extra reservations against the window's
 * counter, or a charge the budget wanted to make was refused by the store.
 * Counted separately from reservation decisions because a refused charge is not
 * a refusal of traffic — it only means the fleet's pacing was not tightened this
 * time (`applyVaConsumerPacingGuidance` fails soft).
 */
export interface VaSharedConsumerBudgetPacingPressure {
  /** Times an upstream response tightened this instance's pacing. */
  charges: number;
  /** Reservations those charges added to the shared window in total. */
  chargedReservations: number;
  /** Charges the store refused; the response was still served. */
  refusedCharges: number;
  lastChargedAt: string | null;
}

export interface VaSharedConsumerBudgetPressureSnapshot {
  /** These counters are this instance's decisions, never a fleet total. */
  scope: "per-instance";
  /** When this instance recorded its first decision (ISO 8601), or null. */
  since: string | null;
  /** Upstream attempts this instance was allowed to make. */
  admitted: number;
  /** Upstream attempts this instance refused. `admitted + refused` = decisions. */
  refused: number;
  /** Every reason, including the ones that are structurally zero here. */
  refusals: Record<VaSharedConsumerBudgetRefusalReason, number>;
  /**
   * Refusals recorded in the window containing `now` or the one before it — the
   * two windows the budget's rolling rule overlaps at any instant. This is the
   * "is it throttling *now*" reading; `lastRefusalAt` says how stale it is.
   */
  refusedInLastWindow: number;
  lastRefusalAt: string | null;
  lastRefusalReason: VaSharedConsumerBudgetRefusalReason | null;
  pacing: VaSharedConsumerBudgetPacingPressure;
  /** One sentence stating the same thing, for a human reading the body. */
  detail: string;
}

/** The two most recent windows a refusal was recorded in, at most. */
interface RefusalWindow {
  bucket: number;
  count: number;
}

interface PressureState {
  since: number | null;
  admitted: number;
  refused: number;
  refusals: Record<VaSharedConsumerBudgetRefusalReason, number>;
  windows: RefusalWindow[];
  lastRefusalAt: number | null;
  lastRefusalReason: VaSharedConsumerBudgetRefusalReason | null;
  pacing: {
    charges: number;
    chargedReservations: number;
    refusedCharges: number;
    lastChargedAt: number | null;
  };
}

function zeroRefusals(): Record<VaSharedConsumerBudgetRefusalReason, number> {
  return Object.fromEntries(
    VA_SHARED_CONSUMER_REFUSAL_REASONS.map((reason) => [reason, 0]),
  ) as Record<VaSharedConsumerBudgetRefusalReason, number>;
}

/**
 * Module state, deliberately unbounded in *time* but bounded in *shape*: counters
 * that only rise, two window entries, and two timestamps. Nothing accumulates per
 * decision, so a long-lived instance cannot grow this by being busy.
 */
const state: PressureState = {
  since: null,
  admitted: 0,
  refused: 0,
  refusals: zeroRefusals(),
  windows: [],
  lastRefusalAt: null,
  lastRefusalReason: null,
  pacing: { charges: 0, chargedReservations: 0, refusedCharges: 0, lastChargedAt: null },
};

function isoOrNull(at: number | null): string | null {
  return at === null ? null : new Date(at).toISOString();
}

/** An instant that can be placed in a window; anything else is not a number. */
function isUsableInstant(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Record one reservation decision.
 *
 * `now` is the instant the *reservation* decided against, because that is the
 * window the decision belongs to; `windowMs` is the budget's own window length,
 * passed in rather than re-declared so the counter can never be bucketed by a
 * window the budget does not use.
 *
 * An unusable `now` (the reservation's own clock guard) still counts as a refusal:
 * it is one of the ways an upstream attempt is refused, and dropping it would
 * make the counters under-report. It is simply not placed in a window, and the
 * timestamp falls back to wall-clock time, which the caller only failed to supply
 * for the decision itself.
 */
export function recordVaConsumerBudgetDecision(args: {
  outcome: VaSharedConsumerBudgetOutcome;
  now: number;
  windowMs: number;
}): void {
  const usable = isUsableInstant(args.now);
  const at = usable ? args.now : Date.now();
  if (state.since === null) state.since = at;

  if (args.outcome === "admitted") {
    state.admitted += 1;
    return;
  }

  state.refused += 1;
  state.refusals[args.outcome] += 1;
  state.lastRefusalAt = at;
  state.lastRefusalReason = args.outcome;

  if (!usable || !Number.isSafeInteger(args.windowMs) || args.windowMs <= 0) return;

  const bucket = Math.floor(args.now / args.windowMs);
  const newest = state.windows.at(-1);
  if (newest && newest.bucket === bucket) {
    newest.count += 1;
    return;
  }
  // Keep at most the two most recent windows: the snapshot only ever sums the
  // window containing `now` and its predecessor.
  state.windows = [...state.windows, { bucket, count: 1 }].slice(-2);
}

/** Record a pacing charge the upstream's own guidance justified. */
export function recordVaConsumerBudgetPacingCharge(args: {
  reservations: number;
  now?: number;
}): void {
  const at = args.now ?? Date.now();
  state.pacing.charges += 1;
  state.pacing.chargedReservations += Math.max(0, Math.trunc(args.reservations));
  state.pacing.lastChargedAt = isUsableInstant(at) ? at : Date.now();
}

/** Record a charge the store refused. The upstream response was still served. */
export function recordVaConsumerBudgetPacingRefusal(): void {
  state.pacing.refusedCharges += 1;
}

/**
 * Read the pressure this instance has accumulated.
 *
 * `windowMs` is the budget's window length (again the budget's own constant), used
 * only to place `now` in a window; a reader that cannot name a window gets
 * `refusedInLastWindow: 0` rather than the lifetime total, because a refusal that
 * cannot be located in time is not evidence about *this* window.
 */
export function readVaConsumerBudgetPressure(args: {
  windowMs: number;
  now?: number;
}): VaSharedConsumerBudgetPressureSnapshot {
  const instant = args.now ?? Date.now();
  const bucket = Number.isSafeInteger(args.windowMs) && args.windowMs > 0 && isUsableInstant(instant)
    ? Math.floor(instant / args.windowMs)
    : null;

  const refusedInLastWindow =
    bucket === null
      ? 0
      : state.windows.reduce(
          (total, window) =>
            window.bucket === bucket || window.bucket === bucket - 1
              ? total + window.count
              : total,
          0,
        );

  const decisions = state.admitted + state.refused;

  return {
    scope: "per-instance",
    since: isoOrNull(state.since),
    admitted: state.admitted,
    refused: state.refused,
    refusals: { ...state.refusals },
    refusedInLastWindow,
    lastRefusalAt: isoOrNull(state.lastRefusalAt),
    lastRefusalReason: state.lastRefusalReason,
    pacing: {
      charges: state.pacing.charges,
      chargedReservations: state.pacing.chargedReservations,
      refusedCharges: state.pacing.refusedCharges,
      lastChargedAt: isoOrNull(state.pacing.lastChargedAt),
    },
    detail:
      decisions === 0
        ? "no reservation has been decided on this instance since it started"
        : state.refused === 0
          ? `all ${decisions} reservation decisions on this instance were admitted`
          : `${state.refused} of ${decisions} reservation decisions on this instance were refused the shared consumer budget; the most recent reason was ${state.lastRefusalReason}`,
  };
}

/**
 * Reset for tests. Module state outlives a test case inside one file, so a suite
 * that asserts on counts clears them first; production code never calls this.
 */
export function clearVaConsumerBudgetPressureForTests(): void {
  state.since = null;
  state.admitted = 0;
  state.refused = 0;
  state.refusals = zeroRefusals();
  state.windows = [];
  state.lastRefusalAt = null;
  state.lastRefusalReason = null;
  state.pacing = { charges: 0, chargedReservations: 0, refusedCharges: 0, lastChargedAt: null };
}
