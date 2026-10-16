/**
 * What does the app actually require for the consent controls, and what does it show when they are missing?
 * Read-only: nothing is submitted (every submission-matching request is aborted).
 */
import { chromium } from "playwright";

const TARGET = "https://lifeinsurancebrokeradvocate.com/practice-application";
const SUBMIT_RE = /send-practice-application|supabase\.co|resend\.com|\.functions\./i;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.route("**/*", (route) => (SUBMIT_RE.test(route.request().url()) ? route.abort() : route.continue()));
const page = await ctx.newPage();
await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("h1", { timeout: 45000 });
await page.waitForTimeout(1800);

const describe = (el) => ({
  tag: el.tagName.toLowerCase(),
  role: el.getAttribute("role") || "",
  name: el.getAttribute("name") || "",
  ariaChecked: el.getAttribute("aria-checked"),
  ariaInvalid: el.getAttribute("aria-invalid"),
  dataState: el.getAttribute("data-state"),
  nearestInput: (() => {
    const input = el.closest("div,label,fieldset")?.querySelector('input[type="checkbox"]');
    return input ? { name: input.name, checked: input.checked } : null;
  })(),
  html: el.outerHTML.replace(/\s+/g, " ").slice(0, 220),
});

const consentButtons = await page.locator('button[role="checkbox"][name^="consents."]').all();
console.log("consent controls found:", consentButtons.length);
for (const b of consentButtons) console.log(" before:", JSON.stringify(describe(await b.elementHandle().then((h) => h.evaluate((n) => n)))));

// click each one the way a user would, then re-read
for (const b of consentButtons) {
  await b.scrollIntoViewIfNeeded().catch(() => {});
  await b.click({ timeout: 5000 }).catch((e) => console.log("click error:", String(e).slice(0, 80)));
  await page.waitForTimeout(300);
}
console.log("\nafter clicking each once:");
for (const b of consentButtons) {
  const s = await b.evaluate((n) => ({
    name: n.getAttribute("name"),
    ariaChecked: n.getAttribute("aria-checked"),
    ariaInvalid: n.getAttribute("aria-invalid"),
    dataState: n.getAttribute("data-state"),
    mirror: n.closest("div,label,fieldset")?.querySelector('input[type="checkbox"]')?.checked ?? null,
  }));
  console.log("  ", JSON.stringify(s));
}

// submit with the send aborted and read every complaint the app surfaces
const body = () => page.locator("body").innerText();
const before = await body();
await page.getByRole("button", { name: /submit|send application/i }).first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1500);
const after = await body();
const notice = after.match(/Please fix[^\n]*/i)?.[0] || "(no notice)";
const fresh = after.split("\n").map((l) => l.trim()).filter((l) => l && !before.includes(l)).slice(0, 14);
console.log("\nvalidation notice:", notice);
console.log("new on-screen text:", JSON.stringify(fresh, null, 1));

const invalid = await page.evaluate(() =>
  [...document.querySelectorAll('[aria-invalid="true"]')].slice(0, 10).map((el) => {
    const wrap = el.closest("div,label,fieldset,li");
    return {
      tag: el.tagName.toLowerCase(),
      name: el.getAttribute("name") || "",
      label: (el.getAttribute("aria-label") || wrap?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 60),
      describedBy: (el.getAttribute("aria-describedby") || "").slice(0, 60),
      describedText: (el.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText || "")
        .join(" ")
        .slice(0, 80),
    };
  })
);
console.log("\nstill aria-invalid:", JSON.stringify(invalid, null, 1));

await ctx.close();
await browser.close();
