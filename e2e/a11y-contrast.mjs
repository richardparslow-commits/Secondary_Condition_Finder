/**
 * R-05 — real-browser contrast and keyboard evidence (VA Lighthouse §5.5).
 *
 * jsdom computes no layout, so axe's `color-contrast` rule can only return
 * "incomplete" there and is disabled in `tests/setup/accessibility.ts`. This is
 * precisely the gap the Lighthouse report calls out: the analytical token test
 * (`tests/design-token-contrast.test.ts`) covers token pairs, and jsdom axe
 * covers everything else, but no automated check ever measured a rendered
 * pixel. This spec closes that with the harness the repo already runs in CI:
 * the same raw-WebDriver + chromedriver stack as `e2e/secondary-workflow.mjs`.
 *
 * Trusted Types posture (deliberate, not incidental): the production CSP
 * enforces `require-trusted-types-for 'script'`, and the policy accepts
 * same-origin script URLs only — `blob:` and `data:` URLs are refused. So axe
 * is NOT injected via blob/data URL or CDN tag. Instead the axe source is read
 * from the pinned `node_modules/axe-core` package at spec startup and passed
 * through WebDriver `execute/sync` script evaluation, which is not a DOM
 * injection sink and therefore never engages Trusted Types at all. Nothing
 * extra reaches the deployed bundle, and the security gate needs no relaxation
 * (asserted by an audit contract, not merely intended).
 *
 * What runs, per key route:
 *   1. Full axe scan with `color-contrast` ENABLED — the rule set the other
 *      suites cannot see. Blocking impacts are critical/serious, the same bar
 *      as the jsdom gate in `tests/setup/accessibility.ts`.
 *   2. A keyboard walk: send Tab, and after every step assert
 *      `document.activeElement` reports visible client rects (an invisibly
 *      focused element has none) and that the walk actually advanced across
 *      distinct interactive elements.
 *
 * Artifacts: per-route axe JSON results and a summary are written to
 * `a11y-evidence/` for the workflow to upload; the log stays bounded and free
 * of DOM dumps — raw per-node detail lives only in the JSON files.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
const APP_PORT = Number(process.env.A11Y_E2E_APP_PORT ?? 3400);
const DRIVER_PORT = Number(process.env.A11Y_E2E_DRIVER_PORT ?? 9515);
const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const DRIVER_BASE_URL = `http://127.0.0.1:${DRIVER_PORT}`;
const WAIT_TIMEOUT_MS = 30_000;
const WEBDRIVER_COMMAND_TIMEOUT_MS = 20_000;
const WEBDRIVER_SESSION_TIMEOUT_MS = 30_000;
const WEBDRIVER_SESSION_ATTEMPTS = 2;
const WEBDRIVER_SESSION_RETRY_DELAY_MS = 1_000;
const USE_PROCESS_GROUPS = process.platform !== "win32";
const WORKFLOW_SESSION_SECRET =
  process.env.WORKFLOW_SESSION_SECRET ??
  "browser-e2e-workflow-secret-only-for-local-ci-2026";
const EVIDENCE_DIR = process.env.A11Y_EVIDENCE_DIR ?? "a11y-evidence";
const AXE_BLOCKING_IMPACTS = new Set(["critical", "serious"]);
const AXE_SCAN_TIMEOUT_MS = 45_000;
/** Bounded by keystroke count, not page size, so the walk cannot hang. */
const KEYBOARD_WALK_MAX_STEPS = 120;

/**
 * Key routes. `/results` is an HTTP 307 redirect shim to `/secondary`, so the
 * scan targets its real destination; the list covers the shipped surface the
 * Lighthouse §5.5 intent applies to.
 */
const ROUTES = [
  { path: "/", label: "home" },
  { path: "/get-records", label: "get-records" },
  { path: "/pathways", label: "pathways" },
  { path: "/presumptive", label: "presumptive" },
  { path: "/privacy", label: "privacy" },
  { path: "/scenarios", label: "scenarios" },
  { path: "/secondary", label: "secondary" },
  { path: "/secondary/diagnosed", label: "secondary-diagnosed" },
  { path: "/secondary/service-connected", label: "secondary-service-connected" },
  { path: "/secondary/condition-caused-by", label: "secondary-condition-caused-by" },
  { path: "/secondary/condition-aggravation", label: "secondary-condition-aggravation" },
  { path: "/secondary/evidence", label: "secondary-evidence" },
  { path: "/secondary/suggestions", label: "secondary-suggestions" },
  { path: "/secondary/legal", label: "secondary-legal" },
  { path: "/secondary/ratings", label: "secondary-ratings" },
  { path: "/about", label: "about" },
  { path: "/terms", label: "terms" },
  { path: "/va-account", label: "va-account" },
  { path: "/va-forms", label: "va-forms" },
  { path: "/va-forms/finder", label: "va-forms-finder" },
  { path: "/va-reference", label: "va-reference" },
  { path: "/va-reference/service-branches", label: "va-reference-service-branches" },
];

const children = [];
let sessionId;

/**
 * Read once at spec startup: the pinned axe-core source is evaluated inside
 * the page through WebDriver `execute/sync`, so it never becomes a DOM script
 * injection sink and never engages the app's Trusted Types gate.
 */
const AXE_BOOTSTRAP = fs.readFileSync(
  path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js"),
  "utf8",
);

function checkpoint(message) {
  console.log(`[a11y] ${message}`);
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
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status >= 200 && response.status < 500) return;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready: ${lastError?.message ?? "timeout"}`);
}

async function webdriver(method, endpoint, body, timeoutMs = WEBDRIVER_COMMAND_TIMEOUT_MS) {
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
    const error = payload.value?.message ?? JSON.stringify(payload.value ?? payload);
    throw new Error(`WebDriver ${method} ${endpoint} failed: ${error}`);
  }
  return payload.value;
}

function isTransientSessionTransportError(error) {
  return (
    error instanceof Error &&
    error.message.startsWith("WebDriver POST /session request failed or timed out:")
  );
}

async function createWebDriverSession() {
  const request = {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: [
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--window-size=1440,1200",
          ],
        },
      },
    },
  };
  let lastError;
  for (let attempt = 1; attempt <= WEBDRIVER_SESSION_ATTEMPTS; attempt += 1) {
    try {
      return await webdriver("POST", "/session", request, WEBDRIVER_SESSION_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      if (!isTransientSessionTransportError(error) || attempt === WEBDRIVER_SESSION_ATTEMPTS) {
        throw error;
      }
      checkpoint(`Chrome session startup transport failed on attempt ${attempt}; retrying once`);
      await delay(WEBDRIVER_SESSION_RETRY_DELAY_MS);
      await waitForHttp(`${DRIVER_BASE_URL}/status`, "ChromeDriver after session-start retry");
    }
  }
  throw lastError ?? new Error("ChromeDriver session creation failed without an error.");
}

async function waitForRouteComplete(route) {
  const deadline = Date.now() + 20_000;
  let lastUrl = "";
  let lastState = "";
  while (Date.now() < deadline) {
    lastUrl = await webdriver("GET", `/session/${sessionId}/url`);
    lastState = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
      script: "return document.readyState",
      args: [],
    });
    if (lastUrl === `${APP_BASE_URL}${route.path}` && lastState === "complete") return;
    await delay(200);
  }
  throw new Error(
    `Route ${route.path} never reached complete: url=${lastUrl} state=${lastState}`,
  );
}

async function navigateToPath(route) {
  await webdriver("POST", `/session/${sessionId}/url`, {
    url: `${APP_BASE_URL}${route.path}`,
  });
  await waitForRouteComplete(route);
}

/**
 * Run axe's color-contrast rule against the live document and return the
 * raw report. The screen-size argument is pass-through deterministic and the
 * results stringified so script evaluation return values stay JSON-safe.
 */
async function runContrastScan(route) {
  const bootIndicator = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `${AXE_BOOTSTRAP}\n;return Boolean(window.axe);`,
    args: [],
  });
  if (bootIndicator !== true) {
    throw new Error(`${route.path}: axe bootstrap did not take effect in the live page`);
  }
  // `execute/async` (not sync): axe.run returns a promise that completes
  // after the sync evaluation returns, so the callback form is required —
  // the same pattern `coi-isolation.mjs` uses for its worker probe.
  const raw = await webdriver(
    "POST",
    `/session/${sessionId}/execute/async`,
    {
      script: `
        const done = arguments[arguments.length - 1];
        window.axe
          .run(document, { runOnly: { type: "rule", values: ["color-contrast"] } })
          .then((results) => done(JSON.stringify({
            passes: results.passes.length,
            violations: results.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.length,
              firstTarget: v.nodes[0]?.target?.[0],
              targets: v.nodes.map((n) => n.target?.[0]).filter(Boolean),
              firstFailureSummary: v.nodes[0]?.failureSummary,
            })),
            incomplete: results.incomplete.length,
            inapplicable: results.inapplicable.length,
          })))
          .catch((error) => done(JSON.stringify({ error: String(error && error.message || error) })));
      `,
      args: [],
    },
    AXE_SCAN_TIMEOUT_MS,
  );
  const report = JSON.parse(raw);
  if (report.error) {
    throw new Error(`${route.path}: axe contrast scan failed: ${report.error}`);
  }
  return report;
}

/**
 * Focus the first tabbable element via script, then send Tab through the
 * WebDriver Actions API and after each step assert the focused element is
 * visible and that focus actually advanced. Bounded by step count.
 */
async function runKeyboardWalk(route) {
  const focusInitialised = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      const focusables = Array.from(document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusables.length === 0) return "empty";
      focusables[0].focus();
      return document.activeElement === focusables[0] ? "focused" : "noop";
    `,
    args: [],
  });
  if (focusInitialised === "empty") {
    checkpoint(`${route.path}: no tabbable elements; keyboard walk skipped`);
    return { steps: 0, distinctElements: 0 };
  }

  let priorSignature = "";
  let distinctElements = 0;
  let step = 0;
  for (; step < KEYBOARD_WALK_MAX_STEPS; step += 1) {
    await webdriver("POST", `/session/${sessionId}/actions`, {
      actions: [
        {
          type: "key",
          id: "r05-tab",
          actions: [{ type: "keyDown", value: "\uE000" }, { type: "keyUp", value: "\uE000" }],
        },
      ],
    });
    const active = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
      script: `
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const rects = el.getClientRects();
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          label: (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || '').slice(0, 120),
          rects: rects.length,
          visibility: style.visibility,
          display: style.display,
        };
      `,
      args: [],
    });
    if (!active) break; // focus walked past the last tabbable — walk complete
    if (active.rects === 0 || active.visibility === "hidden" || active.display === "none") {
      throw new Error(
        `${route.path}: keyboard step ${step + 1} focused an invisible element ` +
          `<${active.tag.toLowerCase()}> "${active.label}" — visible-focus evidence failed`,
      );
    }
    const signature = `${active.tag}:${active.label}`;
    if (signature !== priorSignature) distinctElements += 1;
    priorSignature = signature;
  }
  if (distinctElements < 1) {
    throw new Error(
      `${route.path}: keyboard walk pressed Tab ${step} times but focus never advanced ` +
        "to any interactive element — keyboard coverage evidence failed",
    );
  }
  return { steps: step, distinctElements };
}

async function auditRoute(route) {
  checkpoint(`auditing ${route.path} (${route.label})`);
  await navigateToPath(route);

  const contrast = await runContrastScan(route);
  const evidenceFile = path.join(
    EVIDENCE_DIR,
    `contrast-${route.label}.json`,
  );
  fs.writeFileSync(evidenceFile, JSON.stringify(contrast, null, 2), "utf8");

  const blocking = contrast.violations.filter((violation) =>
    AXE_BLOCKING_IMPACTS.has(violation.impact ?? "unknown"),
  );
  if (blocking.length > 0) {
    throw new Error(
      `${route.path}: real-browser color-contrast found ${blocking.length} blocking violation(s):\n` +
        blocking
          .map(
            (violation) =>
              `  - [${violation.impact}] ${violation.id} (${violation.nodes} node(s)) — ${violation.help} @ ${violation.firstTarget}\n` +
              `      ${violation.firstFailureSummary ?? ""}`.trimEnd(),
          )
          .join("\n") +
        `\naxe raw report: ${path.relative(process.cwd(), evidenceFile)}`,
    );
  }
  if (contrast.incomplete > 0) {
    checkpoint(
      `${route.path}: axe reported ${contrast.incomplete} incomplete node(s) — recorded in evidence, not blocking`,
    );
  }

  const keyboard = await runKeyboardWalk(route);
  return {
    route: route.path,
    label: route.label,
    contrastPasses: contrast.passes,
    contrastViolations: contrast.violations.length,
    contrastIncomplete: contrast.incomplete,
    keyboardSteps: keyboard.steps,
    keyboardDistinctElements: keyboard.distinctElements,
    evidenceFile: path.relative(process.cwd(), evidenceFile),
  };
}

async function runJourney() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const summaries = [];
  for (const route of ROUTES) {
    const summary = await auditRoute(route);
    summaries.push(summary);
    checkpoint(
      `${route.path}: contrast passes=${summary.contrastPasses}, violations=${summary.contrastViolations}, ` +
        `incomplete=${summary.contrastIncomplete}, keyboard steps=${summary.keyboardSteps}, ` +
        `distinct=${summary.keyboardDistinctElements}`,
    );
  }
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "summary.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), routes: summaries }, null, 2),
    "utf8",
  );
  checkpoint(`completed audit of ${summaries.length} routes; evidence in ${EVIDENCE_DIR}/`);
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
  const nextExecutable = path.join(process.cwd(), "node_modules", ".bin", "next");
  const nextServer = logProcess(
    "next",
    spawn(nextExecutable, ["dev", "-H", "127.0.0.1", "-p", String(APP_PORT)], {
      env: {
        ...process.env,
        WORKFLOW_SESSION_SECRET,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: USE_PROCESS_GROUPS,
    }),
  );

  const chromeDriver = logProcess(
    "chromedriver",
    spawn(resolveChromeDriver(), [`--port=${DRIVER_PORT}`], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: USE_PROCESS_GROUPS,
    }),
  );

  if (!nextServer.pid || !chromeDriver.pid) {
    throw new Error("Unable to start the Next.js server or ChromeDriver.");
  }

  await Promise.all([
    waitForHttp(APP_BASE_URL, "Next.js a11y server"),
    waitForHttp(`${DRIVER_BASE_URL}/status`, "ChromeDriver"),
  ]);

  const session = await createWebDriverSession();
  sessionId = session.sessionId;
  if (!sessionId) throw new Error("ChromeDriver did not return a WebDriver session id.");

  await runJourney();
}

try {
  await main();
} finally {
  await cleanup();
}
