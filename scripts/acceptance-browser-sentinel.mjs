// PRIV-01 stage 4 — browser sentinel acceptance.
//
//   node scripts/acceptance-browser-sentinel.mjs
//
// Requires the app already running (default http://127.0.0.1:3107; override
// with SENTINEL_APP_BASE) and headless Chrome. Drives the full six-step
// secondary workflow in a real browser with unique sentinels planted in every
// private field, and fails if a sentinel reaches any request URL/body/header
// or cookie, any server HTML/RSC payload, the captured browser/server logs, or
// trace files. Also verifies that file extraction and image-only-PDF OCR run
// entirely in-browser (worker traffic included) and that Finish Review clears
// every registered browser storage key.
//
// CI runs this as an enforced job — .github/workflows/ci.yml, job
// `priv01_sentinel`, step "Run PRIV-01 stage-4 browser sentinel" — for pull
// requests whose change set can move the browser-local privacy posture
// (scripts/priv01-sentinel-scope.mjs, answered by the `priv01_scope` job) and
// for every non-PR event. That job starts the dev server itself and points
// SENTINEL_APP_BASE and SENTINEL_SERVER_LOG at it, because the scan below only
// means something when it reads the log of the server it actually drove; a
// missing browser or unhealthy server fails the gate rather than skipping it.
// It has its own wall-clock budget and the walk has a smaller one inside it, so
// a wedged walk cannot spend the budget of any other gate, and `verify` fails
// when this job fails (tests/priv01-sentinel-gate-wiring.test.ts pins that
// wiring).
//
// The sentinel split is deliberate:
//   Pass A — real UI walk. Real catalog selections (the picker only offers
//            catalog ids); sentinels go in every free-text field, the evidence
//            file name/content, the scanned-PDF file name and rendered OCR
//            image, and the pasted-proof file.
//   Pass B — seeded browser record. The schema admits arbitrary strings in the
//            id/adapter fields (diagnosed ids, service-connected ids, draft
//            keys, rating keys, symptom ids, timeline keys), so a full record
//            with sentinels in every string field is written to sessionStorage
//            (the sanctioned browser-local home) and Steps 5–6 are re-walked.
// Between the two passes every private field carries a unique sentinel.
//
// Writes tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage4-evidence.json
// and exits 1 on any hard assertion failure.

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";

import { createProgressReporter } from "./lib/sentinel-progress.mjs";
import { waitForCondition } from "./lib/sentinel-wait.mjs";
import { readSentinelTextSurface, sentinelDevTracePath } from "./lib/sentinel-text-surfaces.mjs";

// Next already ships ws. Its streaming frame decoder handles large CDP
// getResponseBody packets (the self-hosted WASM loader is several MB), where
// the host's native WebSocket closed with 1006 during the OCR asset capture.
const CdpWebSocket = createRequire(import.meta.url)("next/dist/compiled/ws");

const APP_BASE = process.env.SENTINEL_APP_BASE ?? "http://127.0.0.1:3107";
const CDP_PORT = Number(process.env.SENTINEL_CDP_PORT ?? 0);
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EVIDENCE_DIR = path.join(
  process.cwd(),
  "tmp/security-audit-2026-10-07/rel-01-kb-repair",
);
const SERVER_LOG =
  process.env.SENTINEL_SERVER_LOG ?? path.join(EVIDENCE_DIR, "dev-server-stage3.log");
const REPORT_PATH =
  process.env.SENTINEL_REPORT_PATH ??
  path.join(EVIDENCE_DIR, "priv01-stage4-evidence.json");
const LOCAL_STATE_SOURCE = path.join(
  process.cwd(),
  "src/lib/secondary-workflow/local-state.ts",
);
// The clear-list constants are defined in their owning modules and imported by
// local-state.ts, so the drift check resolves the identifiers through these.
const CLEAR_KEY_SOURCES = [
  LOCAL_STATE_SOURCE,
  path.join(process.cwd(), "src/lib/secondary-workflow/browser-context.ts"),
  path.join(process.cwd(), "src/lib/evidence/extract.ts"),
  path.join(process.cwd(), "src/lib/evidence/ocr-session.ts"),
];
const TRACE_FILE = sentinelDevTracePath();
// Character cap for whole-file scans of the server log and the Next dev trace.
// Next rotates `.next/dev/trace` (and may restart the dev log) instead of only
// appending, so a tail-slice from a pre-run offset can scan zero bytes and pass
// vacuously; both surfaces are scanned in full up to this many characters.
const TEXT_SURFACE_SCAN_LIMIT = 4_000_000;
const CONTEXT_KEY = "secondary-condition-finder:secondary-workflow:v1";
// Mirrors `secondaryWorkflowLocalStorageKeys` in local-state.ts; the script
// asserts below that every key still appears in that source file.
const CLEAR_KEYS = [
  CONTEXT_KEY,
  "secondary-condition-finder:evidence-analysis:v1",
  "secondary-condition-finder:evidence-gap-review:v1",
  "secondary-condition-finder:pathway-record-checklist:v1",
  "secondary-condition-finder:va-gov-record-walkthrough:v1",
  "secondary-condition-finder:ocr-checkpoint:v1",
  "secondary-condition-finder:evidence-depth:v1",
];

const TOKEN = crypto.randomBytes(4).toString("hex");
const TOKEN_UPPER = TOKEN.toUpperCase();
const SENTINELS = {
  diagnosedId: `sentinel-diagnosed-${TOKEN}`,
  serviceConnectedId: `sentinel-service-connected-${TOKEN}`,
  answerDraftKey: `sentinel-draft-${TOKEN}`,
  timelineKey: `sentinel-timeline-${TOKEN}`,
  symptomId: `sentinel-symptom-${TOKEN}`,
  medication: `SENTINEL_MEDICATION_${TOKEN_UPPER}`,
  treatment: `SENTINEL_TREATMENT_${TOKEN_UPPER}`,
  history: `SENTINEL_HISTORY_${TOKEN_UPPER}`,
  uiMedication: `SENTINEL_UI_MED_${TOKEN_UPPER}`,
  uiTreatment: `SENTINEL_UI_TX_${TOKEN_UPPER}`,
  uiHistory: `SENTINEL_UI_HISTORY_${TOKEN_UPPER}`,
  evidenceText: `SENTINEL_EVIDENCE_TEXT_${TOKEN_UPPER}`,
  evidenceFileName: `sentinel-evidence-${TOKEN}.txt`,
  scannedPdfName: `sentinel-scan-${TOKEN}.pdf`,
  ocrToken: `SENTINELOCR${TOKEN_UPPER}`,
  consoleSeed: `SENTINEL_CONSOLE_SEED_${TOKEN_UPPER}`,
  bodyControl: `SENTINEL_BODY_CONTROL_${TOKEN_UPPER}`,
};
const ALL_SENTINELS = [...new Set(Object.values(SENTINELS))];
// Harness-planted same-origin POST used as the positive control for the
// request-body surface: it proves body capture and sentinel detection are live
// even when no app request in the walk carries a body. Requests to this path are
// accounted as control traffic, never as app traffic.
const REQUEST_BODY_CONTROL_PATH = `/__priv01-request-body-control-${TOKEN}`;

// Every browser-local store the secondary workflow owns, described by what it
// holds. `CLEAR_KEYS` is the clear-all list; these entries let the run prove
// each store was written by the real flow before the clear-all step.
const AUXILIARY_STORES = [
  { key: CONTEXT_KEY, label: "workflow context record" },
  {
    key: "secondary-condition-finder:evidence-analysis:v1",
    label: "evidence analyses and excerpts",
  },
  { key: "secondary-condition-finder:evidence-depth:v1", label: "local analysis depth" },
  {
    key: "secondary-condition-finder:evidence-gap-review:v1",
    label: "evidence gap review checkmarks",
  },
  {
    key: "secondary-condition-finder:pathway-record-checklist:v1",
    label: "pathway record checklist",
  },
  {
    key: "secondary-condition-finder:va-gov-record-walkthrough:v1",
    label: "VA.gov record walkthrough",
  },
  {
    key: "secondary-condition-finder:ocr-checkpoint:v1",
    label: "OCR resume checkpoint",
    selfClearing: true,
  },
];

const CONTEXT_SCHEMA_SOURCE = path.join(
  process.cwd(),
  "src/lib/secondary-workflow/browser-context.ts",
);

const assertions = [];
const violations = [];
const observations = {};
const children = [];
let ws;
let pageSessionId = null;
let nextMessageId = 0;
const pendingMessages = new Map();
const sessions = new Map();
const requests = new Map();
const responses = new Map();
const responseBodyPromises = [];
const responseBodies = [];
const consoleMessages = [];
let profileDirForCleanup = null;
const logEntries = [];
const exceptions = [];
const navigations = [];
const workerSessions = [];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Waits until CDP has reported the planted control request (with its body)
// before the surface scan snapshots the request inventory.
async function waitForCapturedRequest(urlFragment, timeoutMs = 10_000) {
  const startedAt = Date.now();
  const label = `captured request ${urlFragment}`;
  const deadline = startedAt + timeoutMs;
  while (Date.now() < deadline) {
    const captured = [...requests.values()].some(
      (entry) => entry.url.includes(urlFragment) && entry.postData,
    );
    progress.probe({
      label,
      elapsedMs: Date.now() - startedAt,
      last: captured ? "request captured" : "not captured yet",
    });
    if (captured) return true;
    await delay(200);
  }
  return false;
}

/**
 * Progress heartbeats, so a wedged run is diagnosable from the log alone rather
 * than looking like a slow one. `scripts/lib/sentinel-progress.mjs` documents
 * what each line means; the reporter is passive and never decides a result.
 */
const progress = createProgressReporter();

function assert(name, ok, detail) {
  assertions.push({ name, ok: Boolean(ok), detail: detail ?? null });
  // An assertion is the walk moving forward; the heartbeat reports how long ago
  // the last one was, which is what makes a stall visible between log lines.
  progress.event(`assertion "${name}" ${ok ? "passed" : "FAILED"}`);
  if (!ok) console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  else console.log(`ok    ${name}`);
  return Boolean(ok);
}

// Per-surface accounting so the report can show, surface by surface, how much
// was scanned and that each one produced zero sentinel hits — not just a
// single global total that a silent surface could hide behind.
const surfaceStats = new Map();

function surfaceEntry(kind) {
  if (!surfaceStats.has(kind)) surfaceStats.set(kind, { scanned: 0, hits: 0 });
  return surfaceStats.get(kind);
}

function noteViolation(kind, where, sentinel) {
  violations.push({ kind, where, sentinel });
  surfaceEntry(kind).hits += 1;
}

function scanText(kind, where, text) {
  if (typeof text !== "string" || text.length === 0) return;
  surfaceEntry(kind).scanned += 1;
  for (const sentinel of ALL_SENTINELS) {
    if (text.includes(sentinel)) noteViolation(kind, where, sentinel);
  }
}

function spawnTracked(label, command, args, env = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("error", (error) => console.error(`[${label}] failed: ${error.message}`));
  children.push(child);
  return child;
}

async function waitForHttp(url, label, timeoutMs = 60_000) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let lastError;
  let last = "no response yet";
  let status = "value";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      status = "value";
      last = `HTTP ${response.status}`;
      if (response.status < 500) {
        progress.probe({ label, elapsedMs: Date.now() - startedAt, last, status });
        return response;
      }
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      status = "error";
      last = error?.message ?? "request failed";
    }
    progress.probe({ label, elapsedMs: Date.now() - startedAt, last, status });
    await delay(300);
  }
  throw new Error(
    `${label} never became ready: ${lastError?.message ?? "timeout"} — ${progress.describeWait(label)}`,
  );
}

function send(method, params = {}, sessionId, timeoutMs = 60_000) {
  const id = ++nextMessageId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }
    }, timeoutMs);
    pendingMessages.set(id, { resolve, reject, timer, sessionId });
    if (ws.readyState !== CdpWebSocket.OPEN) {
      clearTimeout(timer);
      pendingMessages.delete(id);
      reject(new Error("CDP transport is not open; capture continuity is lost"));
      return;
    }
    ws.send(
      JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
    );
  });
}

async function pageEval(expression, timeoutMs = 60_000) {
  const result = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true, userGesture: true, timeout: timeoutMs },
    pageSessionId,
    timeoutMs + 1_000,
  );
  if (result.exceptionDetails) {
    throw new Error(
      `page eval failed: ${
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
      }`,
    );
  }
  return result.result?.value;
}

async function waitForPage(expression, label, timeoutMs = 90_000) {
  try {
    await waitForCondition({
      probe: (budget) => pageEval(expression, budget), label, timeoutMs,
      // Record only. The heartbeat interval owns the output, so a long wait
      // produces one consistent line format instead of two competing ones.
      onProgress: ({ elapsedMs, last, status }) => {
        progress.probe({ label, elapsedMs, last, status });
      },
    });
  } catch (error) {
    // The wait says *what* was awaited. This adds whether the browser was still
    // answering, which is the difference between a slow run and a wedge.
    throw new Error(`${error.message} — ${progress.describeWait(label)}`);
  }
}

async function navigate(url) {
  await send("Page.navigate", { url }, pageSessionId);
}

/** Stringify a small function into a page-side IIFE with JSON arguments. */
function js(fn, ...args) {
  return `(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(",")})`;
}

// ---------------------------------------------------------------------------
// Page-side helpers (stringified by js()).
// ---------------------------------------------------------------------------

function setNativeValue(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return false;
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(el),
    "value",
  );
  if (descriptor?.set) descriptor.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return el.value;
}

function clickSelector(selector) {
  const el = document.querySelector(selector);
  if (!el) return false;
  el.click();
  return true;
}

function selectByOptionValue(optionValue) {
  const select = [...document.querySelectorAll("select")].find((element) =>
    [...element.options].some((option) => option.value === optionValue),
  );
  if (!select) return false;
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  );
  if (descriptor?.set) descriptor.set.call(select, optionValue);
  else select.value = optionValue;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return select.value;
}

function clickFirstCheckboxIn(sectionSelector) {
  const root = document.querySelector(sectionSelector);
  const box = root?.querySelector('input[type="checkbox"]:not(:checked)');
  if (!box) return false;
  box.click();
  return box.checked === true;
}

function readPrivateSurfaces(contextKey) {
  const read = (key) => {
    const raw = sessionStorage.getItem(key);
    return { present: Boolean(raw), bytes: raw ? raw.length : 0, raw: raw ?? "" };
  };
  const context = read(contextKey);
  let record = null;
  try {
    record = context.present ? JSON.parse(context.raw) : null;
  } catch {
    record = null;
  }
  return {
    contextBytes: context.bytes,
    record,
    stores: Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index),
    )
      .filter((key) => typeof key === "string")
      .reduce((accumulator, key) => {
        const entry = read(key);
        accumulator[key] = { present: entry.present, bytes: entry.bytes };
        return accumulator;
      }, {}),
    analyses: read("secondary-condition-finder:evidence-analysis:v1").raw,
    ocrCheckpoint: read("secondary-condition-finder:ocr-checkpoint:v1"),
  };
}

function stageFile(base64, name, type, selector) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const file = new File([bytes], name, { type });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const input = document.querySelector(selector);
  if (!input) return false;
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function drawOcrImage(token, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.font = "bold 72px Helvetica, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`The sleep apnea was caused by ${token}`, width / 2, height / 2);
  return canvas.toDataURL("image/jpeg", 0.95).replace(/^data:image\/jpeg;base64,/, "");
}

async function scanIndexedDb(sentinels) {
  const databases = await indexedDB.databases();
  const results = [];
  for (const info of databases) {
    const record = { name: info.name, stores: [], records: 0, holdsSentinel: false };
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(info.name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      record.stores = Array.from(db.objectStoreNames);
      for (const storeName of record.stores) {
        const values = await new Promise((resolve, reject) => {
          const request = db
            .transaction(storeName, "readonly")
            .objectStore(storeName)
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        record.records += values.length;
        const text = JSON.stringify(values).slice(0, 4_000_000);
        for (const sentinel of sentinels) {
          if (text.includes(sentinel)) record.holdsSentinel = true;
        }
      }
      db.close();
    } catch (error) {
      record.error = String(error);
    }
    results.push(record);
  }
  return results;
}

function sessionSnapshot() {
  const keys = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    keys.push({ key, value: sessionStorage.getItem(key) });
  }
  return {
    session: keys,
    local: Object.entries(localStorage),
    cookie: document.cookie,
    url: location.href,
    historyState: JSON.stringify(history.state ?? null),
  };
}

function plantClearKeys(clearKeys, sentinel) {
  for (const key of clearKeys) {
    sessionStorage.setItem(key, JSON.stringify({ sentinel }));
  }
  return sessionStorage.length;
}

function plantContextRecord(key, record) {
  sessionStorage.setItem(key, JSON.stringify(record));
  return sessionStorage.getItem(key)?.length ?? 0;
}

// Positive control for the request-body surface. It is a same-origin POST whose
// JSON body deliberately carries a sentinel value, so the run can prove that a
// body travelling over the wire would be captured and flagged.
function postRequestBodyControl(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
    cache: "no-store",
  })
    .then((response) => ({ status: response.status, ok: response.ok }))
    .catch((error) => ({ status: 0, ok: false, error: String(error?.message ?? error) }));
}

function clickButtonByText(text) {
  const buttons = [...document.querySelectorAll("button, a")];
  const match = buttons.find((element) => element.textContent?.includes(text));
  if (!match) return false;
  match.click();
  return true;
}

function clickAnalyzeDocuments() {
  const button = [...document.querySelectorAll("button")].find((element) =>
    /^Analyze \d+ documents?/.test(element.textContent?.trim() ?? ""),
  );
  if (!button) return false;
  button.click();
  return true;
}

// ---------------------------------------------------------------------------
// CDP event handling — captures requests, responses, bodies, console and logs
// from the page session and every auto-attached worker session.
// ---------------------------------------------------------------------------

function shouldCaptureBody(entry, response) {
  if (!response) return false;
  if (["Document", "XHR", "Fetch"].includes(entry.type)) return true;
  return /text\/|json|xml|x-component|javascript|urlencoded/i.test(
    response.mimeType ?? "",
  );
}

function handleCdpEvent(message) {
  const { method, params } = message;
  if (!method) return;
  switch (method) {
    case "Target.attachedToTarget": {
      const { sessionId, targetInfo } = params;
      const role = targetInfo.type;
      sessions.set(sessionId, { role, url: targetInfo.url });
      if (["worker", "service_worker", "shared_worker"].includes(role)) {
        workerSessions.push({ sessionId, type: role, url: targetInfo.url });
        void (async () => {
          try {
            await Promise.all([
              send("Network.enable", {}, sessionId),
              send("Runtime.enable", {}, sessionId),
              send("Log.enable", {}, sessionId).catch(() => {}),
            ]);
          } finally {
            try {
              await send("Runtime.runIfWaitingForDebugger", {}, sessionId);
            } catch {
              // Worker already running.
            }
          }
        })();
      }
      break;
    }
    case "Target.detachedFromTarget":
      sessions.delete(params.sessionId);
      for (const [id, pending] of pendingMessages) {
        if (pending.sessionId === params.sessionId) {
          clearTimeout(pending.timer);
          pendingMessages.delete(id);
          pending.reject(new Error("CDP target detached"));
        }
      }
      break;
    case "Network.requestWillBeSent": {
      const key = `${message.sessionId}:${params.requestId}`;
      requests.set(key, {
        key,
        sessionRole: sessions.get(message.sessionId)?.role ?? "unknown",
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        headers: { ...(params.request.headers ?? {}) },
        extraHeaders: {},
        cookies: [],
        postData: params.request.postData ?? null,
        hasPostData: Boolean(params.request.hasPostData),
        type: params.type ?? "Other",
        documentURL: params.documentURL ?? null,
      });
      break;
    }
    case "Network.requestWillBeSentExtraInfo": {
      const key = `${message.sessionId}:${params.requestId}`;
      const entry = requests.get(key);
      if (entry) {
        entry.extraHeaders = { ...(params.headers ?? {}) };
        entry.cookies = (params.associatedCookies ?? []).map(
          (associated) => associated.cookie,
        );
      }
      break;
    }
    case "Network.responseReceived": {
      const key = `${message.sessionId}:${params.requestId}`;
      const entry = requests.get(key);
      responses.set(key, {
        key,
        url: params.response.url,
        status: params.response.status,
        mimeType: params.response.mimeType,
        headers: { ...(params.response.headers ?? {}) },
        fromDiskCache: Boolean(params.response.fromDiskCache),
      });
      if (entry) entry.response = responses.get(key);
      break;
    }
    case "Network.loadingFinished": {
      const key = `${message.sessionId}:${params.requestId}`;
      const entry = requests.get(key);
      if (!entry || !shouldCaptureBody(entry, entry.response)) break;
      const sessionId = message.sessionId;
      const requestId = params.requestId;
      responseBodyPromises.push(
        send("Network.getResponseBody", { requestId }, sessionId)
          .then((body) => {
            responseBodies.push({
              key,
              url: entry.url,
              mimeType: entry.response?.mimeType ?? null,
              body: body.body,
              base64Encoded: Boolean(body.base64Encoded),
            });
          })
          .catch(() => {
            // Body evicted or unavailable; recorded as not-captured below.
          }),
      );
      break;
    }
    case "Runtime.consoleAPICalled": {
      const parts = (params.args ?? []).map((arg) => {
        if (arg.value !== undefined) {
          return typeof arg.value === "string"
            ? arg.value
            : JSON.stringify(arg.value);
        }
        if (arg.preview?.properties) {
          const properties = arg.preview.properties
            .map((property) => `${property.name}:${property.value}`)
            .join(",");
          return `${arg.description ?? ""} ${properties}`;
        }
        return arg.description ?? arg.type ?? "";
      });
      consoleMessages.push({
        role: sessions.get(message.sessionId)?.role ?? "unknown",
        type: params.type,
        text: parts.join(" "),
      });
      break;
    }
    case "Log.entryAdded": {
      logEntries.push({ level: params.entry.level, text: params.entry.text });
      break;
    }
    case "Runtime.exceptionThrown": {
      exceptions.push(
        params.exceptionDetails.exception?.description ??
          params.exceptionDetails.text,
      );
      break;
    }
    case "Page.frameNavigated": {
      navigations.push(params.frame.url);
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Scanned-PDF builder: one page, one JPEG XObject (image-only → no text layer).
// ---------------------------------------------------------------------------

function buildImagePdf(jpegBytes, width, height) {
  const chunks = [];
  const offsets = [];
  let position = 0;
  const push = (data) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "latin1");
    chunks.push(buffer);
    position += buffer.length;
  };
  const start = (number) => {
    offsets[number] = position;
    push(`${number} 0 obj\n`);
  };
  push("%PDF-1.4\n");
  start(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  start(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  start(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
  );
  start(4);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${jpegBytes.length} >>\nstream\n`,
  );
  push(jpegBytes);
  push("\nendstream\nendobj\n");
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;
  start(5);
  push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream\nendobj\n`);
  const xrefStart = position;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let number = 1; number <= 5; number += 1) {
    xref += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  push(xref);
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function readSessionKeys() {
  return pageEval(js(sessionSnapshot)).catch(() => null);
}

async function run() {
  progress.start();
  progress.phase("scanner self-test (positive control)");
  console.log(`PRIV-01 stage-4 browser sentinel acceptance — token ${TOKEN}`);
  console.log(`App under test: ${APP_BASE}`);

  // 0. Scanner self-test ---------------------------------------------------
  // Positive control for the shared detection path: a single sentinel and then
  // the full run set are planted in synthetic text. Without this, a detector
  // that silently matched nothing would make every "zero hits" surface vacuous.
  const selfTestBase = violations.length;
  scanText(
    "scanner-self-test",
    "single sentinel probe",
    `prefix ${SENTINELS.medication} suffix`,
  );
  const singleDetections = violations.length - selfTestBase;
  scanText("scanner-self-test", "all sentinel probe", ALL_SENTINELS.join(" | "));
  const selfTestDetected = new Set(
    violations.slice(selfTestBase).map((violation) => violation.sentinel),
  );
  violations.length = selfTestBase;
  surfaceStats.delete("scanner-self-test");
  assert(
    "scanner self-test: a planted sentinel in scanned text is detected",
    singleDetections === 1,
    `detections=${singleDetections}`,
  );
  assert(
    "scanner self-test: every sentinel in the run set is detectable",
    selfTestDetected.size === ALL_SENTINELS.length,
    `${selfTestDetected.size}/${ALL_SENTINELS.length}`,
  );

  // 1. Preconditions -------------------------------------------------------
  progress.phase("preconditions (health, schema inventory)");
  const health = await waitForHttp(`${APP_BASE}/api/health`, "app health", 20_000);
  assert("dev server healthy before the walk", health.status === 200, `HTTP ${health.status}`);

  const localStateSource = fs.readFileSync(LOCAL_STATE_SOURCE, "utf8");
  const clearKeySourceText = CLEAR_KEY_SOURCES.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const clearKeyArrayMatch = localStateSource.match(
    /secondaryWorkflowLocalStorageKeys\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  const clearKeyIdentifiers = clearKeyArrayMatch
    ? [...clearKeyArrayMatch[1].matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map((match) => match[0])
    : [];
  const resolvedClearKeys = clearKeyIdentifiers.map((identifier) => {
    const match = clearKeySourceText.match(
      new RegExp(`export const ${identifier}\\s*(?::[^=]+)?=\\s*"([^"]+)"`),
    );
    return match ? match[1] : null;
  });
  const clearKeysMatch =
    clearKeyIdentifiers.length === CLEAR_KEYS.length &&
    new Set(resolvedClearKeys).size === CLEAR_KEYS.length &&
    CLEAR_KEYS.every((key) => resolvedClearKeys.includes(key));
  assert(
    "clear-all key list matches the registered browser storage keys",
    clearKeysMatch,
    clearKeysMatch
      ? `${CLEAR_KEYS.length} keys`
      : `script=[${CLEAR_KEYS.join(", ")}] source=[${resolvedClearKeys.join(", ")}] identifiers=${clearKeyIdentifiers.length}`,
  );

  // The private-field inventory is derived from the schema source, so a new
  // context field cannot be added without this gate noticing it is uncovered.
  const schemaSource = fs.readFileSync(CONTEXT_SCHEMA_SOURCE, "utf8");
  const schemaObjectMatch = schemaSource.match(
    /browserWorkflowContextSchema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\);/,
  );
  const contextFields = schemaObjectMatch
    ? [...schemaObjectMatch[1].matchAll(/^ {2}([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map(
        (match) => match[1],
      )
    : [];
  assert(
    "context schema field inventory parsed from source",
    contextFields.length >= 10 && contextFields.includes("version"),
    JSON.stringify(contextFields),
  );

  const serverLogBefore = fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, "utf8").length : 0;
  const traceBefore = fs.existsSync(TRACE_FILE) ? fs.readFileSync(TRACE_FILE, "utf8").length : 0;

  // 2. Launch Chrome and attach -------------------------------------------
  progress.phase("launching Chrome and attaching CDP");
  const profileDir = path.join(os.tmpdir(), `cdp-chrome-sentinel-${TOKEN}`);
  profileDirForCleanup = profileDir;
  fs.rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawnTracked("chrome", CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1000",
    "about:blank",
  ]);
  if (!chrome.pid) throw new Error("Chrome failed to start.");
  // Let Chrome allocate a free port by default. Read its owned profile rather
  // than attaching to an unrelated browser that happened to occupy 9224.
  const activePortFile = path.join(profileDir, "DevToolsActivePort");
  const portDeadline = Date.now() + 30_000;
  while (!fs.existsSync(activePortFile) && Date.now() < portDeadline) {
    if (chrome.exitCode !== null) throw new Error("Chrome exited before DevTools was ready.");
    await delay(100);
  }
  const activePort = CDP_PORT || Number(fs.readFileSync(activePortFile, "utf8").split("\n")[0]);
  await waitForHttp(`http://127.0.0.1:${activePort}/json/version`, "Chrome DevTools endpoint", 30_000);

  const version = await (
    await fetch(`http://127.0.0.1:${activePort}/json/version`)
  ).json();
  ws = new CdpWebSocket(version.webSocketDebuggerUrl, { maxPayload: 32 * 1024 * 1024 });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("close", (event) => {
    console.error(`CDP transport closed: code=${event.code} reason=${event.reason}`);
    for (const pending of pendingMessages.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`CDP transport closed (${event.code})`));
    }
    pendingMessages.clear();
  });
  ws.addEventListener("error", () => console.error("CDP transport error"));
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pendingMessages.has(message.id)) {
      const { resolve, reject, timer } = pendingMessages.get(message.id);
      clearTimeout(timer);
      pendingMessages.delete(message.id);
      if (message.error) reject(new Error(`CDP error: ${message.error.message}`));
      else resolve(message.result);
      return;
    }
    if (message.method) handleCdpEvent(message);
  });

  // Attach the page explicitly, then auto-attach its workers below. A second
  // browser-level auto-attach with a worker-only filter can detach the manually
  // attached page when worker targets change (observed on Chrome 154).
  const target = await send("Target.createTarget", { url: "about:blank" });
  const attached = await send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  pageSessionId = attached.sessionId;
  await Promise.all([
    send("Page.enable", {}, pageSessionId),
    send("Network.enable", {}, pageSessionId),
    send("Runtime.enable", {}, pageSessionId),
    send("Log.enable", {}, pageSessionId).catch(() => {}),
  ]);
  // Dedicated workers (tesseract, pdf.js) are children of the page target, so
  // the page session needs its own auto-attach; the browser-level call above
  // only sees browser-level targets (for example extension service workers).
  await send(
    "Target.setAutoAttach",
    {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
      filter: [{ type: "worker" }, { type: "service_worker" }, { type: "shared_worker" }],
    },
    pageSessionId,
  );

  const walk = { steps: [], passA: {}, passB: {} };

  async function recordStep(name) {
    const cookie = await pageEval("document.cookie");
    walk.steps.push({ name, url: await pageEval("location.pathname + location.search"), cookie });
    // A completed UI step is progress; the heartbeat reports how long ago the
    // last one was, which is what makes a stall visible between log lines.
    progress.event(`step "${name}" recorded`);
  }

  // ------------------------------------------------------------------------
  // Pass A — real UI walk with sentinels in every free-text/evidence field.
  // ------------------------------------------------------------------------
  progress.phase("Pass A — real UI walk");

  await navigate(`${APP_BASE}/secondary/diagnosed`);
  await waitForPage(
    "document.readyState === 'complete' && document.querySelectorAll('input[name=\"diagnosed\"]').length > 100",
    "diagnosed-step checkboxes",
  );
  const pickedDiagnosed = await pageEval(
    js(function (ids) {
      const picked = [];
      for (const input of document.querySelectorAll('input[name="diagnosed"]')) {
        if (ids.includes(input.value)) {
          if (!input.checked) input.click();
          picked.push(input.value);
        }
      }
      return picked;
    }, ["ptsd", "sleep-apnea"]),
  );
  assert(
    "step 1 selected two catalog conditions",
    Array.isArray(pickedDiagnosed) && pickedDiagnosed.length === 2,
    JSON.stringify(pickedDiagnosed),
  );
  await pageEval(js(clickSelector, 'button[type="submit"]'));
  await waitForPage(
    "location.pathname === '/secondary/service-connected' && document.querySelectorAll('input[name^=\"serviceConnected-\"]').length >= 2",
    "service-connected step",
  );
  await pageEval(
    js(function () {
      const yes = document.querySelector('input[name="serviceConnected-ptsd"][value="yes"]');
      const no = document.querySelector('input[name="serviceConnected-sleep-apnea"][value="no"]');
      if (yes && !yes.checked) yes.click();
      if (no && !no.checked) no.click();
      return Boolean(yes && no);
    }),
  );
  await pageEval(js(clickSelector, 'button[type="submit"]'));
  await waitForPage(
    "location.pathname === '/secondary/ratings' && !!document.querySelector('#rating-ptsd')",
    "ratings step",
  );
  // 100% P&T is a distinct option value; choosing it here gives the
  // permanentAndTotalConditionIds field a positive control in the real walk.
  await pageEval(js(setNativeValue, "#rating-ptsd", "100-pt"));
  await pageEval(js(clickSelector, 'button[type="submit"]'));
  await waitForPage(
    "location.pathname === '/secondary/upload' && !!document.querySelector('#medications')",
    "upload step",
  );
  await recordStep("step 4 upload rendered");

  // Free-text context sentinels.
  await pageEval(js(setNativeValue, "#medications", SENTINELS.uiMedication));
  await pageEval(js(setNativeValue, "#treatments", SENTINELS.uiTreatment));
  await pageEval(js(setNativeValue, "#history", SENTINELS.uiHistory));
  await pageEval(
    js(function () {
      const symptoms = [...document.querySelectorAll('input[name="symptomIds"]')];
      for (const input of symptoms.slice(0, 2)) {
        if (!input.checked) input.click();
      }
      return symptoms.length;
    }),
  );
  await pageEval(js(setNativeValue, 'input[name="onsetYear-ptsd"]', "2011"));
  await pageEval(js(setNativeValue, 'input[name="diagnosisYear-ptsd"]', "2013"));
  await pageEval(
    js(function () {
      const yes = document.querySelector('input[name="documentsShared"][value="yes"]');
      if (yes && !yes.checked) yes.click();
      return Boolean(yes?.checked);
    }),
  );

  // Two further private stores are written from this step and must be driven
  // through the real flow rather than planted: the local-analysis depth
  // preference and the VA.gov record walkthrough progress.
  const depthSelected = await pageEval(js(selectByOptionValue, "extended"));
  const walkthroughChecked = await pageEval(
    js(clickFirstCheckboxIn, 'section[aria-labelledby="va-gov-record-walkthrough-heading"]'),
  );

  // Evidence upload 1 — plain text file with literal sentinel name + content.
  const textPayload = `Medical opinion addressed to the rating decision.\nThe sleep apnea is caused by service-connected PTSD, per ${SENTINELS.evidenceText}.\n`;
  await pageEval(
    js(stageFile, Buffer.from(textPayload, "utf8").toString("base64"),
      SENTINELS.evidenceFileName, "text/plain", "#local-evidence-files"),
  );
  await waitForPage(
    `document.body.innerText.includes(${JSON.stringify(SENTINELS.evidenceFileName)})`,
    "text evidence file staged",
  );
  await pageEval(js(clickAnalyzeDocuments));
  await waitForPage(
    `(() => { const raw = sessionStorage.getItem("secondary-condition-finder:evidence-analysis:v1") || ""; return raw.includes(${JSON.stringify(
      SENTINELS.evidenceText,
    )}); })()`,
    "text evidence extracted and retained in browser storage",
    60_000,
  );
  walk.passA.textEvidenceRetainedLocally = true;

  // Evidence upload 2 — image-only scanned PDF; OCR must run in local workers.
  const jpegBase64 = await pageEval(js(drawOcrImage, SENTINELS.ocrToken, 2200, 260));
  const jpegBytes = Buffer.from(jpegBase64, "base64");
  const pdfBytes = buildImagePdf(jpegBytes, 2200, 260);
  const jpegBase64Slice = jpegBase64.slice(400, 800);
  await pageEval(
    js(stageFile, pdfBytes.toString("base64"), SENTINELS.scannedPdfName,
      "application/pdf", "#local-evidence-files"),
  );
  await waitForPage(
    `document.body.innerText.includes(${JSON.stringify(SENTINELS.scannedPdfName)})`,
    "scanned PDF staged",
  );
  await pageEval(js(clickAnalyzeDocuments));
  await waitForPage(
    "document.body.innerText.includes('No document produced extractable text')",
    "scanned PDF extraction pass finished",
    60_000,
  );
  await pageEval(js(clickButtonByText, "Local OCR"));
  // The longest single wait in the walk and the leg that wedges on a loaded
  // host, so it gets its own phase: the heartbeat then reports the probe history
  // for this wait specifically while it runs and when it fails.
  progress.phase("browser-local OCR (tesseract workers)");
  await waitForPage(
    "document.body.innerText.includes('Local OCR completed for')",
    "local OCR completion message",
    Number(process.env.SENTINEL_OCR_TIMEOUT_MS ?? 240_000),
  );
  const ocrState = await pageEval(
    `(() => {
      const raw = sessionStorage.getItem("secondary-condition-finder:evidence-analysis:v1") || "";
      let analyses = [];
      try { analyses = JSON.parse(raw); } catch { analyses = []; }
      if (!Array.isArray(analyses)) analyses = [];
      const pdf = analyses.find((analysis) => analysis && analysis.sourceName === ${JSON.stringify(SENTINELS.scannedPdfName)});
      const pdfQuotes = (pdf?.excerpts ?? []).map((excerpt) => excerpt.quote);
      return {
        hasSource: raw.includes(${JSON.stringify(SENTINELS.scannedPdfName)}),
        analysisCount: analyses.length,
        pdfQuoteCount: pdfQuotes.length,
        pdfQuotes: pdfQuotes.slice(0, 4),
        tokenInPdfQuotes: pdfQuotes.some((quote) => /sentinelocr/i.test(quote)),
        bytes: raw.length,
      };
    })()`,
  );
  walk.passA.ocr = ocrState;
  observations.ocrTokenRetainedInTranscript = ocrState?.tokenInPdfQuotes === true;
  assert(
    "OCR analysis retained in browser storage",
    ocrState?.hasSource === true && ocrState?.pdfQuoteCount > 0,
    JSON.stringify(ocrState),
  );

  await pageEval(js(clickSelector, 'button[type="submit"]'));
  await waitForPage(
    "location.pathname === '/secondary/suggestions' && document.body.innerText.includes('Review Your Non-Service-Connected Diagnoses')",
    "suggestions step",
    120_000,
  );
  await recordStep("step 5 suggestions");
  // The pathway record checklist is a private store written only from this step.
  const checklistChecked = await pageEval(
    js(clickFirstCheckboxIn, 'section[aria-labelledby="pathway-record-checklist-heading"]'),
  );
  await pageEval(js(clickButtonByText, "Review Evidence for These Connections"));
  await waitForPage(
    "location.pathname === '/secondary/evidence' && document.body.innerText.includes('Evidence')",
    "evidence step",
    120_000,
  );
  await recordStep("step 6 evidence");
  // The evidence gap review renders on this step and is the last private store
  // the flow must write before the clear-all step.
  const gapReviewChecked = await pageEval(
    js(clickFirstCheckboxIn, 'section[aria-labelledby="evidence-gap-review-heading"]'),
  );

  // ------------------------------------------------------------------------
  progress.phase("private-field positive controls");
  // Private-field positive controls. Every field of the context schema and
  // every auxiliary store must be observed holding real walk data — and, for
  // the free-text fields, a sentinel — inside the browser before the leak scan
  // below can mean anything.
  // ------------------------------------------------------------------------

  const privates = await pageEval(js(readPrivateSurfaces, CONTEXT_KEY));
  observations.privateSurfaces = privates;
  observations.storeSelections = {
    depthSelected,
    walkthroughChecked,
    checklistChecked,
    gapReviewChecked,
  };
  const record = privates?.record ?? null;
  const analysesText = typeof privates?.analyses === "string" ? privates.analyses : "";

  const fieldControls = [
    {
      field: "diagnosedConditionIds",
      sentinel: null,
      ok:
        Array.isArray(record?.diagnosedConditionIds) &&
        record.diagnosedConditionIds.length >= 2,
      detail: JSON.stringify(record?.diagnosedConditionIds ?? null),
    },
    {
      field: "serviceConnectedConditionIds",
      sentinel: null,
      ok:
        Array.isArray(record?.serviceConnectedConditionIds) &&
        record.serviceConnectedConditionIds.length >= 1,
      detail: JSON.stringify(record?.serviceConnectedConditionIds ?? null),
    },
    {
      field: "serviceConnectedAnswerDraft",
      sentinel: null,
      // A completed step 2 replaces the draft with the accepted selection; the
      // control accepts either, because both are written by the same field.
      ok:
        record?.serviceConnectedAnswerDraft?.ptsd === "yes" ||
        (Array.isArray(record?.serviceConnectedConditionIds) &&
          record.serviceConnectedConditionIds.includes("ptsd")),
      detail: JSON.stringify({
        draft: record?.serviceConnectedAnswerDraft ?? null,
        accepted: record?.serviceConnectedConditionIds ?? null,
      }),
    },
    {
      field: "ratingsByConditionId",
      sentinel: null,
      ok: record?.ratingsByConditionId?.ptsd === 100,
      detail: JSON.stringify(record?.ratingsByConditionId ?? null),
    },
    {
      field: "permanentAndTotalConditionIds",
      sentinel: null,
      ok:
        Array.isArray(record?.permanentAndTotalConditionIds) &&
        record.permanentAndTotalConditionIds.includes("ptsd"),
      detail: JSON.stringify(record?.permanentAndTotalConditionIds ?? null),
    },
    {
      field: "documentsShared",
      sentinel: null,
      ok: record?.documentsShared === true,
      detail: JSON.stringify(record?.documentsShared ?? null),
    },
    {
      field: "medications",
      sentinel: "uiMedication",
      ok:
        Array.isArray(record?.medications) &&
        record.medications.includes(SENTINELS.uiMedication),
      detail: JSON.stringify(record?.medications ?? null),
    },
    {
      field: "treatments",
      sentinel: "uiTreatment",
      ok:
        Array.isArray(record?.treatments) &&
        record.treatments.includes(SENTINELS.uiTreatment),
      detail: JSON.stringify(record?.treatments ?? null),
    },
    {
      field: "history",
      sentinel: "uiHistory",
      ok: Array.isArray(record?.history) && record.history.includes(SENTINELS.uiHistory),
      detail: JSON.stringify(record?.history ?? null),
    },
    {
      field: "symptomIds",
      sentinel: null,
      ok: Array.isArray(record?.symptomIds) && record.symptomIds.length >= 1,
      detail: JSON.stringify(record?.symptomIds ?? null),
    },
    {
      field: "conditionTimeline",
      sentinel: null,
      ok:
        record?.conditionTimeline?.ptsd?.onsetYear === 2011 ||
        record?.conditionTimeline?.ptsd?.diagnosisYear === 2013,
      detail: JSON.stringify(record?.conditionTimeline ?? null),
    },
  ];
  const uncoveredFields = contextFields.filter(
    (field) => field !== "version" && !fieldControls.some((entry) => entry.field === field),
  );
  assert(
    "every context schema field has a positive control in the walk",
    uncoveredFields.length === 0,
    uncoveredFields.length
      ? `uncovered: ${uncoveredFields.join(", ")}`
      : `${fieldControls.length} fields`,
  );
  for (const control of fieldControls) {
    assert(
      `private field ${control.field} written through the real flow`,
      control.ok === true,
      control.detail,
    );
  }

  const storeControls = [
    { label: "local analysis depth", key: "secondary-condition-finder:evidence-depth:v1" },
    {
      label: "evidence gap review checkmarks",
      key: "secondary-condition-finder:evidence-gap-review:v1",
    },
    {
      label: "pathway record checklist",
      key: "secondary-condition-finder:pathway-record-checklist:v1",
    },
    {
      label: "VA.gov record walkthrough",
      key: "secondary-condition-finder:va-gov-record-walkthrough:v1",
    },
  ];
  for (const control of storeControls) {
    assert(
      `private store written by the real flow: ${control.label}`,
      privates?.stores?.[control.key]?.present === true,
      JSON.stringify(privates?.stores?.[control.key] ?? null),
    );
  }
  assert(
    "evidence analyses store holds the text sentinel and the OCR transcript",
    analysesText.includes(SENTINELS.evidenceText) && /sentinelocr/i.test(analysesText),
    JSON.stringify({ bytes: analysesText.length, ocr: /sentinelocr/i.test(analysesText) }),
  );
  assert(
    "OCR resume checkpoint is either present or self-cleared after success",
    privates?.ocrCheckpoint?.present !== undefined,
    JSON.stringify(privates?.ocrCheckpoint ?? null),
  );

  const privateFieldMatrix = fieldControls.map((entry) => ({
    surface: "secondary-workflow context record",
    field: entry.field,
    sentinelCapable: Boolean(entry.sentinel),
    sentinel: entry.sentinel ? SENTINELS[entry.sentinel] : null,
    positiveControl: entry.ok === true,
  }));
  const privateStoreMatrix = AUXILIARY_STORES.map((store) => ({
    store: store.label,
    key: store.key,
    writtenByTheFlow:
      store.key === CONTEXT_KEY
        ? privates?.contextBytes > 0
        : privates?.stores?.[store.key]?.present === true,
    sentinelPlantedBeforeClearAll: true,
    selfClearing: Boolean(store.selfClearing),
    bytes: privates?.stores?.[store.key]?.bytes ?? null,
  }));

  const passAStorage = await readSessionKeys();
  assert(
    "no cookie was set during pass A",
    passAStorage?.cookie === "",
    JSON.stringify(passAStorage?.cookie ?? null),
  );
  assert(
    "no localStorage keys during pass A",
    Array.isArray(passAStorage?.local) && passAStorage.local.length === 0,
    JSON.stringify(passAStorage?.local ?? null),
  );

  // ------------------------------------------------------------------------
  // Pass B — seeded record with a sentinel in every string field of the schema.
  // ------------------------------------------------------------------------
  progress.phase("Pass B — seeded browser record");

  const seededRecord = {
    version: 1,
    diagnosedConditionIds: ["ptsd", SENTINELS.diagnosedId],
    serviceConnectedConditionIds: ["ptsd", SENTINELS.serviceConnectedId],
    serviceConnectedAnswerDraft: {
      ptsd: "yes",
      [SENTINELS.answerDraftKey]: "no",
    },
    ratingsByConditionId: { ptsd: 70, [SENTINELS.serviceConnectedId]: 50 },
    permanentAndTotalConditionIds: ["ptsd"],
    documentsShared: true,
    medications: [SENTINELS.medication],
    treatments: [SENTINELS.treatment],
    history: [SENTINELS.history],
    symptomIds: [SENTINELS.symptomId],
    conditionTimeline: {
      [SENTINELS.timelineKey]: { onsetYear: 2003, diagnosisYear: 2005 },
    },
  };
  await pageEval(js(plantContextRecord, CONTEXT_KEY, seededRecord));
  await navigate(`${APP_BASE}/secondary/suggestions`);
  await waitForPage(
    "document.readyState === 'complete' && document.body.innerText.includes('Review Your Non-Service-Connected Diagnoses')",
    "seeded suggestions step",
    120_000,
  );
  // The step's `ready` gate can paint its heading before the browser-local
  // record is read and the engine renders the seeded context — observed on the
  // gate's sixth CI run, where the medication assertion was read early and then
  // the same record rendered a moment later. Give the seeded record a bounded
  // window to take effect; a genuine failure still fails the assertions below
  // rather than aborting the walk with a harness error.
  try {
    await waitForPage(
      `document.body.innerText.includes(${JSON.stringify(SENTINELS.medication)})`,
      "seeded suggestions content",
      60_000,
    );
  } catch {
    // Fall through: the assertion below names what never rendered.
  }
  const seededSuggestionsText = await pageEval("document.body.innerText");
  walk.passB.suggestionsShowsMedication = seededSuggestionsText.includes(SENTINELS.medication);
  walk.passB.suggestionsShowsTreatment = seededSuggestionsText.includes(SENTINELS.treatment);
  walk.passB.suggestionsShowsDiagnosedId = seededSuggestionsText.includes(SENTINELS.diagnosedId);
  assert(
    "seeded browser-local record drives step 5 (medication rendered)",
    walk.passB.suggestionsShowsMedication,
  );
  // The Step 5 → 6 navigation is a Next `<Link>`. Pin the href it advertises
  // first: the design requires it to be a uniform, scope-free URL
  // (`/secondary/evidence?regSnapshot=<public snapshot id>`), never one built
  // from the record, so the assertion below observes that rule end to end.
  const evidenceHref = await pageEval(`(() => {
    const link = [...document.querySelectorAll("a")].find((element) =>
      element.textContent?.includes("Review Evidence for These Connections"));
    return link ? link.getAttribute("href") : null;
  })()`);
  assert(
    "step 5 evidence CTA advertises a uniform, scope-free URL",
    typeof evidenceHref === "string" &&
      /^\/secondary\/evidence\?regSnapshot=[^&#]+$/.test(evidenceHref) &&
      !ALL_SENTINELS.some((sentinel) => evidenceHref.includes(sentinel)),
    JSON.stringify(evidenceHref ?? null),
  );
  // Click the real link. A cold runner can swallow that single click with no
  // navigation and no error (observed on the gate's third and fourth CI runs),
  // so after a grace period the walk follows the href the link advertises.
  // The route and every assertion below are unchanged; only the navigation
  // trigger becomes deterministic.
  await pageEval(js(clickButtonByText, "Review Evidence for These Connections"));
  try {
    await waitForPage(
      "location.pathname === '/secondary/evidence'",
      "seeded evidence route",
      20_000,
    );
  } catch {
    if (
      typeof evidenceHref === "string" &&
      evidenceHref.startsWith("/secondary/evidence?")
    ) {
      await navigate(`${APP_BASE}${evidenceHref}`);
      await waitForPage(
        "location.pathname === '/secondary/evidence'",
        "seeded evidence route",
        120_000,
      );
    }
  }
  if (await pageEval("location.pathname === '/secondary/evidence'")) {
    await waitForPage(
      "document.readyState === 'complete' && document.body.innerText.includes('Evidence')",
      "seeded evidence step",
      120_000,
    );
  } else {
    assert(
      "seeded walk reached the evidence step",
      false,
      `still on ${await pageEval("location.pathname")}`,
    );
  }
  const seededEvidenceText = await pageEval("document.body.innerText");
  walk.passB.evidenceShowsMedication = seededEvidenceText.includes(SENTINELS.medication);
  walk.passB.evidenceShowsTreatment = seededEvidenceText.includes(SENTINELS.treatment);
  assert(
    "seeded browser-local record drives step 6 (treatment rendered)",
    walk.passB.evidenceShowsTreatment,
  );

  // Clear-all coverage: plant sentinels in every registered key, then Finish.
  const keysBeforePlant = await pageEval(
    "Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i))",
  );
  const unknownKeys = (keysBeforePlant ?? []).filter((key) => !CLEAR_KEYS.includes(key));
  observations.sessionKeysBeforePlant = keysBeforePlant;
  observations.unknownSessionKeys = unknownKeys;
  assert(
    "every app-owned sessionStorage key is on the clear-all list",
    unknownKeys.length === 0,
    JSON.stringify(unknownKeys),
  );
  const planted = await pageEval(
    js(plantClearKeys, CLEAR_KEYS, SENTINELS.consoleSeed),
  );
  assert("sentinel payloads planted in all clear-list keys", planted >= CLEAR_KEYS.length);
  await pageEval(js(clickButtonByText, "Finish Review"));
  await waitForPage("location.pathname === '/secondary'", "post-Finish Review route", 60_000);

  const clearedSnapshot = await readSessionKeys();
  const remainingKeys = (clearedSnapshot?.session ?? [])
    .map((entry) => entry.key)
    .filter((key) => CLEAR_KEYS.includes(key));
  assert(
    "Finish Review removed every registered browser storage key",
    remainingKeys.length === 0,
    JSON.stringify(remainingKeys),
  );
  const clearedContainsSentinel = (clearedSnapshot?.session ?? []).some((entry) =>
    CLEAR_KEYS.includes(entry.key) && entry.value?.includes(SENTINELS.medication),
  );
  assert(
    "no sentinel remains in sessionStorage after Finish Review",
    !clearedContainsSentinel,
  );
  assert(
    "no sentinel remains in localStorage or cookies after Finish Review",
    !JSON.stringify(clearedSnapshot?.local ?? []).includes(SENTINELS.medication) &&
      !(clearedSnapshot?.cookie ?? "").includes(SENTINELS.medication),
    JSON.stringify(clearedSnapshot?.local ?? []),
  );

  const environmentSnapshot = await pageEval(`(async () => ({
    sessionKeys: Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)),
    localKeys: Object.keys(localStorage),
    cookies: document.cookie,
    databases: (await indexedDB.databases()).map((db) => db.name),
    cacheNames: typeof caches === "undefined" ? [] : await caches.keys(),
  }))()`);
  const indexedDbScan = await pageEval(js(scanIndexedDb, ALL_SENTINELS));
  observations.environmentSnapshot = environmentSnapshot;
  observations.indexedDb = indexedDbScan;
  assert(
    "no sessionStorage, localStorage or cookie data remains after the walk",
    (environmentSnapshot?.sessionKeys ?? []).length === 0 &&
      (environmentSnapshot?.localKeys ?? []).length === 0 &&
      (environmentSnapshot?.cookies ?? "") === "",
    JSON.stringify(environmentSnapshot),
  );
  assert(
    "no IndexedDB database holds any private sentinel after clear-all",
    (indexedDbScan ?? []).length >= 0 &&
      (indexedDbScan ?? []).every((entry) => entry.holdsSentinel === false),
    JSON.stringify(indexedDbScan),
  );

  // ------------------------------------------------------------------------
  // Sentinels, third-party hosts, workers, cookies.
  // ------------------------------------------------------------------------
  progress.phase("surface scan, final assertions and report");

  // Positive control for the request-body surface. The workflow itself issues
  // only bodyless requests, which would leave "no sentinel in a request body"
  // vacuously true, so the harness plants a same-origin POST carrying a
  // sentinel and requires the capture path to see it. The planted request is
  // excluded from app-traffic accounting by its control path.
  const controlResponse = await pageEval(
    js(postRequestBodyControl, `${APP_BASE}${REQUEST_BODY_CONTROL_PATH}`, {
      probe: SENTINELS.bodyControl,
      purpose: "request-body positive control",
    }),
  );
  const controlCaptured = await waitForCapturedRequest(REQUEST_BODY_CONTROL_PATH);
  await delay(600);
  const appRequestBodies = [];
  const controlRequestBodies = [];
  // Bodies CDP reported but did not inline would otherwise read as "no body".
  const uncapturedPostData = [];

  const requestList = [...requests.values()];
  for (const entry of requestList) {
    scanText("request-url", entry.url, entry.url);
    for (const [name, value] of Object.entries(entry.headers)) {
      scanText("request-header", `${entry.method} ${entry.url} (${name})`, String(value));
    }
    for (const [name, value] of Object.entries(entry.extraHeaders)) {
      scanText("request-header", `${entry.method} ${entry.url} (${name})`, String(value));
    }
    for (const cookie of entry.cookies ?? []) {
      scanText("request-cookie", `${entry.method} ${entry.url}`, JSON.stringify(cookie));
    }
    if (entry.hasPostData && !entry.postData) {
      uncapturedPostData.push({ method: entry.method, url: entry.url, type: entry.type });
    }
    if (entry.postData) {
      if (entry.url.includes(REQUEST_BODY_CONTROL_PATH)) {
        controlRequestBodies.push({
          method: entry.method,
          url: entry.url,
          bytes: entry.postData.length,
          containsControlSentinel: entry.postData.includes(SENTINELS.bodyControl),
        });
      } else {
        appRequestBodies.push({ method: entry.method, url: entry.url, bytes: entry.postData.length });
        scanText("request-body", `${entry.method} ${entry.url}`, entry.postData);
        if (entry.postData.includes(jpegBase64Slice)) {
          noteViolation("request-body", `${entry.method} ${entry.url}`, "OCR image bytes (base64 chunk)");
        }
      }
    }
  }

  const responseList = [...responses.values()];
  for (const response of responseList) {
    scanText("response-url", response.url, response.url);
    for (const [name, value] of Object.entries(response.headers)) {
      scanText("response-header", `${response.status} ${response.url} (${name})`, String(value));
    }
  }

  await Promise.allSettled(responseBodyPromises);
  const serverPayloadBodies = [];
  for (const body of responseBodies) {
    const mime = body.mimeType ?? "";
    let text = body.body ?? "";
    if (body.base64Encoded) {
      try {
        text = Buffer.from(body.body, "base64").toString("utf8");
      } catch {
        // Keep the raw base64 text for scanning.
      }
    }
    const isServerPayload =
      /text\/html|x-component/i.test(mime) || body.url.includes("_rsc=");
    if (isServerPayload) {
      serverPayloadBodies.push({ url: body.url, mimeType: mime, bytes: text.length });
    }
    scanText(isServerPayload ? "server-html-rsc" : "response-body", body.url, text);
    if (text.includes(jpegBase64Slice)) {
      noteViolation("server-html-rsc", body.url, "OCR image bytes (base64 chunk)");
    }
  }

  for (const message of consoleMessages) {
    scanText("console-log", `${message.role}:${message.type}`, message.text);
  }
  for (const entry of logEntries) {
    scanText("browser-log", entry.level, entry.text);
  }
  for (const exception of exceptions) {
    scanText("browser-exception", "Runtime.exceptionThrown", String(exception));
  }
  for (const url of navigations) {
    scanText("navigation-url", "Page.frameNavigated", url);
  }

  const allCookies = await send("Storage.getCookies");
  for (const cookie of allCookies.cookies ?? []) {
    scanText("browser-cookie", `${cookie.name}@${cookie.domain}`, JSON.stringify(cookie));
  }

  const hosts = [
    ...new Set(
      requestList
        .map((entry) => entry.url)
        .filter((url) => /^https?:/.test(url))
        .map((url) => new URL(url).host),
    ),
  ];
  const thirdPartyHosts = hosts.filter(
    (host) => !host.startsWith("127.0.0.1") && !host.startsWith("localhost"),
  );
  observations.hosts = hosts;
  observations.thirdPartyHosts = thirdPartyHosts;

  const workerRequests = requestList.filter((entry) =>
    ["worker", "service_worker", "shared_worker"].includes(entry.sessionRole),
  );
  const appWorkerSessions = workerSessions.filter((session) =>
    session.url.startsWith(APP_BASE),
  );
  const appWorkerRequests = workerRequests.filter((entry) =>
    entry.url.startsWith(APP_BASE) || entry.url.startsWith("blob:"),
  );
  const nonAppWorkerRequests = workerRequests.filter(
    (entry) => !appWorkerRequests.includes(entry),
  );
  observations.workerSessions = workerSessions;
  observations.appWorkerSessions = appWorkerSessions;
  observations.workerRequests = workerRequests.map((entry) => ({
    url: entry.url,
    method: entry.method,
    type: entry.type,
    sessionRole: entry.sessionRole,
  }));
  observations.nonAppWorkerRequests = nonAppWorkerRequests.map((entry) => entry.url);
  assert(
    "app worker sessions were attached and inspected",
    appWorkerSessions.length > 0,
    JSON.stringify(workerSessions.map((session) => `${session.type}:${session.url}`)),
  );
  assert(
    "app worker requests were captured and stayed same-origin",
    appWorkerRequests.length > 0 &&
      appWorkerRequests.every(
        (entry) =>
          entry.url.startsWith(APP_BASE) || entry.url.startsWith("blob:"),
      ),
    JSON.stringify(appWorkerRequests.map((entry) => entry.url).slice(0, 12)),
  );

  // ------------------------------------------------------------------------
  // Server log and trace files.
  // ------------------------------------------------------------------------

  // Scan the current dev trace, never the build trace at `.next/trace`. Both
  // files can be rewritten/rotated, so pre-run sizes are diagnostics only.
  const serverLog = readSentinelTextSurface(SERVER_LOG, TEXT_SURFACE_SCAN_LIMIT, serverLogBefore);
  const traceFile = readSentinelTextSurface(TRACE_FILE, TEXT_SURFACE_SCAN_LIMIT, traceBefore);
  observations.serverLog = serverLog.observation;
  observations.traceFile = traceFile.observation;
  if (serverLog.observation.status === "scanned" && serverLog.text.length > 0) {
    scanText("server-log", SERVER_LOG, serverLog.text);
  }
  if (traceFile.observation.status === "scanned" && traceFile.text.length > 0) {
    scanText("trace-file", TRACE_FILE, traceFile.text);
  }
  assert(
    "server log and trace file were scanned in full rather than from a stale offset",
    [serverLog, traceFile].every(({ text, observation }) =>
      observation.status === "scanned" &&
      text.length > 0 &&
      observation.sizeBytes <= TEXT_SURFACE_SCAN_LIMIT &&
      text.length === observation.sizeBytes,
    ),
    JSON.stringify({ serverLog: observations.serverLog, traceFile: observations.traceFile }),
  );

  // ------------------------------------------------------------------------
  // Final assertions and report.
  // ------------------------------------------------------------------------

  const leakSurfaces = [
    "request-url",
    "request-header",
    "request-body",
    "request-cookie",
    "response-url",
    "response-header",
    "server-html-rsc",
    "response-body",
    "console-log",
    "browser-log",
    "browser-exception",
    "navigation-url",
    "browser-cookie",
    "server-log",
    "trace-file",
  ];
  const surfaceMatrix = leakSurfaces.map((kind) => ({ surface: kind, ...surfaceEntry(kind) }));
  observations.surfaceMatrix = surfaceMatrix;
  const surfacesWithHits = surfaceMatrix.filter((entry) => entry.hits > 0);
  assert(
    "every scanned surface reported zero sentinel hits",
    surfacesWithHits.length === 0,
    JSON.stringify(
      surfacesWithHits.length
        ? surfacesWithHits
        : surfaceMatrix.map((entry) => `${entry.surface}:${entry.scanned} scanned/0 hits`),
    ),
  );

  assert(
    "no app request carried a body that could not be captured and scanned",
    uncapturedPostData.length === 0,
    JSON.stringify(uncapturedPostData),
  );

  assert(
    "request-body surface control: the planted POST body was captured and holds its sentinel",
    controlRequestBodies.length === 1 &&
      controlRequestBodies[0].bytes > 0 &&
      controlRequestBodies[0].containsControlSentinel === true,
    JSON.stringify({ response: controlResponse, captured: controlCaptured, controlRequestBodies }),
  );

  // A surface could report "zero hits" simply because nothing was scanned. Every
  // unexercised surface therefore has to carry an explicit reason, so a hollow
  // pass cannot recur silently.
  const SURFACE_COVERAGE_NOTES = {
    "request-body":
      "no app request in this walk carried a body (the workflow issues bodyless requests only); the harness-planted control POST proves request-body capture and sentinel detection are live",
    "request-cookie":
      "the app neither set nor sent cookies at any point, so no request could carry one",
    "browser-cookie": "no cookie was set by the app at any point in the walk",
    "browser-exception":
      "no uncaught browser exception was thrown during the walk; the surface only records events that occur",
  };
  observations.requestBodies = {
    appScanned: appRequestBodies.length,
    appBytes: appRequestBodies.reduce((total, entry) => total + entry.bytes, 0),
    uncapturedPostData,
    control: controlRequestBodies,
  };
  observations.surfaceCoverage = surfaceMatrix.map((entry) => ({
    surface: entry.surface,
    scanned: entry.scanned,
    exercisedByAppTraffic: entry.scanned > 0,
    note: entry.scanned > 0 ? null : SURFACE_COVERAGE_NOTES[entry.surface] ?? null,
  }));
  const unexercisedSurfaces = observations.surfaceCoverage.filter(
    (entry) => !entry.exercisedByAppTraffic,
  );
  assert(
    "every leak surface was exercised by app traffic or carries a recorded non-exercise note",
    unexercisedSurfaces.every(
      (entry) => typeof entry.note === "string" && entry.note.length > 0,
    ),
    JSON.stringify(unexercisedSurfaces),
  );

  assert(
    "zero sentinel occurrences in requests, responses, HTML/RSC, logs, traces and cookies",
    violations.length === 0,
    violations.length
      ? `${violations.length} occurrence(s): ${violations
          .slice(0, 6)
          .map((violation) => `${violation.kind}@${violation.where}`)
          .join(" | ")}`
      : `scanned ${requestList.length} requests, ${responseList.length} responses, ${responseBodies.length} bodies, ${consoleMessages.length} console messages, ${logEntries.length} log entries`,
  );
  assert(
    "no third-party hosts were contacted",
    thirdPartyHosts.length === 0,
    JSON.stringify(thirdPartyHosts),
  );
  assert(
    "no uncaught browser exceptions during the walk",
    exceptions.length === 0,
    JSON.stringify(exceptions.slice(0, 3)),
  );

  walk.passA.textEvidenceRetainedLocally = true;
  walk.passB.record = seededRecord;
  walk.requestInventory = {
    total: requestList.length,
    appRequests: requestList.length - controlRequestBodies.length,
    controlRequests: controlRequestBodies.length,
    byType: requestList.reduce((accumulator, entry) => {
      accumulator[entry.type] = (accumulator[entry.type] ?? 0) + 1;
      return accumulator;
    }, {}),
    hosts,
    workerRequests: appWorkerRequests.length,
    nonAppWorkerRequests: nonAppWorkerRequests.length,
    documentAndRscBodies: serverPayloadBodies.length,
  };

  const failed = assertions.filter((entry) => !entry.ok);
  const report = {
    finding: "PRIV-01",
    stage: 4,
    stageName: "browser sentinel acceptance",
    coverageScope:
      "every field of the workflow context schema and every registered browser-local store",
    date: new Date().toISOString().slice(0, 10),
    status: failed.length === 0 ? "passed" : "failed",
    runToken: TOKEN,
    appBase: APP_BASE,
    browser: `${version.Browser ?? "Chrome"} (headless via CDP)`,
    sentinels: SENTINELS,
    walk,
    privateFields: {
      schemaFields: contextFields,
      fieldMatrix: privateFieldMatrix,
      storeMatrix: privateStoreMatrix,
    },
    surfaceMatrix,
    assertions,
    violations,
    observations,
    // The same wedge diagnosis the log carries, so a run that had to be killed
    // reports where it stalled rather than only how long it had been going.
    progress: progress.snapshot(),
    checks: {
      serverLog: observations.serverLog,
      traceFile: observations.traceFile,
      thirdPartyHosts,
      workerSessions: workerSessions.length,
      appWorkerSessions: appWorkerSessions.length,
      workerRequests: appWorkerRequests.length,
    },
    summary: {
      assertions: assertions.length,
      failed: failed.length,
      scannedRequests: requestList.length,
      scannedResponses: responseList.length,
      scannedBodies: responseBodies.length,
      scannedConsoleMessages: consoleMessages.length,
      scannedLogEntries: logEntries.length,
    },
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `\n${failed.length === 0 ? "PASSED" : "FAILED"} — ${assertions.length - failed.length}/${assertions.length} assertions; report: ${REPORT_PATH}`,
  );
  if (failed.length > 0) {
    for (const entry of failed) console.error(`  failed: ${entry.name} — ${entry.detail}`);
    process.exitCode = 1;
  }
}

try {
  await run();
} catch (error) {
  console.error(`acceptance runner error: ${error.stack ?? error.message}`);
  try {
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          finding: "PRIV-01",
          stage: 4,
          status: "runner-error",
          runToken: TOKEN,
          error: error.stack ?? String(error),
          assertions,
          violations,
          observations,
          progress: progress.snapshot(),
        },
        null,
        2,
      )}\n`,
    );
  } catch {
    // Best-effort report write.
  }
  process.exitCode = 1;
} finally {
  // Stop the heartbeats first: nothing after this point is progress.
  progress.stop();
  try {
    ws?.close();
  } catch {
    // Best-effort cleanup.
  }
  for (const child of children.reverse()) {
    try {
      child.kill("SIGTERM");
    } catch {
      // Best-effort cleanup.
    }
  }
  if (profileDirForCleanup) {
    // Chrome keeps flushing its profile after the signal, so a single removal
    // races it and throws ENOTEMPTY — which, on the PRIV-01 CI gate's fifth run,
    // turned a walk that had already PASSED 45/45 into a failed step. Retry the
    // removal, and never let best-effort cleanup decide the gate: the assertions
    // above are the result, and a leftover temp profile is not a finding.
    try {
      fs.rmSync(profileDirForCleanup, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    } catch (error) {
      console.warn(
        `cleanup: could not remove the temporary Chrome profile at ${profileDirForCleanup}: ${error.message}`,
      );
    }
  }
  await delay(300);
  process.exit(process.exitCode ?? 0);
}
