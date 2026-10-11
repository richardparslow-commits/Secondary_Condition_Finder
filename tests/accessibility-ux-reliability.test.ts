import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * These routes are rendered with a bare `renderToStaticMarkup`, which mounts no
 * app router. Every route in a real App Router render has one, and client
 * components that navigate on submit (`ServiceHistoryForm`,
 * `Dd214LocalAnalyzer`) legitimately call `useRouter()` — Next.js itself
 * rejects location-based navigation in client handlers
 * (@next/next/no-location-assign-relative-destination). The stub only supplies
 * that always-present context so these landmark/heading assertions can render
 * the routes; no assertion below is relaxed by it.
 */
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
}));

import AboutPage from "@/app/about/page";
import HomePage from "@/app/page";
import PresumptivePage from "@/app/presumptive/page";
import PrivacyPage from "@/app/privacy/page";
import SecondaryLandingPage from "@/app/secondary/page";
import TermsPage from "@/app/terms/page";

function renderPageHtml(element: ReturnType<typeof HomePage>): string {
  return renderToStaticMarkup(element);
}

function expectSingleMainLandmark(html: string): void {
  const mainCount = (html.match(/<main/g) ?? []).length;
  expect(mainCount).toBe(1);
}

function expectHeadingHierarchy(html: string): void {
  expect(html).toContain("<h1");
  expect(html.includes("<h3") && !html.includes("<h2")).toBe(false);
}

describe("accessibility and UX content contracts", () => {
  it("renders one main landmark and a top-level heading on primary routes", async () => {
    const pages = [
      renderPageHtml(HomePage()),
      renderPageHtml(AboutPage()),
      renderPageHtml(SecondaryLandingPage()),
      renderPageHtml(await PresumptivePage()),
      renderPageHtml(PrivacyPage()),
      renderToStaticMarkup(await TermsPage()),
    ];

    for (const page of pages) {
      expectSingleMainLandmark(page);
      expectHeadingHierarchy(page);
    }
  });

  it("keeps route copy explicit about non-diagnostic and privacy scope", async () => {
    const home = renderPageHtml(HomePage());
    const about = renderPageHtml(AboutPage());
    const terms = renderToStaticMarkup(await TermsPage());
    const privacy = renderPageHtml(PrivacyPage());

    expect(home).toContain("This is a research aid, not advice.");
    expect(about).toContain("does not diagnose medical conditions");
    expect(about).toContain("Veteran researching and organizing information");
    expect(terms).toContain("Not Legal or Medical Advice");
    expect(privacy).toContain("Privacy by design");
    expect(privacy).toContain("are not placed in page URLs");
    expect(privacy).toContain("presumptive workflow does not encode selected service locations or service dates in query strings");
    expect(privacy).toContain("does not initialize Application Insights or another client analytics/telemetry SDK");
    expect(privacy).toContain("emits allowlisted operational workflow and recommendation events");
    expect(privacy).not.toContain("does not persist workflow or recommendation event history through an application event logger");
    expect(privacy).toContain("Production account access, representatives, submissions and uploads remain disabled");
  });

  it("keeps public VA-reference and privacy copy aligned to the current architecture", () => {
    const home = renderPageHtml(HomePage());
    const about = renderPageHtml(AboutPage());
    const privacy = renderPageHtml(PrivacyPage());

    expect(home).toContain('href="/va-forms/finder"');
    expect(home).toContain("Search public VA form metadata by form number, keyword, or title");
    expect(home).not.toContain("bounded public reference for VA Form 21-526EZ");

    expect(about).toContain("searchable VA Forms metadata");
    expect(about).toContain("disability terminology and service-branch reference information");
    expect(about).toContain("operational workflow and recommendation count/status events are emitted to server logs");
    expect(about).not.toContain("does not persist workflow or recommendation event history through an application event logger");
    expect(about).toContain('href="/va-account"');
    expect(about).not.toContain("recommendation-event persistence is limited to aggregate operational counts");

    expect(privacy).toContain("environment-aware VA public-reference adapter is disabled by default");
    expect(privacy).toContain("credentialed sandbox connectivity and future production connectivity remain separate external gates");
    expect(privacy).not.toContain("VA sandbox integration is disabled by default and is a separate future integration gate");
  });

  it("keeps public scope and legal routes discoverable", () => {
    const home = renderPageHtml(HomePage());
    const about = renderPageHtml(AboutPage());

    expect(home).toContain('href="/about"');
    expect(home).toContain('href="/privacy"');
    expect(home).toContain('href="/terms"');
    expect(about).toContain('href="/privacy"');
    expect(about).toContain('href="/terms"');
  });

  it("enforces global keyboard, reflow, forced-colors, and reduced-motion safeguards", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(layout).toContain('className="skip-link"');
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain("tabIndex={-1}");

    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 3px solid var(--focus)");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("min-width: 0");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("forced-color-adjust: auto");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("announces dynamic reference and evidence status changes without exposing extra data", () => {
    const referenceExplorer = readFileSync(
      "src/components/va/DisabilityReferenceExplorer.tsx",
      "utf8",
    );
    const evidenceAnalyzer = readFileSync(
      "src/components/evidence/LocalEvidenceAnalyzer.tsx",
      "utf8",
    );

    expect(referenceExplorer).toMatch(
      /role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"[\s\S]*Showing \{matches\.length\} of \{items\.length\}/,
    );
    expect(referenceExplorer).toContain('htmlFor="va-disability-reference-search"');
    expect(referenceExplorer).toContain('id="va-disability-reference-search"');

    expect(evidenceAnalyzer).toMatch(
      /role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"[\s\S]*Extraction notices/,
    );
    expect(evidenceAnalyzer).toMatch(
      /Evidence excerpt summary[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"[\s\S]*\{totals\.nexus\} nexus-relevant excerpt/,
    );
    expect(evidenceAnalyzer).not.toContain("aria-live=\"assertive\"");
  });

  it("associates the DD-214 upload and free-text location controls with durable labels", () => {
    // B03: the production browser check found the upload control exposed only
    // as "Choose File", with no associated label/id/aria-label naming its
    // DD-214 purpose, and the free-text location input relying on a
    // placeholder as its only name. Both now carry durable programmatic names.
    const analyzer = readFileSync(
      "src/components/presumptive/Dd214LocalAnalyzer.tsx",
      "utf8",
    );

    expect(analyzer).toContain('htmlFor="dd214-file"');
    expect(analyzer).toContain('id="dd214-file"');
    expect(analyzer).toMatch(/aria-describedby="dd214-file-help"/);
    expect(analyzer).toContain('id="dd214-file-help"');

    expect(analyzer).toContain('htmlFor="dd214-location-add"');
    expect(analyzer).toContain('id="dd214-location-add"');
  });

  it("does not overstate manual Section 508 verification in the evidence report", () => {
    const audit = readFileSync("docs/accessibility-audit.md", "utf8");

    expect(audit).toContain("PARTIAL EVIDENCE — MANUAL CONFORMANCE REVIEW PENDING");
    expect(audit).toContain("Keyboard-only traversal and focus order");
    expect(audit).toContain("Screen-reader announcements and reading order");
    expect(audit).toContain("Complete Section 508 / WCAG 2.0 A+AA conformance determination");
    expect(audit).toContain("docs/section508-manual-review-workbook.md");
    expect(audit).toContain("/va-forms/finder");
    expect(audit).toContain("/va-reference/service-branches");
    expect(audit).not.toContain("Zero PII");
    expect(audit).not.toContain("| Verified |\n| **Screen Reader Announcement**");
  });

  it("keeps the manual review workbook human-only, build-specific, and incomplete by default", () => {
    const workbook = readFileSync(
      "docs/section508-manual-review-workbook.md",
      "utf8",
    );

    expect(workbook).toContain("Tester");
    expect(workbook).toContain("Deployed `main` commit SHA");
    expect(workbook).toContain("Vercel production deployment ID");
    expect(workbook).toContain("Operating system + version");
    expect(workbook).toContain("Browser + version");
    expect(workbook).toContain("Assistive technology + version");
    expect(workbook).toContain("NVDA + current Chrome/Edge");
    expect(workbook).toContain("VoiceOver + current Safari");
    expect(workbook).toContain("Browser zoom at 200%");
    expect(workbook).toContain("Windows forced-colors/high-contrast mode");
    expect(workbook).toContain("/va-forms/finder");
    expect(workbook).toContain("/va-reference/service-branches");
    expect(workbook).toContain("synthetic PDF");
    expect(workbook).toContain("synthetic DOCX");
    expect(workbook).toContain("synthetic text");
    expect(workbook).toContain("NOT TESTED");
    expect(workbook).toContain("NO — pending human review");
    expect(workbook).not.toContain("- [x]");
  });

  it("keeps workbook build identity resolved live rather than pinned to a stale build", () => {
    const workbook = readFileSync(
      "docs/section508-manual-review-workbook.md",
      "utf8",
    );

    // A committed SHA/deployment/run id goes stale the moment `main` advances and
    // silently points a human tester at a superseded build, which issue #195
    // prohibits. The session-identity rows must therefore stay blank and be
    // resolved at session start.
    const blankRows = [
      "| Deployed `main` commit SHA | |",
      "| Vercel production deployment ID | |",
      "| Vercel commit status | |",
      "| Main CI run | |",
      "| Production Runtime Readiness run | |",
      "| Tester | |",
      "| Assistive technology + version | |",
    ];
    for (const row of blankRows) {
      expect(workbook).toContain(row);
    }

    expect(workbook).toContain("node scripts/resolve-review-build-identity.mjs");
    expect(workbook).toContain("Resolve the build identity at session start");
    // Prior pinned identifiers survive only inside the clearly-labelled
    // superseded table, never as the active session identity.
    expect(workbook).toContain("Superseded build identifiers");
    expect(workbook).toContain("bbe2935274e1e00b235ac69f6ef1e8ddc4b8bdab");
    const supersededIndex = workbook.indexOf("Superseded build identifiers");
    expect(workbook.indexOf("bbe2935274e1e00b235ac69f6ef1e8ddc4b8bdab")).toBeGreaterThan(
      supersededIndex,
    );
  });

  it("keeps the build-identity resolver scoped to identity and free of accessibility results", () => {
    const script = readFileSync(
      "scripts/resolve-review-build-identity.mjs",
      "utf8",
    );

    // The resolver must never be able to emit an accessibility verdict that could
    // be mistaken for human evidence.
    expect(script).toContain("not an accessibility PASS");
    expect(script).toContain("supporting evidence only");
    expect(script).not.toMatch(/\bPASS\b\s*[|:]\s*PASS/);
    expect(script).not.toContain("NOT TESTED |");

    // No hardcoded deployment identity: everything is resolved at run time.
    expect(script).not.toContain("dpl_6GJrwnr7ToGVFHL4RUeGoFTt3YyC");
    expect(script).not.toContain("6287296680");
    expect(script).not.toContain("34000588157");
    expect(script).not.toContain("bbe2935274e1e00b235ac69f6ef1e8ddc4b8bdab");

    // Reachability probing records status only, never bodies or headers.
    expect(script).toContain('method: "HEAD"');
    expect(script).toContain("HTTP status only");
  });
});
