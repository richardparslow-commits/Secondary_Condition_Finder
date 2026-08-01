import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

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
      renderPageHtml(SecondaryLandingPage()),
      renderPageHtml(PresumptivePage()),
      renderPageHtml(PrivacyPage()),
      renderToStaticMarkup(await TermsPage()),
    ];

    for (const page of pages) {
      expectSingleMainLandmark(page);
      expectHeadingHierarchy(page);
    }
  });

  it("keeps route copy explicit about non-diagnostic/non-deterministic scope", async () => {
    const home = renderPageHtml(HomePage());
    const terms = renderToStaticMarkup(await TermsPage());
    const privacy = renderPageHtml(PrivacyPage());

    expect(home).toContain("This is a research aid, not advice.");
    expect(terms).toContain("Not Legal or Medical Advice");
    expect(privacy).toContain("Zero PII Policy");
  });

  it("keeps both legal routes discoverable from the main chooser page", () => {
    const home = renderPageHtml(HomePage());

    expect(home).toContain('href="/privacy"');
    expect(home).toContain('href="/terms"');
  });
});
