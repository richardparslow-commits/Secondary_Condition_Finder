/**
 * Peak-preserving sampling for an operation with a bounded evidence history.
 *
 * The hostile-file harness measures the browser's process RSS while a scan runs.
 * A single before/after pair would miss the peak: Tesseract frees its image
 * buffers between pages and the renderer returns canvases to the pool, so RSS
 * can fall back before the run ends. The peak is therefore updated on *every*
 * sample, for as long as the run lasts, while only a bounded history is written
 * to the evidence file.
 *
 * Those two jobs are deliberately separate, and confusing them was a defect
 * (db2570ac): the loop used to stop observing once the retained list reached its
 * cap, and the peak was computed from that truncated list. At 250 ms a four-minute
 * scan is ~960 samples, so observation ended after ~100 s and a late high-memory
 * phase on a slow host would have failed a valid run. The retention cap bounds
 * the artifact, never the observation; the retained list still stores the newest
 * sample that exceeds its maximum, so it contains the peak it is presented
 * beside.
 *
 * The sampler is injectable (`sample`, `wait`, `intervalMs`, `retainLimit`) and
 * imports no browser or `ps`, so its peak-over-retention behaviour is exercised
 * by a fast unit test instead of a source-order assertion.
 */

import { setTimeout as delay } from "node:timers/promises";

export const DEFAULT_SAMPLE_INTERVAL_MS = 250;
export const DEFAULT_RETENTION_LIMIT = 400;

/**
 * Sample once per interval while `run` executes, returning the operation's
 * result alongside the retained history, the number of samples taken and the
 * peak over the whole run.
 *
 * `sample` may return `null` when the quantity cannot be read (no matching
 * process, unsupported platform); such an attempt counts for nothing, but the
 * loop keeps running, so a transient unreadable sample cannot end observation.
 *
 * @template T
 * @param {{
 *   run: () => Promise<T>,
 *   sample: () => number | null | undefined,
 *   intervalMs?: number,
 *   retainLimit?: number,
 *   wait?: (milliseconds: number) => Promise<unknown>,
 * }} options
 * @returns {Promise<{ result: T, samples: number[], sampleCount: number, peak: number | null }>}
 */
export async function sampleRssWhileRunning({
  run,
  sample,
  intervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
  retainLimit = DEFAULT_RETENTION_LIMIT,
  wait = delay,
}) {
  const samples = [];
  let sampleCount = 0;
  let peak = null;
  let stopping = false;
  const sampler = (async () => {
    while (!stopping) {
      const value = sample();
      if (value !== null && value !== undefined) {
        sampleCount += 1;
        if (peak === null || value > peak) peak = value;
        if (samples.length < retainLimit) {
          samples.push(value);
        } else if (value >= Math.max(...samples)) {
          samples[samples.length - 1] = value;
        }
      }
      await wait(intervalMs);
    }
  })();
  try {
    return { result: await run(), samples, sampleCount, peak };
  } finally {
    stopping = true;
    await sampler;
  }
}
