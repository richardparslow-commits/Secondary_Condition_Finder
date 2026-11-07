import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Production Cross-Origin Isolation E2E journey.
 *
 * Unlike the other journeys (which spawn `next dev`), this one boots the
 * production build with `next start`: the COOP/COEP headers under assertion
 * come from next.config.ts `headers()`, and the request under test is
 * explicitly "production responses". CI runs this journey immediately after
 * `npm run build`, so a fresh production build always exists at this point;
 * locally, run `npm run build` first.
 *
 * Assertions:
 *  1. Every representative production route (pages, the API surface, and an
 *     evidence-upload route) responds with `Cross-Origin-Opener-Policy:
 *     same-origin` and `Cross-Origin-Embedder-Policy: require-corp` — the
 *     pair that unlocks `crossOriginIsolated` for the browser-local WASM OCR
 *     pipeline.
 *  2. In a real Chrome document on an OCR-capable page (/presumptive hosts
 *     the Dd214 OCR analyzer), `self.crossOriginIsolated === true` and
 *     SharedArrayBuffer is constructible.
 *  3. In a same-origin classic dedicated worker — the exact construction
 *     tesseract.js uses via `workerPath: "/tesseract/worker.min.js"` —
 *     `self.crossOriginIsolated === true` and SharedArrayBuffer is
 *     available. The probe lives at /tesseract/coi-probe.js (static,
 *     same-origin) because the app's Trusted Types default policy refuses
 *     blob:/data: script URLs by design; a dedicated worker inherits its
 *     creator's agent-cluster isolation, so this is the property the OCR
 *     pipeline depends on (no OCR inference is run and no model bytes are
 *     loaded).
 */

const APP_PORT = Number(process.env.COI_E2E_APP_PORT ?? 3300);
const DRIVER_PORT = Number(process.env.COI_E2E_DRIVER_PORT ?? 9715);
const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const DRIVER_BASE_URL = `http://127.0.0.1:${DRIVER_PORT}`;
const COMMAND_TIMEOUT_MS = 15_000;
const SESSION_TIMEOUT_MS = 30_000;
const USE_PROCESS_GROUPS = process.platform !== "win32";
const children = [];
let sessionId;

/** Routes asserted for COI headers: app pages, the OCR/evidence surface, and the API. */
const HEADER_CHECK_ROUTES = [
  "/",
  "/presumptive",
  "/secondary/diagnosed",
  "/secondary/upload",
  "/api/health",
];

function logProcess(label, child) {
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
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

async function terminateProcessTree(child, signal = "SIGTERM") {
  sendProcessTreeSignal(child, signal);
  await delay(250);
  // Session-start retries can leave browser grandchildren behind. A detached
  // process group lets cleanup remove those descendants and close inherited
  // stdio handles before the next browser journey starts.
  sendProcessTreeSignal(child, "SIGKILL");
}

function resolveChromeDriver() {
  const configured = process.env.CHROMEDRIVER_PATH;
  if (configured) return configured;
  const runnerDirectory = process.env.CHROMEWEBDRIVER;
  if (runnerDirectory) {
    const candidate = path.join(runnerDirectory, "chromedriver");
    if (fs.existsSync(candidate)) return candidate;
  }
  return "chromedriver";
}

async function waitForHttp(url, label) {
  const deadline = Date.now() + 30_000;
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

async function webdriver(method, endpoint, body, timeoutMs = COMMAND_TIMEOUT_MS) {
  let response;
  try {
    response = await fetch(`${DRIVER_BASE_URL}${endpoint}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(
      `WebDriver ${method} ${endpoint} request failed or timed out: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    throw new Error(
      `WebDriver ${method} ${endpoint} failed: ${payload.value?.message ?? JSON.stringify(payload.value ?? payload)}`,
    );
  }
  return payload.value;
}

async function createSession() {
  const request = {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900"],
        },
      },
    },
  };

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await webdriver("POST", "/session", request, SESSION_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      const transient =
        error instanceof Error &&
        error.message.startsWith("WebDriver POST /session request failed or timed out:");
      if (!transient || attempt === 2) throw error;
      await delay(1_000);
      await waitForHttp(`${DRIVER_BASE_URL}/status`, "ChromeDriver after session retry");
    }
  }
  throw lastError ?? new Error("ChromeDriver session creation failed.");
}

async function currentUrl() {
  return new URL(await webdriver("GET", `/session/${sessionId}/url`));
}

async function waitForPath(pathname) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if ((await currentUrl()).pathname === pathname) return;
    await delay(200);
  }
  throw new Error(`Browser did not reach ${pathname}`);
}

/**
 * Assert the Cross-Origin Isolation headers on a production response.
 *
 * Deliberately strict on exact values: `same-origin` (not
 * `same-origin-allow-popups`) is what isolates the browsing context, and
 * `credentialless`/`unsafe-none` would silently downgrade the OCR worker's
 * SharedArrayBuffer availability.
 */
async function assertCoiHeaders(route) {
  const response = await fetch(`${APP_BASE_URL}${route}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status >= 500) {
    throw new Error(`${route} returned HTTP ${response.status} in production mode`);
  }
  const coop = response.headers.get("cross-origin-opener-policy");
  const coep = response.headers.get("cross-origin-embedder-policy");
  if (coop !== "same-origin" || coep !== "require-corp") {
    throw new Error(
      `${route} is missing Cross-Origin Isolation headers in production: ` +
        `expected Cross-Origin-Opener-Policy "same-origin" (got ${JSON.stringify(coop)}) and ` +
        `Cross-Origin-Embedder-Policy "require-corp" (got ${JSON.stringify(coep)})`,
    );
  }
}

/** Assert document-level Cross-Origin Isolation state via the browser. */
async function assertDocumentIsolation(label) {
  const report = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      return {
        crossOriginIsolated: self.crossOriginIsolated === true,
        sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      };
    `,
    args: [],
  });
  if (!report?.crossOriginIsolated || !report?.sharedArrayBuffer) {
    throw new Error(
      `${label}: document is not cross-origin isolated in production ` +
        `(crossOriginIsolated=${report?.crossOriginIsolated}, SharedArrayBuffer=${report?.sharedArrayBuffer})`,
    );
  }
}

/**
 * Assert Cross-Origin Isolation inside a dedicated worker.
 *
 * Uses the static same-origin probe worker at /tesseract/coi-probe.js —
 * the same construction type, origin, and path prefix as the tesseract.js
 * OCR worker (/tesseract/worker.min.js). A same-origin path is required by
 * the app's Trusted Types default policy, which refuses blob:/data: script
 * URLs by design (see src/instrumentation-client.ts) — the
 * same constraint tesseract.js itself satisfies. A dedicated worker
 * inherits its creator's agent-cluster isolation, so
 * `self.crossOriginIsolated === true` in the probe is exactly the property
 * the OCR pipeline needs for its SharedArrayBuffer-based transfers. No OCR
 * model bytes are loaded and no inference runs — the probe only reports
 * isolation state.
 */
async function assertWorkerIsolation(label) {
  const reportJson = await webdriver("POST", `/session/${sessionId}/execute/async`, {
    script: `
      const done = arguments[arguments.length - 1];
      const finish = (value) => done(JSON.stringify(value));
      const timeout = setTimeout(() => finish({ error: "worker report timed out" }), 5_000);
      try {
        const worker = new Worker("/tesseract/coi-probe.js");
        worker.onmessage = (event) => {
          clearTimeout(timeout);
          worker.terminate();
          finish(event.data);
        };
        worker.onerror = (event) => {
          clearTimeout(timeout);
          worker.terminate();
          finish({ error: "worker error: " + (event.message || "unknown") });
        };
        worker.postMessage("report");
      } catch (error) {
        clearTimeout(timeout);
        finish({ error: "worker construction failed: " + String(error) });
      }
    `,
    args: [],
  });
  let report;
  try {
    report = JSON.parse(reportJson);
  } catch {
    throw new Error(`${label}: worker report was not valid JSON: ${String(reportJson)}`);
  }
  if (report.error) {
    throw new Error(`${label}: worker context check failed: ${report.error}`);
  }
  if (!report.crossOriginIsolated || !report.sharedArrayBuffer) {
    throw new Error(
      `${label}: OCR worker context is not cross-origin isolated in production ` +
        `(crossOriginIsolated=${report.crossOriginIsolated}, SharedArrayBuffer=${report.sharedArrayBuffer})`,
    );
  }
}

async function runJourney() {
  for (const route of HEADER_CHECK_ROUTES) {
    await assertCoiHeaders(route);
  }

  await webdriver("POST", `/session/${sessionId}/url`, { url: `${APP_BASE_URL}/presumptive` });
  await waitForPath("/presumptive");
  await assertDocumentIsolation("Presumptive page (Dd214 OCR surface)");
  await assertWorkerIsolation("Presumptive page (Dd214 OCR surface)");

  console.log(
    "COI E2E passed: production responses carry Cross-Origin-Opener-Policy same-origin and " +
      "Cross-Origin-Embedder-Policy require-corp on all asserted routes, and both the document and a " +
      "same-origin dedicated worker (the tesseract.js OCR construction) report crossOriginIsolated with " +
      "SharedArrayBuffer available.",
  );
}

async function cleanup() {
  if (sessionId) {
    try {
      await webdriver("DELETE", `/session/${sessionId}`);
    } catch {
      // Best-effort browser cleanup only.
    }
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
      "No production build found (.next/BUILD_ID missing). This journey asserts production responses; run `npm run build` first (CI runs it right after the build step).",
    );
  }

  const nextExecutable = path.join(process.cwd(), "node_modules", ".bin", "next");
  const nextServer = logProcess(
    "coi-next",
    spawn(nextExecutable, ["start", "-H", "127.0.0.1", "-p", String(APP_PORT)], {
      env: {
        ...process.env,
        WORKFLOW_SESSION_SECRET:
          process.env.WORKFLOW_SESSION_SECRET ?? "browser-validation-workflow-secret-only-for-local-ci-2026",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: USE_PROCESS_GROUPS,
    }),
  );
  const chromeDriver = logProcess(
    "coi-chromedriver",
    spawn(resolveChromeDriver(), [`--port=${DRIVER_PORT}`], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: USE_PROCESS_GROUPS,
    }),
  );

  if (!nextServer.pid || !chromeDriver.pid) throw new Error("Unable to start COI browser services.");
  await Promise.all([
    waitForHttp(APP_BASE_URL, "COI Next.js production server"),
    waitForHttp(`${DRIVER_BASE_URL}/status`, "COI ChromeDriver"),
  ]);

  const session = await createSession();
  sessionId = session.sessionId;
  if (!sessionId) throw new Error("ChromeDriver did not return a session id.");
  await runJourney();
}

try {
  await main();
} finally {
  await cleanup();
}
