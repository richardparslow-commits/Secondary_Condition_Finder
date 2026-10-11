/**
 * WCAG 2.1 AA contrast guard for design tokens.
 *
 * axe-core cannot enforce 1.4.3 here: tests/setup/accessibility.ts disables
 * `color-contrast` because jsdom applies neither computed styles nor layout, so
 * the rule can only report "incomplete". That leaves the CI gate structurally
 * blind to contrast — which is how Tailwind's built-in slate-500 text utility
 * reached production and measured 4.35:1 on `bg-slate-100` and 3.86:1 on
 * `bg-slate-200` (finding H-01).
 *
 * This suite closes that gap analytically: it reads the real hex values out of
 * src/app/globals.css and asserts the WCAG relative-luminance ratio for every
 * text/background pair the app can actually produce, then scans src/ so an
 * off-token class cannot be reintroduced without a failing build.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const GLOBALS_CSS = path.join(process.cwd(), "src/app/globals.css");
const SRC_ROOT = path.join(process.cwd(), "src");

/**
 * The off-token class this suite forbids. Assembled at runtime rather than
 * written as a literal: Tailwind v4 scans every non-ignored file in the project
 * for candidate class names, so a literal occurrence here would cause the
 * production build to emit a utility for the exact class we are guarding
 * against. Verified by checking the built CSS contains no such rule.
 */
const OFF_TOKEN_MUTED_CLASS = ["text-slate", "500"].join("-");

/**
 * What that class actually compiles to under Tailwind 4.3.3. Read out of the
 * production bundle rather than assumed: Tailwind 4.3.x re-tuned the slate ramp,
 * so slate-500 is #62748e here, NOT the #64748b of Tailwind v3 that earlier
 * audit drafts quoted. Both fail AA on slate-100/200, so the conclusion is
 * unchanged, but the ratio is 4.35:1 rather than 4.34:1.
 *
 * The project's own --muted is a literal in globals.css and is therefore immune
 * to any future palette re-tuning — which is the main argument for using it.
 */
const TAILWIND_SLATE_500 = "#62748e";

/** WCAG 2.1 AA minimums. */
const NORMAL_TEXT_MIN = 4.5;
const LARGE_TEXT_MIN = 3;

function tokenHex(name: string): string {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`design token --${name} not found in globals.css`);
  return match[1]!.toLowerCase();
}

/** sRGB channel -> linear light, per WCAG 2.1 relative luminance. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Backgrounds muted body text can legitimately sit on. slate-100 and slate-200
 * are the two that produced the measured H-01 failures (badge containers and
 * hover/active tab states).
 */
const BACKGROUNDS = {
  surface: "#ffffff", // --surface, card background
  page: "#f8fafc", // --background (slate-50)
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
} as const;

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walkTsx(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("WCAG 2.1 AA design-token contrast", () => {
  it("muted text clears 4.5:1 on every background it is used on", () => {
    const muted = tokenHex("muted");
    for (const [name, bg] of Object.entries(BACKGROUNDS)) {
      const r = ratio(muted, bg);
      expect(
        r,
        `--muted ${muted} on ${name} ${bg} = ${r.toFixed(2)}:1, needs ${NORMAL_TEXT_MIN}:1`,
      ).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    }
  });

  it("foreground text clears 4.5:1 on surface and page background", () => {
    const fg = tokenHex("foreground");
    expect(ratio(fg, BACKGROUNDS.surface)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    expect(ratio(fg, BACKGROUNDS.page)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });

  it("primary text clears 4.5:1 on white", () => {
    expect(ratio(tokenHex("primary"), BACKGROUNDS.surface)).toBeGreaterThanOrEqual(
      NORMAL_TEXT_MIN,
    );
  });

  it("exposes --color-muted so Tailwind generates the text-muted utility", () => {
    // Root cause of H-01: --muted existed in :root but was never mapped in
    // `@theme inline`, so no `text-muted` utility was generated and components
    // reached for Tailwind's built-in slate-500 text utility instead.
    const css = readFileSync(GLOBALS_CSS, "utf8");
    const theme = css.match(/@theme inline \{([^}]*)\}/);
    expect(theme, "globals.css must contain an `@theme inline` block").not.toBeNull();
    expect(theme![1], "`@theme inline` must map --color-muted").toContain(
      "--color-muted: var(--muted)",
    );
  });

  it("keeps the compliant muted colour rather than Tailwind slate-500", () => {
    // Regression guard. Tailwind's slate-500 fails AA on slate-100 and slate-200;
    // asserting that here means the suite cannot be silently satisfied by
    // re-pointing --muted at the failing value.
    expect(ratio(TAILWIND_SLATE_500, BACKGROUNDS.slate100)).toBeLessThan(NORMAL_TEXT_MIN);
    expect(ratio(TAILWIND_SLATE_500, BACKGROUNDS.slate200)).toBeLessThan(NORMAL_TEXT_MIN);
    expect(tokenHex("muted")).not.toBe(TAILWIND_SLATE_500);
  });

  it("keeps the focus token above the 3:1 non-text minimum", () => {
    // --focus draws the 3px focus-visible outline, so SC 1.4.11 applies (3:1),
    // not 4.5:1.
    expect(ratio(tokenHex("focus"), BACKGROUNDS.surface)).toBeGreaterThanOrEqual(
      LARGE_TEXT_MIN,
    );
  });
});

describe("off-token muted text is not reintroduced", () => {
  it("no component uses the off-token slate-500 text class (fails AA on slate-100/200)", () => {
    const offenders = walkTsx(SRC_ROOT)
      .map((file) => ({ file, text: readFileSync(file, "utf8") }))
      .filter(({ text }) => text.includes(OFF_TOKEN_MUTED_CLASS))
      .map(({ file }) => path.relative(process.cwd(), file));

    expect(
      offenders,
      `${OFF_TOKEN_MUTED_CLASS} fails WCAG 1.4.3 on bg-slate-100 (4.35:1) and ` +
        `bg-slate-200 (3.86:1). Use text-muted instead. ` +
        `Offending files: ${offenders.join(", ") || "(none)"}`,
    ).toEqual([]);
  });

  it("uses the text-muted token for de-emphasised copy", () => {
    // Guards against the sweep being reverted wholesale. Asserted as a floor,
    // not an exact count, so adding new muted copy does not fail the build.
    const sites = walkTsx(SRC_ROOT).reduce(
      (total, file) =>
        total + (readFileSync(file, "utf8").match(/text-muted/g)?.length ?? 0),
      0,
    );
    expect(
      sites,
      "expected the H-01 sweep to leave text-muted in use across src/",
    ).toBeGreaterThanOrEqual(65);
  });
});
