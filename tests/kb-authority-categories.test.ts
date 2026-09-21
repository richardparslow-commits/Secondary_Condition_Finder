import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The tiered staleness windows in citations:decay only bite when references
 * carry an authorityCategory; uncategorized rows silently fall back to the
 * historical 365-day window. The 2026-09 categorization pass assigned every
 * reference in the knowledge base (374 medical-scientific-evidence from
 * PubMed/OUP hosts, 5 current-regulatory-authority citing 38 CFR 3.310).
 * These tests pin that invariant so new references cannot regress to
 * uncategorized, and so the URL-derived classification stays accurate.
 */

const KB_DIR = join(process.cwd(), "data", "knowledge-base");

type ReferenceRow = {
  citation: string;
  sourceUrl?: string;
  verificationScope?: string;
  authorityCategory?: string;
};

type KbFile = {
  suggestions?: Array<{ sourceReferences?: ReferenceRow[] }>;
};

function eachReference(): Array<{ file: string; reference: ReferenceRow }> {
  const rows: Array<{ file: string; reference: ReferenceRow }> = [];
  for (const file of readdirSync(KB_DIR).filter((name) => name.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(join(KB_DIR, file), "utf8")) as KbFile;
    for (const suggestion of data.suggestions ?? []) {
      for (const reference of suggestion.sourceReferences ?? []) {
        rows.push({ file, reference });
      }
    }
  }
  return rows;
}

function expectedCategoryFor(url: string | undefined): string | null {
  if (!url) return null;
  if (url.includes("pubmed.ncbi.nlm.nih.gov") || url.includes("academic.oup.com")) {
    return "medical-scientific-evidence";
  }
  if (url.includes("law.cornell.edu") || url.includes("ecfr.gov")) {
    return "current-regulatory-authority";
  }
  return null;
}

describe("knowledge-base authority categorization", () => {
  const rows = eachReference();

  it("categorizes every source reference so the tiered staleness windows apply", () => {
    const uncategorized = rows.filter(({ reference }) => !reference.authorityCategory);
    expect(uncategorized, uncategorized.map((r) => r.file).join(", ")).toEqual([]);
  });

  it("matches the URL-derived authority tier for every reference", () => {
    const mismatches: string[] = [];
    for (const { file, reference } of rows) {
      const expected = expectedCategoryFor(reference.sourceUrl);
      if (expected && reference.authorityCategory !== expected) {
        mismatches.push(`${file}: ${reference.sourceUrl} -> ${reference.authorityCategory} (expected ${expected})`);
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  it("keeps legal-framework rows out of the medical category and vice versa", () => {
    for (const { file, reference } of rows) {
      if (reference.verificationScope === "legal-framework") {
        expect(
          reference.authorityCategory,
          `${file}: legal-framework reference must not be categorized as medical evidence`,
        ).not.toBe("medical-scientific-evidence");
      }
      if (reference.authorityCategory === "medical-scientific-evidence") {
        expect(
          reference.verificationScope,
          `${file}: medical-scientific reference must not claim legal-framework scope`,
        ).not.toBe("legal-framework");
      }
    }
  });
});
