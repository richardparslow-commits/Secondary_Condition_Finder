import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import HomePage from "@/app/page";
import ConditionCausedByPage from "@/app/secondary/condition-caused-by/page";
import SecondaryLegalPage from "@/app/secondary/legal/page";
import SecondaryLandingPage from "@/app/secondary/page";
import TermsPage from "@/app/terms/page";
import { FORBIDDEN_PHRASES } from "@/lib/guardrails";
import {
  PRESUMPTIVE_TRACK_OVERVIEW,
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

function sourceFilesUnder(relativeDirectory: string): string[] {
  const root = path.join(process.cwd(), relativeDirectory);
  const files: string[] = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFilesUnder(path.relative(process.cwd(), absolute)));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
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

  it("keeps the Home presumptive card limited to the two implemented matching tracks", () => {
    const html = renderToStaticMarkup(HomePage());

    expect(html).toContain(PRESUMPTIVE_TRACK_OVERVIEW);
    expect(html).toContain("Current matching scope: Agent Orange/herbicide and burn-pit/fine-particulate presumptive tracks only");
    expect(html).toContain("Other VA presumptive pathways are not currently screened here");
    expect(html).toContain("this tool does not determine eligibility");
    expect(html).not.toContain("radiation");
    expect(html).not.toContain("cold exposure");
    expect(html).not.toContain("No nexus opinion required");
  });

  it("uses a current verification notice without obsolete phase labeling", () => {
    const html = renderToStaticMarkup(HomePage());

    expect(html).toContain(UNVERIFIED_REFERENCE_NOTICE);
    expect(html).toContain("Source references marked unverified are research starting points");
    expect(html).not.toContain("Phase 1");
  });

  it("uses the increase-in-severity aggravation standard without a permanent-worsening requirement", () => {
    const html = renderToStaticMarkup(HomePage());
    expect(html).toContain("increased in severity beyond its natural progression");

    const sourceFiles = [
      ...sourceFilesUnder("src/app"),
      ...sourceFilesUnder("src/components"),
    ];
    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, "utf8").toLowerCase();
      expect(source, file).not.toContain("permanently worsened");
      expect(source, file).not.toContain("permanent worsening");
    }
  });

  it("does not present diagnosis or a particular nexus document as universally mandatory", () => {
    const html = renderToStaticMarkup(ConditionCausedByPage());

    expect(html).toContain("Core service-connection questions");
    expect(html).toContain("Evidence must establish a current disability");
    expect(html).toContain("A named medical diagnosis is not an absolute legal prerequisite in every circumstance");
    expect(html).toContain("functional impairment of earning capacity");
    expect(html).toContain("intentionally limited to conditions you identify as diagnosed");
    expect(html).toContain("does not treat a particular document type as universally mandatory");
    expect(html).not.toContain("Three Required Elements");
    expect(html).not.toContain("A current diagnosed condition supported by appropriate evidence");
  });

  it("renders secondary citations only from the canonical legal references module", async () => {
    const pages = [
      renderToStaticMarkup(HomePage()),
      renderToStaticMarkup(SecondaryLandingPage()),
      renderToStaticMarkup(ConditionCausedByPage()),
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
