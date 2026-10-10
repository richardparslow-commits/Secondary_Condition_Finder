import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createProgressReporter,
  formatDuration,
  summarizeProbe,
} from "../scripts/lib/sentinel-progress.mjs";

/**
 * Contract for the acceptance walk's progress heartbeats
 * (scripts/lib/sentinel-progress.mjs, wired into scripts/acceptance-browser-sentinel.mjs).
 *
 * The failure this exists for is a *wedge*: on a loaded host the browser stops
 * answering `Runtime.evaluate`, the condition the walk is waiting for never
 * becomes true, and the run looks identical to a slow one. The old output was
 * `waiting: <label> (120s)` — elapsed time and nothing else — so the diagnosis
 * lived only in the JSON report written after somebody killed the run.
 *
 * These cases pin the distinction: a probe that *answers* (even `false`) is a
 * target that is reachable, so the run is slow; consecutive probe *errors* are a
 * target that stopped answering, so the run is wedged; and no event of any kind
 * for far longer than the walk's own poll interval means something is stuck
 * outside the polling loop. Each must produce a different, greppable line.
 *
 * One more thing is pinned here because a real run got it wrong: the verdict must
 * name *what* stopped answering. The walk probes the browser and the app under
 * test alike, and the first version of this module reported "browser stopped
 * answering" for a dev server that was not listening.
 */

const WALK_SOURCE = fs.readFileSync(
  path.join(process.cwd(), "scripts/acceptance-browser-sentinel.mjs"),
  "utf8",
);

/** Reporter with an injectable clock, writer and timer. */
function makeReporter(options: { heartbeatMs?: number; stallMs?: number } = {}) {
  let time = 0;
  const lines: string[] = [];
  const timers: Array<() => void> = [];
  const handles = new Map<unknown, () => void>();
  const cleared: unknown[] = [];
  const unrefs: string[] = [];
  const reporter = createProgressReporter({
    now: () => time,
    write: (message: string) => lines.push(message),
    heartbeatMs: options.heartbeatMs ?? 1_000,
    stallMs: options.stallMs ?? 2_000,
    setIntervalFn: ((callback: () => void) => {
      const handle = {
        unref: () => unrefs.push("unref"),
        __timer: true,
      };
      handles.set(handle, callback);
      timers.push(callback);
      return handle as unknown as NodeJS.Timeout;
    }) as unknown as typeof setInterval,
    // Models the real thing: a cleared interval stops firing, so "stop() stopped
    // the heartbeats" is actually asserted rather than assumed.
    clearIntervalFn: ((timer: unknown) => {
      cleared.push(timer);
      const callback = handles.get(timer);
      if (!callback) return;
      const index = timers.indexOf(callback);
      if (index >= 0) timers.splice(index, 1);
    }) as unknown as typeof clearInterval,
  });
  return {
    reporter,
    lines,
    timers,
    cleared,
    unrefs,
    advance: (ms: number) => {
      time += ms;
    },
    tick: () => {
      for (const callback of timers) callback();
    },
    progressLines: () => lines.filter((line) => line.startsWith("progress ")),
  };
}

describe("progress heartbeat formatting", () => {
  it("renders compact durations", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(9_400)).toBe("9s");
    expect(formatDuration(65_000)).toBe("1m05s");
    expect(formatDuration(3_725_000)).toBe("1h02m");
  });

  it("spells out the probe results that matter, and keeps every summary on one line", () => {
    expect(summarizeProbe(true)).toBe("returned true");
    expect(summarizeProbe(false)).toBe("returned false");
    expect(summarizeProbe(undefined)).toBe("no result yet");
    expect(summarizeProbe(7)).toBe("returned 7");
    expect(summarizeProbe("CDP Runtime.evaluate timed out")).toBe("CDP Runtime.evaluate timed out");
    expect(summarizeProbe("line one\nline two\n\nline three")).toBe("line one line two line three");
    expect(summarizeProbe("")).toBe("(empty)");

    const long = summarizeProbe("x".repeat(500));
    expect(long.length).toBeLessThanOrEqual(121);
    expect(long.endsWith("…")).toBe(true);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(summarizeProbe(circular)).toBe("(unserializable)");
  });
});

describe("progress heartbeats distinguish a wedge from a slow run", () => {
  it("reports a page that answers (even 'false') as slow, never as stalled", () => {
    const { reporter, lines, advance } = makeReporter();

    reporter.phase("browser-local OCR (tesseract workers)");
    for (let i = 0; i < 8; i += 1) {
      advance(500);
      reporter.probe({ label: "local OCR completion message", elapsedMs: i * 500, last: false });
    }
    advance(1_000);

    const line = reporter.describe();
    expect(line).toContain('phase "browser-local OCR (tesseract workers)"');
    expect(line).toMatch(/waiting \d+s on "local OCR completion message"/);
    expect(line).toContain("OK: still answering");
    expect(line).toContain("last probe returned false");
    expect(line).not.toContain("STALLED");
    expect(lines.join("\n")).toContain("phase 0s: browser-local OCR");
  });

  it("reports consecutive probe errors as a wedged browser, with the last error", () => {
    const { reporter, advance } = makeReporter();

    reporter.phase("browser-local OCR (tesseract workers)");
    for (let i = 0; i < 6; i += 1) {
      advance(400);
      // Every probe throws: the browser stopped answering Runtime.evaluate.
      reporter.probe({
        label: "local OCR completion message",
        elapsedMs: i * 400,
        last: "CDP Runtime.evaluate timed out",
        status: "error",
      });
    }

    const line = reporter.describe();
    expect(line).toContain("STALLED:unresponsive");
    expect(line).toContain('"local OCR completion message" stopped answering: 6 consecutive probe errors');
    expect(line).toContain("last: CDP Runtime.evaluate timed out");
  });

  it("names what stopped answering instead of blaming the browser by default", () => {
    // Regression: the first version of this module said "browser stopped
    // answering" for every stall. A real walk that wedged because the app under
    // test was not listening logged exactly that, which points the reader at
    // Chrome when the dev server is the process that is missing.
    const { reporter, advance } = makeReporter();

    reporter.phase("preconditions (health, schema inventory)");
    for (let i = 0; i < 5; i += 1) {
      advance(300);
      reporter.probe({ label: "app health", elapsedMs: i * 300, last: "fetch failed", status: "error" });
    }

    const line = reporter.describe();
    expect(line).toContain('"app health" stopped answering: 5 consecutive probe errors');
    expect(line).toContain("last: fetch failed");
    expect(line).not.toContain("browser");
    expect(reporter.describeWait("app health")).not.toContain("browser");
    expect(reporter.snapshot().detail).not.toContain("browser");
  });

  it("recovers the 'responding' verdict as soon as a probe answers again", () => {
    const { reporter, advance } = makeReporter();

    for (let i = 0; i < 4; i += 1) {
      advance(400);
      reporter.probe({ label: "step 5 suggestions", elapsedMs: i * 400, last: "CDP timed out", status: "error" });
    }
    expect(reporter.describe()).toContain("STALLED:unresponsive");

    advance(400);
    reporter.probe({ label: "step 5 suggestions", elapsedMs: 2_000, last: false });
    const line = reporter.describe();
    expect(line).toContain("OK: still answering");
    expect(line).not.toContain("STALLED");
  });

  it("reports a stall outside any polling loop, and clears it on the next event", () => {
    const { reporter, advance } = makeReporter();

    reporter.phase("launching Chrome and attaching CDP");
    advance(3_000);
    const stalled = reporter.describe();
    expect(stalled).toContain("STALLED:no-progress");
    expect(stalled).toContain("no observable progress for 3s");
    expect(stalled).toContain('last event: phase "launching Chrome and attaching CDP"');

    reporter.event('assertion "dev server healthy before the walk" passed');
    const recovered = reporter.describe();
    expect(recovered).toContain("OK");
    expect(recovered).not.toContain("STALLED");
    expect(recovered).toContain("assertion");
  });

  it("says which of the two failures a timed-out wait actually was", () => {
    const wedged = makeReporter();
    for (let i = 0; i < 4; i += 1) {
      wedged.advance(400);
      wedged.reporter.probe({ label: "local OCR completion message", elapsedMs: i * 400, last: "CDP Runtime.evaluate timed out", status: "error" });
    }
    const wedgeText = wedged.reporter.describeWait("local OCR completion message");
    expect(wedgeText).toContain('stalled on "local OCR completion message"');
    expect(wedgeText).toContain("this is a wedge, not a slow run");

    const slow = makeReporter();
    for (let i = 0; i < 40; i += 1) {
      slow.advance(400);
      slow.reporter.probe({ label: "local OCR completion message", elapsedMs: i * 400, last: false });
    }
    const slowText = slow.reporter.describeWait("local OCR completion message");
    expect(slowText).toContain("it kept answering (last probe returned false)");
    expect(slowText).toContain("never became true rather than the target wedging");
  });
});

describe("progress heartbeat scheduling and snapshot", () => {
  it("throttles to the heartbeat interval, then keeps reporting while a wait is active", () => {
    const { reporter, advance, tick, progressLines } = makeReporter({ heartbeatMs: 1_000 });

    reporter.start();
    reporter.phase("preconditions (health, schema inventory)");
    expect(progressLines()).toHaveLength(0);

    advance(500);
    tick();
    expect(progressLines()).toHaveLength(0);

    advance(600); // 1.1s in
    tick();
    expect(progressLines()).toHaveLength(1);

    // An active wait keeps producing heartbeats without new phases.
    advance(1_100);
    reporter.probe({ label: "app health", elapsedMs: 100, last: "HTTP 503" });
    tick();
    expect(progressLines()).toHaveLength(2);
    expect(progressLines().at(-1)).toContain('waiting 0s on "app health"');

    // ...and stops once the timer is cleared.
    reporter.stop();
    advance(10_000);
    tick();
    expect(progressLines()).toHaveLength(2);
  });

  it("does not keep the process alive, and start/stop are idempotent", () => {
    const { reporter, timers, cleared, unrefs, advance, tick, progressLines } = makeReporter();

    reporter.start();
    expect(timers).toHaveLength(1);
    expect(unrefs).toHaveLength(1);

    // A heartbeat must never be the reason the process stays alive.
    reporter.start();
    expect(timers).toHaveLength(1);

    reporter.stop();
    expect(cleared).toHaveLength(1);
    reporter.stop();
    expect(cleared).toHaveLength(1);

    advance(20_000);
    tick();
    expect(progressLines()).toHaveLength(0);
  });

  it("exposes a serializable snapshot that carries the same verdict as the log line", () => {
    const { reporter, advance, tick } = makeReporter();
    reporter.start();
    reporter.phase("surface scan, final assertions and report");
    reporter.event('assertion "OCR analysis retained in browser storage" passed');
    for (let i = 0; i < 5; i += 1) {
      advance(400);
      reporter.probe({ label: "local OCR completion message", elapsedMs: i * 400, last: "CDP Runtime.evaluate timed out", status: "error" });
    }
    advance(1_100);
    tick();

    const snapshot = reporter.snapshot();
    expect(snapshot).toMatchObject({
      phase: "surface scan, final assertions and report",
      waitLabel: "local OCR completion message",
      probes: 5,
      consecutiveProbeErrors: 5,
      lastProbeSummary: "CDP Runtime.evaluate timed out",
      state: "unresponsive",
    });
    expect(snapshot.heartbeats).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("the walk wires the heartbeats and cannot regress to elapsed-time-only output", () => {
  it("starts and stops the reporter around the run", () => {
    expect(WALK_SOURCE).toContain("const progress = createProgressReporter();");
    expect(WALK_SOURCE).toMatch(/async function run\(\) \{\n  progress\.start\(\);/);
    expect(WALK_SOURCE).toMatch(/} finally \{\n  \/\/ Stop the heartbeats first[\s\S]{0,80}progress\.stop\(\);/);
  });

  it("names a phase before each stretch that can run long", () => {
    for (const phase of [
      "scanner self-test (positive control)",
      "preconditions (health, schema inventory)",
      "launching Chrome and attaching CDP",
      "Pass A — real UI walk",
      "browser-local OCR (tesseract workers)",
      "private-field positive controls",
      "Pass B — seeded browser record",
      "surface scan, final assertions and report",
    ]) {
      expect(WALK_SOURCE, `missing phase label: ${phase}`).toContain(`progress.phase("${phase}")`);
    }
  });

  it("records probe outcomes and progress events instead of printing elapsed time", () => {
    // The old heartbeat: elapsed seconds, and nothing about whether anything was
    // still moving.
    expect(WALK_SOURCE).not.toContain("waiting: ${label}");
    expect(WALK_SOURCE).toContain("progress.probe({ label, elapsedMs, last, status })");
    expect(WALK_SOURCE).toContain('progress.event(`assertion "${name}"');
    expect(WALK_SOURCE).toContain('progress.event(`step "${name}" recorded`)');
    // The shared wait must report *why* a probe failed, not only its message.
    const waitSource = fs.readFileSync(
      path.join(process.cwd(), "scripts/lib/sentinel-wait.mjs"),
      "utf8",
    );
    expect(waitSource).toContain("onProgress({ label, elapsedMs: now() - started, last, status })");
  });

  it("puts the wedge diagnosis in the timeout message and in both reports", () => {
    expect(WALK_SOURCE).toMatch(/throw new Error\(`\$\{error\.message\} — \$\{progress\.describeWait\(label\)\}`\)/);
    expect(WALK_SOURCE).toContain('`${label} never became ready: ${lastError?.message ?? "timeout"} — ${progress.describeWait(label)}`');
    // The passing report and the runner-error report both carry the snapshot, so
    // a run that had to be killed still says where it stalled.
    expect(WALK_SOURCE.match(/progress: progress\.snapshot\(\),/g) ?? []).toHaveLength(2);
  });
});
