import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function readRunState(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeRunState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

export function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

export function startBackgroundRun({ file, script, argv, cwd, env }) {
  if (fs.existsSync(file)) {
    const previous = readRunState(file);
    if (previous.status === "running" && processIsAlive(previous.pid)) {
      throw new Error(`A sentinel run is already active (pid ${previous.pid}); use --wait.`);
    }
  }
  const logPath = `${file}.log`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const log = fs.openSync(logPath, "a");
  const runId = crypto.randomUUID();
  const child = spawn(process.execPath, [script, ...argv], {
    cwd, env: { ...env, SENTINEL_RUN_STATE: file, SENTINEL_RUN_ID: runId },
    detached: true, stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  child.unref();
  // Child writes authoritative progress/completion after its CLI initializes.
  const state = { runId, pid: child.pid, status: "running", startedAt: new Date().toISOString(), logPath };
  writeRunState(file, state);
  return state;
}

/** Timeout returns pending (exit 2), NEVER passed, and leaves the run intact. */
export async function waitForRun({ file, timeoutMs, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), alive = processIsAlive }) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const state = readRunState(file);
    if (state.status === "completed") return { ...state, pending: false };
    if (!alive(state.pid)) return { ...state, pending: false, exitCode: 1, reason: "runner-exited-without-result" };
    const remaining = deadline - now();
    if (remaining <= 0) return { ...state, pending: true, exitCode: 2 };
    await sleep(Math.min(1_000, remaining));
  }
}
