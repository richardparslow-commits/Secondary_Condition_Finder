import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
const APP_PORT = Number(process.env.VALIDATION_E2E_APP_PORT ?? 3200);
const DRIVER_PORT = Number(process.env.VALIDATION_E2E_DRIVER_PORT ?? 9615);
const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const DRIVER_BASE_URL = `http://127.0.0.1:${DRIVER_PORT}`;
const COMMAND_TIMEOUT_MS = 15_000;
const SESSION_TIMEOUT_MS = 30_000;
const USE_PROCESS_GROUPS = process.platform !== "win32";
const children = [];
let sessionId;

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

async function terminateProcessTree(child) {
  sendProcessTreeSignal(child, "SIGTERM");
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
          args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=390,844"],
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

async function findAllByXpath(xpath) {
  const elements = await webdriver("POST", `/session/${sessionId}/elements`, {
    using: "xpath",
    value: xpath,
  });
  return elements.map((element) => element[ELEMENT_KEY]).filter(Boolean);
}

async function clickElement(elementId) {
  await webdriver("POST", `/session/${sessionId}/element/${elementId}/click`, {});
}

async function clickXpath(xpath) {
  await clickElement(await findByXpath(xpath));
}

async function isSelected(elementId) {
  return Boolean(await webdriver("GET", `/session/${sessionId}/element/${elementId}/selected`));
}

async function setInputValue(xpath, value) {
  const elementId = await findByXpath(xpath);
  const actual = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      const input = arguments[0];
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, arguments[1]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value;
    `,
    args: [{ [ELEMENT_KEY]: elementId }, value],
  });
  if (actual !== value) throw new Error(`Expected input value ${value}, received ${actual}`);
}

async function setSelectValue(elementId, value) {
  const actual = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      const select = arguments[0];
      select.value = arguments[1];
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value;
    `,
    args: [{ [ELEMENT_KEY]: elementId }, value],
  });
  if (actual !== value) throw new Error(`Expected select value ${value}, received ${actual}`);
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

async function waitForAlertContaining(text) {
  await findByXpath(`//*[@role='alert' and contains(normalize-space(.), ${JSON.stringify(text)})]`, 15_000);
}

async function expectStaticErrorUrl(pathname, code) {
  const url = await currentUrl();
  const keys = [...url.searchParams.keys()];
  if (
    url.pathname !== pathname ||
    keys.length !== 1 ||
    keys[0] !== "error" ||
    url.searchParams.get("error") !== code
  ) {
    throw new Error(`Expected ${pathname}?error=${code}; received ${url.pathname}${url.search}`);
  }
}

async function assertNoHorizontalOverflow(label) {
  const metrics = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      const root = document.documentElement;
      const body = document.body;
      return {
        clientWidth: root.clientWidth,
        scrollWidth: Math.max(root.scrollWidth, body ? body.scrollWidth : 0),
      };
    `,
    args: [],
  });
  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(`${label} has horizontal overflow at mobile viewport: ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
  }
}

async function runJourney() {
  await webdriver("POST", `/session/${sessionId}/url`, { url: `${APP_BASE_URL}/secondary/diagnosed` });
  await waitForPath("/secondary/diagnosed");
  await assertNoHorizontalOverflow("Step 1 diagnosed");

  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 2')]");
  await waitForAlertContaining("Select at least one diagnosed condition to continue.");
  await expectStaticErrorUrl("/secondary/diagnosed", "select-diagnosed");

  const diagnosed = await findAllByXpath("//input[@name='diagnosed' and @type='checkbox']");
  if (diagnosed.length < 2) throw new Error("Expected at least two selectable conditions in the fixture catalog.");
  await clickElement(diagnosed[0]);
  await clickElement(diagnosed[1]);
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 2')]");
  await waitForPath("/secondary/service-connected");
  await assertNoHorizontalOverflow("Step 2 service-connected");

  const radios = await findAllByXpath("//input[starts-with(@name, 'serviceConnected-') and @type='radio']");
  if (radios.length < 4) throw new Error("Expected Yes/No radio groups for selected conditions.");
  for (const radio of radios) {
    if (await isSelected(radio)) {
      throw new Error("A service-connected answer was selected before explicit user input.");
    }
  }

  const noAnswers = await findAllByXpath("//input[starts-with(@name, 'serviceConnected-') and @value='no']");
  if (noAnswers.length < 2) throw new Error("Expected at least two No choices on Step 2.");
  await clickElement(noAnswers[0]);
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 3')]");
  await waitForAlertContaining("Choose Yes or No for every diagnosed condition before continuing.");
  await expectStaticErrorUrl("/secondary/service-connected", "answer-service-connected");
  await assertNoHorizontalOverflow("Step 2 incomplete validation state");

  const noAnswersAfterIncomplete = await findAllByXpath("//input[starts-with(@name, 'serviceConnected-') and @value='no']");
  if (!(await isSelected(noAnswersAfterIncomplete[0]))) {
    throw new Error("Step 2 did not preserve the completed No answer after validation.");
  }
  for (let index = 1; index < noAnswersAfterIncomplete.length; index += 1) {
    await clickElement(noAnswersAfterIncomplete[index]);
  }
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 3')]");
  await waitForAlertContaining("needs at least one condition already recognized as service connected");
  await expectStaticErrorUrl("/secondary/service-connected", "no-service-connected");
  await assertNoHorizontalOverflow("Step 2 validation state");

  const yesAnswersAfterError = await findAllByXpath("//input[starts-with(@name, 'serviceConnected-') and @value='yes']");
  if (yesAnswersAfterError.length < 1) throw new Error("Expected a service-connected Yes choice after validation.");
  await clickElement(yesAnswersAfterError[0]);
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 3')]");
  await waitForPath("/secondary/ratings");
  await assertNoHorizontalOverflow("Step 3 ratings");

  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 4')]");
  await waitForAlertContaining("Choose a current rating or I prefer not to answer for every service-connected condition.");
  await expectStaticErrorUrl("/secondary/ratings", "select-rating");
  await assertNoHorizontalOverflow("Step 3 validation state");

  const ratingSelects = await findAllByXpath("//select[starts-with(@name, 'rating-')]");
  if (ratingSelects.length < 1) throw new Error("Expected at least one rating choice on Step 3.");
  for (const select of ratingSelects) await setSelectValue(select, "decline");
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 4')]");
  await waitForPath("/secondary/upload");
  await assertNoHorizontalOverflow("Step 4 documents");

  await clickXpath("//button[contains(normalize-space(.), 'View Suggestions')]");
  await waitForPath("/secondary/suggestions");
  await assertNoHorizontalOverflow("Step 5 suggestions");

  await clickXpath("//a[contains(normalize-space(.), 'Open Evidence Checklist')]");
  await waitForPath("/secondary/evidence");
  await assertNoHorizontalOverflow("Step 6 evidence");
  await findByXpath("//h1[contains(normalize-space(.), 'Evidence & Research Checklist')]");

  await webdriver("POST", `/session/${sessionId}/url`, { url: `${APP_BASE_URL}/presumptive` });
  await waitForPath("/presumptive");
  await assertNoHorizontalOverflow("Presumptive form");
  await clickXpath("(//input[@name='location' and @type='checkbox'])[1]");
  await setInputValue("//input[@name='serviceStart']", "2020-01-02");
  await setInputValue("//input[@name='serviceEnd']", "2020-01-01");
  await clickXpath("//button[contains(normalize-space(.), 'Show presumptive conditions')]");
  await waitForAlertContaining("Service start date must be on or before the end date.");
  await expectStaticErrorUrl("/presumptive", "date-order");
  await assertNoHorizontalOverflow("Presumptive validation state");

  console.log("Validation E2E passed at mobile viewport: accessible alerts, preserved partial Step 2 answers, six-step Secondary progression, no horizontal overflow, neutral explicit answers, and static-error privacy URLs.");
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
    "validation-next",
    spawn(nextExecutable, ["dev", "-H", "127.0.0.1", "-p", String(APP_PORT)], {
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
    "validation-chromedriver",
    spawn(resolveChromeDriver(), [`--port=${DRIVER_PORT}`], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: USE_PROCESS_GROUPS,
    }),
  );

  if (!nextServer.pid || !chromeDriver.pid) throw new Error("Unable to start validation browser services.");
  await Promise.all([
    waitForHttp(APP_BASE_URL, "validation Next.js server"),
    waitForHttp(`${DRIVER_BASE_URL}/status`, "validation ChromeDriver"),
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
