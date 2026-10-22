import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRoutes } from "../scripts/lib/public-routes.mjs";

const spec = readFileSync(resolve(process.cwd(), "e2e/a11y-contrast.mjs"), "utf8");
const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const trustedTypesGate = readFileSync(
  resolve(process.cwd(), "src/components/security/TrustedTypesGate.tsx"),
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
    expect(spec).toContain("seededControl, routes: summaries");
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
    // Validation requirement from §5.5: the `git diff` on the gate must be
    // empty. Pinned here semantically: the gate still requires trusted types
    // for scripts and still refuses blob/data/same-origin-only escapes.
    expect(trustedTypesGate).toContain("require-trusted-types-for");
    expect(trustedTypesGate).toMatch(/'script'/);
    // The CSP still enforces require-trusted-types-for 'script'.
    expect(proxy).toContain("require-trusted-types-for");
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
