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

/* ─── R-09: the two design-token boundary rules this suite owns ─────────── */

const GLOBALS_CSS_TEXT = readFileSync(GLOBALS_CSS, "utf8");
const FORM_COMPONENT = "src/components/ServiceHistoryForm.tsx";

/** Tailwind slate-200 — the reviewed disabled surface. */
const DISABLED_SURFACE = "#e2e8f0";

/**
 * The rule that forces every `bg-slate-9` button to primary + white with
 * `!important`. It is why the disabled state cannot be expressed as a Tailwind
 * variant on the component.
 */
const BUTTON_NORMALIZATION_RULE = /\.app-shell button\[class\*="bg-slate-9"\][^{}]*\{([^}]*)\}/;

/** The `:disabled` state declared in the stylesheet, where it does win. */
const DISABLED_STATE_RULE = /[^{}]*\[class\*="bg-slate-9"\]:disabled[^{}]*\{([^}]*)\}/;

function walkSources(dir: string, extensions: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walkSources(full, extensions, out);
    else if (extensions.some((extension) => entry.endsWith(extension))) out.push(full);
  }
  return out;
}

/**
 * L-02 — a disabled control has to look disabled and stay readable.
 *
 * The audit recorded this as `text-white` on `disabled:bg-slate-300` = 1.49:1
 * measured from the *class list*. Measured in a real browser, that pair is not
 * what ships: the legacy palette normalization above matches
 * `button[class*="bg-slate-9"]` and forces `background: var(--primary)`,
 * `color: #fff` and the border with `!important`, so `disabled:bg-slate-300`
 * never renders. The disabled submit on `/presumptive` computed to
 * `rgb(29, 78, 216)` on `#fff` — byte-identical to the enabled control, at
 * `opacity: 1` — while the source read as if the disabled state were styled.
 * The real defect was therefore that a disabled control had no visual
 * affordance at all, and the fix belongs in the stylesheet, not the component.
 */
describe("a disabled control declares its state where the cascade lets it win (L-02)", () => {
  it("still carries the normalization rule that makes component-level disabled colours ineffective", () => {
    const rule = GLOBALS_CSS_TEXT.match(BUTTON_NORMALIZATION_RULE);
    expect(
      rule,
      "the bg-slate-9 button normalization rule is gone. If the palette " +
        "normalization was deliberately removed, the disabled state can move back " +
        "into the component and this suite should be re-aimed",
    ).not.toBeNull();
    expect(rule![1], "that rule forces the surface with !important").toMatch(
      /background:[^;]*!important/,
    );
    expect(rule![1], "and the colour with !important").toMatch(/color:[^;]*!important/);
  });

  it("declares a readable disabled state for those buttons in the stylesheet", () => {
    const rule = GLOBALS_CSS_TEXT.match(DISABLED_STATE_RULE);
    expect(
      rule,
      "no `:disabled` rule for the normalized buttons. Without one, a disabled " +
        "control renders exactly like an enabled one (measured: identical " +
        "computed background, colour and opacity)",
    ).not.toBeNull();

    const declarations = rule![1]!;
    const background = declarations.match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase();
    expect(background, "the disabled state must set an explicit background").toBeDefined();
    expect(
      background,
      "slate-200 is the reviewed disabled surface; slate-300 was the audited " +
        "pair and is not reachable through this rule either",
    ).toBe(DISABLED_SURFACE);
    expect(
      declarations,
      "the disabled text must use the --muted token, not a Tailwind slate utility",
    ).toContain("color: var(--muted)");

    const measured = ratio(tokenHex("muted"), background!);
    console.log(
      `disabled control: --muted ${tokenHex("muted")} on ${background} = ${measured.toFixed(2)}:1`,
    );
    expect(
      measured,
      "the disabled state must clear 4.5:1 — a control a low-vision user cannot " +
        "read is worse than one they cannot see is disabled",
    ).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);

    expect(
      declarations,
      "no opacity on the disabled state: translucency would lower exactly the " +
        "contrast this rule exists to keep",
    ).not.toMatch(/opacity/);
  });

  it("keeps no disabled colour utility in the component, where it cannot take effect", () => {
    const form = readFileSync(path.join(process.cwd(), FORM_COMPONENT), "utf8")
      // The comments in this component name the dead utilities on purpose, to
      // explain why the state lives in the stylesheet. Only real code counts.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(
      form.match(/disabled:(?:bg|text)-\S+/g) ?? [],
      "a `disabled:bg-*` / `disabled:text-*` utility on this button renders " +
        "nothing — the normalization rule above wins with !important — while the " +
        "source reads as though the disabled state were styled there. Declare it " +
        "in globals.css instead.",
    ).toEqual([]);
  });
});

/**
 * L-03 — `--border-strong` is decorative and must not become a control boundary.
 *
 * It measures well below the 3:1 that SC 1.4.11 requires of a form field's or
 * control's boundary, which is fine for the callout and footer-note edges it is
 * used on and a conformance failure the moment it is reused for an input. The
 * audit asked for a comment at the definition; a comment alone rots, so the
 * documented ratio is checked against the token's real value and the token's
 * usage is a closed inventory.
 */
describe("--border-strong stays decorative (L-03)", () => {
  const lines = GLOBALS_CSS_TEXT.split("\n");
  const definitionIndex = lines.findIndex((line) => /--border-strong:\s*#[0-9a-fA-F]{6}/.test(line));
  const warning = lines.slice(Math.max(0, definitionIndex - 6), definitionIndex).join("\n");

  const usages = walkSources(SRC_ROOT, [".tsx", ".css"]).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((text, index) =>
        text.includes("border-strong")
          ? [{ file: path.relative(process.cwd(), file).split(path.sep).join("/"), index, text }]
          : [],
      ),
  );

  it("warns at the definition, with the ratio that makes the warning true", () => {
    expect(definitionIndex, "--border-strong is not defined in globals.css").toBeGreaterThan(-1);
    expect(warning, "the decorative-only warning was removed or moved").toContain("DECORATIVE ONLY");
    expect(warning, "the warning must name the success criterion it fails").toContain("1.4.11");

    const measured = ratio(tokenHex("border-strong"), BACKGROUNDS.surface);
    console.log(`decorative border: --border-strong ${tokenHex("border-strong")} on surface = ${measured.toFixed(2)}:1`);
    expect(
      measured,
      "this rule only exists while the token is below the 3:1 non-text minimum",
    ).toBeLessThan(LARGE_TEXT_MIN);
    expect(
      warning,
      `the warning quotes a ratio that no longer matches the token (measured ${measured.toFixed(2)}:1)`,
    ).toContain(`${measured.toFixed(2)}:1`);
  });

  it("is used only by the reviewed decorative surfaces, all in the stylesheet", () => {
    expect(
      [...new Set(usages.map((usage) => usage.file))],
      "a component reached for --border-strong directly; components must use " +
        "--border (or darker) for any boundary a user has to perceive",
    ).toEqual(["src/app/globals.css"]);

    const texts = usages.map((usage) => usage.text);
    expect(usages.length, "a new --border-strong usage appeared; review it before allowing it").toBe(3);
    expect(
      texts.some((text) => /--border-strong:\s*#[0-9a-fA-F]{6}/.test(text)),
      "the token definition itself must still be one of the usages",
    ).toBe(true);
    for (const [selector, reason] of [
      [".ui-callout", "callout border"],
      [".ui-footer-note", "footer-note border"],
    ] as const) {
      expect(
        texts.some((text) => text.includes(selector) && text.includes("var(--border-strong)")),
        `the reviewed ${reason} (${selector}) no longer uses the token`,
      ).toBe(true);
    }
  });

  it("is not a control boundary, and controls keep using --border", () => {
    for (const usage of usages) {
      expect(
        usage.text,
        `--border-strong is on a form-control boundary at ${usage.file}:${usage.index + 1}. ` +
          `It measures 1.80:1, below the 3:1 SC 1.4.11 requires there.`,
      ).not.toMatch(
        /(?:^|[^\w-])(?:input|select|textarea|fieldset|checkbox|radio)\b|\brole="?textbox"?/i,
      );
    }

    const controlRule = GLOBALS_CSS_TEXT.match(/\.app-shell input\[type="text"\][^{}]*\{([^}]*)\}/);
    expect(controlRule, "the shared control boundary rule is gone").not.toBeNull();
    expect(
      controlRule![1],
      "form controls must keep the compliant --border boundary",
    ).toContain("border: 1px solid var(--border)");
  });
});
