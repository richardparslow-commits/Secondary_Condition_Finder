import "server-only";

import { z } from "zod";

import { clampRetryAfterCooldownMs, parseRetryAfterMs } from "./circuit-breaker";

/**
 * The outbound resilience policy for VA public-reference calls.
 *
 * This module owns every decision about *whether and how long to wait* before
 * another attempt reaches VA, so the transport in `sandbox.ts` contains only
 * control flow. Three rules it enforces, none of which are free choices:
 *
 *   1. **A retry always waits.** `vaApiRetryDelayMs` is the only backoff
 *      generator: exponential in the attempt, capped, and never below the base.
 *      Jitter is *added* to that floor and never subtracted from it, so no clock
 *      skew or unlucky random draw can collapse a retry into a hot loop.
 *   2. **A `429` is obeyed, not argued with.** The upstream told us when to come
 *      back. `planVaApiRateLimitRetry` retries only when that instruction fits
 *      `VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS`, waits at least as long as it asked,
 *      and otherwise declines — leaving the caller to fall back immediately and
 *      open the circuit for the full window. See that constant for why the
 *      budget sits below one second.
 *   3. **A malformed payload is a value, not an exception.** `parseVaApiPayload`
 *      is the single place a schema mismatch is converted, and it deliberately
 *      discards the Zod issue list: issue paths and received-type descriptions
 *      are derived from an upstream-controlled document, so returning them would
 *      hand an attacker-shaped structure to whatever logs or renders it. The
 *      caller gets `ok: false` and nothing else, which is all the fallback needs.
 *
 * Nothing here performs I/O or reads configuration, so the policy is
 * exhaustively testable without a network, a clock, or a runtime environment.
 */

/**
 * `Retry-After` parsing and cooldown clamping, re-exported so this module is a
 * single import site for the resilience policy. The implementations stay in
 * `circuit-breaker.ts`, next to the circuit state they describe; a second copy
 * here would let the retry budget and the circuit window disagree about what the
 * upstream actually asked for.
 */
export { clampRetryAfterCooldownMs, parseRetryAfterMs };

/** Base delay before the first retry of a transient failure, in milliseconds. */
export const VA_API_RETRY_BASE_DELAY_MS = 100;
/** Ceiling on the exponential term, before jitter, in milliseconds. */
export const VA_API_RETRY_MAX_DELAY_MS = 400;
/** Retries *after* the first attempt; total attempts are this value plus one. */
export const VA_API_MAX_RETRIES = 2;
/** @deprecated Use VA_API_RETRY_BASE_DELAY_MS; retained for test compatibility. */
export const VA_API_RETRY_DELAY_MS = VA_API_RETRY_BASE_DELAY_MS;
/**
 * Fraction of the base delay added as jitter. Bounded on purpose: this spreads a
 * fleet's retry wave while keeping the generated delay inside a range a test can
 * assert, unlike full jitter which is unbounded below and above.
 */
export const VA_API_RETRY_JITTER_RATIO = 0.2;

/**
 * Statuses retried with plain exponential backoff, because the response itself
 * carries no instruction about when to come back. `500` is deliberately absent:
 * an unhandled server error is not evidence that an immediate repeat will
 * succeed, and VA's own guidance does not require retrying every 5xx.
 */
export const VA_API_TRANSIENT_RETRY_STATUS: ReadonlySet<number> = new Set([
  503, 504,
]);

/** The upstream rate-limit status, which carries its own retry instruction. */
export const VA_API_RATE_LIMIT_STATUS = 429;

/**
 * Longest upstream `Retry-After` this adapter will wait *inside* the request
 * that received the 429, in milliseconds.
 *
 * Deliberately below one second. `Retry-After` in its delay-seconds form is a
 * whole number of seconds, so every value VA realistically sends is at least
 * 1000 ms and therefore exceeds this budget: those responses take the audited
 * path — immediate labelled fallback, plus a circuit opened for the upstream's
 * own window so the *whole consumer* backs off and the retry is served later as
 * the single admitted probe. Holding a web request open for the instructed
 * window is what that design avoids, and the VA production-access package states
 * the same ("immediate fallback without an immediate retry for HTTP 429/500").
 *
 * What remains is the one case the circuit cannot serve well: an upstream that
 * explicitly authorizes an immediate retry (`Retry-After: 0`, or an HTTP-date
 * already in the past). The circuit's 1 s minimum would otherwise turn "retry
 * now" into a one-second outage for every caller, so that authorization is
 * honored here instead.
 *
 * Raising this budget is a policy change, not a tuning tweak: it would start
 * retrying whole-second instructions, which the fleet-simulation and circuit
 * regression suites pin as single-attempt, and it would make the phrase "without
 * an immediate retry" in the production-access package inaccurate. Update those
 * first, or leave this alone.
 */
export const VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS = 500;

/**
 * Deterministic backoff with bounded jitter.
 *
 * Jitter spreads retries across instances so a shared upstream incident does not
 * get a synchronized retry wave; the bound keeps the base/max contract testable.
 * The result is never below `VA_API_RETRY_BASE_DELAY_MS`, so a retry can never be
 * scheduled with no delay at all.
 *
 * @param attempt 1-based number of the attempt that just failed.
 */
export function vaApiRetryDelayMs(
  attempt: number,
  random: () => number = Math.random,
): number {
  const base = Math.min(
    VA_API_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    VA_API_RETRY_MAX_DELAY_MS,
  );
  const jitter = Math.floor(base * VA_API_RETRY_JITTER_RATIO * random());
  return base + jitter;
}

/** Why a `429` was not retried inside the request that received it. */
export type VaApiRateLimitNoRetryReason =
  /** The attempt cap is reached; the caller must fall back and open the window. */
  | "attempts-exhausted"
  /** No usable `Retry-After`; waiting for an unknown duration is not honoring it. */
  | "retry-after-unusable"
  /** The instructed wait is longer than a request may hold open. */
  | "retry-after-exceeds-budget";

/** Whether to retry a `429` in-request, and how long to wait first. */
export type VaApiRateLimitRetryDecision =
  | { retry: true; delayMs: number; retryAfterMs: number }
  | { retry: false; reason: VaApiRateLimitNoRetryReason };

/**
 * Decide whether one `429` may be retried before the caller falls back.
 *
 * A declined decision is the normal, expected outcome for a rate limit: the
 * caller records it through `recordVaOutboundCircuitOutcome`, which opens the
 * circuit for the clamped `Retry-After` window so the retry happens later, as
 * the single admitted probe, instead of as a held-open request.
 *
 * @param args.attempt        1-based number of the attempt that just returned 429.
 * @param args.retryAfterMs   Parsed `Retry-After`, or null when absent/unusable.
 * @param args.budgetMs       Override for the wait budget; defaults to policy.
 */
export function planVaApiRateLimitRetry(args: {
  attempt: number;
  retryAfterMs: number | null | undefined;
  budgetMs?: number;
  random?: () => number;
}): VaApiRateLimitRetryDecision {
  if (args.attempt > VA_API_MAX_RETRIES) {
    return { retry: false, reason: "attempts-exhausted" };
  }

  const instructed = args.retryAfterMs;
  // A negative value is not an instruction this parser can produce, and a
  // non-finite one cannot be waited out. Both mean the response did not tell us
  // when to return, so there is nothing to honor.
  if (
    instructed === null ||
    instructed === undefined ||
    !Number.isFinite(instructed)
  ) {
    return { retry: false, reason: "retry-after-unusable" };
  }
  if (instructed > (args.budgetMs ?? VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS)) {
    return { retry: false, reason: "retry-after-exceeds-budget" };
  }

  return {
    retry: true,
    // Never less than the upstream asked for, and never less than the backoff
    // floor: `Retry-After: 0` authorizes an immediate retry, which the floor
    // turns into the smallest legal delay instead of a second concurrent burst.
    delayMs: Math.max(instructed, vaApiRetryDelayMs(args.attempt, args.random)),
    retryAfterMs: instructed,
  };
}

/** Outcome of validating one upstream payload against its schema. */
export type VaApiPayloadParse<T> = { ok: true; data: T } | { ok: false };

/**
 * Validate one upstream payload, turning a schema mismatch into a value.
 *
 * Error detail is intentionally discarded. A Zod issue list carries paths and
 * "received" descriptions derived from the upstream document, so returning it
 * would let a malformed response choose part of what a caller logs or renders.
 * `ok: false` is everything the fallback path needs, and the caller's own
 * observation already records the content-free fact that validation failed.
 */
export function parseVaApiPayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): VaApiPayloadParse<T> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { ok: false };
  return { ok: true, data: parsed.data };
}
