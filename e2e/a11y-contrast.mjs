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
 *   1. The rendering-dependent axe rules — `color-contrast` and
 *      `link-in-text-block` — the rule set the other suites cannot measure.
 *      Blocking impacts are critical/serious, the same bar as the jsdom gate in
 *      `tests/setup/accessibility.ts`.
 *   2. A keyboard walk: send Tab, and after every step assert
 *      `document.activeElement` reports visible client rects (an invisibly
 *      focused element has none) and that the walk actually advanced across
 *      distinct interactive elements.
 *
 * Before any route is audited, a control seeds one known sub-AA text pair into
 * a page under the dark-host emulation and requires the same scan to report a
 * blocking `color-contrast` violation. A dark pass that cannot fail when
 * contrast is actually broken would otherwise be a second green light pass;
 * the control fails the run instead, and records its own evidence.
 *
 * Artifacts: per-route axe JSON results and a summary are written to
 * `a11y-evidence/` for the workflow to upload; the log stays bounded and free
 * of DOM dumps — raw per-node detail lives only in the JSON files.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { contrastRoutes } from "../scripts/lib/public-routes.mjs";
import {
  buildRouteInventoryReport,
  readContrastEvidence,
  writeRouteInventoryReport,
} from "../scripts/lib/route-inventory-report.mjs";

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

/**
 * Host colour-scheme contexts. The app is deliberately light-only
 * (`color-scheme: light` on `html`), but an operating system or embedding
 * browser that prefers dark still changes the *host* context around it: native
 * controls, scrollbars and any surface that did not paint its own background
 * follow the host preference. Axe in a light-looking Chrome would never see
 * that, so every route is scanned once in each context.
 *
 * `dark-host` is emulated through CDP (`Emulation.setEmulatedMedia`) rather
 * than by launching a second browser or flipping a CSS class. A class would
 * test the app's own theme switch, not the host preference; a launch flag
 * would test one Chrome release's forced-dark implementation instead of the
 * media feature the platform exposes. CDP changes exactly the query an OS/browser
 * dark preference changes, and it is reset before the keyboard walk so that
 * walk still runs in the default context.
 */
const COLOR_SCHEME_PASSES = [
  {
    id: "light",
    media: "light",
    label: "light host",
    evidenceSuffix: "",
  },
  {
    id: "dark-host",
    media: "dark",
    label: "dark host context",
    evidenceSuffix: "-dark-host",
  },
];
/** Bounded by keystroke count, not page size, so the walk cannot hang. */
const KEYBOARD_WALK_MAX_STEPS = 120;

/** Deterministic sub-AA pair: #888 on #777 is about 1.26:1. */
const SEEDED_CONTRAST = {
  id: "a11y-dark-contrast-seed",
  text: "Seeded dark-host contrast control",
  color: "#888888",
  background: "#777777",
};
const SEEDED_CONTRAST_EVIDENCE = "contrast-seeded-dark-control.json";

/**
 * The routes this scan covers, read from the machine-checked public-route
 * manifest (`scripts/lib/public-routes.mjs`) rather than from a copy here.
 *
 * The copy this replaces scanned 22 of the 26 reviewed routes —
 * `/privacy/request`, `/secondary/upload`, `/presumptive/results` and
 * `/runtime-readiness` were absent — so the gate's own "audits every shipped
 * route, not a hand-picked subset" claim was not true of the list it ran. The
 * manifest derives the route set from `src/app/**\/page.tsx`, and
 * `tests/public-route-manifest.test.ts` fails when a shipped route is missing
 * from it: a new page joins this scan by existing rather than by being
 * remembered here.
 *
 * `/results` is the one route the manifest leaves out: it is an HTTP 307
 * redirect shim to `/secondary`, renders no content of its own, and the scan
 * targets its real destination instead.
 */
const ROUTES = contrastRoutes();

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
 * Point Chrome's `prefers-color-scheme` at one host context, then prove the
 * emulation took effect before anything is measured under it. A silent CDP
 * refusal would otherwise turn the dark pass into a second light pass that
 * always passes.
 */
async function emulateHostColorScheme(pass) {
  await webdriver("POST", `/session/${sessionId}/goog/cdp/execute`, {
    cmd: "Emulation.setEmulatedMedia",
    params: {
      features: [{ name: "prefers-color-scheme", value: pass.media }],
    },
  });
  const prefersDark = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: "return window.matchMedia('(prefers-color-scheme: dark)').matches",
    args: [],
  });
  const expected = pass.media === "dark";
  if (prefersDark !== expected) {
    throw new Error(
      `Chrome did not adopt the ${pass.label} preference: ` +
        `prefers-color-scheme: dark reported ${prefersDark}, expected ${expected}`,
    );
  }
}

/**
 * Run the rendering-dependent axe rules against the live document and return
 * the raw report. The screen-size argument is pass-through deterministic and the
 * results stringified so script evaluation return values stay JSON-safe.
 *
 * Two rules, both of which need a real layout and real computed colours:
 *
 *   - `color-contrast` — the rule the jsdom gate documents as skipped.
 *   - `link-in-text-block` (WCAG 1.4.1) — whether a link inside a block of text
 *     is distinguishable without colour. jsdom returns it as `incomplete` for
 *     the same mechanical reason, so the shipped build could carry a
 *     colour-only link into a manual review unnoticed; that is exactly what
 *     happened — this gate's first run with the rule enabled flagged
 *     `/secondary` and `/privacy/request` in the working tree.
 */
async function runContrastScan(route, pass) {
  const bootIndicator = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `${AXE_BOOTSTRAP}\n;return Boolean(window.axe);`,
    args: [],
  });
  if (bootIndicator !== true) {
    throw new Error(
      `${route.path} (${pass.label}): axe bootstrap did not take effect in the live page`,
    );
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
          .run(document, {
            runOnly: { type: "rule", values: ["color-contrast", "link-in-text-block"] },
          })
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
    throw new Error(`${route.path} (${pass.label}): axe contrast scan failed: ${report.error}`);
  }
  return report;
}

/**
 * Prove the dark-host pass can go red. The seed is a fixed sub-AA pair with
 * explicit colours, so it does not depend on the app's palette or on a CSS
 * token that a regression might also change. It is injected through CSSOM
 * property writes rather than inline `style` attributes, because the production
 * CSP's `style-src` nonce would refuse the latter.
 *
 * Returns the recorded result instead of throwing on a missed detection, so the
 * caller can write the summary (including the failed control) before deciding.
 */
async function runSeededDarkContrastControl() {
  const pass = COLOR_SCHEME_PASSES.find((candidate) => candidate.id === "dark-host");
  if (!pass) throw new Error("the dark-host colour-scheme pass is not declared");

  checkpoint("seeding a sub-AA text pair under the dark-host context");
  await emulateHostColorScheme(pass);
  await navigateToPath({ path: "/" });

  const computed = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      const id = arguments[0];
      document.getElementById(id)?.remove();
      const seed = document.createElement("p");
      seed.id = id;
      seed.textContent = arguments[1];
      seed.style.setProperty("position", "fixed", "important");
      seed.style.setProperty("left", "0", "important");
      seed.style.setProperty("top", "0", "important");
      seed.style.setProperty("z-index", "2147483647", "important");
      seed.style.setProperty("margin", "0", "important");
      seed.style.setProperty("padding", "12px", "important");
      seed.style.setProperty("font-size", "16px", "important");
      seed.style.setProperty("opacity", "1", "important");
      seed.style.setProperty("color", arguments[2], "important");
      seed.style.setProperty("background-color", arguments[3], "important");
      document.body.appendChild(seed);
      const style = window.getComputedStyle(seed);
      return {
        text: seed.textContent,
        color: style.color,
        background: style.backgroundColor,
      };
    `,
    args: [SEEDED_CONTRAST.id, SEEDED_CONTRAST.text, SEEDED_CONTRAST.color, SEEDED_CONTRAST.background],
  });

  const contrast = await runContrastScan(
    { path: "/ (seeded dark contrast control)" },
    pass,
  );

  await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: "document.getElementById(arguments[0])?.remove(); return true;",
    args: [SEEDED_CONTRAST.id],
  });
  await emulateHostColorScheme(COLOR_SCHEME_PASSES[0]);

  const blocking = contrast.violations.filter((violation) =>
    AXE_BLOCKING_IMPACTS.has(violation.impact ?? "unknown"),
  );
  const detected = blocking.find((violation) => violation.id === "color-contrast") ?? null;
  const record = {
    generatedAt: new Date().toISOString(),
    pass: pass.id,
    emulatedColorScheme: pass.media,
    rule: "color-contrast",
    seededElement: `<p id="${SEEDED_CONTRAST.id}">${SEEDED_CONTRAST.text}</p>`,
    computed,
    detected: detected
      ? {
          impact: detected.impact,
          nodes: detected.nodes,
          firstTarget: detected.firstTarget ?? null,
          firstFailureSummary: detected.firstFailureSummary ?? null,
        }
      : null,
    blockingViolations: blocking.length,
    contrastViolations: contrast.violations.length,
    passed: detected !== null,
  };
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, SEEDED_CONTRAST_EVIDENCE),
    JSON.stringify(record, null, 2),
    "utf8",
  );
  return record;
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
  const passes = [];

  for (const pass of COLOR_SCHEME_PASSES) {
    await emulateHostColorScheme(pass);
    await navigateToPath(route);

    // The app opts out of host dark rendering. If this ever reports "normal"
    // or "dark", native controls and any unpainted surface have silently
    // followed the host preference, which is the condition this pass exists
    // to catch.
    const appColorScheme = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
      script: "return getComputedStyle(document.documentElement).colorScheme",
      args: [],
    });
    if (appColorScheme !== "light") {
      throw new Error(
        `${route.path}: color-scheme is ${JSON.stringify(appColorScheme)} during the ${pass.label} pass — ` +
          "the light palette must not be left to the host preference",
      );
    }

    const contrast = await runContrastScan(route, pass);
    const evidenceFile = path.join(
      EVIDENCE_DIR,
      `contrast-${route.label}${pass.evidenceSuffix}.json`,
    );
    // The raw file records which host context produced it. Without this, a
    // reviewer reading the artifact cannot tell the dark pass actually ran
    // under a dark preference, and a refused CDP override would look like a
    // clean second light scan.
    const evidence = {
      hostContext: {
        pass: pass.id,
        emulatedColorScheme: pass.media,
        documentColorScheme: appColorScheme,
      },
      ...contrast,
    };
    fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2), "utf8");

    const blocking = contrast.violations.filter((violation) =>
      AXE_BLOCKING_IMPACTS.has(violation.impact ?? "unknown"),
    );
    if (blocking.length > 0) {
      throw new Error(
        `${route.path}: real-browser color-contrast found ${blocking.length} blocking violation(s) ` +
          `in the ${pass.label} pass:\n` +
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
        `${route.path} (${pass.label}): axe reported ${contrast.incomplete} incomplete node(s) — recorded in evidence, not blocking`,
      );
    }

    passes.push({
      id: pass.id,
      label: pass.label,
      contrastPasses: contrast.passes,
      contrastViolations: contrast.violations.length,
      contrastIncomplete: contrast.incomplete,
      evidenceFile: path.relative(process.cwd(), evidenceFile),
    });
  }

  // Reset the media override before the keyboard walk: focus visibility is not
  // a colour-scheme property, so it is measured once, in the shipped default
  // context, rather than paying for a duplicate walk per route.
  await emulateHostColorScheme(COLOR_SCHEME_PASSES[0]);
  await navigateToPath(route);
  const keyboard = await runKeyboardWalk(route);

  const light = passes.find((pass) => pass.id === "light");
  const darkHost = passes.find((pass) => pass.id === "dark-host");
  if (!light || !darkHost) {
    throw new Error(`${route.path}: a colour-scheme pass produced no result`);
  }

  return {
    route: route.path,
    label: route.label,
    contrastPasses: light.contrastPasses,
    contrastViolations: light.contrastViolations,
    contrastIncomplete: light.contrastIncomplete,
    darkHostContrastPasses: darkHost.contrastPasses,
    darkHostContrastViolations: darkHost.contrastViolations,
    darkHostContrastIncomplete: darkHost.contrastIncomplete,
    darkHostEvidenceFile: darkHost.evidenceFile,
    keyboardSteps: keyboard.steps,
    keyboardDistinctElements: keyboard.distinctElements,
    evidenceFile: light.evidenceFile,
  };
}

/**
 * Publishes the per-run route inventory report for this run of the gate.
 *
 * The summary this writes is the run's claim; the report reads the evidence back
 * off disk — the `summary.json` rows and the per-route files they name — and
 * reconciles that claim against the routes the manifest declares for this
 * surface. So a route the loop skipped, or a summary row whose evidence file was
 * never written, shows up as a named problem instead of a shorter list.
 *
 * Every audit is written to disk before this runs, so it is called on both
 * paths: a failed walk still publishes the record of what it did and did not
 * cover.
 */
function publishRouteInventoryReport() {
  const read = readContrastEvidence({ directory: EVIDENCE_DIR });
  const report = buildRouteInventoryReport({
    surface: "contrast",
    records: read.records,
    evidenceProblems: read.problems,
    generatedAt: read.generatedAt,
    run: {
      id: process.env.GITHUB_RUN_ID ?? null,
      label: process.env.GITHUB_EVENT_NAME ?? null,
      commit: process.env.GITHUB_SHA ?? null,
    },
  });
  const { markdownPath, markdown } = writeRouteInventoryReport({
    report,
    base: path.join(EVIDENCE_DIR, "route-inventory-report"),
  });
  // Printed, not merely written: the CI log is the first thing a reader opens,
  // and the point of the report is that a coverage gap is visible there.
  console.log(markdown);
  checkpoint(`route inventory report for this run: ${markdownPath}`);
  return { report, markdownPath };
}

async function runJourney() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const summaries = [];
  let seededControl = null;
  let journeyFailure = null;

  try {
    seededControl = await runSeededDarkContrastControl();
    checkpoint(
      seededControl.passed
        ? `seeded dark-host contrast control: ${seededControl.rule} detected ` +
            `(${seededControl.detected?.impact}, ${seededControl.detected?.nodes} node(s))`
        : "seeded dark-host contrast control was NOT detected — refusing to report a clean pass",
    );
    if (!seededControl.passed) {
      throw new Error(
        "the dark-host pass did not report the seeded sub-AA text pair as a blocking " +
          "color-contrast violation, so a clean result from it would be vacuous\n" +
          `control evidence: ${path.relative(process.cwd(), path.join(EVIDENCE_DIR, SEEDED_CONTRAST_EVIDENCE))}`,
      );
    }

    for (const route of ROUTES) {
      const summary = await auditRoute(route);
      summaries.push(summary);
      checkpoint(
        `${route.path}: light contrast passes=${summary.contrastPasses}, violations=${summary.contrastViolations}, ` +
          `incomplete=${summary.contrastIncomplete}; dark-host passes=${summary.darkHostContrastPasses}, ` +
          `violations=${summary.darkHostContrastViolations}, incomplete=${summary.darkHostContrastIncomplete}; ` +
          `keyboard steps=${summary.keyboardSteps}, distinct=${summary.keyboardDistinctElements}`,
      );
    }
    checkpoint(`completed audit of ${summaries.length} routes; evidence in ${EVIDENCE_DIR}/`);
  } catch (error) {
    journeyFailure = error;
  }

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "summary.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), seededControl, routes: summaries },
      null,
      2,
    ),
    "utf8",
  );

  let report = null;
  try {
    report = publishRouteInventoryReport().report;
  } catch (publishError) {
    // Best-effort: a publishing failure must not mask a failed walk, which is
    // the more specific error. It is reported as the failure when there is no
    // walk error to report instead.
    if (!journeyFailure) journeyFailure = publishError;
    else checkpoint(`route inventory report could not be published: ${publishError?.message ?? publishError}`);
  }

  if (journeyFailure) throw journeyFailure;

  if (report && report.problems.length > 0) {
    throw new Error(
      `the per-run route inventory report names ${report.problems.length} coverage problem(s), so this surface ` +
        "stopped covering at least one route it declares:\n" +
        report.problems.map((problem) => `  - ${problem}`).join("\n"),
    );
  }
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
