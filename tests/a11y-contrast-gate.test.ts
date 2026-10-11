import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
  it("runs axe with color-contrast enabled and the jsdom gate keeps skipping it for the documented mechanical reason", () => {
    // The real-browser spec must enable the rule the jsdom gate cannot run.
    expect(spec).toContain('values: ["color-contrast"]');
    expect(spec).toContain('"critical"');
    expect(spec).toContain('"serious"');
    // The jsdom gate's skip stays exactly as documented — mechanical, not convenient.
    expect(accessibilitySetup).toContain('"color-contrast": { enabled: false }');
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
    // Route list must name the canonical research surfaces; /results is the
    // documented 307 shim to /secondary and is audited through that target.
    for (const route of [
      'path: "/"',
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
      expect(spec).toContain(route);
    }
    // Every declared route object carries a stable evidence-file label.
    const routeLines = spec.match(/\{ path: "([^"]+)", label: "([^"]+)" \}/g) ?? [];
    expect(routeLines.length).toBeGreaterThanOrEqual(20);
  });
});
