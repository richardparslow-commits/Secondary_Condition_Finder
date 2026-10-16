/**
 * Opt-in end-to-end submission test — the only test in this repository that deliberately sends real email.
 *
 * It fills the live worksheet with unmistakably synthetic data, ticks the consent boxes, satisfies the client-side
 * validation, submits through the real UI, and captures what actually left the browser (payload, response, on-screen
 * confirmation). Three submissions by default, each in a fresh browser context.
 *
 * Two guards, because a misfire sends real email to a real inbox:
 *   1. --confirm-send
 *   2. E2E_SEND_CONFIRM=I-understand-this-sends-real-email
 * Without both it refuses and exits 2. `--dry` runs everything — payload capture and the consent assertions
 * included — with the submission request refused in the network layer, so nothing is sent.
 *
 * SAFETY: every non-GET/HEAD/OPTIONS request is refused unless it is the submission itself AND the run is
 * authorised to send. An allowlist that guesses the endpoint URL is not enough: the first version of this harness
 * matched only a guessed URL pattern and would have let a real POST to any other endpoint through in --dry. Deny by
 * default seals that, and recording what was refused is also how the real endpoint is discovered instead of guessed.
 *
 * How this test decides the form is valid (verified against the live page, not assumed):
 *   - the gate is the app's own behaviour: clicking Submit only reaches the submission backend once every rule
 *     passes. So a refused write after a click is proof the form validated, and it works the same in --dry;
 *   - the "Please fix N highlighted item(s). Nothing has been sent." line is advisory evidence, not the gate: on
 *     the live page it lags the field state, and it is absent entirely once the form is valid;
 *   - each outstanding field has a container with id `error-<field>` whose text says what is wrong, so this test
 *     names outstanding *fields* rather than only counting complaints;
 *   - the consent boxes are `<button role="checkbox">` with NO name attribute (a `name^="consents."` selector
 *     never matches), but each carries aria-describedby="… error-consent_contact|error-consent_disclaimer", which
 *     is the stable handle used here. They are only clicked when the app complains, never speculatively, because a
 *     second click would untick them;
 *   - `<select>` controls must be filled too: an unnamed, unlabelled select left empty by an inputs-only sweep was
 *     one of the blockers, with no `error-<field>` container to explain it.
 *
 * Usage:
 *   node e2e-send-submission.mjs --dry                       # rehearse: capture the payload, send nothing
 *   E2E_SEND_CONFIRM=I-understand-this-sends-real-email node e2e-send-submission.mjs --confirm-send
 *   ... --submissions=3 --url=<target> --quiet --headful
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split("=").slice(1).join("=");
const has = (n) => argv.includes(`--${n}`);
const PROD = "https://lifeinsurancebrokeradvocate.com/practice-application";
const TARGET = arg("url", PROD);
const ORIGIN = new URL(TARGET).origin;
const DRY = has("dry");
const QUIET = has("quiet");
const HEADFUL = has("headful");
const SUBMISSIONS = Number(arg("submissions", "3"));
const MAX_PASSES = Number(arg("passes", "14"));
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
/**
 * Endpoints that are the practice-application submission itself. Anything else is refused.
 * `/api/public/practice-application` is the endpoint the live page actually posts to — discovered by refusing
 * every write and reading what appeared, not guessed from the name.
 */
const SUBMIT_RE = /practice-application|supabase\.co|resend\.com|\.functions\./i;
const SECTIONS = [
  "1. Health / Medical", "2. Mental Health", "3. Nicotine / Smoking", "4. Alcohol", "5. Risky Behavior",
  "6. Driving Record", "7. Arrest / Criminal Record", "8. Bankruptcy", "9. Illegal Drug Use",
  "10. Residency & Foreign Travel", "11. Occupation & Financial", "12. Military Service",
];
/** The two consent controls, by the field key the app itself uses in its error wiring. */
const CONSENT_FIELDS = ["consent_contact", "consent_disclaimer"];

// ---------------------------------------------------------------- guards
if (!DRY) {
  const authorised = has("confirm-send") && process.env.E2E_SEND_CONFIRM === "I-understand-this-sends-real-email";
  if (!authorised) {
    console.error(
      [
        "refusing to send: this test submits REAL applications and sends REAL email.",
        "  rehearse first:   node e2e-send-submission.mjs --dry",
        "  to actually send: E2E_SEND_CONFIRM=I-understand-this-sends-real-email node e2e-send-submission.mjs --confirm-send",
      ].join("\n")
    );
    process.exit(2);
  }
}
if (!DRY && TARGET !== PROD && !has("url")) {
  console.error("refusing to send to an unexpected target; pass --url= explicitly if that is intended");
  process.exit(2);
}

const markerFor = (i) => `QA-SYNTHETIC-E2E-${STAMP}#${i}`;
const syntheticEmail = (i) => `qa+synthetic-${STAMP}-${i}@example.com`;
const redact = (url) => url.replace(/([?&](apikey|key|token|access_token|jwt)=)[^&]+/gi, "$1REDACTED");

/**
 * The application's own verdict on what is still wrong, by field.
 * `fields` comes from the per-field error containers; `invalid` from aria-invalid, so a field the app marks
 * invalid without printing a message (the unnamed select) still shows up with its tag and value.
 */
async function complaints(page) {
  return page
    .evaluate(() => {
      const named = [];
      for (const el of document.querySelectorAll('[id^="error-"]')) {
        const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
        if (text) named.push({ field: el.id.replace(/^error-/, ""), text: text.slice(0, 90) });
      }
      const invalid = [];
      for (const el of document.querySelectorAll('[aria-invalid="true"]')) {
        const described = (el.getAttribute("aria-describedby") || "").split(/\s+/).find((s) => s.startsWith("error-"));
        invalid.push({
          field: described ? described.replace(/^error-/, "") : el.getAttribute("name") || el.id || el.tagName.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || "",
          value: String(el.value ?? "").slice(0, 30),
          label: (el.getAttribute("aria-label") || el.closest("label")?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 50),
        });
      }
      return { fields: named, invalid, invalidFields: [...new Set(invalid.map((i) => i.field))] };
    })
    .catch(() => ({ fields: [], invalid: [], invalidFields: [] }));
}

/**
 * Tick one consent control until the app stops complaining about that field. Never clicks without a complaint,
 * because a stray click would untick a box that is already ticked.
 */
async function fixConsent(page, field, notes) {
  const control = page.locator(`[aria-describedby*="error-${field}"]`).first();
  const found = await control.count();
  const detail = { field, found, attempts: 0, ariaInvalid: null, ariaChecked: null, cleared: false };
  if (!found) {
    notes.push(`consent ${field}: no control declares aria-describedby error-${field}`);
    return detail;
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    detail.attempts = attempt;
    const c = await complaints(page);
    detail.ariaInvalid = await control.getAttribute("aria-invalid").catch(() => null);
    detail.ariaChecked = await control.getAttribute("aria-checked").catch(() => null);
    const complained = c.fields.some((f) => f.field === field) || c.invalidFields.includes(field);
    if (!complained && detail.ariaInvalid !== "true") {
      detail.cleared = true;
      break;
    }
    await control.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await control
      .click({ timeout: 4000, force: true })
      .catch((e) => notes.push(`consent ${field} click${attempt}: ` + String(e).slice(0, 50)));
    await page.waitForTimeout(300);
    const after = await complaints(page);
    detail.ariaInvalid = await control.getAttribute("aria-invalid").catch(() => null);
    detail.ariaChecked = await control.getAttribute("aria-checked").catch(() => null);
    const still = after.fields.some((f) => f.field === field) || after.invalidFields.includes(field);
    if (!still && detail.ariaInvalid !== "true") {
      detail.cleared = true;
      break;
    }
  }
  return detail;
}

async function expandSections(page, notes) {
  let opened = 0;
  for (const name of SECTIONS) {
    const btn = page.getByRole("button", { name, exact: true }).first();
    if (!(await btn.count())) continue;
    if ((await btn.getAttribute("aria-expanded")) !== "true") {
      await btn.click({ timeout: 5000 }).catch((e) => notes.push(`expand ${name}: ${String(e).slice(0, 60)}`));
      opened++;
    }
  }
  return opened;
}

/** One pass of "make everything valid": answer open groups, fill empty selects and inputs. */
async function sweep(page, marker, email) {
  const changed = { radios: 0, texts: 0, numbers: 0, dates: 0, selects: 0 };
  await expandSections(page, []);
  for (const group of await page.locator('[role="radiogroup"]').all()) {
    const checked = await group.locator('input[type="radio"]:checked').count().catch(() => 0);
    const ariaChecked = await group.locator('[role="radio"][aria-checked="true"]').count().catch(() => 0);
    if (checked + ariaChecked > 0) continue;
    const no = group.getByRole("radio", { name: "No", exact: true }).first();
    if (await no.count()) {
      await no.check({ timeout: 3000, force: true }).catch(async () => {
        await no.click({ timeout: 3000, force: true }).catch(() => {});
      });
      changed.radios++;
    }
  }
  for (const el of await page.locator("select").all()) {
    if (!(await el.isVisible().catch(() => false))) continue;
    if ((await el.inputValue().catch(() => "x")).trim()) continue;
    const label = ((await el.getAttribute("aria-label")) || (await el.getAttribute("name")) || (await el.getAttribute("id")) || "").toLowerCase();
    const chosen = await el
      .evaluate((sel, wantState) => {
        const opts = [...sel.options].filter((o) => o.value);
        if (!opts.length) return null;
        const stateish = opts.find((o) => /^(TX|CA|FL|NY)$/.test(o.value.trim()) || /texas|california/i.test(o.text));
        return (wantState && stateish ? stateish : opts[0]).value;
      }, /state|province|country|region/.test(label))
      .catch(() => null);
    if (chosen) {
      await el.selectOption(chosen).catch(() => {});
      changed.selects++;
    }
  }
  for (const el of await page.locator('input[type="text"], input:not([type]), textarea').all()) {
    if (!(await el.isVisible().catch(() => false))) continue;
    if ((await el.inputValue().catch(() => "x")).trim()) continue;
    const label = ((await el.getAttribute("aria-label")) || (await el.getAttribute("name")) || "").toLowerCase();
    await el.fill(/email/.test(label) ? email : marker).catch(() => {});
    changed.texts++;
  }
  for (const el of await page.locator('input[type="number"]').all()) {
    if (!(await el.isVisible().catch(() => false))) continue;
    if ((await el.inputValue().catch(() => "1")).trim()) continue;
    await el.fill("1").catch(() => {});
    changed.numbers++;
  }
  for (const el of await page.locator('input[type="date"]').all()) {
    if (!(await el.isVisible().catch(() => false))) continue;
    if ((await el.inputValue().catch(() => "x")).trim()) continue;
    await el.fill("1980-01-01").catch(() => {});
    changed.dates++;
  }
  return changed;
}

/**
 * Repair pass driven by the app's own complaints: for each field it names, reach the control the app points at
 * (via aria-describedby) and satisfy it by type. Catches stragglers a positional sweep misses.
 */
async function repairComplaints(page, fields, marker, email, notes) {
  const actions = [];
  for (const { field, text } of fields) {
    const control = page.locator(`[aria-describedby*="error-${field}"]`).first();
    if (!(await control.count())) {
      actions.push({ field, action: "unreachable", text });
      continue;
    }
    const role = (await control.getAttribute("role").catch(() => null)) || "";
    const tag = await control.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    try {
      await control.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      if (role === "checkbox" || role === "switch" || tag === "button") {
        if ((await control.getAttribute("aria-checked")) !== "true") await control.click({ timeout: 4000, force: true });
        actions.push({ field, action: "clicked", text });
      } else if (tag === "select") {
        await control
          .evaluate((sel) => {
            const opts = [...sel.options].filter((o) => o.value);
            if (opts.length) sel.value = opts[0].value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          })
          .catch(() => {});
        actions.push({ field, action: "selected", text });
      } else {
        const type = (await control.getAttribute("type").catch(() => null)) || "text";
        const value = /email/.test(field) ? email : type === "number" ? "1" : type === "date" ? "1980-01-01" : marker;
        await control.fill(value).catch(() => {});
        actions.push({ field, action: "filled:" + type, text });
      }
    } catch (e) {
      notes.push(`repair ${field}: ` + String(e).slice(0, 60));
      actions.push({ field, action: "failed", text });
    }
  }
  return actions;
}

async function submitOnce(browser, index) {
  const marker = markerFor(index);
  const email = syntheticEmail(index);
  const notes = [];
  const result = {
    index,
    marker,
    applicantEmail: email,
    startedAt: new Date().toISOString(),
    notes,
    writeAttempts: [],
    blockedWrites: [],
    sentPayload: null,
    response: null,
    confirmation: null,
    consentsInPayload: [],
    consentState: {},
    validation: [],
    repairs: [],
    swept: [],
    reachedSendableState: false,
    sent: false,
  };

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  let allowSend = false; // flipped only once validation is satisfied and we are ready for the real click
  ctx.route("**/*", async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return route.continue();
    // Deny by default. Only the submission itself may ever leave, and only in an authorised run.
    const isSubmission = SUBMIT_RE.test(req.url());
    const entry = {
      method,
      url: redact(req.url()),
      isSubmission,
      crossOrigin: (() => { try { return new URL(req.url()).origin !== ORIGIN; } catch { return null; } })(),
      allowed: allowSend && isSubmission,
      bytes: (req.postData() || "").length,
      at: new Date().toISOString().slice(11, 19),
    };
    result.writeAttempts.push(entry);
    if (!entry.allowed) result.blockedWrites.push(entry);
    // Capture the first payload the app actually tried to send: in --dry those exact bytes are the point of the
    // rehearsal, and the refusal below is what keeps them on this machine.
    if (isSubmission && !result.payload) {
      try {
        result.payload = JSON.parse(req.postData() || "{}");
        result.payloadCapturedFrom = `attempt ${result.writeAttempts.length} (${entry.method} ${entry.url.slice(0, 80)})`;
      } catch {
        result.payload = null;
      }
    }
    if (entry.allowed && !result.sentPayload) {
      try {
        result.sentPayload = JSON.parse(req.postData() || "{}");
      } catch {
        result.sentPayload = null;
      }
    }
    if (!entry.allowed) return route.abort("blockedbyclient");
    return route.continue();
  });

  const page = await ctx.newPage();
  page.on("dialog", (d) => { result.notes.push("dialog: " + d.message().slice(0, 80)); d.accept().catch(() => {}); });
  page.on("response", async (res) => {
    if (SUBMIT_RE.test(res.url()) && allowSend) {
      result.response = { status: res.status(), url: redact(res.url()) };
      result.response.body = (await res.text().catch(() => "")).slice(0, 400);
    }
  });
  page.on("pageerror", (e) => result.notes.push("pageerror: " + String(e).slice(0, 120)));

  const submitButton = () => page.getByRole("button", { name: /submit|send application/i });

  /** Click Submit and decide whether the form was accepted, from the write the app then tried to make. */
  const submitAttempt = async () => {
    const before = await page.locator("body").innerText();
    const n0 = result.writeAttempts.length;
    const btn = submitButton().first();
    const present = await btn.count();
    let clickError = null;
    if (!present) clickError = "no submit button matched /submit|send application/i";
    else await btn.click({ timeout: 6000 }).catch((e) => { clickError = String(e).slice(0, 80); });
    await page.waitForTimeout(1500);
    const writes = result.writeAttempts.slice(n0);
    const after = await page.locator("body").innerText();
    const fix = after.match(/Please fix (\d+) highlighted item/i);
    const c = await complaints(page);
    return {
      attempted: writes.length > 0,
      writes,
      clickError,
      submitButtonPresent: present,
      noticeCount: fix ? Number(fix[1]) : null,
      notice: fix ? fix[0] : "no 'Please fix' notice",
      fields: c.fields,
      invalid: c.invalid,
      invalidFields: c.invalidFields,
      freshText: after.split("\n").map((l) => l.trim()).filter((l) => l && !before.includes(l)).slice(0, 8),
    };
  };

  try {
    await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("h1", { timeout: 45000 });
    await page.waitForTimeout(1800);

    // identity — synthetic and self-describing
    const date = page.locator('input[type="date"]').first();
    if (await date.count()) await date.fill("1980-01-01").catch(() => {});
    for (const [lbl, val] of [[/state of birth/i, "TX"], [/gender/i, "Male"], [/e-?mail/i, email], [/phone|mobile|cell/i, `555-010${index}`]]) {
      const el = page.getByLabel(lbl).first();
      if (await el.count()) await el.fill(val).catch(() => {});
    }
    const nameField = page.getByLabel(/full name|^name$/i).first();
    if (await nameField.count()) await nameField.fill("QA SYNTHETIC E2E — DO NOT PROCESS").catch(() => {});
    else {
      const first = page.locator('input[type="text"]').first();
      if (await first.count()) await first.fill("QA SYNTHETIC E2E — DO NOT PROCESS").catch(() => {});
    }
    // put the searchable marker where the owner will see it in the email
    const freeText = page.getByLabel(/other|comment|notes|additional|describe/i).first();
    if (await freeText.count()) await freeText.fill(marker).catch(() => {});
    else {
      const inputs = await page.locator('textarea, input[type="text"]').all();
      for (const el of inputs.slice(1)) {
        if (await el.isVisible().catch(() => false)) { await el.fill(marker).catch(() => {}); break; }
      }
    }

    // sweep → consents → repair → read the app's own verdict, until it accepts the form or stops improving
    let lastFields = [];
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const changed = await sweep(page, marker, email);
      let v = await submitAttempt();
      const complained = new Set([...v.fields.map((f) => f.field), ...v.invalidFields]);
      const consentFields = CONSENT_FIELDS.filter((f) => complained.has(f));
      for (const field of consentFields) result.consentState[field] = await fixConsent(page, field, notes);
      if (consentFields.length) v = await submitAttempt();
      let repairs = [];
      if (!v.attempted && v.fields.length) {
        repairs = await repairComplaints(page, v.fields, marker, email, notes);
        if (repairs.length) v = await submitAttempt();
      }
      result.repairs.push(...repairs);
      result.swept.push({ pass, ...changed, consentsTicked: consentFields.length, repairs: repairs.length, attempted: v.attempted, outstanding: v.fields.map((f) => f.field) });
      result.validation.push({
        pass,
        attempted: v.attempted,
        writes: v.writes,
        clickError: v.clickError,
        notice: v.notice,
        fields: v.fields.map((f) => f.field),
        invalid: v.invalidFields,
        freshText: v.freshText,
      });
      if (v.attempted) {
        result.reachedSendableState = true;
        break;
      }
      const progress = changed.radios + changed.texts + changed.numbers + changed.dates + changed.selects + repairs.length + consentFields.length;
      const fields = v.fields.map((f) => f.field);
      const stalled = progress === 0 && lastFields.join("|") === fields.join("|");
      lastFields = fields;
      if (stalled) break;
    }

    result.markerPlacedAfterSweep = await page
      .evaluate((m) => [...document.querySelectorAll("input, textarea")].filter((el) => el.value === m).length, marker)
      .catch(() => null);

    if (!result.reachedSendableState) {
      // one explicit consent attempt so the receipt always records both controls, then a final verdict
      for (const field of CONSENT_FIELDS) if (!result.consentState[field]) result.consentState[field] = await fixConsent(page, field, notes);
      const v = await submitAttempt();
      result.reachedSendableState = v.attempted;
      result.outstandingAfterConsents = v.fields;
      result.invalidAfterConsents = v.invalidFields;
      result.noticeAfterConsents = v.notice;
      result.finalFreshText = v.freshText;
      if (!v.attempted) notes.push("never reached a sendable state: " + v.notice);
    }
    result.validationRemaining = result.reachedSendableState ? 0 : (result.outstandingAfterConsents?.length ?? 0) || (result.invalidAfterConsents?.length ?? 0);

    // A rehearsal must never send, whatever the form does: in --dry the gate is still detected (the app's attempt
    // is refused and observed), but allowSend is never raised, so nothing leaves the machine.
    if (result.reachedSendableState && DRY) {
      result.rehearsedOnly = true;
      notes.push("dry run: the sendable state was reached and the submission the app tried was refused");
    }
    if (result.reachedSendableState && !DRY) {
      allowSend = true;
      const before = await page.locator("body").innerText();
      const btn = submitButton().first();
      // The app has already had one attempt refused — that refusal is how the gate was detected — so give the real
      // click a few chances: a refused first attempt can leave the button in an error state that needs re-clicking.
      for (let click = 1; click <= 3; click++) {
        await btn.click({ timeout: 8000 }).catch((e) => notes.push(`final click ${click}: ` + String(e).slice(0, 80)));
        await page.waitForTimeout(click === 1 ? 6000 : 4000);
        if (result.writeAttempts.some((w) => w.allowed)) break;
      }
      const after = await page.locator("body").innerText();
      result.confirmation = after.split("\n").map((l) => l.trim()).filter((l) => l && !before.includes(l)).slice(0, 10);
      result.sentWrites = result.writeAttempts.filter((r) => r.allowed).length;
      result.sent = result.sentWrites > 0 && (result.response?.status ?? 500) < 400;
    }

    if (result.payload) {
      const flat = JSON.stringify(result.payload).toLowerCase();
      for (const key of ["consent", "acknowledg", "contact"]) if (flat.includes(key)) result.consentsInPayload.push(key);
      result.payloadKeys = Object.keys(result.payload);
      result.payloadBytes = JSON.stringify(result.payload).length;
    }
  } catch (err) {
    result.notes.push("threw: " + String(err).slice(0, 160));
  }
  await ctx.close();
  result.finishedAt = new Date().toISOString();
  return result;
}

// ---------------------------------------------------------------- run
const browser = await chromium.launch({ channel: process.env.CHANNEL || "chrome", headless: !HEADFUL });
const runs = [];
for (let i = 1; i <= SUBMISSIONS; i++) {
  const r = await submitOnce(browser, i);
  runs.push(r);
  if (!QUIET) {
    console.log(
      `submission ${i}/${SUBMISSIONS}: ${DRY ? "dry-run" : r.sent ? "SENT" : "not sent"} | sendable=${r.reachedSendableState} | writes ${r.writeAttempts.length} (allowed ${r.writeAttempts.filter((x) => x.allowed).length}, blocked ${r.blockedWrites.length}) | response ${r.response?.status ?? "none"} | confirm: ${JSON.stringify((r.confirmation || []).slice(0, 2))}`
    );
    for (const w of r.blockedWrites.slice(0, 6)) console.log(`   refused ${w.method} ${w.isSubmission ? "" : "(unrecognised endpoint) "}${w.url.slice(0, 110)} — ${w.bytes} bytes`);
    for (const c of Object.values(r.consentState)) console.log(`   consent ${c.field}: found=${c.found} attempts=${c.attempts} aria-checked=${c.ariaChecked} >aria-invalid=${c.ariaInvalid} cleared=${c.cleared}`);
    if (r.noticeAfterConsents) console.log("   app said:", r.noticeAfterConsents);
  }
}
await browser.close();

const complete = (r) => (DRY ? r.reachedSendableState : r.sent);
mkdirSync(resolve(HERE, "results"), { recursive: true });
const receipt = {
  mode: DRY ? "dry-run (nothing sent)" : "real submissions",
  target: TARGET,
  stamp: STAMP,
  consentsVerified: runs.map((r) => Object.values(r.consentState).map((c) => `${c.field}:cleared=${c.cleared}`)),
  submissions: runs,
  inboxSearchStrings: runs.map((r) => r.marker),
};
writeFileSync(resolve(HERE, "results", `e2e-send-${STAMP}.json`), JSON.stringify(receipt, null, 2));
writeFileSync(
  resolve(HERE, "results", `e2e-send-${STAMP}.md`),
  [
    `# End-to-end submission ${DRY ? "rehearsal (nothing sent)" : "receipt"}`,
    ``,
    `- Target: ${TARGET}`,
    `- When: ${STAMP}`,
    `- Validity gate: the application reached its own sendable state and tried to submit — ${runs.filter(complete).length}/${runs.length} submissions`,
    ...runs.map((r) =>
      [
        ``,
        `## Submission ${r.index}`,
        `- Search the inbox for: \`${r.marker}\``,
        `- Applicant address used (undeliverable by design): ${r.applicantEmail}`,
        `- Passes to sendable state: ${r.swept.map((s) => `p${s.pass}(radios ${s.radios}, selects ${s.selects}, texts ${s.texts}, numbers ${s.numbers}, dates ${s.dates}, consents ${s.consentsTicked}, repairs ${s.repairs})`).join(", ")}`,
        `- Outstanding fields named by the app: ${r.validation.map((v) => `p${v.pass}=[${v.fields.join(",")}]`).join(" ") || "none"}`,
        `- Consents: ${Object.values(r.consentState).map((c) => `${c.field} cleared=${c.cleared} attempts=${c.attempts} aria-checked=${c.ariaChecked}`).join("; ") || "none observed"}`,
        `- Writes seen: ${r.writeAttempts.length} (allowed ${r.writeAttempts.filter((x) => x.allowed).length}, refused ${r.blockedWrites.length}) — ${[...new Set(r.writeAttempts.map((w) => `${w.method} ${w.url.split("?")[0]}`))].join(", ") || "none"}`,
        `- Rehearsal safety: every write except the submission itself is refused, including the page's own first-party telemetry endpoint, so no synthetic lead is registered anywhere`,
        `- Response: ${r.response ? `${r.response.status} ${r.response.body?.slice(0, 120)}` : "none"}`,
        `- Payload: ${r.payloadBytes ?? 0} bytes captured from ${r.payloadCapturedFrom ?? "no attempt"}; keys: ${(r.payloadKeys || []).slice(0, 12).join(", ")}`,
        r.sentPayload ? `- Payload actually sent: ${JSON.stringify(r.sentPayload).length} bytes` : "",
        `- Consent values present in the payload: ${r.consentsInPayload.join(", ") || "none found"}`,
        `- On-screen confirmation: ${JSON.stringify(r.confirmation || [])}`,
        r.notes.length ? `- Notes: ${r.notes.slice(0, 5).join(" | ")}` : "",
      ].join("\n")
    ),
  ].join("\n")
);
console.log(`\nreceipt: results/e2e-send-${STAMP}.md`);
console.log(
  runs.every(complete)
    ? DRY
      ? `dry run complete: the form reached the application's own sendable state and ${runs.filter((r) => r.payloadBytes).length}/${runs.length} payloads were captured; nothing was sent.`
      : "all submissions were accepted by the application; check the inbox for the search strings above."
    : "NOT all submissions completed — see the receipt."
);
process.exit(runs.every(complete) ? 0 : 1);
