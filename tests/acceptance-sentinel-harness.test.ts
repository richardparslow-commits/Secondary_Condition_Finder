import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PORT,
  NEXT_DEV_LOG_PATH,
  assertServerPortAvailable,
  findRunningDevServer,
  inspectSentinelReport,
  isProcessAlive,
  readDevServerLock,
  resolveBrowserExecutable,
  resolveRunConfig,
  runAcceptanceHarness,
  serverLogTail,
  spawnLogged,
  stopProcessTree,
  waitForExit,
  waitForHealth,
} from "../scripts/run-acceptance-sentinel.mjs";

/** A child-process stand-in that can report death on demand. */
function fakeChild(): { child: EventEmitter & { pid: number; exitCode: null; signalCode: null }; die: () => void } {
  const child = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null, signalCode: null });
  return { child, die: () => child.emit("exit", 1, null) };
}

/**
 * Contract for `npm run acceptance:sentinel` (scripts/run-acceptance-sentinel.mjs).
 *
 * The stage-4 browser walk scans the dev server's own log, so the app server and
 * the walk have to be started as one unit. That pairing used to live only in a
 * shell block in ci.yml, where the shell's exit status decided and nothing
 * checked the evidence the walk wrote. This suite pins the entrypoint's four
 * promises, which is what makes it usable unattended:
 *
 *   1. it resolves a coherent plan (or fails loudly) without a browser or a
 *      server, so a broken invocation never looks like a privacy result;
 *   2. it only reports success when *both* signals agree — the walk's exit code
 *      and the evidence report it wrote;
 *   3. a failure before the walk (no browser, unhealthy server) fails without
 *      running the walk at all;
 *   4. a dev server this run started is stopped on every path, including a
 *      regression — while a server that was already running for this project is
 *      reused and left alone, unless `--no-reuse` opted out.
 *
 * The control-flow cases inject the server/spawn/sentinel steps rather than
 * driving Chrome: they are about orchestration, and a harness test that needs a
 * browser is a harness test nobody runs.
 */

const HARNESS_SOURCE = fs.readFileSync(
  path.join(process.cwd(), "scripts/run-acceptance-sentinel.mjs"),
  "utf8",
);
const SENTINEL_SCRIPT = path.join(process.cwd(), "scripts/acceptance-browser-sentinel.mjs");

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-harness-"));
}

/**
 * A config whose artifact paths live in a temp dir but whose runner script is
 * the real one, so the harness's existence check is exercised honestly.
 */
function configFor(options: {
  dir: string;
  manageServer?: boolean;
  reportPath?: string;
}): ReturnType<typeof resolveRunConfig> {
  const config = resolveRunConfig({
    env: {},
    argv: options.manageServer === false ? ["--base", "http://127.0.0.1:9999"] : [],
    cwd: options.dir,
  });
  return {
    ...config,
    sentinelScript: SENTINEL_SCRIPT,
    reportPath: options.reportPath ?? config.reportPath,
  };
}

function writeReport(reportPath: string, report: unknown): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report)}\n`);
}

/** Seeds the managed server's log, as the real `npm run dev` would have. */
function writeServerLog(config: { serverLogPath: string }, text: string): void {
  fs.mkdirSync(path.dirname(config.serverLogPath), { recursive: true });
  fs.writeFileSync(config.serverLogPath, text);
}

const PASSING_REPORT = {
  finding: "PRIV-01",
  status: "passed",
  runToken: "harness-test",
  summary: { assertions: 46, failed: 0 },
};

describe("acceptance sentinel entrypoint: plan resolution", () => {
  it("defaults to a managed dev server on the CI port", () => {
    const config = resolveRunConfig({ env: {}, argv: [], cwd: process.cwd() });
    expect(config.manageServer).toBe(true);
    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.appBase).toBe(`http://127.0.0.1:${DEFAULT_PORT}`);
    expect(config.host).toBe("127.0.0.1");
    expect(config.sentinelScript).toBe(SENTINEL_SCRIPT);
    expect(path.isAbsolute(config.serverLogPath)).toBe(true);
    expect(path.isAbsolute(config.reportPath)).toBe(true);
  });

  it("drives an external app when SENTINEL_APP_BASE is set, and stops managing one", () => {
    const config = resolveRunConfig({
      env: { SENTINEL_APP_BASE: "http://127.0.0.1:3107" },
      argv: [],
      cwd: process.cwd(),
    });
    expect(config.manageServer).toBe(false);
    expect(config.appBase).toBe("http://127.0.0.1:3107");
  });

  it("honours flags, and rejects a plan it cannot execute", () => {
    const flags = resolveRunConfig({
      env: {},
      argv: ["--port", "4200", "--report", "out/evidence.json"],
      cwd: process.cwd(),
    });
    expect(flags.port).toBe(4200);
    expect(flags.appBase).toBe("http://127.0.0.1:4200");
    expect(flags.reportPath).toBe(path.join(process.cwd(), "out/evidence.json"));

    expect(() => resolveRunConfig({ env: {}, argv: ["--port", "not-a-port"], cwd: process.cwd() })).toThrow(
      /--port must be an integer/,
    );
    expect(() => resolveRunConfig({ env: {}, argv: ["--nope"], cwd: process.cwd() })).toThrow(/unknown option/);
    expect(() =>
      resolveRunConfig({ env: { SENTINEL_APP_BASE: "127.0.0.1:3107" }, argv: [], cwd: process.cwd() }),
    ).toThrow(/must be an http\(s\) URL/);
    expect(() => resolveRunConfig({ env: {}, argv: ["--port"], cwd: process.cwd() })).toThrow(/needs a value/);
  });

  it("prints usage instead of planning when asked for help", () => {
    const config = resolveRunConfig({ env: {}, argv: ["--help"], cwd: process.cwd() });
    expect(config.help).toBe(true);
    expect(config.usage).toContain("acceptance:sentinel");
  });
});

describe("acceptance sentinel entrypoint: browser resolution", () => {
  it("prefers CHROME_PATH and fails closed when it does not exist", () => {
    expect(
      resolveBrowserExecutable({
        env: { CHROME_PATH: "/opt/ci/chrome" },
        platform: "linux",
        exists: (candidate) => candidate === "/opt/ci/chrome",
        pathEnv: "",
      }),
    ).toBe("/opt/ci/chrome");

    expect(
      resolveBrowserExecutable({
        env: { CHROME_PATH: "/opt/ci/missing" },
        platform: "linux",
        exists: () => false,
        pathEnv: "/usr/bin",
      }),
    ).toBeNull();
  });

  it("falls back to a known install, then to PATH", () => {
    const linuxDefault = "/usr/bin/google-chrome";
    expect(
      resolveBrowserExecutable({
        env: {},
        platform: "linux",
        exists: (candidate) => candidate === linuxDefault,
        pathEnv: "",
      }),
    ).toBe(linuxDefault);

    expect(
      resolveBrowserExecutable({
        env: {},
        platform: "linux",
        exists: (candidate) => candidate === "/custom/bin/chromium",
        pathEnv: ["/custom/bin", "/usr/bin"].join(path.delimiter),
      }),
    ).toBe("/custom/bin/chromium");

    expect(
      resolveBrowserExecutable({ env: {}, platform: "linux", exists: () => false, pathEnv: "/usr/bin" }),
    ).toBeNull();
  });
});

describe("acceptance sentinel entrypoint: health and evidence checks are real", () => {
  it("waits for a real /api/health to start answering, and gives up on time", async () => {
    let ready = false;
    const server = http.createServer((_request, response) => {
      response.statusCode = ready ? 200 : 503;
      response.end(ready ? "ok" : "starting");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("no port");
    const url = `http://127.0.0.1:${address.port}/api/health`;

    try {
      expect(await waitForHealth({ url, timeoutMs: 400, intervalMs: 50 })).toBe(false);

      ready = true;
      expect(await waitForHealth({ url, timeoutMs: 5_000, intervalMs: 50 })).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("carries the server log tail into a failure so the cause is self-serve", () => {
    const dir = tempDir();
    const logPath = path.join(dir, "dev-server.log");
    fs.writeFileSync(logPath, "first line\n[?25h\nYou can access the existing server at http://127.0.0.1:3107,\n");

    const tail = serverLogTail(logPath, { lines: 1 });
    expect(tail).toContain("You can access the existing server at http://127.0.0.1:3107,");
    expect(tail).not.toContain("first line");
    expect(tail).not.toContain("\u001b");

    expect(serverLogTail(path.join(dir, "absent.log"))).toContain("no server log");
    const empty = path.join(dir, "empty.log");
    fs.writeFileSync(empty, "\n\n");
    expect(serverLogTail(empty)).toContain("is empty");
  });

  it("refuses an occupied port instead of driving an unrelated app", async () => {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    try {
      await expect(assertServerPortAvailable({ host: "127.0.0.1", port: address.port })).rejects.toThrow(/occupied/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("reads the walk's evidence, and treats a contradictory report as failure", () => {
    const dir = tempDir();

    const missing = path.join(dir, "nope.json");
    expect(inspectSentinelReport(missing)).toMatchObject({ ok: false, reason: "report-missing" });

    const corrupt = path.join(dir, "corrupt.json");
    fs.writeFileSync(corrupt, "{not json");
    expect(inspectSentinelReport(corrupt)).toMatchObject({ ok: false, reason: "report-unreadable" });

    const failed = path.join(dir, "failed.json");
    writeReport(failed, { status: "failed", summary: { failed: 2 } });
    expect(inspectSentinelReport(failed)).toMatchObject({ ok: false, reason: "report-records-failures" });

    const runnerError = path.join(dir, "runner-error.json");
    writeReport(runnerError, { status: "runner-error", error: "boom" });
    expect(inspectSentinelReport(runnerError)).toMatchObject({ ok: false, reason: "runner-error" });

    const passed = path.join(dir, "passed.json");
    writeReport(passed, PASSING_REPORT);
    expect(inspectSentinelReport(passed)).toMatchObject({ ok: true });
  });
});

describe("acceptance sentinel entrypoint: the managed server is real and is always stopped", () => {
  it("logs the server's output and stops the whole process tree", async () => {
    const dir = tempDir();
    const logPath = path.join(dir, "server.log");
    const spawned = spawnLogged(
      process.execPath,
      ["-e", "console.log('HARNESS_PROBE_READY'); setInterval(() => {}, 1000);"],
      { cwd: dir, env: process.env, logPath },
    );

    const deadline = Date.now() + 10_000;
    let logged = "";
    while (Date.now() < deadline) {
      logged = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
      if (logged.includes("HARNESS_PROBE_READY")) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(logged).toContain("HARNESS_PROBE_READY");

    const outcome = process.platform === "win32" ? "taskkill" : "group-sigterm";
    expect(stopProcessTree(spawned)).toBe(outcome);
    expect(await waitForExit(spawned.child)).toBe(true);
  });

  it("reports an already-finished server instead of claiming a teardown", async () => {
    const finished = spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore" });
    await waitForExit(finished);
    expect(stopProcessTree({ child: finished })).toBe("already-exited");
  });
});

/**
 * Next keeps a per-project dev lock, so while any `next dev` holds this checkout
 * a second one refuses to start. Before reuse, that turned "a dev server is
 * already running" into a harness failure on a locked project; these cases pin
 * that the entrypoint now drives that server instead, keeps the log assertion
 * meaningful, and can be told not to.
 */
describe("acceptance sentinel entrypoint: reusing a dev server already running for this project", () => {
  const lock = {
    pid: 65085,
    port: 3117,
    hostname: "127.0.0.1",
    appUrl: "http://127.0.0.1:3117",
    startedAt: 1_791_554_793_905,
  };

  it("reuses by default, and opts out with --no-reuse or SENTINEL_NO_REUSE", () => {
    expect(resolveRunConfig({ env: {}, argv: [], cwd: process.cwd() }).reuseServer).toBe(true);
    expect(resolveRunConfig({ env: {}, argv: ["--no-reuse"], cwd: process.cwd() }).reuseServer).toBe(false);
    expect(
      resolveRunConfig({ env: { SENTINEL_NO_REUSE: "1" }, argv: [], cwd: process.cwd() }).reuseServer,
    ).toBe(false);
    // Placeholder shapes must not silently flip the mode.
    for (const value of ["", "0", "false"]) {
      expect(
        resolveRunConfig({ env: { SENTINEL_NO_REUSE: value }, argv: [], cwd: process.cwd() }).reuseServer,
        value,
      ).toBe(true);
    }
  });

  it("reads the dev lock Next writes, and rejects anything unusable", () => {
    const dir = tempDir();
    const lockPath = path.join(dir, "lock");
    fs.writeFileSync(lockPath, JSON.stringify(lock));
    expect(readDevServerLock(lockPath)).toMatchObject({ pid: 65085, port: 3117, appUrl: "http://127.0.0.1:3117" });

    // A lock that records a port but no url still yields a usable base URL.
    const portOnly = path.join(dir, "port-only");
    fs.writeFileSync(portOnly, JSON.stringify({ pid: 7, port: 4200 }));
    expect(readDevServerLock(portOnly)).toMatchObject({ pid: 7, appUrl: "http://127.0.0.1:4200" });

    expect(readDevServerLock(path.join(dir, "absent"))).toBeNull();
    const corrupt = path.join(dir, "corrupt");
    fs.writeFileSync(corrupt, "{not json");
    expect(readDevServerLock(corrupt)).toBeNull();
    const noPid = path.join(dir, "no-pid");
    fs.writeFileSync(noPid, JSON.stringify({ port: 4200 }));
    expect(readDevServerLock(noPid)).toBeNull();
  });

  it("treats a dead pid as no server, so a crashed run's lock is never reused", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    const throws = (code: string) => () => {
      throw Object.assign(new Error(code), { code });
    };
    expect(isProcessAlive(2 ** 30, { kill: throws("ESRCH") })).toBe(false);
    // A process owned by another user is alive, not gone.
    expect(isProcessAlive(2 ** 30, { kill: throws("EPERM") })).toBe(true);

    const dir = tempDir();
    expect(
      findRunningDevServer(
        { cwd: dir },
        { readDevServerLock: () => lock, isProcessAlive: () => false, exists: () => true },
      ),
    ).toBeNull();
    expect(
      findRunningDevServer(
        { cwd: dir },
        { readDevServerLock: () => null, isProcessAlive: () => true, exists: () => true },
      ),
    ).toBeNull();
  });

  it("refuses to reuse a live server whose log is missing, instead of letting the log scan pass vacuously", () => {
    const dir = tempDir();
    const unusable = findRunningDevServer(
      { cwd: dir },
      { readDevServerLock: () => lock, isProcessAlive: () => true, exists: () => false },
    );
    expect(unusable).toMatchObject({ reusable: false, pid: 65085, reason: "server-log-missing" });
    expect((unusable as { detail: string }).detail).toContain("does not exist");

    const usable = findRunningDevServer(
      { cwd: dir },
      { readDevServerLock: () => lock, isProcessAlive: () => true, exists: () => true },
    );
    expect(usable).toMatchObject({ reusable: true, pid: 65085, appBase: "http://127.0.0.1:3117" });
    expect((usable as { serverLogPath: string }).serverLogPath).toBe(path.join(dir, NEXT_DEV_LOG_PATH));
  });

  it("drives the running server instead of spawning one Next would refuse", async () => {
    const dir = tempDir();
    const reportPath = path.join(dir, "reused.json");
    const config = configFor({ dir, reportPath });
    const calls: string[] = [];
    let walkedBase = "";
    let walkedLog = "";
    const reusedLog = path.join(dir, "next-development.log");

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: () => {},
        findRunningDevServer: () => ({
          reusable: true,
          pid: 65085,
          port: 3117,
          hostname: "127.0.0.1",
          appBase: "http://127.0.0.1:3117",
          serverLogPath: reusedLog,
        }),
        assertPortAvailable: async () => {
          calls.push("port-check");
        },
        spawnServer: () => {
          calls.push("spawn");
          return { pid: 1 };
        },
        checkHealth: async () => {
          calls.push("health");
          return true;
        },
        runSentinel: async (cfg: ReturnType<typeof resolveRunConfig>) => {
          calls.push("sentinel");
          walkedBase = cfg.appBase;
          walkedLog = cfg.serverLogPath;
          writeReport(reportPath, PASSING_REPORT);
          return { code: 0 };
        },
        stopServer: () => {
          calls.push("stop");
          return "group-sigterm";
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 0, reason: "passed" });
    // No port check (the running server owns the port), no spawn, and no teardown
    // of a server this process did not start.
    expect(calls).toEqual(["health", "sentinel"]);
    expect(walkedBase).toBe("http://127.0.0.1:3117");
    expect(walkedLog).toBe(reusedLog);
  });

  it("names the escape hatches when a live server cannot be reused", async () => {
    const dir = tempDir();
    const config = configFor({ dir });
    const errors: string[] = [];
    let spawned = false;

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: (message: string) => errors.push(message),
        findRunningDevServer: () => ({
          reusable: false,
          pid: 9,
          appBase: "http://127.0.0.1:3117",
          serverLogPath: path.join(dir, "gone.log"),
          reason: "server-log-missing",
          detail: "its log does not exist",
        }),
        spawnServer: () => {
          spawned = true;
          return { pid: 1 };
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 1, reason: "server-log-missing" });
    expect(spawned).toBe(false);
    expect(errors.join("\n")).toContain("--base http://127.0.0.1:3117 --server-log");
    expect(errors.join("\n")).toContain("--no-reuse");
  });

  it("never runs the walk against a reused server that never becomes healthy, and leaves it running", async () => {
    const dir = tempDir();
    const config = { ...configFor({ dir }), readyTimeoutMs: 20 };
    let sentinelRuns = 0;
    let stopped = false;

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: () => {},
        findRunningDevServer: () => ({
          reusable: true,
          pid: 5,
          port: 3117,
          hostname: "127.0.0.1",
          appBase: "http://127.0.0.1:3117",
          serverLogPath: path.join(dir, "next-development.log"),
        }),
        checkHealth: async () => false,
        runSentinel: async () => {
          sentinelRuns += 1;
          return { code: 0 };
        },
        stopServer: () => {
          stopped = true;
          return "group-sigterm";
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 1, reason: "reused-server-unhealthy" });
    expect(sentinelRuns).toBe(0);
    expect(stopped).toBe(false);
  });

  it("does not even look for a running server when reuse is opted out", async () => {
    const dir = tempDir();
    const reportPath = path.join(dir, "fresh.json");
    const config = { ...configFor({ dir, reportPath }), reuseServer: false };
    let discoveries = 0;

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: () => {},
        findRunningDevServer: () => {
          discoveries += 1;
          return null;
        },
        assertPortAvailable: async () => {},
        spawnServer: () => ({ pid: 1, child: { pid: 1, exitCode: null, signalCode: null } }),
        checkHealth: async () => true,
        runSentinel: async () => {
          writeReport(reportPath, PASSING_REPORT);
          return { code: 0 };
        },
        stopServer: () => "group-sigterm",
      },
    });

    expect(result).toMatchObject({ exitCode: 0, reason: "passed" });
    expect(discoveries).toBe(0);
  });
});

describe("acceptance sentinel entrypoint: orchestration", () => {
  it("passes when the walk exits 0 and its evidence agrees", async () => {
    const dir = tempDir();
    const reportPath = path.join(dir, "evidence.json");
    const config = configFor({ dir, reportPath });
    const calls: string[] = [];

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: () => {},
        assertPortAvailable: async () => {},
        spawnServer: () => {
          calls.push("spawn");
          return { pid: 1234, child: { pid: 1234, exitCode: null, signalCode: null } };
        },
        checkHealth: async () => {
          calls.push("health");
          return true;
        },
        runSentinel: async () => {
          calls.push("sentinel");
          writeReport(reportPath, PASSING_REPORT);
          return { code: 0 };
        },
        stopServer: () => {
          calls.push("stop");
          return "group-sigterm";
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 0, reason: "passed" });
    expect(calls).toEqual(["spawn", "health", "sentinel", "stop"]);
  });

  it("propagates a regression and still stops the server", async () => {
    const dir = tempDir();
    const config = configFor({ dir });
    let stopped = false;

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: () => {},
        assertPortAvailable: async () => {},
        spawnServer: () => ({ pid: 1, child: { pid: 1, exitCode: null, signalCode: null } }),
        checkHealth: async () => true,
        runSentinel: async () => ({ code: 2 }),
        stopServer: () => {
          stopped = true;
          return "group-sigterm";
        },
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.reason).toBe("sentinel-failed");
    expect(stopped).toBe(true);
  });

  it("fails when the walk exits 0 but wrote no evidence", async () => {
    const dir = tempDir();
    const config = configFor({ dir, reportPath: path.join(dir, "absent.json") });
    const errors: string[] = [];

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: (message: string) => errors.push(message),
        assertPortAvailable: async () => {},
        spawnServer: () => ({ pid: 2, child: { pid: 2, exitCode: null, signalCode: null } }),
        checkHealth: async () => true,
        runSentinel: async () => ({ code: 0 }),
        stopServer: () => "group-sigterm",
      },
    });

    expect(result).toMatchObject({ exitCode: 1, reason: "report-missing" });
    expect(errors.join("\n")).toContain("does not confirm a pass");
  });

  it("never runs the walk when the managed server never becomes healthy", async () => {
    const dir = tempDir();
    const config = configFor({ dir });
    let sentinelRuns = 0;
    let stopped = false;

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: () => {},
        assertPortAvailable: async () => {},
        spawnServer: () => ({ pid: 3, child: { pid: 3, exitCode: null, signalCode: null } }),
        checkHealth: async () => false,
        runSentinel: async () => {
          sentinelRuns += 1;
          return { code: 0 };
        },
        stopServer: () => {
          stopped = true;
          return "group-sigterm";
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 1, reason: "server-unhealthy" });
    expect(sentinelRuns).toBe(0);
    expect(stopped).toBe(true);
  });

  it("fails fast, with the log tail, when the managed server dies before health", async () => {
    const dir = tempDir();
    const config = configFor({ dir });
    writeServerLog(config, "next dev refused: existing server at http://127.0.0.1:3107\n");
    const { child, die } = fakeChild();
    const errors: string[] = [];
    let sentinelRuns = 0;

    const running = runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: (message: string) => errors.push(message),
        assertPortAvailable: async () => {},
        spawnServer: () => {
          setTimeout(die, 10);
          return { pid: 4242, child };
        },
        checkHealth: () => new Promise(() => {}), // never answers
        runSentinel: async () => {
          sentinelRuns += 1;
          return { code: 0 };
        },
        stopServer: () => "already-exited",
      },
    });

    const result = await running;
    expect(result).toMatchObject({ exitCode: 1, reason: "server-exited" });
    expect(sentinelRuns).toBe(0);
    expect(errors.join("\n")).toContain("exited before answering /api/health");
    expect(errors.join("\n")).toContain("existing server at http://127.0.0.1:3107");
  });

  it("names the log tail when the server is slow rather than dead", async () => {
    const dir = tempDir();
    const config = { ...configFor({ dir }), readyTimeoutMs: 20 };
    writeServerLog(config, "compiling…\n");
    const errors: string[] = [];

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: (message: string) => errors.push(message),
        assertPortAvailable: async () => {},
        spawnServer: () => ({ pid: 7 }),
        checkHealth: async () => false,
        stopServer: () => "group-sigterm",
      },
    });

    expect(result).toMatchObject({ exitCode: 1, reason: "server-unhealthy" });
    expect(errors.join("\n")).toContain("compiling…");
  });

  it("fails without starting a server when there is no browser to drive", async () => {
    const dir = tempDir();
    const config = configFor({ dir });
    let spawned = false;

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: null,
        log: () => {},
        error: () => {},
        assertPortAvailable: async () => {},
        spawnServer: () => {
          spawned = true;
          return { pid: 4 };
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 1, reason: "no-browser" });
    expect(spawned).toBe(false);
  });

  it("leaves an external app alone: no server to start or stop", async () => {
    const dir = tempDir();
    const reportPath = path.join(dir, "external.json");
    const config = configFor({ dir, manageServer: false, reportPath });
    let touchedServer = false;

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: () => {},
        error: () => {},
        assertPortAvailable: async () => {},
        spawnServer: () => {
          touchedServer = true;
          return { pid: 5 };
        },
        stopServer: () => {
          touchedServer = true;
          return "group-sigterm";
        },
        runSentinel: async () => {
          writeReport(reportPath, PASSING_REPORT);
          return { code: 0 };
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 0, reason: "passed" });
    expect(touchedServer).toBe(false);
  });

  it("resolves a plan under --dry-run without touching a server or a browser", async () => {
    const dir = tempDir();
    const config = { ...configFor({ dir }), dryRun: true };
    const lines: string[] = [];

    const result = await runAcceptanceHarness({
      config,
      deps: {
        browserPath: "/fake/chrome",
        log: (message: string) => lines.push(message),
        error: () => {},
        assertPortAvailable: async () => {},
        spawnServer: () => {
          throw new Error("dry-run must not start a server");
        },
      },
    });

    expect(result).toMatchObject({ exitCode: 0, reason: "dry-run" });
    expect(lines.join("\n")).toContain("plan: browser=/fake/chrome");
  });
});

describe("acceptance sentinel entrypoint: wiring", () => {
  it("is exposed as an npm script that runs it directly", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["acceptance:sentinel"]).toBe("node scripts/run-acceptance-sentinel.mjs");
  });

  it("hands the walk the app base, the server log and the report path it scanned", () => {
    expect(HARNESS_SOURCE).toContain("SENTINEL_APP_BASE: config.appBase");
    expect(HARNESS_SOURCE).toContain("SENTINEL_SERVER_LOG: config.serverLogPath");
    expect(HARNESS_SOURCE).toContain("SENTINEL_REPORT_PATH: config.reportPath");
    expect(HARNESS_SOURCE).toContain("/api/health");
    expect(HARNESS_SOURCE).toContain('stdio: "inherit"');
  });

  it("tears down the process group, not just the npm wrapper", () => {
    expect(HARNESS_SOURCE).toContain("kill(-child.pid, \"SIGTERM\")");
    expect(HARNESS_SOURCE).toContain("taskkill");
    expect(HARNESS_SOURCE).toContain("process.on(\"SIGINT\"");
    expect(HARNESS_SOURCE).toContain("process.on(\"SIGTERM\"");
  });

  it("stops the running walk on an interrupt, not only the server", () => {
    // The walk spawns Chrome; leaving it behind on Ctrl+C strands a headless
    // browser and a half-finished acceptance run.
    expect(HARNESS_SOURCE).toContain("let activeSentinelChild = null;");
    expect(HARNESS_SOURCE).toMatch(/if \(activeSentinelChild\) stopProcessTree\(activeSentinelChild\);/);
    expect(HARNESS_SOURCE).toMatch(/detached: process\.platform !== "win32",\n\s+stdio: "inherit"/);
  });

  it("wires dev-server reuse as the default, with an explicit opt-out", () => {
    expect(HARNESS_SOURCE).toContain("deps.findRunningDevServer ?? findRunningDevServer");
    expect(HARNESS_SOURCE).toContain("runConfig.reuseServer ? await discover(runConfig) : null");
    expect(HARNESS_SOURCE).toContain('NEXT_DEV_LOCK_PATH = path.join(".next", "dev", "lock")');
    expect(HARNESS_SOURCE).toContain("--no-reuse");
    expect(HARNESS_SOURCE).toContain("SENTINEL_NO_REUSE");
  });

  it("keeps the run unattended-safe: no prompt, no shell, no interactive flag", () => {
    expect(HARNESS_SOURCE).not.toMatch(/\breadline\b/);
    expect(HARNESS_SOURCE).not.toMatch(/shell:\s*true/);
    expect(HARNESS_SOURCE).not.toMatch(/prompts?\s*\(/i);
  });
});
