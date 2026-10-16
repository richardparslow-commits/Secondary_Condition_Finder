/**
 * Promoted copy — canonical for CI. Working copy and raw results live in tmp/lppa-live-tests/.
 * See tools/live-regression/README.md for the monitor, baseline and schedule.
 * Live randomized acceptance suite for the production practice application.
 *
 * Target : https://lifeinsurancebrokeradvocate.com/practice-application
 * Scope  : draft/local only. "Submit / Contact Me" is never clicked and every request to the
 *          submission backend is aborted in the network layer, so no submission and no consent
 *          record can be created by this suite.
 *
 * Fixes carried here (see AUDIT.md):
 *   B1  one maintained suite instead of three divergent harnesses
 *   B2  conditions/consent resolved by accessible name at click time, with escalating tick
 *       methods and a label-mismatch assertion (no positional element handles)
 *   B3  condition check asserts page health + answer preservation, counts every control type
 *   B4  answer-counter maximum read from the page, never hardcoded
 *   B5  build id captured per run; campaign reports whether the build changed mid-run
 *   B6  third-party ad/analytics errors classified separately from application errors (request URL and the
 *       console mirror's source URL, whose text carries no host — ISSUE-008)
 *   B7  interactions that fail are recorded instead of silently swallowed
 *   B8  automatic same-seed replay of a failed run: flake vs reproduced failure
 *   B9  screenshot + HTML + console evidence captured on a failure
 *   B10 non-zero exit when an application-level failure survives replay, or the rig failed
 *
 * Usage:
 *   node live-suite.mjs [--runs=100] [--concurrency=4] [--seed=42]
 *                       [--viewport=desktop|mobile|random] [--minConditions=0]
 *                       [--only=N] [--out=path] [--headful] [--noReplay] [--noEvidence]
 *                       [--kbps=N --latency=MS]  emulate a throttled link (CDP Network.emulateNetworkConditions,
 *                       the same emulation hydration-race-gate.mjs uses) so the same journeys can be
 *                       replayed at a production-realistic speed; navigation timeouts widen to suit it
 *                       [--checkpoint=path --resume]  append each finished journey as one JSONL line;
 *                       with --resume, journeys already in the checkpoint file are skipped, so an
 *                       interrupted campaign continues from its last completed journey index.
 * Test-only switches used to verify the rig itself:
 *   --injectFailure=N   run N fails every attempt (verifies replay + evidence + exit code)
 *   --injectFlake=N     run N fails only on its first attempt (verifies flake detection)
 *   --injectHydration=N run N records a synthetic React #418 (verifies the hydration gate can fail)
 */
import { chromium } from "playwright";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = "https://lifeinsurancebrokeradvocate.com/practice-application";

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const has = (name) => argv.includes(`--${name}`);

const RUNS = Number(arg("runs", "100"));
const CONCURRENCY = Number(arg("concurrency", "4"));
const BASE_SEED = Number(arg("seed", "42"));
const VIEWPORT = arg("viewport", "desktop");
const MIN_CONDITIONS = Number(arg("minConditions", "0"));
const KBPS = Number(arg("kbps", "0"));
const LATENCY = Number(arg("latency", "150"));
const THROTTLED = KBPS > 0;
const ONLY = arg("only", null);
const HEADFUL = has("headful");
const REPLAY = !has("noReplay");
const EVIDENCE = !has("noEvidence");
const INJECT_FAILURE = Number(arg("injectFailure", "0"));
const INJECT_FLAKE = Number(arg("injectFlake", "0"));
const INJECT_HYDRATION = Number(arg("injectHydration", "0"));
const CHECKPOINT = arg("checkpoint", null);
const RESUME = has("resume");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = resolve(HERE, arg("out", `results/suite-${STAMP}.json`));
const CHECKPOINT_PATH = CHECKPOINT ? resolve(HERE, CHECKPOINT) : null;
const EVIDENCE_DIR = resolve(HERE, "results/evidence");

const SECTIONS = [
  "1. Health / Medical", "2. Mental Health", "3. Nicotine / Smoking", "4. Alcohol",
  "5. Risky Behavior", "6. Driving Record", "7. Arrest / Criminal Record", "8. Bankruptcy",
  "9. Illegal Drug Use", "10. Residency & Foreign Travel", "11. Occupation & Financial",
  "12. Military Service",
];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const CONSENT_LABELS = /consent to contact|acknowledgment/i;
const CONSENT_LOCATORS = [/consent to contact/i, /acknowledgment/i];
const SYNTHETIC = "QA-SYNTHETIC";
const THIRD_PARTY = /googlesyndication|doubleclick|csp\.withgoogle|google\.com|gstatic|adsbygoogle|flock\.js|__l5e|adtrafficquality|sodar/i;
// Hydration failures get their own check because they are silent: every functional assertion can pass while
// React has already thrown the server-rendered DOM away. #418 = element mismatch, #425 = text, #423 = recoverable.
const HYDRATION_MISMATCH = /Minified React error #(418|423|425)|Hydration failed|text content does not match|server rendered HTML didn't match/i;
// After a fatal #418 React discards the DOM; streamed completion scripts then throw this cascade.
const HYDRATION_WIPE = /Cannot read properties of null \(reading 'parentNode'\)/i;
const HYDRATION_INJECTED = "Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= (injected by --injectHydration)";
const APP_LEVEL = /^(http_2xx|no_bot_challenge|disclaimer_visible|counter_|every_answer_|answered_at_least|autosaves_|answers_restored|identity_|consent_boxes|save_draft|print_invokes|clear_draft|no_console_errors|no_page_errors|no_hydration_|no_failed_requests_from_app|no_submission_left|ticking_conditions|condition_checkboxes|ticked_element|toggling_yes_to_no|no_application_data|no_horizontal_overflow|injected_failure)/;
const HARNESS_LEVEL = /^(no_swallowed_errors|journey_completed)/;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuffle = (r, arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const viewportFor = (r, mode) => {
  const mobile = mode === "mobile" || (mode === "random" && r() < 0.3);
  return mobile
    ? { width: [360, 390, 414, 428][Math.floor(r() * 4)], height: 844 }
    : { width: 1280 + Math.floor(r() * 360), height: 900 + Math.floor(r() * 220) };
};
const buildPrefix = (id) => String(id || "").split(".").slice(0, 2).join(".");

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function runJourney(browser, runIndex, attempt) {
  const seed = BASE_SEED * 1000003 + runIndex;
  const r = rng(seed + attempt - 1); // identical journey shape on replay of attempt 1
  const vp = viewportFor(r, VIEWPORT);
  const run = {
    run: runIndex + 1,
    attempt,
    seed,
    mobile: vp.width < 500,
    checks: {},
    coverage: { sectionsExpanded: [], yes: 0, no: 0, notSure: 0, textFields: 0, conditionBoxes: [], followUpGroups: 0 },
    steps: [],
    dataLeaks: [],
    toggleTested: false,
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
    thirdPartyErrors: [],
    blockedRequests: [],
    softErrors: [],
    notes: [],
  };
  const t0 = Date.now();
  const context = await browser.newContext({ viewport: vp });
  await context.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls += 1; };
  });
  // Hard safety net: nothing can reach the submission backend from this context.
  const APP_ORIGIN = new URL(TARGET).origin;
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (/send-practice-application|supabase\.co|resend\.com|\.functions\./i.test(url)) {
      run.blockedRequests.push(url.slice(0, 160));
      return route.abort();
    }
    // Strict privacy assertion: application data (draft content, synthetic answers) must
    // never reach a host other than the app itself. Checked on URL *and* body.
    if (!url.startsWith(APP_ORIGIN)) {
      const body = req.postData() || "";
      if (url.includes(SYNTHETIC) || body.includes(SYNTHETIC) || /practice-app-draft/.test(url + body)) {
        run.dataLeaks.push(`${req.method()} ${url.slice(0, 160)} body=${body.slice(0, 80)}`);
      }
    }
    return route.continue();
  });

  const page = await context.newPage();
  if (THROTTLED) {
    // Production-realistic reliability: same CDP emulation as hydration-race-gate.mjs, so a
    // throttled campaign and the gate measure the same delivery conditions. Navigation
    // timeouts widen with it — otherwise a slow link manufactures harness failures instead
    // of measuring the app.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: LATENCY,
      downloadThroughput: Math.round((KBPS * 1024) / 8),
      uploadThroughput: Math.round((KBPS * 1024) / 16),
    });
    page.setDefaultNavigationTimeout(180000);
  }
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text().slice(0, 220);
    // ISSUE-008: a third-party resource that fails at the network layer is mirrored here host-less, so its source URL decides too.
    const source = `${m.text()} ${m.location()?.url || ""}`;
    (THIRD_PARTY.test(source) ? run.thirdPartyErrors : run.consoleErrors).push(text);
  });
  page.on("pageerror", (e) => run.pageErrors.push(String(e).slice(0, 220)));
  if (INJECT_HYDRATION && runIndex + 1 === INJECT_HYDRATION) run.pageErrors.push(HYDRATION_INJECTED);
  page.on("dialog", (d) => { run.dialogs = (run.dialogs || []).concat(d.message().slice(0, 120)); d.accept().catch(() => {}); });
  page.on("requestfailed", (req) => {
    const f = req.failure()?.errorText || "";
    if (/aborted/i.test(f)) return;
    const entry = `${f} ${req.url().slice(0, 120)}`;
    (THIRD_PARTY.test(req.url()) ? run.thirdPartyErrors : run.networkErrors).push(entry);
  });
  page.on("response", (res) => {
    if (res.status() < 400) return;
    const entry = `HTTP ${res.status()} ${res.url().slice(0, 120)}`;
    (THIRD_PARTY.test(res.url()) ? run.thirdPartyErrors : run.networkErrors).push(entry);
  });

  const check = (name, ok, detail) =>
    (run.checks[name] = { ok: !!ok, detail: detail === undefined ? null : String(detail).slice(0, 240) });
  // B7: an interaction that fails is recorded, not swallowed.
  const noteSoft = (step, err) => run.softErrors.push(`${step}: ${String(err).slice(0, 120)}`);

  const readCounter = () =>
    page.evaluate(() => {
      const el = document.querySelector('[role="progressbar"], progress');
      const m = el?.closest("div")?.innerText?.match(/(\d+)\s*\/\s*(\d+)/);
      return { answered: m ? Number(m[1]) : null, max: m ? Number(m[2]) : null, draftBytes: (localStorage.getItem("practice-app-draft-v1") || "").length };
    });

  const countControls = () =>
    page.evaluate(() => ({
      groups: document.querySelectorAll('[role="radiogroup"]').length,
      texts: document.querySelectorAll('input[type="text"], textarea').length,
      selects: document.querySelectorAll("select").length,
      dates: document.querySelectorAll('input[type="date"]').length,
      numbers: document.querySelectorAll('input[type="number"]').length,
    }));

  // B2 fix. These are Radix-style controls: a button[role=checkbox] plus a hidden mirror input,
  // so the app's real state is aria-checked (Playwright isChecked() reads it; el.checked does not
  // exist on the button). A forced coordinate click can also land on the sticky header after
  // scroll-into-view, so escalate: real click -> DOM click (no geometry) -> centred real click.
  // Always verify before acting, never click an already-checked control.
  const tickByName = async (name, opts) => {
    const regex = !!(opts && opts.regex);
    const box = () => (regex ? page.getByRole("checkbox", { name }).first() : page.getByRole("checkbox", { name: name, exact: true }).first());
    const el = box();
    if (!(await el.count())) return { ticked: false, reason: "not rendered" };
    const readLabel = () => el.evaluate((n) => (n.closest("label")?.innerText || n.getAttribute("aria-label") || "").trim()).catch(() => "");
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (await el.isChecked().catch(() => false)) {
        return { ticked: true, label: await readLabel(), method: attempt === 1 ? "already-checked" : "attempt-" + attempt };
      }
      try {
        if (attempt === 3) {
          await el.evaluate((n) => n.scrollIntoView({ block: "center" })).catch(() => {});
          await el.click({ timeout: 4000, force: true });
        } else {
          await el.click({ timeout: 4000, force: true, noWaitAfter: true });
        }
      } catch (e) { noteSoft("tick " + String(name).slice(0, 26) + " (click " + attempt + ")", e); }
      await page.waitForTimeout(300);
      if (!(await el.isChecked().catch(() => false))) {
        // DOM click bypasses pointer geometry entirely; React still sees it via the root listener.
        try { await el.evaluate((n) => n.click()); } catch (e) { noteSoft("tick " + String(name).slice(0, 26) + " (dom " + attempt + ")", e); }
        await page.waitForTimeout(250);
      }
    }
    if (!(await el.isChecked().catch(() => false))) return { ticked: false, reason: "not checked after 3 attempts" };
    return { ticked: true, label: await readLabel(), method: "escalated" };
  };

  const expandSection = async (name) => {
    const btn = page.getByRole("button", { name, exact: true }).first();
    if (!(await btn.count())) { run.notes.push(`missing section: ${name}`); return false; }
    if ((await btn.getAttribute("aria-expanded")) !== "true") {
      try { await btn.click({ timeout: 5000 }); } catch (e) { noteSoft(`expand ${name}`, e); }
    }
    return true;
  };

  const answerGroups = async (groups, depth, deltas) => {
    const target = shuffle(r, groups).slice(0, Math.max(1, Math.round(groups.length * depth)));
    for (const g of target) {
      if (!(await g.isVisible().catch(() => false))) continue;
      // Randomized Yes / No / Not Sure branching; falls back to Yes/No where the
      // question does not offer a Not Sure option.
      let choice = pick(r, ["Yes", "No", "Not Sure"]);
      let radio = choice === "Not Sure"
        ? g.getByRole("radio", { name: /not sure/i }).first()
        : g.getByRole("radio", { name: choice, exact: true }).first();
      if (!(await radio.count()) && choice === "Not Sure") {
        choice = r() < 0.5 ? "Yes" : "No";
        radio = g.getByRole("radio", { name: choice, exact: true }).first();
      }
      if (!(await radio.count())) continue;
      const before = (await readCounter()).answered;
      try { await radio.check({ timeout: 4000 }); } catch (e) { noteSoft(`answer ${choice}`, e); continue; }
      if (!(await radio.isChecked().catch(() => false))) { noteSoft(`answer ${choice}`, "not checked after click"); continue; }
      if (choice === "Not Sure") run.coverage.notSure += 1;
      else run.coverage[choice.toLowerCase()] += 1;
      await page.waitForTimeout(80);
      const after = (await readCounter()).answered;
      if (before !== null && after !== null) deltas.push(after - before);
    }
  };

  try {
    const resp = await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: THROTTLED ? 180000 : 60000 });
    run.deploymentId = resp?.headers()["x-deployment-id"] || null;
    check("http_2xx", resp && resp.status() >= 200 && resp.status() < 300, `status=${resp?.status()}`);
    await page.waitForSelector("h1", { timeout: 30000 });
    check("no_bot_challenge", !/just a moment|checking your browser|attention required|cf-error|Ray ID/i.test(await page.content()));
    check("disclaimer_visible", await page.locator("text=/Practice worksheet only/i").first().isVisible().catch(() => false));
    run.overflowEarly = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, win: window.innerWidth }));

    // B4: the maximum comes from the page.
    const c0 = await readCounter();
    run.counterMax = c0.max;
    check("counter_starts_at_zero", c0.answered === 0 && c0.max >= 40 && c0.max <= 200, JSON.stringify(c0));
    run.steps.push("loaded");

    const wantSections = Math.max(1, Math.round(r() * SECTIONS.length));
    const chosen = [SECTIONS[0], ...shuffle(r, SECTIONS.slice(1)).slice(0, wantSections - 1)];
    for (const name of chosen) if (await expandSection(name)) run.coverage.sectionsExpanded.push(name);

    const year = 1950 + Math.floor(r() * 55);
    const month = 1 + Math.floor(r() * 12);
    const day = 1 + Math.floor(r() * 28);
    let dobSet = false;
    const dateField = page.locator('input[type="date"]').first();
    if (await dateField.count()) {
      try { await dateField.fill(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`); dobSet = true; }
      catch (e) { noteSoft("fill dob", e); }
    }
    const state = pick(r, STATES);
    const gender = pick(r, ["Male", "Female", "Other", "Prefer not to say"]);
    try { await page.getByLabel(/state of birth/i).first().selectOption(state); } catch (e) { noteSoft("select state", e); }
    try { await page.getByLabel(/gender/i).first().selectOption(gender); } catch (e) { noteSoft("select gender", e); }
    check("identity_inputs_accept_values", dobSet, `dob=${dobSet} state=${state} gender=${gender} viewport=${run.mobile ? "mobile" : "desktop"}`);
    run.steps.push("identity-set");

    const baseline = (await readCounter()).answered;
    const deltas = [];
    await answerGroups(await page.locator('[role="radiogroup"]').all(), 0.3 + r() * 0.7, deltas);

    run.steps.push(`answers:${run.coverage.yes + run.coverage.no + run.coverage.notSure}`);

    // ---- B2/B3: conditions ticked by name, asserting health rather than a radiogroup ----
    const conditionNames = [];
    for (const b of await page.locator('input[type="checkbox"]').all()) {
      const name = await b.evaluate((el) => (el.closest("label")?.innerText || el.getAttribute("aria-label") || "").trim());
      if (name && !CONSENT_LABELS.test(name)) conditionNames.push(name);
    }
    const controlsBefore = await countControls();
    const radCheckedBefore = await page.evaluate(() => document.querySelectorAll('input[type="radio"]:checked').length);
    const wantTicks = Math.max(MIN_CONDITIONS, Math.floor(r() * 4));
    const wanted = shuffle(r, conditionNames).slice(0, wantTicks);
    let labelChecked = 0;
    for (const name of wanted) {
      const res = await tickByName(name);
      if (res.ticked) {
        run.coverage.conditionBoxes.push(name);
        if (res.label === name) labelChecked += 1;
        else run.notes.push(`ticked element label mismatch: requested "${name}" got "${String(res.label).slice(0, 50)}"`);
      } else {
        run.notes.push(`condition not ticked: ${name} (${res.reason})`);
      }
    }
    if (wanted.length) {
      check("condition_checkboxes_accept_selection", run.coverage.conditionBoxes.length === wanted.length, `wanted=${wanted.length} ticked=${run.coverage.conditionBoxes.length}`);
    }
    await page.waitForTimeout(1200);
    const controlsAfter = await countControls();
    const radCheckedAfter = await page.evaluate(() => document.querySelectorAll('input[type="radio"]:checked').length);
    run.coverage.newControls = Object.fromEntries(Object.keys(controlsBefore).map((k) => [k, Math.max(0, controlsAfter[k] - controlsBefore[k])]));
    run.coverage.newControlTotal = Object.values(run.coverage.newControls).reduce((a, b) => a + b, 0);
    run.coverage.followUpGroups = Math.max(0, controlsAfter.groups - controlsBefore.groups);
    run.coverage.conditionsRendered = conditionNames.length;
    run.coverage.conditionsWithNewControls = run.coverage.newControlTotal > 0;
    if (wanted.length) {
      check("ticking_conditions_keeps_page_healthy", run.consoleErrors.length === 0 && run.pageErrors.length === 0 && radCheckedAfter >= radCheckedBefore, `errors=${run.consoleErrors.length + run.pageErrors.length} radiosBefore=${radCheckedBefore} radiosAfter=${radCheckedAfter}`);
      run.steps.push("conditions-toggled");
    }
    if (run.coverage.followUpGroups > 0) {
      const all = await page.locator('[role="radiogroup"]').all();
      await answerGroups(all.slice(controlsBefore.groups), 0.4 + r() * 0.6, deltas);
    }

    const texts = await page.locator('input[type="text"]:visible, textarea:visible').all();
    for (const t of shuffle(r, texts).slice(0, Math.floor(r() * 3))) {
      try { await t.fill(`${SYNTHETIC}-${Math.floor(r() * 1e6)}`); run.coverage.textFields += 1; }
      catch (e) { noteSoft("fill text field", e); }
    }

    const clicks = run.coverage.yes + run.coverage.no + run.coverage.notSure;
    let c1 = null;
    for (let i = 0; i < 12; i++) {
      c1 = await readCounter();
      if (c1.draftBytes > 0) break;
      await page.waitForTimeout(500);
    }
    const deltaSum = deltas.reduce((n, d) => n + d, 0);
    check("every_answer_counts_at_most_once", deltas.every((d) => d === 0 || d === 1), `deltas>1: ${deltas.filter((d) => d > 1).length} of ${deltas.length}`);
    check("counter_never_over_counts_answers", c1.answered <= baseline + clicks, `counter=${c1.answered} baseline=${baseline} clicks=${clicks}`);
    check("counter_tracks_observed_advances", Math.abs(c1.answered - (baseline + deltaSum)) <= 2, `baseline=${baseline} sum(deltas)=${deltaSum} counter=${c1.answered}`);
    check("counter_never_exceeds_max", c1.answered >= 1 && c1.answered <= c1.max, `answered=${c1.answered}/${c1.max} clicks=${clicks}`);
    check("autosaves_draft_without_clicking_save", c1.draftBytes > 0, `bytes=${c1.draftBytes}`);
    run.coverage.counterAnswered = c1.answered;
    run.coverage.counterClicks = clicks;

    const expandedBefore = run.coverage.sectionsExpanded.slice();
    await page.waitForTimeout(1200);
    const checkedBefore = await page.evaluate(() => document.querySelectorAll('input[type="radio"]:checked').length);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 30000 });
    for (const name of expandedBefore) await expandSection(name);
    const c2 = await readCounter();
    const checkedAfter = await page.evaluate(() => document.querySelectorAll('input[type="radio"]:checked').length);
    const restoredState = await page.getByLabel(/state of birth/i).first().inputValue().catch(() => "");
    check("counter_restored_after_reload", c2.answered === c1.answered && c2.answered > 0, `before=${c1.answered} after=${c2.answered}`);
    check("answers_restored_after_reload", checkedAfter === checkedBefore && checkedBefore > 0, `checkedBefore=${checkedBefore} checkedAfter=${checkedAfter}`);
    check("identity_restored_after_reload", restoredState === state, `expected=${state} got=${restoredState}`);
    run.steps.push("reloaded");

    // Toggling a parent answer from Yes back to No must not leave orphaned child data:
    // the follow-up groups it revealed hide again, and no radio inside a hidden group stays checked.
    for (const g of await page.locator('[role="radiogroup"]:visible').all()) {
      const yes = g.getByRole("radio", { name: "Yes", exact: true }).first();
      if (!(await yes.count()) || !(await yes.isChecked().catch(() => false))) continue;
      const no = g.getByRole("radio", { name: "No", exact: true }).first();
      if (!(await no.count())) continue;
      const visibleBefore = await page.locator('[role="radiogroup"]:visible').count();
      const hiddenChecked = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[role="radiogroup"]')]
            .filter((n) => !n.getClientRects().length)
            .filter((n) => n.querySelector('input[type="radio"]:checked, [role="radio"][aria-checked="true"]')).length);
      const hiddenBefore = await hiddenChecked();
      let clickOk = await no.check({ timeout: 4000 }).then(() => true).catch(() => false);
      if (!clickOk) clickOk = await no.evaluate((n) => n.click()).then(() => true).catch(() => false);
      await page.waitForTimeout(1200);
      const toggled = clickOk && (await no.isChecked().catch(() => false));
      const visibleAfter = await page.locator('[role="radiogroup"]:visible').count();
      const hiddenAfter = await hiddenChecked();
      run.toggleTested = true;
      run.steps.push("toggled-yes-to-no");
      check("toggling_yes_to_no_hides_followups", toggled && visibleAfter <= visibleBefore, `toggled=${toggled} visibleBefore=${visibleBefore} visibleAfter=${visibleAfter}`);
      check("toggling_yes_to_no_leaves_no_orphaned_answers", toggled && hiddenAfter === 0, `hiddenBefore=${hiddenBefore} hiddenAfter=${hiddenAfter}`);
      break;
    }

    const consentFields = await page.evaluate(() =>
      [...document.querySelectorAll('input[type="checkbox"]')]
        .filter((el) => /consent to contact|acknowledgment/i.test(el.closest("label")?.innerText || ""))
        .length,
    );
    let consentSet = 0;
    for (const locator of CONSENT_LOCATORS) {
      const res = await tickByName(locator, { regex: true });
      if (res.ticked) consentSet += 1;
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 30000 });
    const stillChecked = await page.evaluate(() =>
      [...document.querySelectorAll('input[type="checkbox"]')]
        .filter((el) => /consent to contact|acknowledgment/i.test(el.closest("label")?.innerText || "") && el.checked)
        .length,
    );
    check("consent_boxes_not_persisted", consentSet === consentFields && stillChecked === 0, `consentFields=${consentFields} ticked=${consentSet} stillChecked=${stillChecked}`);

    try { await page.getByRole("button", { name: /save draft/i }).first().click({ timeout: 5000 }); } catch (e) { noteSoft("save draft click", e); }
    await page.waitForTimeout(700);
    const saveFeedback = await page.getByRole("status").first().innerText().catch(() => "");
    check("save_draft_gives_feedback", /sav|draft/i.test(saveFeedback), saveFeedback.slice(0, 120));
    run.steps.push("save-draft");

    try { await page.getByRole("button", { name: /print|save as pdf/i }).first().click({ timeout: 5000 }); } catch (e) { noteSoft("print click", e); }
    await page.waitForTimeout(400);
    check("print_invokes_window_print", (await page.evaluate(() => window.__printCalls || 0)) >= 1);
    run.steps.push("print");

    try { await page.getByRole("button", { name: /clear draft/i }).first().click({ timeout: 5000 }); } catch (e) { noteSoft("clear draft click", e); }
    await page.waitForTimeout(1600);
    const c3 = await readCounter();
    const clearFeedback = await page.getByRole("status").first().innerText().catch(() => "");
    check("clear_draft_resets_state", c3.answered === 0 && c3.draftBytes === 0, `answered=${c3.answered} bytes=${c3.draftBytes} status="${clearFeedback.slice(0, 60)}"`);
    run.steps.push("clear-draft");

    check("no_console_errors", run.consoleErrors.length === 0, run.consoleErrors[0] || "");
    check("no_page_errors", run.pageErrors.length === 0, run.pageErrors[0] || "");
    const seenErrors = [...run.pageErrors, ...run.consoleErrors];
    const mismatch = seenErrors.filter((e) => HYDRATION_MISMATCH.test(e));
    check("no_hydration_mismatch", mismatch.length === 0, mismatch[0] || "");
    const wipe = seenErrors.filter((e) => HYDRATION_WIPE.test(e));
    check("no_hydration_dom_wipe", wipe.length === 0, wipe[0] || "");
    check("no_failed_requests_from_app", run.networkErrors.length === 0, run.networkErrors[0] || "");
    check("no_submission_left_the_browser", run.blockedRequests.length === 0, run.blockedRequests[0] || "");
    check("no_application_data_leaves_device", run.dataLeaks.length === 0, run.dataLeaks[0] || "none");
    const late = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, win: window.innerWidth }));
    const worst = Math.max(run.overflowEarly.doc, run.overflowEarly.body, late.doc, late.body);
    check("no_horizontal_overflow", worst <= late.win + 1, `early=${JSON.stringify(run.overflowEarly)} late=${JSON.stringify(late)}`);
    check("no_swallowed_errors", run.softErrors.length === 0, run.softErrors[0] || "");
  } catch (err) {
    run.notes.push("threw: " + String(err).slice(0, 240));
    check("journey_completed", false, String(err).slice(0, 200));
  }

  // Test-only injections used to prove the rig can fail, replay and classify.
  const injectedThisRun = (INJECT_FAILURE && runIndex + 1 === INJECT_FAILURE) || (INJECT_FLAKE && runIndex + 1 === INJECT_FLAKE && attempt === 1);
  if (injectedThisRun) {
    check("injected_failure", false, INJECT_FLAKE ? "injected flake (attempt 1 only)" : "injected failure (every attempt)");
  }

  const failedNow = Object.values(run.checks).some((c) => !c.ok) || run.notes.length > 0;
  if (EVIDENCE && failedNow) {
    try {
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      const base = resolve(EVIDENCE_DIR, `run-${run.run}-attempt-${attempt}`);
      await page.screenshot({ path: `${base}.png`, fullPage: false });
      writeFileSync(`${base}.html`, await page.content());
      writeFileSync(`${base}.log`, [
        `run ${run.run} attempt ${attempt} seed ${run.seed} build ${run.deploymentId}`,
        `failed checks: ${Object.entries(run.checks).filter(([, v]) => !v.ok).map(([k, v]) => `${k}=${v.detail}`).join(" | ")}`,
        `pageErrors: ${JSON.stringify(run.pageErrors)}`,
        `consoleErrors: ${JSON.stringify(run.consoleErrors)}`,
        `softErrors: ${JSON.stringify(run.softErrors)}`,
        `notes: ${JSON.stringify(run.notes)}`,
      ].join("\n"));
      run.evidence = `${base}.png | ${base}.html | ${base}.log`;
    } catch (e) { run.notes.push("evidence capture failed: " + String(e).slice(0, 120)); }
  }
  await context.close().catch(() => {});

  run.elapsedMs = Date.now() - t0;
  run.answeredTotal = run.coverage.yes + run.coverage.no;
  run.passed = !failedNow;
  run.failedChecks = Object.entries(run.checks).filter(([, v]) => !v.ok).map(([k]) => k);
  return run;
}

async function main() {
  mkdirSync(dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ channel: process.env.CHANNEL || "chrome", headless: !HEADFUL });
  log(`suite v6 | runs=${RUNS} concurrency=${CONCURRENCY} seed=${BASE_SEED} viewport=${VIEWPORT} minConditions=${MIN_CONDITIONS} throttle=${THROTTLED ? `${KBPS} kbps/${LATENCY} ms` : "off"} replay=${REPLAY} evidence=${EVIDENCE} → ${OUT}`);

  const checkpointRecords = new Map();
  if (CHECKPOINT_PATH && RESUME && existsSync(CHECKPOINT_PATH)) {
    for (const line of readFileSync(CHECKPOINT_PATH, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (rec && typeof rec.run === "number") checkpointRecords.set(rec.run, rec);
      } catch { /* ignore a partial line left by an interrupted write */ }
    }
    if (checkpointRecords.size) log(`checkpoint: ${checkpointRecords.size} completed journey(s) resumed from ${CHECKPOINT_PATH}`);
  }

  let next = 0;
  let onlyDone = false;
  const attempts = [];
  const wallStart = Date.now();

  const persist = (rec) => {
    if (!CHECKPOINT_PATH) return;
    try { appendFileSync(CHECKPOINT_PATH, JSON.stringify(rec) + "\n"); }
    catch (e) { log(`checkpoint write failed: ${String(e).slice(0, 80)}`); }
  };
  const record = async (i) => {
    const first = await runJourney(browser, i, 1);
    attempts.push(first);
    if (!first.passed && REPLAY) {
      const second = await runJourney(browser, i, 2);
      attempts.push(second);
      const summary = { ...first, replay: { passed: second.passed, failedChecks: second.failedChecks, pageErrors: second.pageErrors, consoleErrors: second.consoleErrors }, reproduced: !second.passed, flaky: second.passed };
      log(`run ${first.run}/${RUNS} attempt 1 failed (${first.failedChecks.join(",") || first.notes[0]}) -> replay ${second.passed ? "PASSED (flake)" : "FAILED AGAIN (reproduced)"}`);
      log(`run ${first.run}/${RUNS} ${summary.passed ? "PASS" : summary.flaky ? "FLAKY" : "FAIL"} (${first.elapsedMs}ms) cond=${first.coverage.conditionBoxes.length} newControls=${first.coverage.newControlTotal}`);
      persist(summary);
      return summary;
    }
    log(`run ${first.run}/${RUNS} ${first.passed ? "PASS" : "FAIL"} (${first.elapsedMs}ms) cond=${first.coverage.conditionBoxes.length} newControls=${first.coverage.newControlTotal} failed=${first.failedChecks.join(",") || "-"}`);
    persist(first);
    return first;
  };

  await Promise.all(
    Array.from({ length: ONLY ? 1 : Math.min(CONCURRENCY, RUNS) }, async () => {
      for (;;) {
        const i = ONLY ? Number(ONLY) - 1 : next++;
        if (ONLY) { if (onlyDone) return; onlyDone = true; }
        if (i >= RUNS || i < 0) return;
        if (checkpointRecords.has(i + 1)) continue;
        await record(i);
        if (i + 1 < RUNS) await new Promise((s) => setTimeout(s, 200 + Math.random() * 400));
      }
    }),
  );
  await browser.close();

  const replays = attempts.filter((a) => a.attempt === 2);
  const sessionMerged = attempts
    .filter((a) => a.attempt === 1)
    .sort((a, b) => a.run - b.run)
    .map((f) => {
      const rp = replays.find((r2) => r2.run === f.run);
      return rp ? { ...f, replay: { passed: rp.passed, failedChecks: rp.failedChecks, pageErrors: rp.pageErrors }, reproduced: !rp.passed, flaky: rp.passed } : f;
    });
  const byRun = new Map();
  for (const rec of checkpointRecords.values()) byRun.set(rec.run, rec);
  for (const rec of sessionMerged) byRun.set(rec.run, rec);
  const merged = [...byRun.values()].sort((a, b) => a.run - b.run);

  const checks = [...new Set(merged.flatMap((r) => Object.keys(r.checks)))];
  // A run that failed once and passed on the same-seed replay is a flake, not a failure.
  const effectivePass = (r) => r.passed === true || r.flaky === true;
  const appFailed = merged.filter((r) => !effectivePass(r) && r.failedChecks.some((c) => APP_LEVEL.test(c)));
  const harnessFailed = merged.filter((r) => !effectivePass(r) && r.failedChecks.some((c) => HARNESS_LEVEL.test(c)));
  const flakyRuns = merged.filter((r) => r.flaky);
  const builds = [...new Set(merged.map((r) => buildPrefix(r.deploymentId)).filter(Boolean))];

  const summary = {
    target: TARGET,
    suiteVersion: "v6",
    throttle: THROTTLED ? `${KBPS} kbps / ${LATENCY} ms` : "off",
    startedAt: STAMP,
    wallClockMs: Date.now() - wallStart,
    runs: merged.length,
    passedRuns: merged.filter(effectivePass).length,
    failedRuns: merged.filter((r) => !effectivePass(r)).length,
    appFailures: appFailed.length,
    harnessFailures: harnessFailed.length,
    flakyRuns: flakyRuns.length,
    flakyRunsDetail: flakyRuns.map((r) => ({ run: r.run, failedOnAttempt1: r.failedChecks })),
    singleBuild: builds.length === 1,
    builds,
    counterMaxSeen: [...new Set(merged.map((r) => r.counterMax))],
    viewportMode: VIEWPORT,
    mobileRuns: merged.filter((r) => r.mobile).length,
    toggleTestedRuns: merged.filter((r) => r.toggleTested).length,
    dataLeakSuspects: merged.reduce((n, r) => n + (r.dataLeaks ? r.dataLeaks.length : 0), 0),
    runsWithThirdPartyErrors: merged.filter((r) => r.thirdPartyErrors.length).length,
    runsWithSoftErrors: merged.filter((r) => r.softErrors.length).length,
    perCheck: Object.fromEntries(checks.map((c) => {
      const rs = merged.filter((r) => r.checks[c]);
      return [c, { pass: rs.filter((r) => r.checks[c].ok).length, fail: rs.filter((r) => !r.checks[c].ok).length }];
    })),
    surfaceCoverage: {
      sectionsHit: [...new Set(merged.flatMap((r) => r.coverage.sectionsExpanded))].length,
      sections: Object.fromEntries(SECTIONS.map((s) => [s, merged.filter((r) => r.coverage.sectionsExpanded.includes(s)).length])),
      yesAnswers: merged.reduce((n, r) => n + r.coverage.yes, 0),
      noAnswers: merged.reduce((n, r) => n + r.coverage.no, 0),
      notSureAnswers: merged.reduce((n, r) => n + (r.coverage.notSure || 0), 0),
      textFieldsFilled: merged.reduce((n, r) => n + r.coverage.textFields, 0),
      conditionBoxesToggled: merged.reduce((n, r) => n + r.coverage.conditionBoxes.length, 0),
      distinctConditions: [...new Set(merged.flatMap((r) => r.coverage.conditionBoxes))].sort(),
      conditionsWithNewControls: merged.filter((r) => r.coverage.conditionsWithNewControls).length,
      conditionsWithoutNewControls: merged.filter((r) => r.coverage.conditionBoxes.length && !r.coverage.conditionsWithNewControls).length,
      conditionsWithoutNewControlsNames: [...new Set(merged.filter((r) => r.coverage.conditionBoxes.length && !r.coverage.conditionsWithNewControls).flatMap((r) => r.coverage.conditionBoxes))].sort(),
      followUpGroupsRendered: merged.reduce((n, r) => n + r.coverage.followUpGroups, 0),
      maxCounterReached: merged.length ? Math.max(...merged.map((r) => r.coverage.counterAnswered || 0)) : 0,
    },
    timing: merged.length
      ? {
          medianRunMs: merged.map((r) => r.elapsedMs).sort((a, b) => a - b)[Math.floor(merged.length / 2)],
          slowestRunMs: Math.max(...merged.map((r) => r.elapsedMs)),
          fastestRunMs: Math.min(...merged.map((r) => r.elapsedMs)),
        }
      : null,
    submissionsMade: 0,
    blockedNetworkRequests: merged.flatMap((r) => r.blockedRequests).length,
    thirdPartySamples: [...new Set(merged.flatMap((r) => r.thirdPartyErrors))].slice(0, 5),
  };
  writeFileSync(OUT, JSON.stringify({ summary, results: merged, attempts: [...checkpointRecords.values(), ...attempts] }, null, 2));
  console.log("\n=== SUMMARY ===\n" + JSON.stringify(summary, null, 2) + `\n\nresults → ${OUT}`);
  if (appFailed.length || harnessFailed.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
