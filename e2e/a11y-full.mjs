/**
 * Full-route accessibility gate: axe-core in a real browser (Playwright).
 *
 * The R-05 gate (`e2e/a11y-contrast.mjs`) deliberately runs only the two rules
 * that need a layout engine — `color-contrast` and `link-in-text-block` — and
 * the jsdom gate in `tests/setup/accessibility.ts` renders nothing. Neither runs
 * the full WCAG 2.1 A/AA rule set against every rendered page. This gate does:
 *
 *   1. Boots the production build (`next start`; run `npm run build` first) and
 *      opens every route declared by `scripts/lib/public-routes.mjs`.
 *   2. Asserts each page rendered its heading, and on `/scenarios` that the
 *      demo heading and one `<article>` per bundled scenario are present, so a
 *      blank page or a failed hydration cannot pass as a clean scan.
 *   3. Runs axe-core 4.14 with the WCAG 2.1 A/AA tags — the same bar as the
 *      jsdom gate — and fails on any `serious` or `critical` violation.
 *   4. Fails if axe inspected nothing on a route, so a misconfigured scan
 *      cannot pass vacuously.
 *   5. Proves the scan can go red on every run: before auditing any route it
 *      seeds an unlabeled `<button>` into a scratch page, scans it with the
 *      same `runScan`, and requires both that axe reports `button-name` and
 *      that the gate's own failure path turns that finding into a throw. It
 *      then seeds a 1.26:1 text pair into a page under the dark-host
 *      emulation, requires `[serious] color-contrast` for it, and requires the
 *      failure message to name it as a `(dark host)` finding. A control that
 *      cannot detect its seed aborts the run instead of reporting a clean
 *      (and therefore meaningless) result.
 *   6. Scans every route a second time with `prefers-color-scheme: dark`
 *      emulated, the same control the R-05 gate applies. The app is
 *      deliberately light-only, but a dark host still changes the context
 *      around it — native controls, scrollbars, and any surface that did not
 *      paint its own background follow the host preference — and a light-looking
 *      Chrome would never see that. Dark findings are held to the same
 *      serious/critical bar and reported against the route as `(dark host)`.
 *      The emulation is proved to have taken effect (the page's own
 *      `matchMedia` query must report dark) before anything is measured under
 *      it: a silently refused emulation would otherwise turn the dark pass into
 *      a second light pass that always passes.
 *
 * The route list is derived from the same manifest the R-05 gate uses, so a
 * new page joins this scan by existing rather than by being remembered here.
 * `/results` is excluded by that manifest (a 307 shim to `/secondary`).
 *
 * axe is injected with Playwright's `addInitScript`, which executes through the
 * browser protocol rather than a `<script>` DOM sink. The production CSP keeps
 * `require-trusted-types-for 'script'`, so this is the compatible injection path
 * (the same reason the WebDriver gate evaluates axe instead of injecting a
 * script element); no security header is relaxed for this gate.
 *
 * Evidence: `a11y-evidence/full-axe.json` (one row per audited route, its dark
 * host result, plus every violation and the browser/axe versions) is written
 * before the gate decides, so a failing run still uploads the report that
 * explains it. The file name is
 * deliberately not `summary.json`: the R-05 route-inventory reader owns that
 * file and must not mistake this report for a contrast run.
 *
 * Ports: `A11Y_FULL_APP_PORT` (default 3401). Browser: the installed Chrome
 * channel, which the CI runner and the R-05 gate already require; install
 * Playwright's own Chromium and set `A11Y_FULL_BROWSER=chromium` to use it.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

import { contrastRoutes } from "../scripts/lib/public-routes.mjs";

const APP_PORT = Number(process.env.A11Y_FULL_APP_PORT ?? 3401);
const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const ROUTES = contrastRoutes();
const DEMO_ROUTE = "/scenarios";
const DEMO_HEADING = "Demo scenarios";
const DEMO_SCENARIOS = path.join(process.cwd(), "data", "demo-scenarios.json");
const EVIDENCE_DIR = process.env.A11Y_EVIDENCE_DIR ?? "a11y-evidence";
const EVIDENCE_FILE = path.join(EVIDENCE_DIR, "full-axe.json");
const USE_PROCESS_GROUPS = process.platform !== "win32";
const WORKFLOW_SESSION_SECRET =
  process.env.WORKFLOW_SESSION_SECRET ??
  "browser-e2e-workflow-secret-only-for-local-ci-2026";
const BLOCKING_IMPACTS = new Set(["critical", "serious"]);
/** WCAG 2.1 A + AA — the Section 508 baseline the jsdom gate also uses. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const AXE_SOURCE = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
/**
 * Host colour-scheme contexts, matching the R-05 gate's `COLOR_SCHEME_PASSES`.
 * `light` is stated explicitly rather than left to the browser default, so the
 * baseline is deterministic; `dark-host` is the emulated OS/browser
 * preference. Both are applied through Playwright's `emulateMedia`, which drives
 * the same `prefers-color-scheme` media feature an operating-system preference
 * changes — not a CSS class (which would test the app's own theme switch) and
 * not a forced-dark launch flag (which would test one Chrome release).
 *
 * Each context is its own client (`clientIdentity`, an RFC 5737 documentation
 * address). The pages that reach upstream VA quota are bounded at 30 reads a
 * minute per client by `referenceReadLimiter`, and one client sweeping 26
 * routes twice — plus the prefetches those pages issue — exhausts that: the
 * sweep then records `HTTP 429` on `/va-forms/finder`, `/va-reference`,
 * `/va-reference/service-branches` and `/va-account`, which is the app's
 * throttling working, not an accessibility finding. A second client gives the
 * dark pass the same allowance the light pass has, instead of either measuring
 * under a half-spent budget or waiting a minute per route.
 */
const HOST_COLOR_SCHEMES = [
  {
    id: "light",
    media: "light",
    label: "light host",
    clientIdentity: "198.51.100.10",
  },
  {
    id: "dark-host",
    media: "dark",
    label: "dark host context",
    clientIdentity: "198.51.100.11",
  },
];
/** Deterministic critical rule the seeded control must reproduce. */
const SEEDED_CONTROL_RULE = "button-name";
const SEEDED_CONTROL_ID = "a11y-gate-seeded-control";
const SEEDED_CONTROL_SELECTOR = `#${SEEDED_CONTROL_ID}`;
/**
 * Deterministic sub-AA pair for the dark-host control: `#888` on `#777` is
 * about **1.26:1**, the same seed the R-05 gate uses. Explicit colours rather
 * than app tokens, so a palette regression cannot also move the control.
 */
const SEEDED_DARK_CONTRAST = {
  id: "a11y-gate-seeded-dark-contrast",
  text: "Seeded dark-host contrast control",
  color: "#888888",
  background: "#777777",
};
const WAIT_TIMEOUT_MS = 60_000;
const ROUTE_SELECTOR_TIMEOUT_MS = 30_000;
const children = [];
let browser;

function checkpoint(message) {
  console.log(`[a11y-full] ${message}`);
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

async function runScan(page) {
  return page.evaluate(async (tags) => {
    const results = await window.axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return {
      axeVersion: results.testEngine?.version ?? null,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? "unknown",
        help: violation.help,
        helpUrl: violation.helpUrl,
        tags: violation.tags,
        nodes: violation.nodes.map((node) => ({
          target: node.target.map(String),
          failureSummary: node.failureSummary ?? null,
          html: String(node.html ?? "").slice(0, 300),
        })),
      })),
    };
  }, AXE_TAGS);
}

/**
 * Build the failure report from raw findings. Extracted so the seeded control
 * and the real route scan decide through exactly the same code path: a
 * detector that fires but whose failure decision is broken would still let a
 * red finding through as a pass.
 */
/** Name a finding's host context only when it is the emulated one. */
const hostSuffix = (hostColorScheme) =>
  hostColorScheme === "dark-host" ? " (dark host)" : "";

function gateProblems({ auditedRouteCount, darkHostAuditedRouteCount = null, errors, blocking }) {
  const problems = [];
  if (errors.length > 0) {
    problems.push(
      `${errors.length} route(s) could not be audited:\n` +
        errors
          .map((error) => `  - ${error.route}${hostSuffix(error.hostColorScheme)}: ${error.message}`)
          .join("\n"),
    );
  }
  if (blocking.length > 0) {
    problems.push(
      `${blocking.length} serious/critical WCAG 2.1 A/AA violation(s):\n` +
        blocking
          .map(
            (violation) =>
              `  - ${violation.route}${hostSuffix(violation.hostColorScheme)}: ` +
              `[${violation.impact}] ${violation.id} ` +
              `(${violation.nodes.length} node(s)) — ${violation.help}\n` +
              `      first target: ${violation.nodes[0]?.target?.join(" ") ?? "unknown"}\n` +
              `      ${violation.nodes[0]?.failureSummary ?? ""}`.trimEnd(),
          )
          .join("\n"),
    );
  }
  if (auditedRouteCount === 0) {
    problems.push("no route was audited, so a clean report would be vacuous");
  }
  // `null` means this caller does not run a dark pass (the seeded control).
  if (darkHostAuditedRouteCount === 0) {
    problems.push(
      "no route was audited in the dark host context, so the dark control is vacuous",
    );
  }
  return problems;
}

/** The single throw path both the seeded control and the real scan exercise. */
function throwGateFailure(problems, evidenceFile) {
  if (problems.length === 0) return;
  throw new Error(
    `${problems.join("\n")}\naxe raw report: ${path.relative(process.cwd(), evidenceFile)}`,
  );
}

/**
 * Prove the dark-host pass can report a contrast failure. The emulation guard in
 * `auditRoute` shows the dark pass *is* dark; this shows that a dark scan which
 * is dark still detects broken contrast, and that a dark finding is labelled as
 * one in the failure message. Without it, a rule set that silently skipped
 * `color-contrast` under the emulation would leave 26 clean dark rows that prove
 * nothing. Returns the record rather than throwing, so the summary can be
 * written before the run decides.
 */
async function runSeededDarkContrastControl(axeSource) {
  checkpoint("seeding a sub-AA text pair under the dark host to prove that scan can go red");
  const darkHost = HOST_COLOR_SCHEMES.find((hostColorScheme) => hostColorScheme.id === "dark-host");
  if (!darkHost) throw new Error("the dark-host colour-scheme pass is not declared");
  const context = await browser.newContext({
    extraHTTPHeaders: { "X-Forwarded-For": darkHost.clientIdentity },
  });
  const page = await context.newPage();
  await page.addInitScript({ content: axeSource });
  const failures = [];

  try {
    await page.emulateMedia({ colorScheme: darkHost.media });
    const response = await page.goto(`${APP_BASE_URL}/`, {
      waitUntil: "domcontentloaded",
      timeout: WAIT_TIMEOUT_MS,
    });
    if (!response || !response.ok()) {
      throw new Error(
        `the seeded dark-host page returned HTTP ${response?.status() ?? "no response"}`,
      );
    }
    const reportedDark = await page.evaluate(
      () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    if (!reportedDark) {
      failures.push("the seeded contrast page did not report prefers-color-scheme: dark");
    }
    await page.waitForSelector("main h1", { timeout: ROUTE_SELECTOR_TIMEOUT_MS });

    // CSSOM property writes, not inline `style` attributes: the production
    // CSP's `style-src` nonce would refuse the latter (as the R-05 seed notes).
    await page.evaluate((seed) => {
      document.getElementById(seed.id)?.remove();
      const element = document.createElement("p");
      element.id = seed.id;
      element.textContent = seed.text;
      element.style.setProperty("color", seed.color, "important");
      element.style.setProperty("background-color", seed.background, "important");
      element.style.setProperty("font-size", "16px", "important");
      element.style.setProperty("padding", "12px", "important");
      document.body.appendChild(element);
    }, SEEDED_DARK_CONTRAST);

    const results = await runScan(page);
    const blocking = results.violations.filter((violation) =>
      BLOCKING_IMPACTS.has(violation.impact),
    );
    const detected =
      blocking.find(
        (violation) =>
          violation.id === "color-contrast" &&
          violation.nodes.some((node) => node.target.join(" ").includes(SEEDED_DARK_CONTRAST.id)),
      ) ?? null;
    if (!detected) {
      failures.push(
        `axe did not report color-contrast for #${SEEDED_DARK_CONTRAST.id} under the dark host, ` +
          "so a clean dark result cannot be trusted",
      );
    }

    let failurePathExercised = false;
    if (detected) {
      const problems = gateProblems({
        auditedRouteCount: ROUTES.length,
        errors: [],
        blocking: [{ route: "/", hostColorScheme: "dark-host", ...detected }],
      });
      try {
        throwGateFailure(problems, EVIDENCE_FILE);
      } catch (error) {
        // Including the label: a dark finding that reports as a light one would
        // make the failure message point at the wrong pass.
        failurePathExercised = error instanceof Error && error.message.includes("(dark host)");
      }
      if (!failurePathExercised) {
        failures.push(
          "the gate detected the seeded dark-host contrast violation but its failure path did not name it as a dark-host finding",
        );
      }
    }

    return {
      rule: "color-contrast",
      seededElement: `<p id="${SEEDED_DARK_CONTRAST.id}">${SEEDED_DARK_CONTRAST.text}</p>`,
      seededColors: { foreground: SEEDED_DARK_CONTRAST.color, background: SEEDED_DARK_CONTRAST.background },
      prefersColorScheme: "dark",
      reportedDark,
      detected: detected
        ? { id: detected.id, impact: detected.impact, targets: detected.nodes.flatMap((node) => node.target) }
        : null,
      blockingViolations: blocking.length,
      failurePathExercised,
      passes: results.passes,
      incomplete: results.incomplete,
      passed: failures.length === 0,
      failures,
    };
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Seed one deterministic critical violation on a scratch page and require the
 * gate to detect it and to fail on it. Runs before the route scan so a broken
 * axe injection, rule set, impact filter or failure path stops the run early
 * instead of producing a green report nothing can trust. The seed lives on its
 * own page and never touches route findings. The dark-host contrast seed runs
 * inside this control, so the same early-abort applies to the dark pass.
 */
async function runSeededControl(axeSource, evidenceFile) {
  checkpoint(`seeding an unlabeled <button> to prove the scan can go red`);
  const page = await browser.newPage();
  await page.addInitScript({ content: axeSource });

  try {
    const response = await page.goto(`${APP_BASE_URL}/`, {
      waitUntil: "domcontentloaded",
      timeout: WAIT_TIMEOUT_MS,
    });
    if (!response || !response.ok()) {
      throw new Error(
        `the seeded-control page returned HTTP ${response?.status() ?? "no response"}`,
      );
    }
    await page.waitForSelector("main h1", { timeout: ROUTE_SELECTOR_TIMEOUT_MS });

    await page.evaluate((id) => {
      const button = document.createElement("button");
      button.id = id;
      document.body.appendChild(button);
    }, SEEDED_CONTROL_ID);

    const results = await runScan(page);
    const blocking = results.violations.filter((violation) =>
      BLOCKING_IMPACTS.has(violation.impact),
    );
    const detected = blocking.find((violation) => violation.id === SEEDED_CONTROL_RULE) ?? null;

    const failures = [];
    if (!detected) {
      failures.push(
        `axe did not report ${SEEDED_CONTROL_RULE} for ${SEEDED_CONTROL_SELECTOR}, ` +
          "so a clean route result cannot be trusted",
      );
    }

    let failurePathExercised = false;
    if (detected) {
      const problems = gateProblems({
        auditedRouteCount: ROUTES.length,
        errors: [],
        blocking,
      });
      try {
        throwGateFailure(problems, evidenceFile);
      } catch (error) {
        failurePathExercised =
          error instanceof Error && error.message.includes(SEEDED_CONTROL_RULE);
      }
      if (!failurePathExercised) {
        failures.push(
          "the gate detected the seeded violation but its failure path did not go red",
        );
      }
    }

    const darkHostContrast = await runSeededDarkContrastControl(axeSource);
    failures.push(...darkHostContrast.failures);

    return {
      rule: SEEDED_CONTROL_RULE,
      seededElement: `<button id="${SEEDED_CONTROL_ID}"></button>`,
      detected: detected
        ? {
            id: detected.id,
            impact: detected.impact,
            targets: detected.nodes.flatMap((node) => node.target.map(String)),
          }
        : null,
      blockingViolations: blocking.length,
      failurePathExercised,
      passes: results.passes,
      incomplete: results.incomplete,
      darkHostContrast,
      passed: failures.length === 0,
      failures,
    };
  } finally {
    await page.close();
  }
}

function readBundledDemoScenarios() {
  const scenarios = JSON.parse(fs.readFileSync(DEMO_SCENARIOS, "utf8"));
  if (!Array.isArray(scenarios) || scenarios.length < 1) {
    throw new Error(`${DEMO_SCENARIOS} holds no scenarios, so there is no demo content to expect`);
  }
  return scenarios.length;
}

async function auditRoute(page, route, expectedDemoCards, hostColorScheme) {
  const host = hostSuffix(hostColorScheme.id);
  checkpoint(`opening ${route.path} (${route.label})${host}`);
  // Emulated before the navigation, so the first paint is already measured in
  // the host context under test rather than repainting into it mid-scan.
  await page.emulateMedia({ colorScheme: hostColorScheme.media });
  const response = await page.goto(`${APP_BASE_URL}${route.path}`, {
    waitUntil: "domcontentloaded",
    timeout: WAIT_TIMEOUT_MS,
  });
  if (!response || !response.ok()) {
    throw new Error(
      `${route.path}${host} returned HTTP ${response?.status() ?? "no response"} — cannot scan the route`,
    );
  }

  // Checked on the page under test, not on `about:blank`: the emulation has to
  // have survived the navigation for the dark pass to be a dark pass at all.
  const reportedDark = await page.evaluate(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  if (reportedDark !== (hostColorScheme.media === "dark")) {
    throw new Error(
      `${route.path}${host}: the browser did not adopt the emulated preference ` +
        `(prefers-color-scheme: dark reported ${reportedDark}); a dark pass that ` +
        "silently stays light would pass for the wrong reason",
    );
  }

  await page.waitForSelector("main h1", { timeout: ROUTE_SELECTOR_TIMEOUT_MS });
  const heading = (await page.locator("main h1").innerText()).trim();
  // Recorded, not asserted: the palette is intentionally light-only, so a dark
  // host must not be able to flip it. Evidence shows what the page declared.
  const documentColorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );

  let scenarioCards = null;
  if (route.path === DEMO_ROUTE) {
    if (heading !== DEMO_HEADING) {
      throw new Error(
        `${route.path} rendered heading ${JSON.stringify(heading)} instead of ${JSON.stringify(DEMO_HEADING)}`,
      );
    }
    scenarioCards = await page.locator("main article").count();
    if (scenarioCards !== expectedDemoCards) {
      throw new Error(
        `${route.path} rendered ${scenarioCards} scenario card(s) but the bundle holds ${expectedDemoCards}; ` +
          "the demo content did not fully render, so refusing to record a clean scan",
      );
    }
  }

  // Text metrics and colours must be final before axe measures contrast.
  await page.evaluate(() => document.fonts.ready);

  const results = await runScan(page);
  if (!results.axeVersion) {
    throw new Error(
      `${route.path}${host}: axe did not report its version, so the scan is not attributable`,
    );
  }
  if (results.passes + results.incomplete + results.violations.length === 0) {
    throw new Error(`${route.path}${host}: axe inspected nothing; a vacuous scan is not a pass`);
  }

  const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact));
  return {
    route: route.path,
    label: route.label,
    hostColorScheme: hostColorScheme.id,
    reportedDark,
    documentColorScheme,
    heading,
    scenarioCards,
    axeVersion: results.axeVersion,
    tags: AXE_TAGS,
    passes: results.passes,
    incomplete: results.incomplete,
    inapplicable: results.inapplicable,
    violations: results.violations,
    blockingViolations: blocking.length,
  };
}

/**
 * Audit every route in every host context. The light result is the row's own
 * fields; the dark result is nested under `darkHost` so one route's evidence
 * stays together. A route whose light scan fails is not re-scanned dark — there
 * is no baseline to compare it against — and a dark failure never discards the
 * light result that was already recorded.
 *
 * `pages` is keyed by host context: each context is a separate client with its
 * own rate-limit allowance, so the two sweeps do not spend one budget.
 */
async function auditAllRoutes(pages, expectedDemoCards) {
  const routes = [];
  const errors = [];

  for (const route of ROUTES) {
    const result = {};
    for (const hostColorScheme of HOST_COLOR_SCHEMES) {
      try {
        const audited = await auditRoute(
          pages[hostColorScheme.id],
          route,
          expectedDemoCards,
          hostColorScheme,
        );
        checkpoint(
          `${audited.route}${hostSuffix(hostColorScheme.id)}: passes=${audited.passes}, ` +
            `incomplete=${audited.incomplete}, violations=${audited.violations.length}, ` +
            `blocking=${audited.blockingViolations}`,
        );
        if (hostColorScheme.id === "light") {
          Object.assign(result, audited);
        } else {
          result.darkHost = {
            reportedDark: audited.reportedDark,
            documentColorScheme: audited.documentColorScheme,
            heading: audited.heading,
            passes: audited.passes,
            incomplete: audited.incomplete,
            inapplicable: audited.inapplicable,
            axeVersion: audited.axeVersion,
            violations: audited.violations,
            blockingViolations: audited.blockingViolations,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ route: route.path, hostColorScheme: hostColorScheme.id, message });
        console.error(
          `[a11y-full] ${route.path}${hostSuffix(hostColorScheme.id)}: ${message}`,
        );
        // No light result means no baseline: skip this route's dark pass.
        if (hostColorScheme.id === "light") break;
      }
    }
    if (result.route) routes.push(result);
  }

  return { routes, errors };
}

async function auditEveryRoute() {
  const expectedDemoCards = readBundledDemoScenarios();
  const axeSource = fs.readFileSync(AXE_SOURCE, "utf8");
  const launchOptions =
    process.env.A11Y_FULL_BROWSER === "chromium"
      ? {}
      : { channel: process.env.A11Y_FULL_BROWSER ?? "chrome" };
  browser = await chromium.launch({ headless: true, ...launchOptions });

  // One context per host context: `extraHTTPHeaders` is per context, and a
  // distinct client identity keeps each sweep inside its own rate-limit budget.
  const pages = {};
  for (const hostColorScheme of HOST_COLOR_SCHEMES) {
    const context = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": hostColorScheme.clientIdentity },
    });
    const page = await context.newPage();
    // CDP-injected source: not a DOM script sink, so the Trusted Types policy
    // never sees it and no CSP relaxation is needed.
    await page.addInitScript({ content: axeSource });
    pages[hostColorScheme.id] = page;
  }

  let seededControl;
  try {
    seededControl = await runSeededControl(axeSource, EVIDENCE_FILE);
    checkpoint(
      seededControl.passed
        ? `${SEEDED_CONTROL_RULE} detected on the seeded control and the failure path fired; ` +
            "the dark-host contrast seed was detected and named as a dark-host finding"
        : `seeded control failed: ${seededControl.failures.join("; ")}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    seededControl = {
      rule: SEEDED_CONTROL_RULE,
      detected: null,
      failurePathExercised: false,
      passes: 0,
      incomplete: 0,
      blockingViolations: 0,
      darkHostContrast: null,
      passed: false,
      failures: [message],
    };
    console.error(`[a11y-full] seeded-violation control: ${message}`);
  }

  checkpoint(`auditing ${ROUTES.length} route(s) in ${HOST_COLOR_SCHEMES.length} host context(s)`);
  const { routes, errors } = await auditAllRoutes(pages, expectedDemoCards);

  const allViolations = routes.flatMap((result) =>
    result.violations.map((violation) => ({ route: result.route, ...violation })),
  );
  const darkHostRoutes = routes.filter((result) => result.darkHost);
  const darkHostViolations = darkHostRoutes.flatMap((result) =>
    result.darkHost.violations.map((violation) => ({
      route: result.route,
      hostColorScheme: "dark-host",
      ...violation,
    })),
  );
  const lightBlocking = allViolations.filter((violation) =>
    BLOCKING_IMPACTS.has(violation.impact),
  );
  const darkHostBlocking = darkHostViolations.filter((violation) =>
    BLOCKING_IMPACTS.has(violation.impact),
  );
  const blocking = [...lightBlocking, ...darkHostBlocking];
  const evidence = {
    generatedAt: new Date().toISOString(),
    gate: "a11y-full",
    routeCount: ROUTES.length,
    auditedRouteCount: routes.length,
    hostColorSchemes: HOST_COLOR_SCHEMES.map((hostColorScheme) => ({
      id: hostColorScheme.id,
      prefersColorScheme: hostColorScheme.media,
      clientIdentity: hostColorScheme.clientIdentity,
    })),
    browser: {
      name: browser.browserType().name(),
      version: browser.version(),
    },
    axeVersion: routes[0]?.axeVersion ?? null,
    tags: AXE_TAGS,
    blockingImpacts: [...BLOCKING_IMPACTS],
    seededControl,
    totals: {
      passes: routes.reduce((sum, result) => sum + result.passes, 0),
      incomplete: routes.reduce((sum, result) => sum + result.incomplete, 0),
      violations: allViolations.length,
      blockingViolations: lightBlocking.length,
      errors: errors.length,
      darkHost: {
        auditedRouteCount: darkHostRoutes.length,
        passes: darkHostRoutes.reduce((sum, result) => sum + result.darkHost.passes, 0),
        incomplete: darkHostRoutes.reduce((sum, result) => sum + result.darkHost.incomplete, 0),
        violations: darkHostViolations.length,
        blockingViolations: darkHostBlocking.length,
      },
    },
    routes,
    violations: allViolations,
    darkHostViolations,
    blockingViolations: blocking,
    errors,
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2), "utf8");

  checkpoint(
    `${routes.length}/${ROUTES.length} route(s) audited; ` +
      `passes=${evidence.totals.passes}, incomplete=${evidence.totals.incomplete}, ` +
      `violations=${evidence.totals.violations}, blocking=${evidence.totals.blockingViolations}, ` +
      `dark-host routes=${evidence.totals.darkHost.auditedRouteCount}, ` +
      `dark-host violations=${evidence.totals.darkHost.violations}, ` +
      `dark-host blocking=${evidence.totals.darkHost.blockingViolations}, ` +
      `errors=${errors.length} (${path.relative(process.cwd(), EVIDENCE_FILE)})`,
  );

  const problems = gateProblems({
    auditedRouteCount: routes.length,
    darkHostAuditedRouteCount: darkHostRoutes.length,
    errors,
    blocking,
  });
  if (!seededControl.passed) {
    problems.push(
      `seeded-violation control failed, so the scan has not been shown to fail:\n` +
        seededControl.failures.map((failure) => `  - ${failure}`).join("\n"),
    );
  }
  throwGateFailure(problems, EVIDENCE_FILE);
}

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
  if (!fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) {
    throw new Error(
      "no production build found (.next/BUILD_ID is missing); run `npm run build` before the full-route a11y gate",
    );
  }

  const nextExecutable = path.join(process.cwd(), "node_modules", ".bin", "next");
  const nextServer = logProcess(
    "next",
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

  await waitForHttp(`${APP_BASE_URL}/`, "Next.js full-route a11y server");
  await auditEveryRoute();
}

try {
  await main();
} catch (error) {
  console.error(
    `[a11y-full] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await cleanup();
}
