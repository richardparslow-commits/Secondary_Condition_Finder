#!/usr/bin/env node
/**
 * Repeatable, unattended entrypoint for the PRIV-01 stage-4 browser sentinel.
 *
 * The stage-4 walk in scripts/acceptance-browser-sentinel.mjs scans the dev
 * server's *own* log, so it has to be pointed at a server it drove. Until now
 * that pairing lived in a shell block inside .github/workflows/ci.yml —
 * `npm run dev & sleep-and-curl /api/health`, then the runner, with a `trap` for
 * teardown. That made the acceptance contract runnable from exactly one place,
 * with the shell's exit status deciding, and nothing checked the evidence the
 * runner wrote.
 *
 * This entrypoint owns both jobs:
 *
 *   npm run acceptance:sentinel                 # reuse a running dev server, else start one
 *   npm run acceptance:sentinel -- --dry-run    # resolve the plan only
 *   npm run acceptance:sentinel -- --base http://127.0.0.1:3107
 *                                               # drive an app that is already up
 *   npm run acceptance:sentinel -- --no-reuse   # always start a fresh dev server
 *
 * Reuse is the default because Next keeps a per-project dev lock: while any
 * `next dev` holds this checkout, a second one refuses to start, so a managed
 * start would fail rather than run. When that lock names a live server whose own
 * log exists, the walk drives that server instead, and leaves it running because
 * this process did not start it. `--no-reuse` / SENTINEL_NO_REUSE opts out and
 * restores the start-fresh behaviour.
 *
 * It is deliberately fail-closed, in the same spirit as the CI gate:
 *
 *   - a missing browser, a server that never answers `/api/health`, or a missing
 *     runner script is a failure (exit 1), never a skip;
 *   - the sentinel's exit code is propagated, and a *second* independent signal
 *     is checked too: a zero exit with a report that says `failed`,
 *     `runner-error`, or that is missing entirely is still a failure, so a
 *     runner that forgets to set its exit code cannot turn a regression green;
 *   - a dev server this run started is stopped on every path — success,
 *     regression, thrown error, or SIGINT/SIGTERM — and the whole process group
 *     is signalled, not just the `npm` wrapper that spawned `next dev`; a server
 *     that was already running is left alone.
 *
 * Nothing here weakens the sentinel: it does not touch the walk, its assertions,
 * or its report. It only decides how the app is started, how the walk is
 * invoked, and what counts as a completed run.
 *
 * Exit codes: 0 passed; 1 any failure (no browser, unhealthy server, missing
 * report, regression, runner error); 130/143 when interrupted.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { pathToFileURL } from "node:url";

import { readRunState, startBackgroundRun, waitForRun, writeRunState } from "./lib/sentinel-run-state.mjs";

export const SENTINEL_SCRIPT = "scripts/acceptance-browser-sentinel.mjs";
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 3117;
export const DEFAULT_READY_TIMEOUT_MS = 120_000;
export const DEFAULT_ARTIFACT_DIR = path.join("tmp", "acceptance-sentinel");

/**
 * Browsers the walk can drive, in the order we trust them. `CHROME_PATH` always
 * wins (CI resolves it with `command -v`); the rest cover a developer machine
 * without one, so `npm run acceptance:sentinel` is repeatable unattended.
 */
const BROWSER_CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Chromium\\Application\\chrome.exe",
  ],
};

const PATH_BROWSER_NAMES = {
  darwin: ["google-chrome", "chromium"],
  linux: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"],
  win32: ["chrome.exe", "chromium.exe"],
};

const USAGE = `Usage: npm run acceptance:sentinel -- [options]

Options:
  --port <n>            port for the managed dev server (default ${DEFAULT_PORT})
  --base <url>          drive an already-running app instead of managing one
  --ready-timeout <ms>  how long to wait for /api/health (default ${DEFAULT_READY_TIMEOUT_MS})
  --server-log <path>   where the managed server writes its log
  --report <path>       where the sentinel writes its evidence JSON
  --background          start a durable run and return immediately
  --wait                wait for the existing background run (safe to repeat)
  --wait-timeout <ms>    bounded client wait (default 30000; pending exits 2)
  --state <path>         run status file (default tmp/acceptance-sentinel/run.json)
  --keep-server         leave the managed server running (for debugging)
  --no-reuse            always start a fresh dev server (default: reuse one already running)
  --dry-run             resolve and print the plan, then exit
  --help                print this message

Environment: CHROME_PATH, SENTINEL_APP_BASE, SENTINEL_RUN_PORT,
SENTINEL_READY_TIMEOUT_MS, SENTINEL_SERVER_LOG, SENTINEL_REPORT_PATH,
SENTINEL_NO_REUSE.`;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * True when an opt-in environment marker is set to anything but a false value.
 * `""`, `"0"` and `"false"` all count as unset, because those shapes get written
 * into shell profiles and CI images as placeholders; treating one as "on" would
 * silently flip a mode the operator did not ask for.
 *
 * @param {string | undefined} value
 */
function envFlagSet(value) {
  const trimmed = value?.trim();
  return (
    trimmed !== undefined &&
    trimmed !== "" &&
    trimmed !== "0" &&
    trimmed.toLowerCase() !== "false"
  );
}

/**
 * @param {string[]} [argv]
 * @returns {{ help?: boolean, dryRun?: boolean, keepServer?: boolean, noReuse?: boolean, port?: string, base?: string, readyTimeout?: string, serverLog?: string, report?: string }}
 */
export function parseArgs(argv = []) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--help":
      case "-h":
        flags.help = true;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--keep-server":
        flags.keepServer = true;
        break;
      case "--no-reuse":
        flags.noReuse = true;
        break;
      case "--port":
      case "--base":
      case "--ready-timeout":
      case "--server-log":
      case "--report": {
        const value = argv[index + 1];
        if (value === undefined || value.startsWith("--")) {
          throw new Error(`${token} needs a value`);
        }
        flags[{ "--port": "port", "--base": "base", "--ready-timeout": "readyTimeout", "--server-log": "serverLog", "--report": "report" }[token]] = value;
        index += 1;
        break;
      }
      default:
        throw new Error(`unknown option: ${token}\n\n${USAGE}`);
    }
  }
  return flags;
}

/**
 * @param {string | number} value
 * @param {string} source
 * @returns {number}
 */
function assertPort(value, source) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${source} must be an integer between 1 and 65535 (got ${JSON.stringify(value)})`);
  }
  return port;
}

/**
 * @typedef {object} RunConfig
 * @property {boolean} help
 * @property {string} usage
 * @property {boolean} manageServer
 * @property {string} appBase
 * @property {string} host
 * @property {number} port
 * @property {number} readyTimeoutMs
 * @property {string} serverLogPath
 * @property {string} reportPath
 * @property {string} sentinelScript
 * @property {string} artifactDir
 * @property {boolean} keepServer
 * @property {boolean} reuseServer
 * @property {boolean} dryRun
 * @property {string | null} chromePath
 * @property {Record<string, string | undefined>} env
 * @property {string} cwd
 * @property {string | null} [browserPath]
 */

/**
 * Resolves the run plan from flags and environment. Always returns the same
 * shape, so callers never have to narrow a help branch out of a union.
 *
 * @param {{ env?: Record<string, string | undefined>, argv?: string[], cwd?: string }} [options]
 * @returns {RunConfig}
 */
export function resolveRunConfig({ env = process.env, argv = [], cwd = process.cwd() } = {}) {
  const flags = parseArgs(argv);

  const externalBase = flags.base ?? env.SENTINEL_APP_BASE ?? null;
  if (externalBase !== null && !/^https?:\/\//.test(externalBase)) {
    throw new Error(`--base/SENTINEL_APP_BASE must be an http(s) URL (got ${externalBase})`);
  }

  const portValue = flags.port ?? env.SENTINEL_RUN_PORT ?? DEFAULT_PORT;
  const port = assertPort(portValue, flags.port === undefined ? "SENTINEL_RUN_PORT" : "--port");

  const timeoutValue = flags.readyTimeout ?? env.SENTINEL_READY_TIMEOUT_MS ?? DEFAULT_READY_TIMEOUT_MS;
  const readyTimeoutMs = Number(timeoutValue);
  if (!Number.isFinite(readyTimeoutMs) || readyTimeoutMs <= 0) {
    throw new Error(`--ready-timeout must be a positive number of milliseconds (got ${JSON.stringify(timeoutValue)})`);
  }

  const artifactDir = path.resolve(cwd, DEFAULT_ARTIFACT_DIR);
  const serverLogPath = path.resolve(
    cwd,
    flags.serverLog ?? env.SENTINEL_SERVER_LOG ?? path.join(DEFAULT_ARTIFACT_DIR, "dev-server.log"),
  );
  const reportPath = path.resolve(
    cwd,
    flags.report ?? env.SENTINEL_REPORT_PATH ?? path.join(DEFAULT_ARTIFACT_DIR, "evidence.json"),
  );
  const sentinelScript = path.resolve(cwd, SENTINEL_SCRIPT);
  // Explicit opt-out from reuse. `--no-reuse` wins, and SENTINEL_NO_REUSE accepts
  // the same "set, and not a false value" shapes as the runtime markers elsewhere.
  const noReuse = Boolean(flags.noReuse) || envFlagSet(env.SENTINEL_NO_REUSE);

  return {
    help: Boolean(flags.help),
    usage: USAGE,
    manageServer: externalBase === null,
    appBase: externalBase ?? `http://${DEFAULT_HOST}:${port}`,
    host: DEFAULT_HOST,
    port,
    readyTimeoutMs,
    serverLogPath,
    reportPath,
    sentinelScript,
    artifactDir,
    keepServer: Boolean(flags.keepServer),
    reuseServer: !noReuse,
    dryRun: Boolean(flags.dryRun),
    chromePath: env.CHROME_PATH ?? null,
    env,
    cwd,
  };
}

/**
 * Resolves the browser binary the walk will drive. Pure with respect to its
 * injected `exists`/`pathEnv`, so the resolution order is testable without a
 * browser installed.
 *
 * @param {{ env?: Record<string, string | undefined>, platform?: string, exists?: (candidate: string) => boolean, pathEnv?: string }} [options]
 * @returns {string | null}
 */
export function resolveBrowserExecutable({
  env = process.env,
  platform = process.platform,
  exists = fs.existsSync,
  pathEnv = process.env.PATH ?? "",
} = {}) {
  const explicit = env.CHROME_PATH;
  if (explicit) return exists(explicit) ? explicit : null;

  for (const candidate of BROWSER_CANDIDATES[platform] ?? BROWSER_CANDIDATES.linux) {
    if (exists(candidate)) return candidate;
  }

  const names = PATH_BROWSER_NAMES[platform] ?? PATH_BROWSER_NAMES.linux;
  for (const directory of pathEnv.split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (exists(candidate)) return candidate;
    }
  }

  return null;
}

/**
 * Polls `/api/health` until the app answers or the budget runs out. A server
 * that is still compiling is indistinguishable from one that is not starting,
 * which is why this is bounded rather than open-ended.
 *
 * @param {{ url: string, timeoutMs: number, intervalMs?: number, fetchImpl?: (input: string, init?: object) => Promise<{ ok?: boolean } | undefined>, sleep?: (ms: number) => Promise<void>, now?: () => number }} options
 * @returns {Promise<boolean>}
 */
export async function waitForHealth({
  url,
  timeoutMs,
  intervalMs = 2_000,
  fetchImpl = fetch,
  sleep = delay,
  now = Date.now,
} = {}) {
  const deadline = now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(Math.max(1, Math.min(5_000, deadline - now()))) });
      if (response?.ok) return true;
    } catch {
      // Not up yet.
    }
    const remaining = deadline - now();
    if (remaining <= 0) return false;
    await sleep(Math.min(intervalMs, remaining));
  }
}

/**
 * Spawns a long-running command with its output appended to `logPath`, in its
 * own process group where the platform supports it, so teardown can signal the
 * whole tree (`npm run dev` → `next dev`) instead of orphaning the child.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, logPath: string }} options
 */
export function spawnLogged(command, args, { cwd, env, logPath } = /** @type {any} */ ({})) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = fs.openSync(logPath, "a");
  const child = spawn(command, args, {
    cwd,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", logFd, logFd],
  });
  child.on("error", () => {
    try {
      fs.closeSync(logFd);
    } catch {
      // Best effort.
    }
  });
  return { child, logFd, logPath, pid: child.pid };
}

/**
 * Stops a spawned server. Returns what it did, so callers (and tests) can tell
 * "we signalled it" from "it was already gone" — a teardown that silently
 * matched nothing must not look like a teardown.
 */
/**
 * @param {{ child?: import("node:child_process").ChildProcess } | import("node:child_process").ChildProcess | null} spawned
 * @param {{ platform?: string, timeoutMs?: number, spawnSyncImpl?: typeof spawnSync, kill?: (pid: number, signal?: string | number) => void }} [options]
 * @returns {string}
 */
export function stopProcessTree(
  spawned,
  { platform = process.platform, timeoutMs = 5_000, spawnSyncImpl = spawnSync, kill = process.kill.bind(process) } = {},
) {
  const child = spawned?.child ?? spawned;
  if (!child || child.exitCode !== null || child.signalCode !== null) return "already-exited";

  if (platform === "win32") {
    spawnSyncImpl("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return "taskkill";
  }

  try {
    kill(-child.pid, "SIGTERM");
    return "group-sigterm";
  } catch {
    try {
      child.kill("SIGTERM");
      return "sigterm";
    } catch {
      return "already-gone";
    }
  } finally {
    // Escalate only if the tree is still there after the grace period.
    const pid = child.pid;
    setTimeout(() => {
      try {
        kill(-pid, "SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          // Gone already.
        }
      }
    }, timeoutMs).unref?.();
  }
}

/**
 * @param {import("node:child_process").ChildProcess} child
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
/**
 * The tail of the managed server's log, so a failure says *why* without the
 * operator having to open the file. Next's per-project dev lock, for example,
 * refuses a second server and prints the already-running one's port and pid.
 *
 * @param {string} logPath
 * @param {{ lines?: number, readFile?: (path: string, encoding: string) => string }} [options]
 * @returns {string}
 */
export function serverLogTail(logPath, { lines = 12, readFile = fs.readFileSync } = {}) {
  let raw;
  try {
    raw = readFile(logPath, "utf8");
  } catch {
    return `(no server log at ${logPath})`;
  }
  const trimmed = raw.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").split("\n").filter((line) => line.trim().length > 0);
  if (trimmed.length === 0) return `(server log at ${logPath} is empty)`;
  return `${logPath}:\n${trimmed.slice(-lines).join("\n")}`;
}

/**
 * Waits for the app to answer, or for the server to die trying. A server that
 * exits before health (a wrong port, a project-level dev lock, a build error)
 * must fail immediately with its log tail rather than burn the whole readiness
 * budget, because in an unattended run nobody is watching the timeout.
 *
 * @param {{ checkHealth: (config: RunConfig) => Promise<boolean>, config: RunConfig, serverChild: any, waitForExitImpl?: (child: any, timeoutMs: number) => Promise<boolean> }} options
 * @returns {Promise<{ kind: "health", healthy: boolean } | { kind: "exit" }>}
 */
export async function waitForHealthOrExit({ checkHealth, config, serverChild, waitForExitImpl = waitForExit }) {
  const healthPromise = checkHealth(config).then((healthy) => ({ kind: /** @type {const} */ ("health"), healthy }));
  if (!serverChild || typeof serverChild.once !== "function") return healthPromise;
  const exitPromise = waitForExitImpl(serverChild, config.readyTimeoutMs + 1_000).then(() => ({
    kind: /** @type {const} */ ("exit"),
  }));
  return Promise.race([healthPromise, exitPromise]);
}

/**
 * @param {import("node:child_process").ChildProcess} child
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function waitForExit(child, timeoutMs = 10_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => { clearTimeout(timer); resolve(true); };
    const timer = setTimeout(() => { child.removeListener("exit", onExit); resolve(false); }, timeoutMs);
    timer.unref?.();
    child.once("exit", onExit);
  });
}

/** Refuse an occupied port instead of accepting another server's health. */
export function assertServerPortAvailable(config) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`Port ${config.port} is occupied; use --base with that server's --server-log, or choose a free --port.`)));
    probe.listen(config.port, config.host, () => probe.close(resolve));
  });
}

// ---------------------------------------------------------------------------
// Reusing a dev server that is already running for this project
// ---------------------------------------------------------------------------

/**
 * Where Next 16 records the dev server it started for *this* checkout, and where
 * that server writes its own log.
 *
 * The lock is the same artifact that makes a second `next dev` refuse to start,
 * so it is the authoritative answer to "is a dev server already running for this
 * project?" — including the pid, port and URL the server actually chose. Reading
 * it is what lets the entrypoint drive that server instead of spawning a process
 * Next will immediately refuse, which used to turn "a server is already up" into
 * a harness failure.
 */
export const NEXT_DEV_LOCK_PATH = path.join(".next", "dev", "lock");
export const NEXT_DEV_LOG_PATH = path.join(".next", "dev", "logs", "next-development.log");

/**
 * Parses Next's dev lock. Returns null for anything unusable — a missing file, a
 * partially written one, or one that names neither a URL nor a port — so a
 * corrupt lock can never be mistaken for a running server.
 *
 * @param {string} lockPath
 * @param {{ readFile?: (path: string, encoding: string) => string }} [options]
 * @returns {{ pid: number, port: number | null, hostname: string, appUrl: string, startedAt: number | null } | null}
 */
export function readDevServerLock(lockPath, { readFile = fs.readFileSync } = {}) {
  let raw;
  try {
    raw = readFile(lockPath, "utf8");
  } catch {
    return null;
  }
  let lock;
  try {
    lock = JSON.parse(raw);
  } catch {
    return null;
  }
  const pid = Number(lock?.pid);
  if (!Number.isInteger(pid) || pid <= 0) return null;

  const portValue = Number(lock?.port);
  const port = Number.isInteger(portValue) && portValue > 0 && portValue <= 65_535 ? portValue : null;
  const hostname = typeof lock?.hostname === "string" && lock.hostname ? lock.hostname : DEFAULT_HOST;
  const appUrl =
    typeof lock?.appUrl === "string" && /^https?:\/\//.test(lock.appUrl)
      ? lock.appUrl
      : port !== null
        ? `http://${hostname}:${port}`
        : null;
  if (appUrl === null) return null;

  const startedAt = Number(lock?.startedAt);
  return { pid, port, hostname, appUrl, startedAt: Number.isFinite(startedAt) ? startedAt : null };
}

/**
 * Whether a pid is still running. `EPERM` means the process exists but belongs to
 * another user, which is still "alive" here; only `ESRCH` means it is gone. A
 * lock left behind by a crashed server must not be reused.
 *
 * @param {number} pid
 * @param {{ kill?: (pid: number, signal?: string | number) => boolean }} [options]
 * @returns {boolean}
 */
export function isProcessAlive(pid, { kill = process.kill.bind(process) } = {}) {
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    return (/** @type {NodeJS.ErrnoException} */ (error))?.code === "EPERM";
  }
}

/**
 * Finds a dev server already running for this project so the walk can drive it.
 *
 * Three outcomes, and the middle one is the point:
 *   - `null` — nothing is running here (no lock, an unreadable lock, or a lock
 *     whose process is gone), so the caller starts its own server.
 *   - `reusable: true` — a live server, with the URL it chose and the log it is
 *     writing, ready to be driven as-is.
 *   - `reusable: false` — a live server that must **not** be reused because its
 *     log is missing. The walk scans the log of the server it drove, and it
 *     tolerates `status: "missing"` there, so pointing it at a log that does not
 *     exist would make that assertion pass vacuously. Refusing here keeps the
 *     acceptance evidence meaningful instead of quietly weaker.
 *
 * @param {{ cwd: string }} config
 * @param {{ readDevServerLock?: typeof readDevServerLock, isProcessAlive?: typeof isProcessAlive, exists?: (path: string) => boolean }} [deps]
 * @returns {{ reusable: true, pid: number, port: number | null, hostname: string, appBase: string, serverLogPath: string } | { reusable: false, pid: number, appBase: string, serverLogPath: string, reason: string, detail: string } | null}
 */
export function findRunningDevServer(config, deps = {}) {
  const read = deps.readDevServerLock ?? readDevServerLock;
  const alive = deps.isProcessAlive ?? isProcessAlive;
  const exists = deps.exists ?? fs.existsSync;

  const lock = read(path.join(config.cwd, NEXT_DEV_LOCK_PATH));
  if (!lock) return null;
  if (!alive(lock.pid)) return null;

  const serverLogPath = path.join(config.cwd, NEXT_DEV_LOG_PATH);
  if (!exists(serverLogPath)) {
    return {
      reusable: false,
      pid: lock.pid,
      appBase: lock.appUrl,
      serverLogPath,
      reason: "server-log-missing",
      detail: `pid ${lock.pid} is alive at ${lock.appUrl}, but its log ${serverLogPath} does not exist, so the walk could not scan the server it drove`,
    };
  }

  return {
    reusable: true,
    pid: lock.pid,
    port: lock.port,
    hostname: lock.hostname,
    appBase: lock.appUrl,
    serverLogPath,
  };
}

/**
 * Reads the sentinel's evidence report. A completed run always writes one, so a
 * missing or unreadable report after a zero exit is itself a failure: the walk's
 * result has to be auditable, not just an exit code.
 */
/**
 * @param {string} reportPath
 * @param {{ readFile?: (path: string, encoding: string) => string }} [options]
 * @returns {{ ok: boolean, reason?: string, detail?: string, report?: any }}
 */
export function inspectSentinelReport(reportPath, { readFile = fs.readFileSync } = {}) {
  let raw;
  try {
    raw = readFile(reportPath, "utf8");
  } catch {
    return { ok: false, reason: "report-missing", detail: `no evidence report at ${reportPath}` };
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch (error) {
    return { ok: false, reason: "report-unreadable", detail: `evidence report is not JSON: ${error.message}` };
  }
  if (report?.status === "runner-error") {
    return { ok: false, reason: "runner-error", detail: `report records a runner error: ${report.error ?? "unknown"}` };
  }
  const failed = report?.summary?.failed;
  if (typeof failed === "number" && failed > 0) {
    return { ok: false, reason: "report-records-failures", detail: `report records ${failed} failed assertion(s)` };
  }
  if (report?.status !== "passed") {
    return { ok: false, reason: "report-not-passed", detail: `report status is ${JSON.stringify(report?.status)}` };
  }
  return { ok: true, report };
}

function defaultSpawnServer(config) {
  return spawnLogged("npm", ["run", "dev", "--", "-H", config.host, "-p", String(config.port)], {
    cwd: config.cwd,
    env: { ...config.env, NEXT_TELEMETRY_DISABLED: "1" },
    logPath: config.serverLogPath,
  });
}

/**
 * The walk currently in flight, so an interrupt can stop it too. Ctrl+C during
 * a walk would otherwise leave Chrome and the walk's browser session running
 * after the harness exits.
 */
let activeSentinelChild = null;

function defaultRunSentinel(config) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [config.sentinelScript], {
      cwd: config.cwd,
      // Its own group, so an interrupt can signal the walk's whole tree (the
      // walk spawns Chrome) rather than just this wrapper.
      detached: process.platform !== "win32",
      stdio: "inherit",
      env: {
        ...config.env,
        SENTINEL_APP_BASE: config.appBase,
        SENTINEL_SERVER_LOG: config.serverLogPath,
        SENTINEL_REPORT_PATH: config.reportPath,
        ...(config.browserPath ? { CHROME_PATH: config.browserPath } : {}),
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    activeSentinelChild = child;
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      activeSentinelChild = null;
      resolve({ code: code ?? (signal ? 1 : 0), signal });
    });
  });
}

/**
 * Orchestrates one acceptance run. Every side effect is injectable so the
 * control flow — fail before the walk when the app never came up, propagate a
 * regression, always tear the server down — is exercised by tests without a
 * browser.
 */
/**
 * @param {{ config: RunConfig, deps?: Record<string, any> }} options
 * @returns {Promise<{ exitCode: number, reason: string, reportPath?: string, browserPath?: string | null }>}
 */
export async function runAcceptanceHarness({ config, deps = {} } = /** @type {any} */ ({})) {
  const io = {
    log: deps.log ?? ((message) => console.log(message)),
    error: deps.error ?? ((message) => console.error(message)),
  };
  const spawnServer = deps.spawnServer ?? defaultSpawnServer;
  const runSentinel = deps.runSentinel ?? defaultRunSentinel;
  const stopServer = deps.stopServer ?? ((spawned) => stopProcessTree(spawned));
  const checkHealth =
    deps.checkHealth ??
    ((cfg) => waitForHealth({ url: `${cfg.appBase}/api/health`, timeoutMs: cfg.readyTimeoutMs }));
  const inspectReport = deps.inspectReport ?? ((cfg) => inspectSentinelReport(cfg.reportPath));

  // `undefined` means "resolve it yourself"; an injected `null` means "assert the
  // no-browser path", so this must not be a `??` fallthrough.
  const browserPath =
    deps.browserPath === undefined ? resolveBrowserExecutable({ env: config.env }) : deps.browserPath;
  if (!browserPath) {
    io.error(
      "No Chrome/Chromium binary found. Set CHROME_PATH, or install Chrome/Chromium: the walk drives a real browser and cannot be skipped.",
    );
    return { exitCode: 1, reason: "no-browser" };
  }
  if (!fs.existsSync(config.sentinelScript)) {
    io.error(`Missing sentinel runner at ${config.sentinelScript}; the acceptance contract cannot be executed.`);
    return { exitCode: 1, reason: "missing-sentinel-script" };
  }
  const runConfig = { ...config, browserPath };

  if (config.dryRun) {
    io.log(
      [
        `plan: browser=${browserPath}`,
        `app=${runConfig.appBase} (${runConfig.manageServer ? "managed dev server" : "external"})`,
        `reuse=${runConfig.reuseServer ? "auto (drives a dev server already running for this project)" : "disabled"}`,
        `serverLog=${runConfig.serverLogPath}`,
        `report=${runConfig.reportPath}`,
        `readyTimeoutMs=${runConfig.readyTimeoutMs}`,
      ].join("\n"),
    );
    return { exitCode: 0, reason: "dry-run", browserPath };
  }

  if (!runConfig.manageServer) {
    io.log(`Driving the app already running at ${runConfig.appBase}…`);
    const result = await runSentinel(runConfig);
    return finish(result, runConfig, io, inspectReport);
  }

  // A dev server may already be running for this checkout — the same lock that
  // makes a second `next dev` refuse to start. Drive that one instead of spawning
  // a process Next will refuse, unless reuse was explicitly opted out of.
  const discover = deps.findRunningDevServer ?? findRunningDevServer;
  const running = runConfig.reuseServer ? await discover(runConfig) : null;
  if (running && !running.reusable) {
    io.error(
      `A dev server for this project is already running (pid ${running.pid} at ${running.appBase}), but it cannot be reused: ${running.detail}. Drive it yourself with --base ${running.appBase} --server-log <path>, restart it, or pass --no-reuse to start a fresh server.`,
    );
    return { exitCode: 1, reason: running.reason };
  }
  if (running) {
    const reusedConfig = { ...runConfig, appBase: running.appBase, serverLogPath: running.serverLogPath };
    if (running.port !== null && running.port !== runConfig.port) {
      io.log(`--port ${runConfig.port} ignored: the dev server already running for this project is on ${running.port}.`);
    }
    io.log(
      `Reusing the dev server already running for this project at ${reusedConfig.appBase} (pid ${running.pid}, log: ${reusedConfig.serverLogPath}); it was not started here, so it is left running.`,
    );
    const readiness = await waitForHealthOrExit({ checkHealth, config: reusedConfig, serverChild: null });
    if (!readiness.healthy) {
      io.error(
        `The dev server already running at ${reusedConfig.appBase}/api/health never answered within ${runConfig.readyTimeoutMs}ms. Its log —\n${serverLogTail(reusedConfig.serverLogPath)}`,
      );
      return { exitCode: 1, reason: "reused-server-unhealthy" };
    }
    io.log(`Server healthy; running ${SENTINEL_SCRIPT}…`);
    const result = await runSentinel(reusedConfig);
    return await finish(result, reusedConfig, io, inspectReport);
  }

  await (deps.assertPortAvailable ?? assertServerPortAvailable)(runConfig);
  io.log(`Starting the dev server on ${runConfig.appBase} (log: ${runConfig.serverLogPath})…`);
  const spawned = spawnServer(runConfig);
  try {
    const readiness = await waitForHealthOrExit({
      checkHealth,
      config: runConfig,
      serverChild: spawned?.child ?? spawned,
    });
    if (readiness.kind === "exit") {
      io.error(
        `The managed dev server exited before answering /api/health at ${runConfig.appBase}/api/health. Last output —\n${serverLogTail(runConfig.serverLogPath)}`,
      );
      return { exitCode: 1, reason: "server-exited" };
    }
    if (!readiness.healthy) {
      io.error(
        `The dev server never answered /api/health at ${runConfig.appBase}/api/health within ${runConfig.readyTimeoutMs}ms. Last output —\n${serverLogTail(runConfig.serverLogPath)}`,
      );
      return { exitCode: 1, reason: "server-unhealthy" };
    }
    io.log(`Server healthy; running ${SENTINEL_SCRIPT}…`);
    const result = await runSentinel(runConfig);
    return await finish(result, runConfig, io, inspectReport);
  } finally {
    if (runConfig.keepServer) {
      io.log(`--keep-server: leaving pid ${spawned?.pid ?? "?"} running (stop it yourself when finished).`);
    } else {
      const outcome = stopServer(spawned);
      io.log(`Stopped the managed dev server (${outcome}).`);
    }
  }
}

async function finish(result, config, io, inspectReport) {
  const code = typeof result === "number" ? result : (result?.code ?? 0);
  if (code !== 0) {
    io.error(`Sentinel failed with exit code ${code}${result?.signal ? ` (signal ${result.signal})` : ""}.`);
    return { exitCode: code === 0 ? 1 : code, reason: "sentinel-failed", reportPath: config.reportPath };
  }

  // Second, independent signal: the walk's own evidence. A runner that exits 0
  // while its report records failures (or wrote no report) is a regression, not
  // a pass.
  const inspected = inspectReport(config);
  if (!inspected.ok) {
    io.error(`Sentinel exited 0 but its evidence does not confirm a pass (${inspected.reason}): ${inspected.detail}.`);
    return { exitCode: 1, reason: inspected.reason, reportPath: config.reportPath };
  }
  const summary = inspected.report?.summary ?? {};
  io.log(
    `Acceptance passed: ${summary.assertions ?? "?"} assertion(s), run token ${inspected.report?.runToken ?? "?"}; report: ${config.reportPath}`,
  );
  return { exitCode: 0, reason: "passed", reportPath: config.reportPath };
}

/**
 * @param {{ env?: Record<string, string | undefined>, argv?: string[], deps?: Record<string, any>, cwd?: string }} [options]
 * @returns {Promise<number>}
 */
export async function main({ env = process.env, argv = process.argv.slice(2), deps = {}, cwd = process.cwd() } = {}) {
  /** @type {RunConfig} */
  let config;
  try {
    config = resolveRunConfig({ env, argv, cwd });
  } catch (error) {
    console.error(`${error.message}`);
    return 1;
  }
  if (config.help) {
    console.log(config.usage);
    return 0;
  }
  fs.mkdirSync(config.artifactDir, { recursive: true });
  return (await runAcceptanceHarness({ config, deps })).exitCode;
}

/**
 * CLI entrypoint. It tracks the managed server so an interrupt stops it too: an
 * unattended run that is killed must not leave a dev server holding the port,
 * and it must not report the interrupted run as a pass.
 */
/**
 * @param {{ env?: Record<string, string | undefined>, argv?: string[], cwd?: string }} [options]
 * @returns {Promise<number>}
 */
export async function runCli({ env = process.env, argv = process.argv.slice(2), cwd = process.cwd() } = {}) {
  let managed = null;
  const deps = {
    spawnServer: (config) => {
      managed = defaultSpawnServer(config);
      return managed;
    },
    stopServer: (spawned) => {
      const outcome = stopProcessTree(spawned);
      managed = null;
      return outcome;
    },
  };
  const onSignal = (signal) => {
    if (managed) stopProcessTree(managed);
    if (activeSentinelChild) stopProcessTree(activeSentinelChild);
    if (env.SENTINEL_RUN_STATE && fs.existsSync(env.SENTINEL_RUN_STATE)) {
      const state = readRunState(env.SENTINEL_RUN_STATE);
      if (state.pid === process.pid && state.runId === env.SENTINEL_RUN_ID) {
        writeRunState(env.SENTINEL_RUN_STATE, { ...state, status: "completed", exitCode: signal === "SIGINT" ? 130 : 143, finishedAt: new Date().toISOString() });
      }
    }
    console.error(
      `Interrupted (${signal}); the managed dev server and any running walk were stopped, and the run is not a pass.`,
    );
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));
  const stateIndex = argv.indexOf("--state");
  const waitIndex = argv.indexOf("--wait-timeout");
  const statePath = path.resolve(cwd, stateIndex >= 0 ? argv[stateIndex + 1] ?? "" : path.join(DEFAULT_ARTIFACT_DIR, "run.json"));
  const waitTimeoutMs = Number(waitIndex >= 0 ? argv[waitIndex + 1] : 30_000);
  if ((stateIndex >= 0 && (!argv[stateIndex + 1] || argv[stateIndex + 1].startsWith("--"))) ||
      !Number.isFinite(waitTimeoutMs) || waitTimeoutMs <= 0) {
    console.error("--state needs a path and --wait-timeout must be positive milliseconds.");
    return 1;
  }
  const background = argv.includes("--background");
  const waiting = argv.includes("--wait");
  if (background && waiting) { console.error("Choose --background or --wait, not both."); return 1; }
  const filtered = argv.filter((_, index) => index !== stateIndex && index !== stateIndex + (stateIndex >= 0 ? 1 : 0) &&
    index !== waitIndex && index !== waitIndex + (waitIndex >= 0 ? 1 : 0))
    .filter((arg) => arg !== "--background" && arg !== "--wait");
  let runState;
  try {
    if (waiting) {
      const result = await waitForRun({ file: statePath, timeoutMs: waitTimeoutMs });
      console.log(result.pending
        ? `Still running (pid ${result.pid}); repeat --wait --state ${statePath}. Log: ${result.logPath}`
        : `Run finished: exit ${result.exitCode}; log: ${result.logPath}`);
      return result.exitCode;
    }
    if (background) {
      // Validate before spawning, so bad arguments never masquerade as a run.
      const plan = resolveRunConfig({ env, argv: filtered, cwd });
      // A dev server already running for this project will be reused, so its port
      // being occupied is not a reason to refuse the run.
      const willReuse = plan.manageServer && plan.reuseServer && Boolean(findRunningDevServer(plan));
      if (plan.manageServer && !willReuse) await assertServerPortAvailable(plan);
      const state = startBackgroundRun({ file: statePath, script: process.argv[1], argv: filtered, cwd, env });
      console.log(`Started sentinel pid ${state.pid}; use --wait --state ${statePath}. Log: ${state.logPath}`);
      return 0;
    }
    if (env.SENTINEL_RUN_STATE) {
      // Parent writes the PID after spawn; tolerate that tiny startup race.
      const deadline = Date.now() + 5_000;
      do {
        try { runState = readRunState(env.SENTINEL_RUN_STATE); } catch { /* not written yet */ }
        if (runState?.runId === env.SENTINEL_RUN_ID) break;
        await delay(20);
      } while (Date.now() < deadline);
      if (!runState || runState.runId !== env.SENTINEL_RUN_ID || runState.pid !== process.pid) throw new Error("Run state ownership mismatch.");
    }
    const exitCode = await main({ env, argv: filtered, cwd, deps });
    if (runState) writeRunState(env.SENTINEL_RUN_STATE, { ...runState, status: "completed", exitCode, finishedAt: new Date().toISOString() });
    return exitCode;
  } catch (error) {
    console.error(error.stack ?? error.message);
    if (runState) writeRunState(env.SENTINEL_RUN_STATE, { ...runState, status: "completed", exitCode: 1, finishedAt: new Date().toISOString() });
    return 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  process.exit(await runCli());
}
