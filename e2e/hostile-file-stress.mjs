/**
 * REL-05 — hostile-file browser stress test for the browser-local DD-214 path.
 *
 * The audit's REL-05 finding ("DD-214 OCR bypasses shared allocation
 * protections; submission promises are unhandled") closed its code clauses with
 * jsdom tests and recorded one thing it could not claim: a hostile file **in a
 * real browser**, under the real production headers, with measured memory. This
 * script is that evidence run. It boots the production build (`next start`; run
 * `npm run build` first) and drives `/presumptive` in Chromium through five
 * hostile inputs — four that must be refused or stalled, and one that is
 * admitted precisely so real WASM pressure can be measured:
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
 *   5. **Large scanned PDF** — a real, artwork-bearing PDF whose pages are sized
 *      so each page renders at the shared canvas cap (4096 × 4096 = 16,777,216
 *      px², exactly `OCR_MAX_CANVAS_AREA_PX`). It is admitted, so Tesseract's
 *      WASM core actually allocates for 16.7M pixels per page. This is the case
 *      that induces real WASM pressure rather than modelling it, and it is
 *      measured both ways: the renderer's JS heap (CDP) **and** process RSS for
 *      the browser's process tree (`ps`). The JS heap is expected to stay small
 *      while RSS climbs — that gap is the WASM memory the earlier run could not
 *      see.
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
 * What this does NOT claim: pressure is induced, but no out-of-memory is forced
 * (nothing makes Tesseract fail on purpose), so this is not an OOM-recovery
 * test. RSS is sampled from `ps` every 250 ms, so a spike between samples is not
 * captured, and it sums the whole browser process tree rather than any single
 * allocator's accounting. RSS sampling requires a POSIX host (CI is Linux); on
 * Windows the pressure check fails with that reason instead of passing
 * unmeasured. The run is one browser build on one machine. Those limits are
 * recorded with the evidence.
 *
 * Evidence: `tmp/hostile-file-stress/evidence.json` holds every check, the
 * measured heap and RSS deltas, the commit and build id, and the browser
 * version.
 *
 * Ports: `HOSTILE_E2E_APP_PORT` (default 3402). Browser: the installed Chrome
 * channel, like the a11y gates; `HOSTILE_E2E_BROWSER=chromium` uses Playwright's
 * own Chromium.
 */

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import zlib from "node:zlib";

import { chromium } from "playwright";

import { sampleRssWhileRunning } from "../scripts/lib/rss-sampler.mjs";

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

/**
 * The synthetic scan's page geometry. `OCR_MAX_CANVAS_AREA_PX` is 16,777,216
 * and `OCR_BASE_RENDER_SCALE` is 2, so 2048 × 2048 pt is the page that renders at
 * exactly the cap: 2048 × 2 = 4096 per side, 4096² = the cap itself, still not
 * downscaled. Anything larger is refused no work by the cap and anything
 * smaller leaves WASM pressure on the table.
 */
const SCAN_PAGE_PT = 2048;
/** Two such pages: enough for the pressure to be real, short of the 5-min OCR budget. */
const SCAN_PAGES = 2;
/** Above the OCR job's own deadline is useless; this stays inside it. */
const SCAN_TIMEOUT_MS = 4 * 60 * 1000;
/** RSS is a sampled quantity; 250 ms is fine-grained against a multi-second OCR pass. */
const RSS_SAMPLE_INTERVAL_MS = 250;
/**
 * Floor for "real WASM pressure". One 16.7M-px Tesseract pass must materialise
 * more than the 16.7 MB grayscale image inside the WASM heap (binarised copy,
 * component arrays, line finding), on top of a 67 MB canvas. 64 MiB is well
 * below what that costs and far above what an idle renderer drifts by.
 */
const WASM_RSS_FLOOR_BYTES = 64 * 1024 * 1024;
/**
 * Upper bound on samples **retained in the evidence file**. The peak is tracked
 * on every sample for the whole operation, so this bounds the artifact rather
 * than the observation: a four-minute scan is ~960 samples at 250 ms, and a
 * cap that also stopped sampling would miss the high-memory phase on a slow host.
 */
const RSS_SAMPLE_LIMIT = 400;

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

/**
 * One page of a synthetic scan: paper, a header rule, and dense word-shaped
 * ink. Deterministic (an LCG, no `Math.random`), so two runs of the harness
 * produce the same bytes and the same amount of OCR work. The strokes are
 * vertical bars rather than solid blocks: they compress well enough to keep the
 * PDF small while still giving Tesseract millions of edges to binarise.
 */
function scanPageRaster(size) {
  const raster = Buffer.alloc(size * size, 0xf4);
  for (let y = 96; y < 104; y += 1) raster.fill(0x22, y * size, (y + 1) * size);
  let seed = 0x9e3779b9;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const rightEdge = size - 150;
  for (let band = 140; band < size - 130; band += 46) {
    const bandHeight = 22 + Math.floor(next() * 8);
    const top = Math.min(band, size - bandHeight - 1);
    let x = 140;
    while (x < rightEdge) {
      const wordEnd = Math.min(rightEdge, x + 20 + Math.floor(next() * 90));
      if (next() > 0.08) {
        for (let y = top; y < top + bandHeight; y += 1) {
          const row = y * size;
          for (let px = x; px < wordEnd; px += 3) raster[row + px] = 0x1c;
        }
      }
      x = wordEnd + 8 + Math.floor(next() * 12);
    }
  }
  return raster;
}

/**
 * A real, parseable PDF whose every page is one full-page grayscale raster.
 *
 * Hand-built (no dependency) with a correct cross-reference table, because
 * pdf.js validates it: the point of this fixture is to be *admitted* and then
 * cost a genuine decode + render + WASM recognition, which a malformed file
 * cannot do. Each page declares no text layer, so the analyzer takes its OCR
 * path for every page.
 */
function scannedPdf(pages = SCAN_PAGES, sizePt = SCAN_PAGE_PT) {
  const chunks = [];
  let offset = 0;
  const push = (buffer) => {
    chunks.push(buffer);
    offset += buffer.length;
  };
  const offsets = new Map();
  const startObject = (number) => {
    offsets.set(number, offset);
    push(Buffer.from(`${number} 0 obj\n`, "latin1"));
  };
  const endObject = () => push(Buffer.from("endobj\n", "latin1"));
  const streamObject = (number, dictionary, payload) => {
    startObject(number);
    push(Buffer.from(`<< ${dictionary} /Length ${payload.length} >>\nstream\n`, "latin1"));
    push(payload);
    push(Buffer.from("\nendstream\n", "latin1"));
    endObject();
  };

  push(Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1"));
  // 1 catalog, 2 page tree, then a page / image / content triple per page.
  const pageNumbers = Array.from({ length: pages }, (_, index) => 3 + index * 3);
  startObject(1);
  push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>\n", "latin1"));
  endObject();
  startObject(2);
  push(
    Buffer.from(
      `<< /Type /Pages /Count ${pages} /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(" ")}] >>\n`,
      "latin1",
    ),
  );
  endObject();

  for (let index = 0; index < pages; index += 1) {
    const pageNumber = pageNumbers[index];
    const imageNumber = pageNumber + 1;
    const contentNumber = pageNumber + 2;
    const compressed = zlib.deflateSync(scanPageRaster(sizePt), { level: 6 });
    startObject(pageNumber);
    push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${sizePt} ${sizePt}] ` +
          `/Resources << /XObject << /Im0 ${imageNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>\n`,
        "latin1",
      ),
    );
    endObject();
    streamObject(
      imageNumber,
      `/Type /XObject /Subtype /Image /Width ${sizePt} /Height ${sizePt} ` +
        "/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode",
      compressed,
    );
    streamObject(
      contentNumber,
      "",
      Buffer.from(`q\n${sizePt} 0 0 ${sizePt} 0 0 cm\n/Im0 Do\nQ\n`, "latin1"),
    );
  }

  const xrefOffset = offset;
  const count = 2 + pages * 3;
  let xref = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let number = 1; number <= count; number += 1) {
    xref += `${String(offsets.get(number) ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  push(Buffer.from(xref, "latin1"));
  push(
    Buffer.from(
      `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      "latin1",
    ),
  );
  return Buffer.concat(chunks);
}

function writeFixtures() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hostile-files-"));
  const files = {
    bombDimension: path.join(directory, "bomb-dimension.png"),
    bombPixels: path.join(directory, "bomb-pixels.png"),
    malformedPdf: path.join(directory, "malformed.pdf"),
    small: path.join(directory, "small.png"),
    largeScan: path.join(directory, "large-scan.pdf"),
  };
  fs.writeFileSync(files.bombDimension, pngWithDeclaredSize(60_000, 120));
  fs.writeFileSync(files.bombPixels, pngWithDeclaredSize(10_000, 10_000));
  fs.writeFileSync(files.malformedPdf, Buffer.from("this is not a PDF at all\n"));
  fs.writeFileSync(files.small, solidPng(16, 16));
  fs.writeFileSync(files.largeScan, scannedPdf());
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

/* ─── process RSS (what the JS heap cannot show) ───────────────────────────── */

const BROWSER_COMMAND_PATTERN = /chrome|chromium|headless_shell/i;

/** The OS process table, or null where it cannot be read. */
function readProcessTable() {
  if (process.platform === "win32") return null;
  try {
    const output = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss=,command="], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 5_000,
    });
    const table = [];
    for (const line of output.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
      if (match) {
        table.push({
          pid: Number(match[1]),
          ppid: Number(match[2]),
          rssKb: Number(match[3]),
          command: match[4],
        });
      }
    }
    return table;
  } catch {
    return null;
  }
}

/**
 * Summed resident set size (bytes) of the browser's process tree.
 *
 * Only descendants of this Node process whose command is a browser binary are
 * counted, so the operator's own Chrome cannot inflate the figure, and the
 * renderer that hosts the WASM heap is included along with its helpers. `ps`
 * reports RSS in kibibytes on both macOS and Linux. Returns null when the table
 * cannot be read (Windows, or a `ps` that failed) rather than a misleading 0 —
 * the caller must not read "unmeasurable" as "no pressure".
 */
function browserRssBytes() {
  const table = readProcessTable();
  if (!table) return null;
  const childrenByParent = new Map();
  for (const entry of table) {
    const siblings = childrenByParent.get(entry.ppid);
    if (siblings) siblings.push(entry);
    else childrenByParent.set(entry.ppid, [entry]);
  }
  const seen = new Set([process.pid]);
  const queue = [process.pid];
  let total = 0;
  let browserProcesses = 0;
  while (queue.length > 0) {
    const parent = queue.shift();
    for (const child of childrenByParent.get(parent) ?? []) {
      if (seen.has(child.pid)) continue;
      seen.add(child.pid);
      queue.push(child.pid);
      if (BROWSER_COMMAND_PATTERN.test(child.command)) {
        total += child.rssKb * 1024;
        browserProcesses += 1;
      }
    }
  }
  return browserProcesses === 0 ? null : total;
}

/**
 * Sample RSS while `run` executes, keeping the peak over the whole operation.
 *
 * The loop itself lives in `scripts/lib/rss-sampler.mjs` so the peak-over-
 * retention behaviour can be unit-tested without booting a browser; this
 * wrapper supplies the only measurement this harness accepts — the browser
 * process tree it launched — and the harness's own interval and cap.
 */
async function withRssSamples(run) {
  return sampleRssWhileRunning({
    run,
    sample: browserRssBytes,
    intervalMs: RSS_SAMPLE_INTERVAL_MS,
    retainLimit: RSS_SAMPLE_LIMIT,
  });
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

/**
 * The only case that costs real memory: a full-resolution scanned PDF that the
 * application accepts, so pdf.js decodes and renders 16.7M px per page and
 * Tesseract's WASM core allocates for the same pixels. Measured both ways —
 * CDP's JS heap for the page, and process RSS for the browser tree — because
 * the WASM heap is not in the former, which is precisely why the earlier run
 * could not see it.
 */
async function runScanPressureCase(page, client, files, checks) {
  await page.evaluate(() => {
    const audit = window.__hostileWorkerAudit;
    audit.created = [];
    audit.terminated = [];
    audit.live = 0;
    audit.stalledMessages = 0;
    audit.stallPattern = null;
  });

  const previousMessage = (await statusText(page)) ?? "";
  const rssBefore = browserRssBytes();
  const heapBefore = await heapBytes(client);
  const startedAt = Date.now();

  let scanError = null;
  let samples = [];
  let sampleCount = 0;
  let sampledPeak = null;
  try {
    const run = await withRssSamples(async () => {
      await upload(page, files.largeScan);
      await page.waitForFunction(
        ({ fileInput, status, previous }) => {
          const input = document.querySelector(fileInput);
          if (!input || input.disabled) return false;
          const message = (document.querySelector(status)?.textContent ?? "").trim();
          // Wait for *this* run's terminal copy, not the previous case's message.
          return (
            message.length > 0 &&
            message !== previous &&
            /extracted|readable text|limit|could not|exceeds|supports PDF|failed/i.test(message)
          );
        },
        { fileInput: FILE_INPUT, status: STATUS, previous: previousMessage },
        { timeout: SCAN_TIMEOUT_MS },
      );
    });
    samples = run.samples;
    sampleCount = run.sampleCount;
    sampledPeak = run.peak;
  } catch (error) {
    scanError = error instanceof Error ? error.message : String(error);
  }

  const elapsedMs = Date.now() - startedAt;
  const rssAfter = browserRssBytes();
  const heapAfter = await heapBytes(client);
  const state = await audit(page);
  const message = (await statusText(page)) ?? "";
  // The peak comes from every sample, not from the truncated evidence list.
  const peakRss = sampledPeak;
  const rssDelta = rssBefore !== null && peakRss !== null ? peakRss - rssBefore : null;
  const heapDelta = heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null;
  const ocrWorker = state.created.find((url) => url.includes(OCR_WORKER_URL)) ?? null;
  const ocrTerminated = state.terminated.some((url) => url.includes(OCR_WORKER_URL));
  const extracted = /extracted locally|No readable text/i.test(message);
  const hitDeadline = /5-minute limit/i.test(message);

  record(
    checks,
    "a large scanned PDF is admitted and its OCR pass finishes",
    scanError === null && extracted && !hitDeadline && Boolean(ocrWorker) && ocrTerminated && state.live === 0,
    `pages=${SCAN_PAGES} at ${SCAN_PAGE_PT}pt (rendered ${SCAN_PAGE_PT * 2}px square, the canvas cap); ` +
      `${JSON.stringify(message)}; ocr worker=${ocrWorker ? "created" : "none"}, ` +
      `terminated=${ocrTerminated}, live=${state.live}, ${Math.round(elapsedMs / 1000)}s` +
      (scanError ? `; wait failed: ${scanError}` : ""),
    {
      pages: SCAN_PAGES,
      pagePt: SCAN_PAGE_PT,
      renderedPx: SCAN_PAGE_PT * 2,
      elapsedMs,
      liveWorkers: state.live,
      hitDeadline,
    },
  );

  record(
    checks,
    "real OCR of the scanned pages moves process RSS, not just the JS heap",
    rssDelta !== null && rssDelta >= WASM_RSS_FLOOR_BYTES && (heapDelta === null || rssDelta > heapDelta),
    rssDelta === null
      ? "process RSS sampling is unavailable on this host (needs a POSIX `ps`); the WASM-pressure claim stays unmeasured"
      : `rss ${rssBefore} -> peak ${peakRss} -> after ${rssAfter} bytes ` +
        `(delta ${rssDelta}, floor ${WASM_RSS_FLOOR_BYTES}); ` +
        `JS heap ${heapBefore} -> ${heapAfter} (delta ${heapDelta}); ` +
        `${sampleCount} sample(s)` +
        (samples.length < sampleCount ? `, ${samples.length} retained in evidence` : ""),
    {
      rssBefore,
      rssPeak: peakRss,
      rssAfter,
      rssDeltaBytes: rssDelta,
      rssFloorBytes: WASM_RSS_FLOOR_BYTES,
      jsHeapBefore: heapBefore,
      jsHeapAfter: heapAfter,
      jsHeapDeltaBytes: heapDelta,
      rssSampleCount: sampleCount,
      rssSamplesRetained: samples.length,
      rssSamples: samples,
    },
  );

  return {
    rssBefore,
    rssPeak: peakRss,
    rssAfter,
    rssDelta,
    heapBefore,
    heapAfter,
    heapDelta,
    samples,
    sampleCount,
  };
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

  // 6: the only case that costs real memory — a full-resolution scan that the
  // application admits, so the WASM core actually allocates for it.
  const pressure = await runScanPressureCase(page, client, files, checks);

  record(
    checks,
    "no unhandled page errors during the hostile run",
    pageErrors.length === 0,
    pageErrors.join(" | "),
    { pageErrors },
  );

  return { checks, pressure };
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

  const { checks, pressure } = await runStress(page, client, files);
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
      scanPages: SCAN_PAGES,
      scanPagePt: SCAN_PAGE_PT,
      scanRenderedPx: SCAN_PAGE_PT * 2,
      rssFloorBytes: WASM_RSS_FLOOR_BYTES,
      rssSampleIntervalMs: RSS_SAMPLE_INTERVAL_MS,
    },
    memory: {
      jsHeap: {
        before: pressure.heapBefore,
        after: pressure.heapAfter,
        deltaBytes: pressure.heapDelta,
      },
      processRss: {
        before: pressure.rssBefore,
        peak: pressure.rssPeak,
        after: pressure.rssAfter,
        deltaBytes: pressure.rssDelta,
        // `samples` is a bounded, illustrative history; `sampleCount` is how
        // many samples the peak was taken from (the scan may outlast the cap).
        sampleCount: pressure.sampleCount,
        samples: pressure.samples,
      },
      wasmPressureInduced: pressure.rssDelta !== null && pressure.rssDelta >= WASM_RSS_FLOOR_BYTES,
    },
    checks,
    totals: { checks: checks.length, passed: checks.length - problems.length, failed: problems.length },
    consoleErrors: consoleErrors.slice(0, 20),
    notClaimed: [
      "WASM memory pressure is induced with a full-resolution scan, but no out-of-memory is forced, so this is not an OOM-recovery test",
      "process RSS is sampled from `ps` every 250 ms and summed over the browser's process tree, so a spike between samples is not captured and no single allocator's accounting is claimed",
      "the peak is taken from every sample for the whole run, but only the first 400 samples are retained in this file, so `samples` is an illustrative history and `sampleCount` says how many the peak was taken from",
      "process RSS sampling requires a POSIX host; without it the pressure check fails rather than passing unmeasured",
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
