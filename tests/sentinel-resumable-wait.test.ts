import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { waitForCondition } from "../scripts/lib/sentinel-wait.mjs";
import { readRunState, waitForRun, writeRunState } from "../scripts/lib/sentinel-run-state.mjs";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function stateFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-wait-"));
  dirs.push(dir);
  return path.join(dir, "run.json");
}

describe("sentinel bounded waits", () => {
  it("resumes polling after transient stalls without overlapping probes", async () => {
    let time = 0;
    let calls = 0;
    let active = 0;
    await waitForCondition({ label: "OCR", timeoutMs: 100, intervalMs: 10, now: () => time,
      sleep: async (ms: number) => { time += ms; },
      probe: async (budget: number) => {
        expect(budget).toBeLessThanOrEqual(100);
        expect(++active).toBe(1);
        active--;
        if (++calls === 1) throw new Error("transient CDP stall");
        return calls === 3;
      },
    });
    expect(calls).toBe(3);
  });

  it("does not renew the deadline on repeated errors", async () => {
    let time = 0;
    await expect(waitForCondition({ label: "OCR", timeoutMs: 25, intervalMs: 10, now: () => time,
      sleep: async (ms: number) => { time += ms; }, probe: async () => { throw new Error("stall"); },
    })).rejects.toThrow(/timed out waiting for OCR/);
    expect(time).toBe(25);
  });

  it("returns pending then resumes the same run to completion", async () => {
    const file = stateFile();
    const state = { runId: "same-run", pid: 1234, status: "running", logPath: "run.log" };
    writeRunState(file, state);
    let time = 0;
    const clock = { now: () => time, alive: () => true, sleep: async (ms: number) => { time += ms; } };
    expect(await waitForRun({ file, timeoutMs: 20, ...clock })).toMatchObject({ pending: true, exitCode: 2, runId: "same-run" });
    expect(readRunState(file)).toEqual(state);
    writeRunState(file, { ...state, status: "completed", exitCode: 0 });
    expect(await waitForRun({ file, timeoutMs: 20, ...clock })).toMatchObject({ pending: false, exitCode: 0, runId: "same-run" });
  });

  it("never treats a missing result, dead process or failed run as a pass", async () => {
    const file = stateFile();
    await expect(waitForRun({ file, timeoutMs: 1 })).rejects.toThrow();
    writeRunState(file, { pid: 1234, status: "running" });
    expect(await waitForRun({ file, timeoutMs: 1, alive: () => false })).toMatchObject({ exitCode: 1, reason: "runner-exited-without-result" });
    writeRunState(file, { status: "completed", exitCode: 1 });
    expect(await waitForRun({ file, timeoutMs: 1 })).toMatchObject({ exitCode: 1, pending: false });
  });
});
