// PRIV-01 stage 4 — browser sentinel acceptance (maintainer gate, not CI).
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
import path from "node:path";

const APP_BASE = process.env.SENTINEL_APP_BASE ?? "http://127.0.0.1:3107";
const CDP_PORT = Number(process.env.SENTINEL_CDP_PORT ?? 9224);
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EVIDENCE_DIR = path.join(
  process.cwd(),
  "tmp/security-audit-2026-10-07/rel-01-kb-repair",
);
const SERVER_LOG =
  process.env.SENTINEL_SERVER_LOG ?? path.join(EVIDENCE_DIR, "dev-server-stage3.log");
const REPORT_PATH = path.join(EVIDENCE_DIR, "priv01-stage4-evidence.json");
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
const TRACE_FILE = path.join(process.cwd(), ".next", "trace");

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
};
const ALL_SENTINELS = [...new Set(Object.values(SENTINELS))];

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

function assert(name, ok, detail) {
  assertions.push({ name, ok: Boolean(ok), detail: detail ?? null });
  if (!ok) console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  else console.log(`ok    ${name}`);
  return Boolean(ok);
}

function noteViolation(kind, where, sentinel) {
  violations.push({ kind, where, sentinel });
}

function scanText(kind, where, text) {
  if (typeof text !== "string" || text.length === 0) return;
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
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return response;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(300);
  }
  throw new Error(`${label} never became ready: ${lastError?.message ?? "timeout"}`);
}

function send(method, params = {}, sessionId) {
  const id = ++nextMessageId;
  return new Promise((resolve, reject) => {
    pendingMessages.set(id, { resolve, reject });
    ws.send(
      JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
    );
    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }
    }, 60_000);
  });
}

async function pageEval(expression) {
  const result = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true, userGesture: true },
    pageSessionId,
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
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await pageEval(expression);
      if (last === true) return;
    } catch (error) {
      last = error.message;
    }
    await delay(400);
  }
  let bodyTail = "";
  try {
    bodyTail = await pageEval("document.body.innerText.slice(-500)");
  } catch {
    // Page gone; keep the empty diagnostic.
  }
  throw new Error(
    `timed out waiting for ${label} (last=${JSON.stringify(last)}; bodyTail=${JSON.stringify(bodyTail)})`,
  );
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
  console.log(`PRIV-01 stage-4 browser sentinel acceptance — token ${TOKEN}`);
  console.log(`App under test: ${APP_BASE}`);

  // 1. Preconditions -------------------------------------------------------
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

  const serverLogBefore = fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, "utf8").length : 0;
  const traceBefore = fs.existsSync(TRACE_FILE) ? fs.statSync(TRACE_FILE).size : 0;

  // 2. Launch Chrome and attach -------------------------------------------
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
  await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`, "Chrome DevTools endpoint", 30_000);

  const version = await (
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
  ).json();
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pendingMessages.has(message.id)) {
      const { resolve, reject } = pendingMessages.get(message.id);
      pendingMessages.delete(message.id);
      if (message.error) reject(new Error(`CDP error: ${message.error.message}`));
      else resolve(message.result);
      return;
    }
    if (message.method) handleCdpEvent(message);
  });

  // Worker sessions must pause on attach so Network.enable is in place before
  // the worker performs its first request (tesseract worker/core/lang assets).
  await send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true,
    filter: [{ type: "worker" }, { type: "service_worker" }, { type: "shared_worker" }],
  });
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
  }

  // ------------------------------------------------------------------------
  // Pass A — real UI walk with sentinels in every free-text/evidence field.
  // ------------------------------------------------------------------------

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
  await pageEval(js(setNativeValue, "#rating-ptsd", "70"));
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
  await waitForPage(
    "document.body.innerText.includes('Local OCR completed for')",
    "local OCR completion message",
    240_000,
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
  await pageEval(js(clickButtonByText, "Review Evidence for These Connections"));
  await waitForPage(
    "location.pathname === '/secondary/evidence' && document.body.innerText.includes('Evidence')",
    "evidence step",
    120_000,
  );
  await recordStep("step 6 evidence");

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

  const seededRecord = {
    version: 1,
    diagnosedConditionIds: ["ptsd", SENTINELS.diagnosedId],
    serviceConnectedConditionIds: ["ptsd", SENTINELS.serviceConnectedId],
    serviceConnectedAnswerDraft: {
      ptsd: "yes",
      [SENTINELS.answerDraftKey]: "no",
    },
    ratingsByConditionId: { ptsd: 70, [SENTINELS.serviceConnectedId]: 50 },
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
  const seededSuggestionsText = await pageEval("document.body.innerText");
  walk.passB.suggestionsShowsMedication = seededSuggestionsText.includes(SENTINELS.medication);
  walk.passB.suggestionsShowsTreatment = seededSuggestionsText.includes(SENTINELS.treatment);
  walk.passB.suggestionsShowsDiagnosedId = seededSuggestionsText.includes(SENTINELS.diagnosedId);
  assert(
    "seeded browser-local record drives step 5 (medication rendered)",
    walk.passB.suggestionsShowsMedication,
  );
  await pageEval(js(clickButtonByText, "Review Evidence for These Connections"));
  await waitForPage(
    "location.pathname === '/secondary/evidence' && document.body.innerText.includes('Evidence')",
    "seeded evidence step",
    120_000,
  );
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
    CLEAR_KEYS.some((key) => entry.value?.includes(SENTINELS.medication)),
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
    if (entry.postData) {
      scanText("request-body", `${entry.method} ${entry.url}`, entry.postData);
      if (entry.postData.includes(jpegBase64Slice)) {
        noteViolation("request-body", `${entry.method} ${entry.url}`, "OCR image bytes (base64 chunk)");
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

  let serverLogTail = "";
  let serverLogStatus = "missing";
  if (fs.existsSync(SERVER_LOG)) {
    const content = fs.readFileSync(SERVER_LOG, "utf8");
    serverLogTail = content.slice(Math.min(serverLogBefore, content.length));
    serverLogStatus = "scanned";
    scanText("server-log", SERVER_LOG, serverLogTail);
  }
  let traceTail = "";
  let traceStatus = "missing";
  if (fs.existsSync(TRACE_FILE)) {
    const size = fs.statSync(TRACE_FILE).size;
    const content = fs.readFileSync(TRACE_FILE, "utf8");
    traceTail = content.slice(traceBefore > 0 ? traceBefore : Math.max(0, size - 2_000_000));
    traceStatus = "scanned";
    scanText("trace-file", TRACE_FILE, traceTail);
  }
  observations.serverLog = { path: SERVER_LOG, status: serverLogStatus, bytes: serverLogTail.length };
  observations.traceFile = { path: TRACE_FILE, status: traceStatus, bytes: traceTail.length };

  // ------------------------------------------------------------------------
  // Final assertions and report.
  // ------------------------------------------------------------------------

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
    date: "2026-10-07",
    status: failed.length === 0 ? "passed" : "failed",
    runToken: TOKEN,
    appBase: APP_BASE,
    browser: `${version.Browser ?? "Chrome"} (headless via CDP)`,
    sentinels: SENTINELS,
    walk,
    assertions,
    violations,
    observations,
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
    fs.rmSync(profileDirForCleanup, { recursive: true, force: true });
  }
  await delay(300);
  process.exit(process.exitCode ?? 0);
}
