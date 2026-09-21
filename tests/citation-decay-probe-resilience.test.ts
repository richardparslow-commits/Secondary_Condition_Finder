import { describe, expect, it } from "vitest";

import {
  isTransientProbeResult,
  mapWithConcurrency,
  PROBE_CONCURRENCY,
  PROBE_INTER_REQUEST_DELAY_MS,
  PER_HOST_MIN_INTERVAL_MS,
  TRANSIENT_MAX_RETRIES,
  TRANSIENT_RETRY_STATUSES,
} from "../scripts/audit-citation-decay";

/**
 * The decay probe originally fired every URL concurrently. Hosts like PubMed
 * throttle bursts with 429s, and the audit reported hundreds of phantom
 * "decayed" rows — a false alarm that swamped the real dead-link queue (the
 * 2026-09-21 run labeled all 370 live probes dead). These tests pin the
 * resilience contract that keeps throttling from being misreported as rot:
 * transient statuses are retried, probes run through a bounded pool, and
 * per-host spacing keeps a single host from being hammered. The HTTP layer
 * itself is not exercised (no network in unit tests).
 */
describe("decay probe resilience", () => {
  it("retries throttling and transient gateway statuses before believing them", () => {
    for (const status of [425, 429, 500, 502, 503, 504]) {
      expect(isTransientProbeResult({ status }), String(status)).toBe(true);
    }
    // Network failure (no status) is transient too.
    expect(isTransientProbeResult({ status: 0 })).toBe(true);
  });

  it("does not retry statuses that are real probe verdicts", () => {
    for (const status of [200, 301, 403, 404, 410]) {
      expect(isTransientProbeResult({ status }), String(status)).toBe(false);
    }
  });

  it("runs probes through a bounded pool that preserves input order", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return i;
      }),
      3,
    );
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("keeps politeness knobs gentle enough to avoid host throttling", () => {
    // The burst that produced 370 phantom 429s ran with unbounded concurrency
    // and zero spacing. The knobs must stay small and the per-host floor must
    // stay well above zero.
    expect(PROBE_CONCURRENCY).toBeLessThanOrEqual(4);
    expect(PROBE_INTER_REQUEST_DELAY_MS).toBeGreaterThan(0);
    expect(PER_HOST_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(500);
    expect(TRANSIENT_MAX_RETRIES).toBeGreaterThanOrEqual(2);
    expect(TRANSIENT_RETRY_STATUSES.has(429)).toBe(true);
  });
});
