/**
 * Reconnaissance for the opt-in submission test: find out exactly what the submit path sends, what it requires,
 * and what it shows on success — WITHOUT sending anything. Every matching request is aborted in the network layer.
 *
 * Usage: node recon-submit.mjs [--url=<target>]
 */
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const arg = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split("=").slice(1).join("=");
const TARGET = arg("url", "https://lifeinsurancebrokeradvocate.com/practice-application");
const SUBMIT = /send-practice-application|supabase\.co|resend\.com|\.functions\./i;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const captured = [];
await ctx.route("**/*", async (route) => {
  const req = route.request();
  if (SUBMIT.test(req.url())) {
    captured.push({
      method: req.method(),
      url: req.url().replace(/([?&](apikey|key|token)=)[^&]+/gi, "$1REDACTED"),
      contentType: req.headers()["content-type"] || "",
      payloadKeys: (() => {
        try {
          const d = JSON.parse(req.postData() || "{}");
          return Object.keys(d);
        } catch {
          return [`(unparsed ${(req.postData() || "").length} bytes)`];
        }
      })(),
      payloadPreview: (() => {
        try {
          const d = JSON.parse(req.postData() || "{}");
          const out = {};
          for (const [k, v] of Object.entries(d)) out[k] = typeof v === "string" ? `${v.slice(0, 40)}${v.length > 40 ? "…" : ""}` : Array.isArray(v) ? `[${v.length} items]` : typeof v;
          return out;
        } catch {
          return "(unparsed)";
        }
      })(),
    });
    return route.abort();
  }
  return route.continue();
});

const page = await ctx.newPage();
page.on("dialog", (d) => d.dismiss().catch(() => {}));
await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("h1", { timeout: 45000 });
await page.waitForTimeout 
  ? await page.waitForTimeout(1500)
  : null;

// What does the form require, and what does it offer?
const survey = await page.evaluate(() => {
  const label = (el) => (el.getAttribute("aria-label") || el.closest("label")?.innerText || el.name || el.id || "").trim().slice(0, 70);
  const required = [...document.querySelectorAll("input, select, textarea")]
    .filter((el) => el.required || el.getAttribute("aria-required") === "true")
    .map((el) => `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""}: ${label(el)}`);
  const consent = [...document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')].map((el) => label(el)).filter(Boolean);
  const buttons = [...document.querySelectorAll("button, [role=button], input[type=submit]")]
    .map((el) => (el.innerText || el.value || el.getAttribute("aria-label") || "").trim())
    .filter(Boolean)
    .filter((t) => /submit|send|apply|sign|agree/i.test(t));
  return { required: [...new Set(required)].slice(0, 20), consent: [...new Set(consent)].slice(0, 20), buttons: [...new Set(buttons)].slice(0, 10) };
});
console.log("required fields:", JSON.stringify(survey.required, null, 1));
console.log("checkbox labels (first 20):", JSON.stringify(survey.consent, null, 1));
console.log("submit-ish buttons:", JSON.stringify(survey.buttons));

// Fill the minimum a stranger would, tick every consent box, and press submit with the send aborted.
const date = page.locator('input[type="date"]').first();
if (await date.count()) await date.fill("1980-01-01").catch(() => {});
for (const [lbl, val] of [[/state of birth/i, "TX"], [/gender/i, "Male"]]) {
  const el = page.getByLabel(lbl).first();
  if (await el.count()) await el.selectOption(val).catch(() => {});
}
const nameField = page.locator('input[type="text"]').first();
if (await nameField.count()) await nameField.fill("QA SYNTHETIC E2E (do not process)").catch(() => {});
const emailField = page.getByLabel(/email/i).first();
if (await emailField.count()) await emailField.fill("qa-synthetic-e2e@example.com").catch(() => {});

for (const box of await page.locator('input[type="checkbox"], [role="checkbox"]').all()) {
  const label = ((await box.getAttribute("aria-label")) || "").trim();
  const text = await box.evaluate((el) => (el.getAttribute("aria-label") || el.closest("label")?.innerText || "").trim()).catch(() => "");
  if (/consent to contact|acknowledg|agree|authoriz/i.test(label + " " + text)) {
    const checked = await box.isChecked().catch(() => false);
    if (!checked) await box.check({ timeout: 3000 }).catch(() => {});
  }
}

const before = await page.locator("body").innerText();
const submit = page.getByRole("button", { name: /submit|send application|send/i }).first();
const hasSubmit = await submit.count();
if (hasSubmit) {
  await submit.click({ timeout: 5000 }).catch((e) => console.log("click failed:", String(e).slice(0, 100)));
  await page.waitForTimeout(2500);
}
const after = await page.locator("body").innerText();
const newText = after.split("\n").filter((l) => l.trim() && !before.includes(l)).slice(0, 12);

console.log("\ncaptured submission requests:", JSON.stringify(captured, null, 1));
console.log("submit control present:", hasSubmit);
console.log("new text after submit:", JSON.stringify(newText, null, 1));

await ctx.close();
await browser.close();
