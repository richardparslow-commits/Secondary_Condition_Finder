import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRoutes } from "../scripts/lib/public-routes.mjs";

const spec = readFileSync(resolve(process.cwd(), "e2e/a11y-contrast.mjs"), "utf8");
const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const trustedTypesBootstrap = readFileSync(
  resolve(process.cwd(), "src/instrumentation-client.ts"),
  "utf8",
);
const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
const accessibilitySetup = readFileSync(
  resolve(process.cwd(), "tests/setup/accessibility.ts"),
  "utf8",
);

/**
 * R-05 (VA Lighthouse §5.5): automated REAL-BROWSER contrast + keyboard
 * evidence. The jsdom gate skips `color-contrast` because jsdom has no layout
 * engine; this suite pins the harness that closes that gap rather than the
 * gap itself.
 */
describe("R-05 real-browser contrast and keyboard gate", () => {
  it("runs the rendering-dependent axe rules and the jsdom gate keeps skipping color-contrast for the documented mechanical reason", () => {
    // The real-browser spec must run the rules the jsdom gate cannot: colour
    // contrast, and whether a link inside a block of text is distinguishable
    // without colour (WCAG 1.4.1). Both need a layout engine and computed
    // colours, so jsdom reports them as `incomplete` and the shipped build could
    // carry the defect into a manual review. The second rule earned its place:
    // the first run with it enabled flagged /secondary and /privacy/request.
    expect(spec).toContain('values: ["color-contrast", "link-in-text-block"]');
    expect(spec).toContain('"critical"');
    expect(spec).toContain('"serious"');
    // The jsdom gate's skip stays exactly as documented — mechanical, not convenient.
    expect(accessibilitySetup).toContain('"color-contrast": { enabled: false }');
  });

  it("scans every route in a light and a dark host context, and proves the emulation took effect", () => {
    // The app is deliberately light-only, but a host that prefers dark still
    // changes native controls and any unpainted surface. Both contexts are
    // measured per route; CDP changes the actual media feature an OS or
    // browser preference changes, and the result is verified before axe runs
    // so a refused override cannot silently become a second light pass.
    expect(spec).toContain("COLOR_SCHEME_PASSES");
    expect(spec).toContain("for (const pass of COLOR_SCHEME_PASSES)");
    expect(spec).toContain("prefers-color-scheme");
    expect(spec).toContain("Emulation.setEmulatedMedia");
    expect(spec).toContain("goog/cdp/execute");
    expect(spec).toContain("did not adopt");
    expect(spec).toContain('id: "dark-host"');
    expect(spec).toContain('evidenceSuffix: "-dark-host"');
    expect(spec).toContain("darkHostContrastViolations");
    // Each raw evidence file names the host context that produced it, so a
    // reviewer can distinguish the dark scan from a second light one.
    expect(spec).toContain("hostContext");
    expect(spec).toContain("emulatedColorScheme");
    // The app must keep its declared light palette rather than inheriting the
    // host preference, and the keyboard walk runs after the override is reset.
    expect(spec).toContain("getComputedStyle(document.documentElement).colorScheme");
    expect(spec).toContain("Reset the media override");
  });

  it("proves the dark-host pass can fail on a seeded sub-AA contrast violation", () => {
    // The dark pass must not be able to return green for a broken palette. A
    // fixed 1.26:1 pair is injected under the emulated dark preference, scanned
    // by the same rules and blocking filter, and required to be reported.
    expect(spec).toContain('id: "a11y-dark-contrast-seed"');
    expect(spec).toContain('color: "#888888"');
    expect(spec).toContain('background: "#777777"');
    expect(spec).toContain("runSeededDarkContrastControl");
    expect(spec).toContain('candidate.id === "dark-host"');
    expect(spec).toContain("contrast-seeded-dark-control.json");
    expect(spec).toContain("passed: detected !== null");
    // CSSOM writes, not inline style attributes: the CSP style-src nonce would
    // refuse a `style="…"` attribute on the seeded element.
    expect(spec).toContain('seed.style.setProperty("color"');
    expect(spec).toContain('seed.style.setProperty("background-color"');
    // It runs through the same scan before any route is audited.
    const call = spec.indexOf("= await runSeededDarkContrastControl();");
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(spec.indexOf("for (const route of ROUTES)"));
    // Fail closed: a missed seed stops the run, and the summary still records it.
    expect(spec).toContain("refusing to report a clean pass");
    expect(spec).toContain("would be vacuous");
    expect(spec).toContain("seededControl, seededKeyboardControl, routes: summaries");
  });

  it("evaluates axe through WebDriver script evaluation instead of a DOM script sink", () => {
    // Inspect code, not the explanatory header comment (which documents what
    // is *refused*): strip block comments before asserting the source only
    // ever evaulates axe via WebDriver and never builds a script URL.
    const code = spec
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/createScriptURL|blob:|data:text\/javascript/);
    expect(code).toContain("node_modules");
    expect(code).toContain("axe-core");
    expect(code).toContain("execute/sync");
    // The axe.run promise completes after sync evaluation returns, so the
    // scan call itself must use the async callback form.
    expect(code).toContain("execute/async");
    expect(code).not.toContain("<script");
  });

  it("walks keyboard focus and asserts visible focus on every step", () => {
    expect(spec).toContain("document.activeElement");
    // An invisibly focused element reports no client rects; that is the
    // visible-focus assertion.
    expect(spec).toContain("getClientRects");
    expect(spec).toContain("focus never advanced");
    expect(spec).toContain("focused an invisible element");
  });

  it("sends the TAB key, not the protocol's NULL key", () => {
    // \uE000 is WebDriver's NULL key. The walk sent it for every "Tab" step, so
    // focus never moved; each route recorded 120 steps / distinct=1 and the
    // gate's `distinct < 1` guard was satisfied by the initial scripted focus.
    // Measured on Chrome 156 before the fix: NULL leaves activeElement
    // unchanged, TAB advances it.
    expect(spec).toContain('const WEBDRIVER_KEY_TAB = "\\uE004"');
    expect(spec).not.toContain('value: "\\uE000"');
    expect(spec).toContain("actions: [\n          { type: \"keyDown\", value: WEBDRIVER_KEY_TAB }");
  });

  it("counts the element the walk starts on, and still requires advancement past it", () => {
    // The walk scripts focus onto the first tabbable element before it presses
    // anything, so that element is a target the walk reached. Counting only
    // what the keystrokes reached after it compared against a total that
    // included it: CI failed /secondary/service-connected — skip link plus the
    // step's single link — after a walk that had covered both, because the
    // rule demanded two advances from a two-element page.
    expect(spec).toContain('focusInitialised?.state === "focused" ? 1 : 0');
    expect(spec).toContain("window.__r05KeyboardLast = started ? visible[0] : null;");
    // A keystroke that moves nothing re-reports the start element, which the
    // baseline now recognises as "same", so the rule still fails a dead key.
    expect(spec).toContain("tabbableElements > 1 && distinctElements < 2");
    expect(spec).toContain("keyboardTabbableElements: keyboard.tabbableElements");
    expect(spec).toContain("so keyboard coverage evidence failed");
  });

  it("identifies advancement by element reference, not by a tag-and-label signature", () => {
    // /secondary/diagnosed ships 819 checkboxes named by their wrapping label,
    // but neither aria-label nor textContent on the input, so a `tag:label`
    // signature read every checkbox as the same value and a walk that did
    // advance appeared stuck. The walk keeps the previous element page-side and
    // compares references.
    expect(spec).toContain("window.__r05KeyboardLast");
    expect(spec).toContain("el === window.__r05KeyboardLast");
    expect(spec).toContain("sameAsPrevious");
    expect(spec).toContain("if (!active.sameAsPrevious) distinctElements += 1;");
    expect(spec).not.toContain("priorSignature");
    // Evidence labels still name the control: fall back to the wrapping label
    // so a checkbox reads as its condition rather than as an empty string.
    expect(spec).toContain("el.labels");
  });

  it("proves the TAB keystroke moves focus on a seeded control before walking routes", () => {
    // The per-route guard alone cannot distinguish a working key from a dead
    // one on a page that exposes a single tabbable element, so the run seeds two
    // adjacent buttons and requires focus to move between them.
    expect(spec).toContain("runSeededKeyboardControl");
    expect(spec).toContain('firstId: "a11y-keyboard-seed-first"');
    expect(spec).toContain('secondId: "a11y-keyboard-seed-second"');
    expect(spec).toContain("keyboard-seeded-control.json");
    expect(spec).toContain("seededKeyboardControl.advanced");
    expect(spec).toContain("refusing to report keyboard traversal");
    expect(spec).toContain("seededKeyboardControl, routes: summaries");
    const seed = spec.indexOf("= await runSeededKeyboardControl();");
    expect(seed).toBeGreaterThan(-1);
    expect(seed).toBeLessThan(spec.indexOf("for (const route of ROUTES)"));
  });

  it("re-probes before recording a route as having nothing to focus", () => {
    // Same commit, two CI runs: /secondary/evidence recorded no tabbable
    // element in one and a single one in the next. A route measured while its
    // render is still arriving must not be reported as a coverage gap, so the
    // probe is retried for a bounded window before "empty" is accepted.
    expect(spec).toContain("const KEYBOARD_PROBE_ATTEMPTS = 10;");
    expect(spec).toContain("const KEYBOARD_PROBE_DELAY_MS = 500;");
    expect(spec).toContain('if (focusInitialised?.state !== "empty") break;');
    expect(spec).toContain("no tabbable elements after");
  });

  it("measures app controls only, not the dev-only overlay render", () => {
    // `next dev` injects a tabbable `nextjs-portal` whose controls carry no
    // focus indicator and never ship. Counting it inflated the walk's numbers
    // with elements the production build does not contain.
    expect(spec).toContain('const DEV_OVERLAY_TAG = "NEXTJS-PORTAL"');
    expect(spec).toContain("el.closest(arguments[0].toLowerCase())");
    expect(spec).toContain("if (active.tag === DEV_OVERLAY_TAG) continue;");
    // The selector overcounts elements that are not in the tab order, so the
    // expected second target is the visible subset, not every selector match.
    expect(spec).toContain("const visible = focusables.filter");
    expect(spec).toContain("tabbable: visible.length");
  });

  it("writes per-route axe evidence and a summary for artifact upload", () => {
    expect(spec).toContain("a11y-evidence");
    expect(spec).toContain("summary.json");
    expect(ci).toContain("a11y-evidence/");
  });

  it("gates in the CI verify job and is re-failed by the aggregator", () => {
    expect(ci).toContain("node e2e/a11y-contrast.mjs");
    expect(ci).toContain("id: a11y_contrast");
    expect(ci).toContain("- browser-a11y-contrast (R-05): ${{ steps.a11y_contrast.outcome }}");
    expect(ci).toContain("[ \"${{ steps.a11y_contrast.outcome }}\" = \"failure\" ]");
    expect(ci).toContain("ci-a11y-contrast.log");
  });

  it("achieves this without relaxing the Trusted Types security gate", () => {
    // Validation requirement from §5.5: the gate must not be widened. Pinned
    // here semantically: the CSP still requires trusted types for scripts,
    // and the bootstrap still installs the strict policy.
    expect(trustedTypesBootstrap).toContain("installTrustedTypesDefaultPolicy");
    expect(proxy).toContain("require-trusted-types-for");
    expect(proxy).toMatch(/'script'/);
  });

  it("audits every shipped route, not a hand-picked subset", () => {
    // The route list is *derived* rather than kept in the spec: the hand-kept
    // copy had fallen four routes behind `src/app` (`/privacy/request`,
    // `/secondary/upload`, `/presumptive/results`, `/runtime-readiness`), which
    // is the drift `scripts/lib/public-routes.mjs` removes. `/results` is the
    // documented 307 shim to `/secondary`, excluded by the manifest and audited
    // through that target.
    expect(spec).toContain("public-routes.mjs");
    expect(spec).toContain("contrastRoutes()");
    expect(spec).not.toMatch(/const ROUTES = \[\s*\n\s*\{ path: "/);

    const scanned = contrastRoutes().map((entry) => entry.path);
    // The canonical research surfaces, spot-checked against the derived list.
    for (const route of [
      "/",
      "/get-records",
      "/pathways",
      "/presumptive",
      "/privacy",
      "/secondary/legal",
      "/secondary/suggestions",
      "/terms",
      "/va-account",
      "/va-forms/finder",
      "/va-reference",
    ]) {
      expect(scanned).toContain(route);
    }
    // Every scanned route carries a stable evidence-file label.
    for (const entry of contrastRoutes()) expect(entry.label).toMatch(/^[a-z0-9-]+$/);
    expect(scanned.length).toBeGreaterThanOrEqual(26);
  });
});
