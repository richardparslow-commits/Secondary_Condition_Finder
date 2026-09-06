import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import HomePage from "@/app/page";
import SecondaryLandingPage from "@/app/secondary/page";
import TermsPage from "@/app/terms/page";
import { FORBIDDEN_PHRASES } from "@/lib/guardrails";
import {
  CAUSED_AGGRAVATED_DISTINCTION,
  SECONDARY_CONTINUE_CTA,
  SECONDARY_TRACK_OVERVIEW,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { SECONDARY_LEGAL_REFERENCES } from "@/lib/legal/references";

function extractCitations(html: string): string[] {
  return html.match(/38 CFR [0-9.]+(?: and [0-9.]+)?/g) ?? [];
}

describe("legal copy contracts", () => {
  it("keeps secondary explainer order and proceed CTA before step one", () => {
    const html = renderToStaticMarkup(SecondaryLandingPage());
    const overviewIndex = html.indexOf(SECONDARY_TRACK_OVERVIEW);
    const causedAggravatedIndex = html.indexOf(CAUSED_AGGRAVATED_DISTINCTION);
    const distinctionIndex = html.indexOf(TRACK_DISTINCTION_NOTICE);
    const referencesIndex = html.indexOf("Supporting references");
    const ctaIndex = html.indexOf(SECONDARY_CONTINUE_CTA);

    expect(overviewIndex).toBeGreaterThan(-1);
    expect(causedAggravatedIndex).toBeGreaterThan(overviewIndex);
    expect(distinctionIndex).toBeGreaterThan(causedAggravatedIndex);
    expect(referencesIndex).toBeGreaterThan(distinctionIndex);
    expect(ctaIndex).toBeGreaterThan(referencesIndex);
  });

  it("renders secondary citations from the canonical legal references module", async () => {
    const pages = [
      renderToStaticMarkup(HomePage()),
      renderToStaticMarkup(SecondaryLandingPage()),
      renderToStaticMarkup(await TermsPage()),
    ];
    const allowed = new Set(
      SECONDARY_LEGAL_REFERENCES.map((reference) => reference.citation),
    );

    for (const page of pages) {
      const citations = extractCitations(page);
      for (const citation of citations) {
        expect(allowed.has(citation)).toBe(true);
      }
    }
  });

  it("keeps non-diagnostic and non-deterministic language contracts", async () => {
    const pages = [
      renderToStaticMarkup(HomePage()),
      renderToStaticMarkup(SecondaryLandingPage()),
      renderToStaticMarkup(await TermsPage()),
    ];

    for (const page of pages) {
      expect(page).toContain(UNVERIFIED_REFERENCE_NOTICE);
      const lower = page.toLowerCase();
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(lower).not.toContain(phrase.toLowerCase());
      }
    }
  });
});
