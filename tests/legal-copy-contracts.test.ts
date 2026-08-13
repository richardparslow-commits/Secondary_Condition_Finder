import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import HomePage from "@/app/page";
import SecondaryLegalPage from "@/app/secondary/legal/page";
import SecondaryLandingPage from "@/app/secondary/page";
import TermsPage from "@/app/terms/page";
import { FORBIDDEN_PHRASES } from "@/lib/guardrails";
import {
  SECONDARY_CONTINUE_CTA,
  SECONDARY_TRACK_OVERVIEW,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { CANONICAL_REFERENCES } from "@/lib/legal/references";
import { SECONDARY_AGGRAVATED_BY_TITLE, SECONDARY_CAUSED_BY_TITLE } from "@/lib/legal/secondary-title";

const SECONDARY_REFERENCE_IDS = new Set([
  "38-cfr-3.310-a",
  "38-cfr-3.310-b",
  "m21-1-v-ii-2",
]);

function extractCitations(html: string): string[] {
  return (html.match(/38 (?:CFR|C\.F\.R\.) § [0-9.]+\([ab]\)/g) ?? []).map((citation) =>
    citation.replace("C.F.R.", "CFR"),
  );
}

describe("legal copy contracts", () => {
  it("renders the required secondary track distinction and proceed CTA", () => {
    const html = renderToStaticMarkup(SecondaryLandingPage());

    expect(html).toContain(SECONDARY_CAUSED_BY_TITLE);
    expect(html).toContain(SECONDARY_AGGRAVATED_BY_TITLE);
    expect(html).toContain(SECONDARY_CONTINUE_CTA);
    expect(html).toContain('href="/secondary/diagnosed"');
    expect(html).toContain("38 CFR § 3.310(a)");
    expect(html).toContain("38 CFR § 3.310(b)");
  });

  it("renders secondary citations only from the canonical legal references module", async () => {
    const pages = [
      renderToStaticMarkup(HomePage()),
      renderToStaticMarkup(SecondaryLandingPage()),
      renderToStaticMarkup(await TermsPage()),
    ];
    const allowed = new Set(
      CANONICAL_REFERENCES
        .filter((reference) => SECONDARY_REFERENCE_IDS.has(reference.id))
        .map((reference) => reference.citation),
    );

    for (const page of pages) {
      for (const citation of extractCitations(page)) {
        expect(allowed.has(citation)).toBe(true);
      }
    }
  });

  it("never renders the retired invalid statutory placeholders", async () => {
    const pages = [
      renderToStaticMarkup(SecondaryLandingPage()),
      renderToStaticMarkup(SecondaryLegalPage()),
      renderToStaticMarkup(await TermsPage()),
    ];

    for (const page of pages) {
      expect(page).not.toContain("81 U.S.C.");
      expect(page).not.toContain("Pub. L. 109-4");
    }
  });

  it("keeps canonical citation statuses unverified", () => {
    for (const reference of CANONICAL_REFERENCES) {
      expect(reference.verificationStatus).toBe("unverified");
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

  it("keeps the canonical secondary overview available to the landing route", () => {
    const html = renderToStaticMarkup(SecondaryLandingPage());
    expect(SECONDARY_TRACK_OVERVIEW).toBeDefined();
    expect(html).toContain("Secondary Service Connection Conditions");
  });
});
