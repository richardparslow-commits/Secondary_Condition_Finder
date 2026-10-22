/**
 * REL-05 — hostile-file browser stress test for the browser-local DD-214 path.
 *
 * The audit's REL-05 finding ("DD-214 OCR bypasses shared allocation
 * protections; submission promises are unhandled") closed its code clauses with
 * jsdom tests and recorded one thing it could not claim: a hostile file **in a
 * real browser**, under the real production headers, with measured memory. This
 * script is that evidence run. It boots the production build (`next start`; run
 * `npm run build` first) and drives `/presumptive` in Chromium through four
 * hostile inputs:
 *
 *   1. **Image bomb, dimension** — a PNG whose header declares 60000×120. The
 *      declared-dimension bound must refuse it (`dimension-too-large`) with the
 *      sized refusal copy, before any worker or bitmap exists.
 *   2. **Image bomb, pixel area** — 10000×10000 (100M pixels, over the 40M cap).
 *      Same contract, `too-many-pixels`.
 *   3. **Malformed PDF** — bytes that are not a PDF at all. pdf.js allocates its
 *      worker when the loading task is created, so this case exists to prove the
 *      rejection still reaches `task.destroy()`: the run must report a bounded
 *      failure and leave no live worker behind.
 *   4. **Hung worker, then cancel** — a real OC[/R] worker that never answers
 *      (its messages are dropped) is the browser stand-in for a hung WASM core.
 *      The tab must keep answering, and Cancel must terminate that worker and
 *      return the surface to an idle, usable state instead of leaving it busy
 *      forever.
 *
 * Between the refusals it measures the JS heap across repeated bomb uploads, so
 * "refused before decode" is a measured allocation story rather than an
 * assertion about one upload.
 *
 * Worker accounting is injected with `addInitScript`, which runs in the page
 * before any application script: it wraps `window.Worker`, recording every
 * construction and `terminate()`, and (for case 4 only) silently dropping
 * messages to the OCR worker. That is how "no worker was created" and "the
 * worker was terminated" are observed rather than inferred from the UI.
 *
 * What this does NOT claim: no real WASM OOM was induced, memory pressure is
 * observed through the Chromium JS heap (not RSS), and the run is one browser
 * build on one machine. Those limits are recorded with the evidence.
 *
 * Evidence: `tmp/hostile-file-stress/evidence.json` holds every check, the
 * measured heap deltas, the commit and build id, and the browser version.
 *
 * Ports: `HOSTILE_E2E_APP_PORT` (default 3402). Browser: the installed Chrome
 * channel, like the a11y gates; `HOSTILE_E2E_BROWSER=chromium` uses Playwright's
 * own Chromium.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import zlib from "node:zlib";

import { chromium } from "playwright";

const APP_PORT = Number(process.env.HOSTILE_E2E_APP_PORT ?? 3402);
const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const ROUTE = "/presumptive";
const FILE_INPUT = "#dd214-file";
const STATUS = "[role=status]";
const EVIDENCE_DIR = process.env.HOSTILE_EVIDENCE_DIR ?? "tmp/hostile-file-stress";
const EVIDENCE_FILE = path.join(EVIDENCE_DIR, "evidence.json");
const USE_PROCESS_GROUPS = process.platform !== "win32";
const WORKFLOW_SESSION_SECRET =
  process.env.WORKFLOW_SESSION_SECRET ??
  "browser-e2e-workflow-secret-only-for-local-ci-2026";
const OCR_WORKER_URL = "/tesseract/worker-guard.js";
const WAIT_TIMEOUT_MS = 60_000;
/** Eight bomb uploads; a refusal that allocated a bitmap would grow the heap. */
const MEMORY_ITERATIONS = 8;
/** Generous bound: the refusals are header-only, so the expected delta is ~0. */
const MEMORY_GROWTH_LIMIT_BYTES = 24 * 1024 * 1024;
const CANCEL_SETTLE_TIMEOUT_MS = 15_000;

const children = [];
let browser;

/* ─── fixtures ─────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const payload = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([length, payload, crc]);
}

/**
 * A PNG header that declares its dimensions and carries no image data.
 *
 * `planImageDecode` reads exactly this header, so a bomb is fully described by
 * it: nothing has to be decoded, and a deployment that refused it by decoding
 * first would need the 10k×10k comment below to be 2.4 GB of pixels.
 */
function pngWithDeclaredSize(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A small, genuinely decodable PNG so the run reaches OCR instead of refusing. */
function solidPng(width, height) {
  const rowBytes = width * 3 + 1;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) raw[y * rowBytes] = 0; // filter: none
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeFixtures() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hostile-files-"));
  const files = {
    bombDimension: path.join(directory, "bomb-dimension.png"),
    bombPixels: path.join(directory, "bomb-pixels.png"),
    malformedPdf: path.join(directory, "malformed.pdf"),
    small: path.join(directory, "small.png"),
  };
  fs.writeFileSync(files.bombDimension, pngWithDeclaredSize(60_000, 120));
  fs.writeFileSync(files.bombPixels, pngWithDeclaredSize(10_000, 10_000));
  fs.writeFileSync(files.malformedPdf, Buffer.from("this is not a PDF at all\n"));
  fs.writeFileSync(files.small, solidPng(16, 16));
  return { directory, files };
}

/* ─── process helpers (same shape as the other browser gates) ──────────────── */

function checkpoint(message) {
  console.log(`[hostile] ${message}`);
}

function logProcess(label, child) {
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("error", (error) => {
    console.error(`[${label}] failed to start: ${error.message}`);
  });
  children.push(child);
  return child;
}

function sendProcessTreeSignal(child, signal) {
  if (!child.pid) return;
  try {
    if (USE_PROCESS_GROUPS) {
      process.kill(-child.pid, signal);
      return;
    }
    if (!child.killed) child.kill(signal);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH")) {
      throw error;
    }
  }
}

async function terminateProcessTree(child) {
  sendProcessTreeSignal(child, "SIGTERM");
  await delay(250);
  sendProcessTreeSignal(child, "SIGKILL");
}

async function waitForHttp(url, label) {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status >= 200 && response.status < 500) return;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready: ${lastError?.message ?? "timeout"}`);
}

function readGitHead() {
  const result = spawn("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  let output = "";
  result.stdout.on("data", (chunk) => {
    output += chunk;
  });
  return new Promise((resolve) => {
    result.on("close", () => resolve(output.trim() || null));
    result.on("error", () => resolve(null));
  });
}

/* ─── browser instrumentation ──────────────────────────────────────────────── */

/**
 * Installed before any application script. `window.Worker` is replaced by a
 * subclass that records construction and termination, and can be switched into
 * a mode where messages to the OCR worker are dropped — a hung worker, which is
 * what a stalled WASM core looks like from the page.
 */
const WORKER_AUDIT_SCRIPT = `(() => {
  const audit = {
    created: [],
    terminated: [],
    live: 0,
    stalledMessages: 0,
    stallPattern: null,
  };
  Object.defineProperty(window, "__hostileWorkerAudit", {
    value: audit,
    configurable: true,
  });
  const NativeWorker = window.Worker;
  class AuditedWorker extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      this.__auditedUrl = String(url);
      audit.created.push(this.__auditedUrl);
      audit.live += 1;
    }
    terminate() {
      if (!this.__auditTerminated) {
        this.__auditTerminated = true;
        audit.live -= 1;
        audit.terminated.push(this.__auditedUrl);
      }
      return super.terminate();
    }
    postMessage(message, transfer) {
      if (audit.stallPattern && new RegExp(audit.stallPattern).test(this.__auditedUrl)) {
        audit.stalledMessages += 1;
        return;
      }
      return super.postMessage(message, transfer);
    }
  }
  window.Worker = AuditedWorker;
})();`;

async function audit(page) {
  return page.evaluate(() => ({ ...window.__hostileWorkerAudit }));
}

async function heapBytes(client) {
  const { metrics } = await client.send("Performance.getMetrics");
  const entry = metrics.find((metric) => metric.name === "JSHeapUsedSize");
  return entry ? Math.round(entry.value) : null;
}

async function statusText(page) {
  return page.evaluate((selector) => {
    const element = document.querySelector(selector);
    return element ? element.textContent : null;
  }, STATUS);
}

async function waitForStatus(page, pattern) {
  await page.waitForFunction(
    ({ selector, source }) => {
      const element = document.querySelector(selector);
      return Boolean(element && new RegExp(source).test(element.textContent ?? ""));
    },
    { selector: STATUS, source: pattern },
    { timeout: WAIT_TIMEOUT_MS },
  );
  return statusText(page);
}

async function upload(page, file) {
  await page.setInputFiles(FILE_INPUT, file);
}

/* ─── checks ───────────────────────────────────────────────────────────────── */

function record(checks, name, passed, detail, measured = {}) {
  checks.push({ name, passed, detail, measured });
  checkpoint(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function runStress(page, client, files) {
  const checks = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${APP_BASE_URL}${ROUTE}`, {
    waitUntil: "domcontentloaded",
    timeout: WAIT_TIMEOUT_MS,
  });
  await page.waitForSelector(FILE_INPUT, { timeout: WAIT_TIMEOUT_MS });

  const baseline = await audit(page);
  record(
    checks,
    "no worker exists before any upload",
    baseline.created.length === 0 && baseline.live === 0,
    `${baseline.created.length} worker(s) created on load`,
  );

  // 1 + 2: declared-dimension image bombs are refused before any worker.
  const bombCases = [
    {
      name: "image bomb refused by declared dimension",
      file: files.bombDimension,
      expected: "60000×120",
    },
    {
      name: "image bomb refused by declared pixel area",
      file: files.bombPixels,
      expected: "10000×10000",
    },
  ];
  for (const bombCase of bombCases) {
    await upload(page, bombCase.file);
    const text = await waitForStatus(page, "too large to analyze safely");
    const state = await audit(page);
    const namesSizedCopy = text.includes(bombCase.expected);
    const noWorker = state.created.length === 0 && state.live === 0;
    record(
      checks,
      bombCase.name,
      namesSizedCopy && noWorker,
      `${JSON.stringify(text)}; workers created=${state.created.length}, live=${state.live}`,
      { expectedSize: bombCase.expected, workersCreated: state.created.length },
    );
  }

  // 3: a malformed PDF reports a bounded failure and leaves no worker running.
  await upload(page, files.malformedPdf);
  await page.waitForFunction(
    ({ selector }) => {
      const element = document.querySelector(selector);
      return Boolean(element && (element.textContent ?? "").trim().length > 0);
    },
    { selector: STATUS },
    { timeout: WAIT_TIMEOUT_MS },
  );
  const pdfText = await statusText(page);
  await page.waitForFunction(
    () => {
      const cancel = Array.from(document.querySelectorAll("button")).find((button) =>
        /cancel extraction/i.test(button.textContent ?? ""),
      );
      return !cancel;
    },
    undefined,
    { timeout: WAIT_TIMEOUT_MS },
  );
  // The worker is created by the loading task; the claim is that the rejected
  // load still reaches destroy(), so any worker that appeared must be gone.
  await page.waitForFunction(
    () => window.__hostileWorkerAudit.live === 0,
    undefined,
    { timeout: WAIT_TIMEOUT_MS },
  );
  const pdfState = await audit(page);
  const pdfWorkerUrl = pdfState.created.find((url) => /pdf\.worker/.test(url)) ?? null;
  record(
    checks,
    "malformed PDF fails closed and tears its pdf.js worker down",
    Boolean(pdfWorkerUrl) && pdfState.live === 0 && /invalid|pdf|extract/i.test(pdfText ?? ""),
    `${JSON.stringify(pdfText)}; pdf.js worker=${pdfWorkerUrl ?? "none"}, live=${pdfState.live}`,
    { workersCreated: pdfState.created.length, liveWorkers: pdfState.live },
  );

  // 4: repeated bombs must not accumulate memory, still creating no worker.
  await page.evaluate(() => {
    window.__hostileWorkerAudit.created = [];
    window.__hostileWorkerAudit.live = 0;
  });
  const heapBefore = await heapBytes(client);
  for (let index = 0; index < MEMORY_ITERATIONS; index += 1) {
    await upload(page, index % 2 === 0 ? files.bombDimension : files.bombPixels);
    await waitForStatus(page, "too large to analyze safely");
  }
  const heapAfter = await heapBytes(client);
  const stateAfterLoop = await audit(page);
  const growth = heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore;
  record(
    checks,
    `${MEMORY_ITERATIONS} repeated bomb uploads stay inside the heap bound`,
    growth !== null && growth <= MEMORY_GROWTH_LIMIT_BYTES,
    `heap ${heapBefore} -> ${heapAfter} bytes (delta ${growth}); ` +
      `workers created=${stateAfterLoop.created.length}`,
    { heapBefore, heapAfter, growthBytes: growth, limitBytes: MEMORY_GROWTH_LIMIT_BYTES },
  );
  record(
    checks,
    "refused uploads never reach an OCR worker",
    stateAfterLoop.created.length === 0 && stateAfterLoop.live === 0,
    `${stateAfterLoop.created.length} worker(s) created across every refusal`,
  );

  // 5: a hung OCR worker must be terminable, and the tab must stay usable.
  await page.evaluate(() => {
    window.__hostileWorkerAudit.stallPattern = "tesseract|worker-guard";
  });
  await upload(page, files.small);
  await page.waitForFunction(
    () => window.__hostileWorkerAudit.created.length > 0,
    undefined,
    { timeout: WAIT_TIMEOUT_MS },
  );
  const hungState = await audit(page);
  const hungOcrWorker = hungState.created.find((url) => url.includes(OCR_WORKER_URL)) ?? null;
  record(
    checks,
    "a hung OCR worker is created and stalls",
    Boolean(hungOcrWorker) && hungState.live === 1,
    `worker=${hungOcrWorker ?? "none"}, live=${hungState.live}, ` +
      `stalled messages=${hungState.stalledMessages}`,
  );

  // The page must answer while the worker is stalled; a frozen tab is the
  // failure mode this check exists for.
  const responsive = await page.evaluate(() => document.title.length > 0);
  record(checks, "the tab still answers while the OCR worker is stalled", responsive);

  const cancelButton = page.getByRole("button", { name: /cancel extraction/i });
  await cancelButton.waitFor({ state: "visible", timeout: WAIT_TIMEOUT_MS });
  await cancelButton.click();

  let cancelSettled = true;
  try {
    await page.waitForFunction(
      () => window.__hostileWorkerAudit.live === 0,
      undefined,
      { timeout: CANCEL_SETTLE_TIMEOUT_MS },
    );
  } catch {
    cancelSettled = false;
  }
  const cancelState = await audit(page);
  const cancelText = await statusText(page);
  const busyAfterCancel = await page
    .getByRole("button", { name: /cancel extraction/i })
    .count();
  record(
    checks,
    "Cancel terminates a hung OCR worker instead of leaving it running",
    cancelSettled && cancelState.live === 0,
    `live=${cancelState.live}, terminated=${cancelState.terminated.length}`,
    { liveWorkers: cancelState.live, terminated: cancelState.terminated.length },
  );
  record(
    checks,
    "Cancel returns the surface to an idle, reusable state",
    /cancelled/i.test(cancelText ?? "") && busyAfterCancel === 0,
    `${JSON.stringify(cancelText)}; cancel buttons=${busyAfterCancel}`,
  );

  record(
    checks,
    "no unhandled page errors during the hostile run",
    pageErrors.length === 0,
    pageErrors.join(" | "),
    { pageErrors },
  );

  return checks;
}

/* ─── main ─────────────────────────────────────────────────────────────────── */

async function cleanup() {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Best-effort browser cleanup only.
    }
    browser = undefined;
  }
  for (const child of children.reverse()) {
    await terminateProcessTree(child);
  }
  await delay(250);
}

async function main() {
  const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
  if (!fs.existsSync(buildIdPath)) {
    throw new Error(
      "no production build found (.next/BUILD_ID is missing); run `npm run build` before the hostile-file stress test",
    );
  }
  const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
  const commit = await readGitHead();

  const { directory, files } = writeFixtures();
  const nextExecutable = path.join(process.cwd(), "node_modules", ".bin", "next");
  const nextServer = logProcess(
    "hostile-next",
    spawn(nextExecutable, ["start", "-H", "127.0.0.1", "-p", String(APP_PORT)], {
      env: {
        ...process.env,
        WORKFLOW_SESSION_SECRET,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: USE_PROCESS_GROUPS,
    }),
  );
  if (!nextServer.pid) throw new Error("Unable to start the Next.js server.");
  await waitForHttp(`${APP_BASE_URL}${ROUTE}`, "Next.js hostile-file server");

  browser = await chromium.launch({
    channel: process.env.HOSTILE_E2E_BROWSER === "chromium" ? undefined : "chrome",
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript({ content: WORKER_AUDIT_SCRIPT });

  const client = await context.newCDPSession(page);
  await client.send("Performance.enable");

  const checks = await runStress(page, client, files);
  const problems = checks.filter((check) => !check.passed);

  const evidence = {
    finding: "REL-05",
    surface: ROUTE,
    commit,
    buildId,
    generatedAt: new Date().toISOString(),
    browser: {
      name: browser.browserType().name(),
      version: browser.version(),
      channel: process.env.HOSTILE_E2E_BROWSER === "chromium" ? "chromium" : "chrome",
    },
    fixtures: Object.fromEntries(
      Object.entries(files).map(([name, file]) => [
        name,
        { bytes: fs.statSync(file).size },
      ]),
    ),
    limits: {
      memoryIterations: MEMORY_ITERATIONS,
      memoryGrowthLimitBytes: MEMORY_GROWTH_LIMIT_BYTES,
    },
    checks,
    totals: { checks: checks.length, passed: checks.length - problems.length, failed: problems.length },
    consoleErrors: consoleErrors.slice(0, 20),
    notClaimed: [
      "no real WASM out-of-memory was induced; pressure is the Chromium JS heap, not process RSS",
      "one browser build on one machine; no Safari, Firefox, or mobile run",
    ],
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2), "utf8");
  fs.rmSync(directory, { recursive: true, force: true });

  checkpoint(
    `${checks.length - problems.length}/${checks.length} check(s) passed ` +
      `(${path.relative(process.cwd(), EVIDENCE_FILE)})`,
  );
  if (problems.length > 0) {
    throw new Error(
      `${problems.length} hostile-file check(s) failed:\n` +
        problems.map((problem) => `  - ${problem.name}: ${problem.detail}`).join("\n") +
        `\nevidence: ${path.relative(process.cwd(), EVIDENCE_FILE)}`,
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(`[hostile] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
