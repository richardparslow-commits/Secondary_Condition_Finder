import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

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
    expect(privacy).toContain("Automatic route, AJAX, and fetch tracking are disabled");
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

  it("does not overstate manual Section 508 verification in the evidence report", () => {
    const audit = readFileSync("docs/accessibility-audit.md", "utf8");

    expect(audit).toContain("PARTIAL EVIDENCE — MANUAL CONFORMANCE REVIEW PENDING");
    expect(audit).toContain("Keyboard-only traversal and focus order");
    expect(audit).toContain("Screen-reader announcements and reading order");
    expect(audit).toContain("Complete Section 508 / WCAG 2.0 AA conformance determination");
    expect(audit).not.toContain("Zero PII");
    expect(audit).not.toContain("| Verified |\n| **Screen Reader Announcement**");
  });
});
