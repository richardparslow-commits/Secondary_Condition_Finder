// Dev-only screenshot utility (maintainer gate, not CI): captures full-page
// screenshots of the guided VA.gov walkthrough for the README.
//
//   node scripts/capture-va-gov-walkthrough-screens.mjs
//
// Starts a Next dev server and headless Chrome, seeds the browser-local
// workflow record (PRIV-01 stages 2–3) for the Step 4 route, waits for the
// client-rendered content, and writes @2x PNGs to docs/assets/. Chrome is
// driven over the DevTools Protocol because its CLI cannot seed sessionStorage.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const APP_PORT = 3107;
const CDP_PORT = 9223;
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;
const DEV_SECRET = "dev-screenshot-workflow-secret-0123456789abcdef";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT_DIR = path.join(process.cwd(), "docs", "assets");

const children = [];
let nextMessageId = 0;
const pending = new Map();
let ws;

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

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
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
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }
    }, 60_000);
  });
}

async function navigateAndWait(sessionId, url, needle, label) {
  await send("Page.navigate", { url }, sessionId);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const ready = await send("Runtime.evaluate", {
        expression: "document.readyState",
        returnByValue: true,
      }, sessionId);
      if (ready.result?.value === "complete") {
        const probe = await send("Runtime.evaluate", {
          expression: `document.body?.innerText.includes(${JSON.stringify(needle)}) ?? false`,
          returnByValue: true,
        }, sessionId);
        if (probe.result?.value === true) return;
      }
    } catch {
      // Navigation races (destroyed context) are retried until the deadline.
    }
    await delay(1_000);
  }
  throw new Error(`${label} never rendered "${needle}".`);
}

async function captureCard(sessionId, outFile) {
  // Clip to the card element. Clip coordinates are CSS pixels and `scale` is
  // independent of deviceScaleFactor — overriding both multiplies (4x), so the
  // device metrics override is left at its default here.
  const box = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const card = document.querySelector('section[aria-labelledby="va-gov-record-walkthrough-heading"]');
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        return { x: rect.x, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
      })()
    `,
    returnByValue: true,
  }, sessionId);
  const clip = box.result?.value;
  if (!clip) throw new Error("Walkthrough card element not found for clipping.");
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { ...clip, scale: 2 },
  }, sessionId);
  fs.writeFileSync(outFile, Buffer.from(shot.data, "base64"));
  console.log(`captured ${outFile} (card ${Math.round(clip.width)}x${Math.round(clip.height)} css @2x)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  spawnTracked("next", path.join(process.cwd(), "node_modules", ".bin", "next"),
    ["dev", "-H", "127.0.0.1", "-p", String(APP_PORT)],
    { WORKFLOW_SESSION_SECRET: DEV_SECRET });
  await waitForHttp(APP_BASE, "Next dev server");

  const chrome = spawnTracked("chrome", CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${CDP_PORT}`,
    "--user-data-dir=/tmp/cdp-chrome-profile-va-walkthrough",
    "--window-size=1440,1000",
    "about:blank",
  ]);
  await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`, "Chrome DevTools endpoint", 30_000);
  if (!chrome.pid) throw new Error("Chrome failed to start.");

  const version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`CDP error: ${message.error.message}`));
      else resolve(message.result);
    }
  });

  // The workflow context is browser-local (PRIV-01): seed it through the page's
  // own sessionStorage instead of the retired cookie. The Step 4 shell renders
  // its empty-state guard first, so load the origin, write the record, then
  // navigate cleanly and wait for the populated form.
  const browserRecord = {
    version: 1,
    diagnosedConditionIds: ["ptsd", "sleep-apnea"],
    serviceConnectedConditionIds: ["ptsd"],
    serviceConnectedAnswerDraft: { "sleep-apnea": "no" },
    ratingsByConditionId: { ptsd: 70 },
    documentsShared: false,
  };

  const step4 = await send("Target.createTarget", { url: "about:blank" });
  const step4Session = (await send("Target.attachToTarget", { targetId: step4.targetId, flatten: true })).sessionId;
  await send("Page.enable", {}, step4Session);
  await send("Network.enable", {}, step4Session);
  await navigateAndWait(step4Session, `${APP_BASE}/secondary/upload`,
    "Enter ratings first", "Step 4 empty-state guard");
  await send("Runtime.enable", {}, step4Session);
  await send("Runtime.evaluate", {
    expression: `sessionStorage.setItem(${JSON.stringify(
      "secondary-condition-finder:secondary-workflow:v1",
    )}, ${JSON.stringify(JSON.stringify(browserRecord))})`,
    returnByValue: true,
  }, step4Session);
  await navigateAndWait(step4Session, `${APP_BASE}/secondary/upload`,
    "Need your full VA medical record? Guided VA.gov download", "Step 4 upload route");
  await delay(1_500);
  await captureCard(step4Session, path.join(OUT_DIR, "va-gov-walkthrough-step4.png"));

  const standalone = await send("Target.createTarget", { url: "about:blank" });
  const standaloneSession = (await send("Target.attachToTarget", { targetId: standalone.targetId, flatten: true })).sessionId;
  await send("Page.enable", {}, standaloneSession);
  await navigateAndWait(standaloneSession, `${APP_BASE}/get-records`,
    "Get Your VA Medical Record", "/get-records route");
  await delay(1_500);
  await captureCard(standaloneSession, path.join(OUT_DIR, "va-gov-walkthrough-get-records.png"));

  console.log("done");
}

try {
  await main();
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
  await delay(250);
  // Children may keep stdio pipes open past the event loop draining; exit
  // explicitly once captures are written.
  process.exit(0);
}
