import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Presumptive-track E2E journey (real Chrome via ChromeDriver).
// Covers: template pre-fill → submit → results → the Phase 4 item C
// presumptive × secondary research-cue panel. Mirrors the harness in
// e2e/secondary-workflow.mjs (standalone script, duplicated helpers by design).

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3101);
const DRIVER_PORT = Number(process.env.E2E_DRIVER_PORT ?? 9516);
const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const DRIVER_BASE_URL = `http://127.0.0.1:${DRIVER_PORT}`;
const WAIT_TIMEOUT_MS = 30_000;
const WEBDRIVER_COMMAND_TIMEOUT_MS = 15_000;
const WEBDRIVER_SESSION_TIMEOUT_MS = 30_000;
const WEBDRIVER_SESSION_ATTEMPTS = 2;
const WEBDRIVER_SESSION_RETRY_DELAY_MS = 1_000;
const USE_PROCESS_GROUPS = process.platform !== "win32";
const WORKFLOW_SESSION_SECRET =
  process.env.WORKFLOW_SESSION_SECRET ??
  "browser-e2e-workflow-secret-only-for-local-ci-2026";

// Agent Orange template (Vietnam window) drives the pre-fill; the Agent Orange
// category is the expected match on the results page.
const TEMPLATE_BUTTON_ARIA = "Apply template Agent Orange — Republic of Vietnam (Jan 1962 – May 1975)";
const LOCATION_VALUE = "Republic of Vietnam";
const START_DATE = "1962-01-09";
const END_DATE = "1975-05-07";
const CATEGORY_NAME = "Agent Orange and other herbicides";
const CROSS_LINK_HEADING = "Also researchable in the secondary track";
const children = [];
let sessionId;

function checkpoint(message) {
  console.log(`[journey] ${message}`);
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
    } else {
      child.kill(signal);
    }
  } catch {
    // Process may already have exited.
  }
}

async function terminateProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  const signal = USE_PROCESS_GROUPS ? "SIGTERM" : "SIGTERM";
  sendProcessTreeSignal(child, signal);
  const deadline = Date.now() + 5_000;
  while (child.exitCode === null && Date.now() < deadline) {
    await delay(100);
  }
  if (child.exitCode === null) {
    sendProcessTreeSignal(child, "SIGKILL");
    await delay(200);
  }
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
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${label} did not become reachable: ${lastError?.message ?? "timeout"}`);
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
  let lastError;
  for (let attempt = 1; attempt <= WEBDRIVER_SESSION_ATTEMPTS; attempt += 1) {
    try {
      return await webdriver(
        "POST",
        "/session",
        {
          capabilities: {
            alwaysMatch: {
              browserName: "chrome",
              "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] },
            },
          },
        },
        WEBDRIVER_SESSION_TIMEOUT_MS,
      );
    } catch (error) {
      lastError = error;
      if (!isTransientSessionTransportError(error)) throw error;
      console.error(`[journey] transient WebDriver session failure (attempt ${attempt}): ${error.message}`);
      await delay(WEBDRIVER_SESSION_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

async function findByXpath(xpath, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const element = await webdriver("POST", `/session/${sessionId}/element`, {
        using: "xpath",
        value: xpath,
      });
      if (element?.[ELEMENT_KEY]) return element[ELEMENT_KEY];
    } catch (error) {
      lastError = error;
    }
    await delay(200);
  }
  throw new Error(`Element not found for XPath ${xpath}: ${lastError?.message ?? "timeout"}`);
}

async function clickXpath(xpath) {
  const elementId = await findByXpath(xpath);
  await webdriver("POST", `/session/${sessionId}/element/${elementId}/click`, {});
}

async function isSelected(xpath) {
  const elementId = await findByXpath(xpath);
  return webdriver("GET", `/session/${sessionId}/element/${elementId}/selected`);
}

async function waitForSelected(xpath, desired, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await isSelected(xpath);
    if (last === desired) return;
    await delay(200);
  }
  throw new Error(`Element ${xpath} selection never became ${desired}; last=${last}`);
}

async function waitForPath(pathname) {
  const deadline = Date.now() + 15_000;
  let lastUrl = "";
  while (Date.now() < deadline) {
    lastUrl = await webdriver("GET", `/session/${sessionId}/url`);
    if (new URL(lastUrl).pathname === pathname) return;
    await delay(200);
  }
  throw new Error(`Expected browser path ${pathname}, received ${lastUrl}`);
}

async function bodyText() {
  const body = await findByXpath("//body");
  return webdriver("GET", `/session/${sessionId}/element/${body}/text`);
}

async function waitForText(needle, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await bodyText();
    if (text.includes(needle)) return;
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${label} to render text: ${needle}`);
}

async function readNamedInputValue(name) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      const input = document.querySelector('input[name="' + arguments[0] + '"]');
      return input ? input.value : null;
    `,
    args: [name],
  });
}

async function runJourney() {
  checkpoint("open home");
  await webdriver("POST", `/session/${sessionId}/url`, { url: APP_BASE_URL });
  await waitForText("Check Presumptive Conditions", "home page");
  checkpoint("home rendered");

  await clickXpath("//a[contains(normalize-space(.), 'Check Presumptive Conditions')]");
  await waitForPath("/presumptive");
  await waitForText("Where did you serve?", "presumptive intake form");
  checkpoint("reached presumptive intake");

  // Quick-start template pre-fill: the applier simulates clicks on the
  // controlled location checkboxes and sets the date inputs directly.
  await clickXpath(`//button[@aria-label='${TEMPLATE_BUTTON_ARIA}']`);
  const locationBox = `//input[@name='location' and @value='${LOCATION_VALUE}']`;
  await waitForSelected(locationBox, true);
  const startValue = await readNamedInputValue("serviceStart");
  const endValue = await readNamedInputValue("serviceEnd");
  if (startValue !== START_DATE || endValue !== END_DATE) {
    throw new Error(`Template pre-fill failed: start=${startValue} end=${endValue}`);
  }
  checkpoint("template pre-filled locations and dates");

  await clickXpath("//button[contains(normalize-space(.), 'Show presumptive conditions')]");
  await waitForPath("/presumptive/results");
  checkpoint("reached presumptive results");

  await waitForText(CATEGORY_NAME, "matched category");
  const results = await bodyText();

  const expected = [
    CATEGORY_NAME,
    "Republic of Vietnam",
    "January 9, 1962 to May 7, 1975",
    "This is not an eligibility decision",
  ];
  for (const phrase of expected) {
    if (!results.includes(phrase)) {
      throw new Error(`Results page is missing expected browser-visible text: ${phrase}`);
    }
  }
  checkpoint("matched Agent Orange category with confirmed dates");

  // Phase 4 item C: the presumptive × secondary research-cue panel.
  // The Agent Orange list intersects published KB secondary targets
  // (e.g. ischemic heart disease, type 2 diabetes) — real data, so the
  // panel must render with the track-separation caveat.
  await waitForText(CROSS_LINK_HEADING, "presumptive × secondary cross-link panel");
  const withPanel = await bodyText();
  for (const phrase of [
    CROSS_LINK_HEADING,
    "secondary of",
    "research cue only, not a determination",
  ]) {
    if (!withPanel.includes(phrase)) {
      throw new Error(`Cross-link panel is missing expected text: ${phrase}`);
    }
  }
  if (!withPanel.includes("/secondary/condition-caused-by")) {
    checkpoint("panel link present (href checked via DOM)");
  }
  const linkElement = await findByXpath(`//a[contains(@href, '/secondary/condition-caused-by')]`);
  if (!linkElement) throw new Error("Cross-link panel link to the secondary track is missing.");
  checkpoint("presumptive × secondary research-cue panel renders with link");

  // Track separation sanity: navigating to the linked secondary entry route
  // works as a clean route with no state transfer.
  await clickXpath(`//a[contains(@href, '/secondary/condition-caused-by')]`);
  await waitForPath("/secondary/condition-caused-by");
  await waitForText("Caused By", "secondary entry page");
  checkpoint("cross-track navigation lands on the secondary entry route");
}

async function cleanup() {
  if (sessionId) {
    try {
      await webdriver("DELETE", `/session/${sessionId}`, undefined, 5_000);
    } catch {
      // Session may already be gone.
    }
    sessionId = undefined;
  }
  for (const child of children) {
    await terminateProcessTree(child);
  }
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
    waitForHttp(APP_BASE_URL, "Next.js E2E server"),
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
