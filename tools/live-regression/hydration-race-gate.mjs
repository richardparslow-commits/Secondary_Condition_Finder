/**
 * Promoted copy — canonical for CI. Working copy and raw results live in tmp/lppa-live-tests/.
 * See tools/live-regression/README.md for the monitor, baseline and schedule.
 * A2 — reproduction gate for the intermittent React #418 on /practice-application.
 *
 * The failure signature recorded in run 7 of the desktop campaign was:
 *     Minified React error #418 ... args[]=HTML&args[]=   (element-level hydration mismatch)
 * React has an open defect with that exact signature — react/react#37321, "streaming hydration can
 * overtake the HTML parser": hydration begins while document.readyState === 'loading' and the claim
 * walk runs out of siblings, so React throws a false fatal #418 and re-renders the document from
 * scratch even though the server HTML is byte-for-byte correct. Its reported preconditions are:
 *   1. streaming SSR (Fizz) — this app is TanStack Start, which streams
 *   2. the client JS chunks ALREADY IN THE HTTP CACHE (first load of a cold cache is always clean)
 *   3. slow/chunked document delivery, e.g. CDP Network.emulateNetworkConditions 1500 kbps / 20 ms
 * and its reported rate un-throttled is ~5–17% per cold boot, which is the order of the 1-in-100 we saw.
 *
 * This gate reproduces those conditions: one persistent browser profile (so the client chunks stay
 * cached), then N loads with throttled document delivery, asserting the streamed DOM survives.
 *
 * It deliberately does NOT inject a MutationObserver or any other observer into the page: the upstream
 * report found that attaching one suppresses the race almost completely (40/40 clean), so instrumented
 * pages cannot measure this defect.
 *
 * Exit 0 = no hydration error observed in N loads. Exit 1 = reproduced (prints the run numbers).
 *
 * Usage: node hydration-race-gate.mjs [--runs=40] [--kbps=1500] [--latency=20] [--no-throttle]
 *                              [--url=http://localhost:3000/practice-application]  (verify a local build)
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const PROFILE = resolve(HERE, ".chrome-profile-race");
const argv = process.argv.slice(2);
const arg = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split("=").slice(1).join("=");
const RUNS = Number(arg("runs", "40"));
const KBPS = Number(arg("kbps", "1500"));
const LATENCY = Number(arg("latency", "20"));
const THROTTLE = !argv.includes("--no-throttle");
const TARGET = arg("url", "https://lifeinsurancebrokeradvocate.com/practice-application");

const isMismatch = (t) => /Minified React error #418|#423|#425|Hydration failed|did not match|doesn't match|text content does not match/i.test(t);
const isWipeCascade = (t) => /Cannot read properties of null \(reading 'parentNode'\)/i.test(t);

mkdirSync(resolve(HERE, "results"), { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, { channel: "chrome", headless: true, viewport: { width: 1440, height: 950 } });

// Warm the cache exactly as the defect requires: the first load of a cold cache is reported as always clean.
{
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.close();
  console.log("cache warmed (client chunks now resident)");
}

const hits = [];
for (let i = 1; i <= RUNS; i++) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 220)));
  page.on("console", (m) => { if (m.type() === "error" && (isMismatch(m.text()) || isWipeCascade(m.text()))) errors.push(m.text().slice(0, 220)); });
  if (THROTTLE) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: LATENCY,
      downloadThroughput: Math.round((KBPS * 1024) / 8),
      uploadThroughput: Math.round((KBPS * 1024) / 16),
    });
  }
  const started = Date.now();
  try {
    await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("h1", { timeout: 45000 });
    await page.waitForTimeout(1800);
  } catch (e) {
    errors.push("nav: " + String(e).slice(0, 120));
  }
  const mismatch = errors.filter(isMismatch);
  const cascade = errors.filter(isWipeCascade);
  if (mismatch.length) hits.push({ run: i, ms: Date.now() - started, errors: mismatch.slice(0, 3), wipeCascade: cascade.length });
  process.stdout.write(`run ${i}/${RUNS}: ${mismatch.length ? "MISMATCH" : "clean"}${cascade.length ? " +wipe-cascade" : ""} (${Date.now() - started}ms)\n`);
  await page.close();
}
await ctx.close();

const summary = {
  target: TARGET,
  throttle: THROTTLE ? `${KBPS} kbps / ${LATENCY} ms` : "off",
  runs: RUNS,
  hydrationMismatches: hits.length,
  rate: `${((hits.length / RUNS) * 100).toFixed(1)}%`,
  hits,
};
writeFileSync(resolve(HERE, "results/hydration-race-gate.json"), JSON.stringify(summary, null, 2));
console.log("\n" + JSON.stringify({ ...summary, hits: hits.slice(0, 5) }, null, 1));
rmSync(PROFILE, { recursive: true, force: true });
process.exit(hits.length ? 1 : 0);
