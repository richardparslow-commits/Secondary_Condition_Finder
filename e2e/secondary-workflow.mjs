import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100);
const DRIVER_PORT = Number(process.env.E2E_DRIVER_PORT ?? 9515);
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

const PRIMARY_CONDITION = "Post-Traumatic Stress Disorder (PTSD)";
const DIAGNOSED_SECONDARY = "Sleep Apnea (Obstructive, Central, Mixed)";
const PATHWAY_CHECKLIST_STORAGE_KEY = "secondary-condition-finder:pathway-record-checklist:v1";
const PATHWAY_CHECKBOX_XPATH =
  "//input[@type='checkbox'][starts-with(@aria-label, 'Post-Traumatic Stress Disorder (PTSD) to Sleep Apnea (Obstructive, Central, Mixed):')]";
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
  // A timed-out ChromeDriver session request can leave a Chrome grandchild alive.
  // Kill the full detached process group so inherited stdio cannot keep this
  // harness open after the browser journey itself has already completed.
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
      return await webdriver(
        "POST",
        "/session",
        request,
        WEBDRIVER_SESSION_TIMEOUT_MS,
      );
    } catch (error) {
      lastError = error;
      if (!isTransientSessionTransportError(error) || attempt === WEBDRIVER_SESSION_ATTEMPTS) {
        throw error;
      }

      checkpoint(
        `Chrome session startup transport failed on attempt ${attempt}/${WEBDRIVER_SESSION_ATTEMPTS}; retrying once`,
      );
      await delay(WEBDRIVER_SESSION_RETRY_DELAY_MS);
      await waitForHttp(`${DRIVER_BASE_URL}/status`, "ChromeDriver after session-start retry");
    }
  }

  throw lastError ?? new Error("ChromeDriver session creation failed without an error.");
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

async function setSelected(xpath, desired) {
  const elementId = await findByXpath(xpath);
  const selected = await webdriver(
    "GET",
    `/session/${sessionId}/element/${elementId}/selected`,
  );
  if (Boolean(selected) !== desired) {
    await webdriver("POST", `/session/${sessionId}/element/${elementId}/click`, {});
  }
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

async function isSelected(xpath) {
  const elementId = await findByXpath(xpath);
  return webdriver("GET", `/session/${sessionId}/element/${elementId}/selected`);
}

async function readSessionStorage(key) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: "return window.sessionStorage.getItem(arguments[0]);",
    args: [key],
  });
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

async function selectPrimaryRating(value) {
  const selectId = await findByXpath(
    `//label[contains(normalize-space(.), 'Rating for ${PRIMARY_CONDITION}')]/following-sibling::select`,
  );
  const selectedValue = await webdriver(
    "POST",
    `/session/${sessionId}/execute/sync`,
    {
      script: `
        const select = arguments[0];
        select.value = arguments[1];
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return select.value;
      `,
      args: [{ [ELEMENT_KEY]: selectId }, value],
    },
  );
  if (selectedValue !== value) {
    throw new Error(`Unable to select rating ${value}; browser reported ${selectedValue}`);
  }
}

async function runJourney() {
  checkpoint("open home");
  await webdriver("POST", `/session/${sessionId}/url`, { url: APP_BASE_URL });
  await clickXpath("//a[contains(normalize-space(.), 'Proceed to Wizard Step 1')]");
  await waitForPath("/secondary");
  checkpoint("reached secondary landing");

  await clickXpath("//a[@href='/secondary/diagnosed']");
  await waitForPath("/secondary/diagnosed");
  checkpoint("reached diagnosed conditions");

  await setSelected(
    `//label[contains(normalize-space(.), '${PRIMARY_CONDITION}')]//input[@type='checkbox']`,
    true,
  );
  await setSelected(
    `//label[contains(normalize-space(.), '${DIAGNOSED_SECONDARY}')]//input[@type='checkbox']`,
    true,
  );
  checkpoint("selected diagnosed fixture conditions");
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 2')]");
  await waitForPath("/secondary/service-connected");
  checkpoint("reached service-connected status");

  await setSelected(
    `//fieldset[.//legend[contains(normalize-space(.), '${PRIMARY_CONDITION}')]]//input[@value='yes']`,
    true,
  );
  await setSelected(
    `//fieldset[.//legend[contains(normalize-space(.), '${DIAGNOSED_SECONDARY}')]]//input[@value='no']`,
    true,
  );
  checkpoint("set service-connected fixture status");
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 3')]");
  await waitForPath("/secondary/ratings");
  checkpoint("reached ratings");

  await selectPrimaryRating("70");
  await clickXpath("//button[contains(normalize-space(.), 'Continue to Step 4')]");
  await waitForPath("/secondary/upload");
  checkpoint("reached document choice");

  await setSelected("//input[@name='documentsShared' and @value='no']", true);
  await clickXpath("//button[contains(normalize-space(.), 'Review Possible Connections')]");
  await waitForPath("/secondary/suggestions");
  checkpoint("reached diagnosis-centered connection review");

  const text = await bodyText();
  const expected = [
    "Review Your Non-Service-Connected Diagnoses",
    "Possible Connections to Review",
    "Diagnosed, not service connected",
    "Already service connected",
    PRIMARY_CONDITION,
    DIAGNOSED_SECONDARY,
  ];
  for (const phrase of expected) {
    if (!text.includes(phrase)) {
      throw new Error(`Connection review page is missing expected browser-visible text: ${phrase}`);
    }
  }
  if (text.includes("Published Secondary Pathways")) {
    throw new Error("Connection review regressed to service-connected-primary suggestion grouping.");
  }

  checkpoint("verify Prepare Evidence pathway checklist on Step 5");
  if (!text.includes("Prepare Evidence — Pathway-Specific Record Checklist")) {
    throw new Error("Step 5 is missing the Prepare Evidence pathway-specific record checklist.");
  }
  // The storage write happens inside the hydrated onChange handler. A click
  // that lands before React hydrates does not persist anything, so retry the
  // (idempotent) click until sessionStorage proves the handler ran.
  let storedSelections = null;
  const storageDeadline = Date.now() + 30_000;
  while (Date.now() < storageDeadline) {
    await setSelected(PATHWAY_CHECKBOX_XPATH, true);
    await delay(500);
    const candidate = await readSessionStorage(PATHWAY_CHECKLIST_STORAGE_KEY);
    if (typeof candidate === "string" && candidate.includes("sleep-apnea:ptsd:")) {
      storedSelections = candidate;
      break;
    }
  }
  if (!storedSelections) {
    throw new Error(`Pathway checklist storage never recorded the fixture pathway selection; last=${storedSelections}`);
  }

  checkpoint("verify pathway checklist selection survives a page reload");
  const suggestionsUrl = await webdriver("GET", `/session/${sessionId}/url`);
  await webdriver("POST", `/session/${sessionId}/url`, { url: suggestionsUrl });
  await waitForPath("/secondary/suggestions");
  await waitForSelected(PATHWAY_CHECKBOX_XPATH, true);

  checkpoint("verify pathway checklist selection follows Steps 5 → 6");
  await clickXpath("//a[contains(normalize-space(.), 'Review Evidence for These Connections')]");
  await waitForPath("/secondary/evidence");
  const evidenceText = await bodyText();
  if (!evidenceText.includes("Prepare Evidence — Pathway-Specific Record Checklist")) {
    throw new Error("Step 6 is missing the Prepare Evidence pathway-specific record checklist.");
  }
  await waitForSelected(PATHWAY_CHECKBOX_XPATH, true);

  checkpoint("verify the Clear checkmarks control resets the pathway checklist store");
  await clickXpath("//button[contains(normalize-space(.), 'Clear checkmarks')]");
  const clearDeadline = Date.now() + 10_000;
  let clearedByButton = null;
  while (Date.now() < clearDeadline) {
    clearedByButton = await readSessionStorage(PATHWAY_CHECKLIST_STORAGE_KEY);
    if (clearedByButton === null) break;
    await delay(200);
  }
  if (clearedByButton !== null) {
    throw new Error(`Clear checkmarks did not remove the pathway checklist store: ${clearedByButton}`);
  }
  await waitForSelected(PATHWAY_CHECKBOX_XPATH, false);

  checkpoint("re-check a pathway record so completion clearing has state to purge");
  let restocked = false;
  const restockDeadline = Date.now() + 30_000;
  while (Date.now() < restockDeadline) {
    await setSelected(PATHWAY_CHECKBOX_XPATH, true);
    await delay(500);
    const candidate = await readSessionStorage(PATHWAY_CHECKLIST_STORAGE_KEY);
    if (typeof candidate === "string" && candidate.includes("sleep-apnea:ptsd:")) {
      restocked = true;
      break;
    }
  }
  if (!restocked) {
    throw new Error("Pathway checklist selection could not be restored after Clear checkmarks.");
  }

  checkpoint("verify Start a new review clears the pathway checklist store");
  await clickXpath("//button[contains(normalize-space(.), 'Start a new review')]");
  await waitForPath("/secondary/diagnosed");
  const clearedValue = await readSessionStorage(PATHWAY_CHECKLIST_STORAGE_KEY);
  if (clearedValue !== null) {
    throw new Error(`Pathway checklist selections survived Start a new review: ${clearedValue}`);
  }

  console.log("Real-browser E2E passed: home → diagnosed → service-connected → ratings → documents → diagnosis-centered connections → pathway checklist persistence → evidence review → completion clearing.");
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
