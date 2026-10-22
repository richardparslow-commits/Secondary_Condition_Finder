import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRoutes } from "../scripts/lib/public-routes.mjs";

const spec = readFileSync(resolve(process.cwd(), "e2e/a11y-full.mjs"), "utf8");
const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");

/**
 * The full-route gate is deliberately a second real-browser pass, not a relabel
 * of R-05: R-05 runs only `color-contrast` and `link-in-text-block` through
 * WebDriver, and the jsdom gate renders nothing. This suite pins the pieces
 * that make the Playwright pass real — the derived route set, the full WCAG tag
 * set, the serious/critical bar, a non-vacuous scan, and CI enforcement — so it
 * cannot be reduced to a check that always passes.
 */
describe("full-route axe gate (Playwright)", () => {
  it("audits every route derived from the public-route manifest", () => {
    expect(spec).toContain('from "playwright"');
    expect(spec).toContain("chromium.launch");
    expect(spec).toContain("public-routes.mjs");
    expect(spec).toContain("contrastRoutes()");
    expect(spec).toContain("for (const route of ROUTES)");
    expect(spec).toContain("page.goto");
    // A hand-picked list would drift; the manifest is the source of truth.
    expect(spec).not.toMatch(/const ROUTES = \[\s*\{ path: "/);
    expect(contrastRoutes().length).toBeGreaterThanOrEqual(26);
  });

  it("keeps the demo page's rendered-content assertion", () => {
    expect(spec).toContain('const DEMO_ROUTE = "/scenarios"');
    expect(spec).toContain("Demo scenarios");
    expect(spec).toContain("main article");
    expect(spec).toContain("readBundledDemoScenarios");
    expect(spec).toContain("scenarioCards !== expectedDemoCards");
    expect(spec).toContain("did not fully render");
  });

  it("runs the WCAG 2.1 A/AA rule set and fails only on serious or critical impacts", () => {
    expect(spec).toContain('["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]');
    expect(spec).toContain('new Set(["critical", "serious"])');
    expect(spec).toContain("blockingViolations");
    expect(spec).toContain("serious/critical WCAG 2.1 A/AA violation(s)");
    // Moderate/minor findings may be recorded, but the gate's bar stays the
    // same as the jsdom gate: critical/serious only.
    expect(spec).not.toContain('"moderate"');
  });

  it("re-scans every route under an emulated dark host and proves the emulation took", () => {
    // The app is light-only, but a dark host still changes the context around it
    // (native controls, scrollbars, unpainted surfaces). R-05 covers two rules in
    // that context; this gate covers the full tag set in it too.
    expect(spec).toContain("HOST_COLOR_SCHEMES");
    expect(spec).toContain('id: "dark-host"');
    expect(spec).toContain('media: "dark"');
    expect(spec).toContain("page.emulateMedia({ colorScheme");
    // Emulated before the navigation, so the scan never measures a repaint.
    // Sliced from the route audit itself: the seeded control navigates first.
    const routeAudit = spec.slice(spec.indexOf("async function auditRoute"));
    expect(routeAudit.indexOf("page.emulateMedia({ colorScheme")).toBeGreaterThan(-1);
    expect(routeAudit.indexOf("page.emulateMedia({ colorScheme")).toBeLessThan(
      routeAudit.indexOf("const response = await page.goto"),
    );
    // A silently refused emulation would make the dark pass a second light pass.
    expect(spec).toContain('window.matchMedia("(prefers-color-scheme: dark)")');
    expect(spec).toContain("did not adopt the emulated preference");
    // Every route is scanned in every context, and a missing dark pass is a
    // failure, not a note: zero dark rows cannot read as a clean control.
    expect(spec).toContain("for (const hostColorScheme of HOST_COLOR_SCHEMES)");
    expect(spec).toContain("darkHostAuditedRouteCount");
    expect(spec).toContain("the dark control is vacuous");
    // Dark findings decide through the same impacts and the same throw path.
    expect(spec).toContain("darkHostViolations");
    expect(spec).toContain("darkHostBlocking");
    expect(spec).toContain("hostSuffix");
  });

  it("refuses a vacuous scan and records attributable evidence before failing", () => {
    expect(spec).toContain("axe inspected nothing");
    expect(spec).toContain("results.axeVersion");
    expect(spec).toContain("full-axe.json");
    expect(spec).toContain("a11y-evidence");
    // Written before the blocking violation or route error throws, so a red run
    // still uploads the report that explains it.
    const writeIndex = spec.indexOf("fs.writeFileSync(EVIDENCE_FILE");
    // The real-scan call, not a seeded control's (both run before evidence is
    // written, and the last throw in the file is the route sweep's).
    const throwIndex = spec.lastIndexOf("throwGateFailure(problems, EVIDENCE_FILE)");
    expect(writeIndex).toBeGreaterThan(-1);
    expect(throwIndex).toBeGreaterThan(writeIndex);
  });

  it("proves the scan can go red before trusting a clean route result", () => {
    // A gate that cannot report a known violation passes for the wrong reason.
    // The control seeds one deterministic critical failure, requires axe to
    // find it, and requires the gate's own failure decision to throw on it —
    // so detection, the impact filter and the throw path are all exercised on
    // every run, not only in the run that happened to find a real problem.
    expect(spec).toContain('const SEEDED_CONTROL_RULE = "button-name"');
    expect(spec).toContain('document.createElement("button")');
    expect(spec).toContain("runSeededControl(axeSource, EVIDENCE_FILE)");
    expect(spec).toContain("failurePathExercised");
    expect(spec).toContain(
      "the gate detected the seeded violation but its failure path did not go red",
    );
    expect(spec).toContain("seeded-violation control failed");
    expect(spec).toContain("seededControl,");
    // Fail closed: a broken control must abort the run, not be noted and passed.
    expect(spec).toContain("if (!seededControl.passed)");
    // Run before the 26-route sweep, so a broken detector stops early.
    expect(spec.indexOf("runSeededControl(axeSource")).toBeLessThan(
      spec.indexOf("auditAllRoutes(page"),
    );
    // Both the control and the real findings decide through the same helpers.
    expect(spec.match(/gateProblems\(\{/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(spec.match(/throwGateFailure\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("proves the dark-host scan can report broken contrast on every run", () => {
    // The emulation guard shows the dark pass is dark; this shows a dark scan
    // still measures contrast, and that the failure names the dark pass.
    expect(spec).toContain("runSeededDarkContrastControl(axeSource)");
    expect(spec).toContain("SEEDED_DARK_CONTRAST");
    expect(spec).toContain('color: "#888888"');
    expect(spec).toContain('background: "#777777"');
    expect(spec).toContain('rule: "color-contrast"');
    expect(spec).toContain("failurePathExercised = error instanceof Error && error.message.includes(\"(dark host)\")");
    expect(spec).toContain("the dark-host contrast seed was detected and named as a dark-host finding");
    expect(spec).toContain("darkHostContrast");
    // Its result joins the seeded control's failures, so it aborts the run too.
    expect(spec).toContain("failures.push(...darkHostContrast.failures)");
    // Still before the route sweep: a broken dark detector stops early.
    expect(spec.indexOf("runSeededDarkContrastControl(axeSource)")).toBeLessThan(
      spec.indexOf("const { routes, errors } = await auditAllRoutes"),
    );
  });

  it("injects axe through the browser protocol without relaxing Trusted Types", () => {
    // `addScriptTag` is a DOM script sink and would engage the production
    // `require-trusted-types-for 'script'` policy; the CDP-backed init script
    // does not. Pinning the choice keeps the gate from forcing a CSP change.
    expect(spec).toContain("addInitScript");
    expect(spec).not.toContain("addScriptTag");
    expect(spec).toContain("axe-core");
    expect(spec).toContain("Trusted Types");
  });

  it("audits the production build, matching the artifact CI has just built", () => {
    expect(spec).toContain('"start"');
    expect(spec).toContain(".next");
    expect(spec).toContain("BUILD_ID");
    expect(spec).toContain("npm run build");
  });

  it("exposes an npm entrypoint and a pinned Playwright dev dependency", () => {
    expect(packageJson.scripts?.["a11y:full"]).toBe("node e2e/a11y-full.mjs");
    expect(packageJson.devDependencies?.playwright).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("gates in the CI verify job and is re-failed by the aggregator", () => {
    expect(ci).toContain("npm run a11y:full");
    expect(ci).toContain("id: a11y_full");
    expect(ci).toContain("- browser-a11y-full (Playwright): ${{ steps.a11y_full.outcome }}");
    expect(ci).toContain('[ "${{ steps.a11y_full.outcome }}" = "failure" ]');
    expect(ci).toContain("ci-a11y-full.log");
    // The gate uses the build output, so it must not run after a failed build.
    expect(ci).toMatch(/Run Playwright axe gate on every route[\s\S]{0,200}steps\.build\.outcome == 'success'/);
  });
});
