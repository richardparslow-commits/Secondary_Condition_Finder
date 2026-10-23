import { describe, expect, it } from "vitest";

import { sampleRssWhileRunning } from "../scripts/lib/rss-sampler.mjs";

/**
 * Browser-free regression for db2570ac.
 *
 * The hostile-file harness samples browser RSS while a long OCR scan runs. It
 * used to stop observing once the retained evidence list reached its 400-entry
 * cap and then compute the peak from that truncated list, so a high-memory phase
 * after ~100 s was invisible and a valid slow-host run failed. These cases drive
 * the real loop with a scripted sample stream and an immediate clock — no
 * browser, no `ps`, no 250 ms waits — and prove the peak advances after the
 * retained history is full.
 */

async function runScripted(values: Array<number | null>, retainLimit: number) {
  let index = 0;
  let waits = 0;
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });

  return sampleRssWhileRunning({
    run: () => finished,
    sample: () => (index < values.length ? values[index++] : null),
    intervalMs: 0,
    retainLimit,
    wait: async () => {
      waits += 1;
      if (waits === values.length + 2) finish();
    },
  });
}

describe("RSS sampler keeps the peak after its retained history fills up", () => {
  it("advances the peak from samples the capped history no longer stores", async () => {
    const result = await runScripted([10, 20, 30, 40, 50, 90], 3);

    // Observation ran past the cap: six samples were taken, only three retained.
    expect(result.sampleCount).toBe(6);
    expect(result.samples).toHaveLength(3);
    // The old code updated the peak only inside the cap check, so it would stop
    // at 30 here. 90 arrives after the list is full and must still win.
    expect(result.peak).toBe(90);
    // The retained history is illustrative, but it still contains the peak it is
    // presented beside.
    expect(result.samples.at(-1)).toBe(90);
    expect(result.samples).not.toContain(40);
  });

  it("keeps observing through an unreadable sample instead of ending the run", async () => {
    const result = await runScripted([100, null, null, 200, 300], 2);

    // Unreadable attempts are not samples, but they must not stop the loop.
    expect(result.sampleCount).toBe(3);
    expect(result.peak).toBe(300);
    expect(result.samples).toEqual([100, 300]);
  });
});
