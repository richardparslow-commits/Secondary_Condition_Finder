import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { matchExactVaReferenceTerm } from "@/lib/va/terminology-match";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("VA reference product surfaces", () => {
  it("keeps terminology matching conservative and exact", () => {
    const items = [
      { id: "30", name: "Migraine Headaches" },
      { id: "31", name: "Sleep Apnea" },
    ];

    expect(matchExactVaReferenceTerm("migraine-headaches", items)).toEqual(items[0]);
    expect(matchExactVaReferenceTerm("Migraine", items)).toBeNull();
    expect(matchExactVaReferenceTerm("Sleep Apnea Syndrome", items)).toBeNull();
  });

  it("ships a searchable Forms Finder with bounded public-reference caching", () => {
    const loader = source("src/lib/va/forms-finder.ts");
    const page = source("src/app/va-forms/finder/page.tsx");
    const layout = source("src/app/va-forms/layout.tsx");

    expect(loader).toContain("fetchVaForms(normalizedQuery)");
    expect(loader).toContain("const CACHE_TTL_MS = 5 * 60 * 1_000");
    expect(loader).toContain("cacheStatus: \"hit\"");
    expect(loader).toContain(".filter((item) => !item.attributes.deleted_at)");
    expect(page).toContain('name="q"');
    expect(page).toContain("form.lastRevisionOn");
    expect(page).toContain("form.validPdf");
    expect(layout).toContain('href="/va-forms/finder"');
  });

  it("exposes standardized service-branch reference data beside the service-history workflow", () => {
    const loader = source("src/lib/va/service-branches.ts");
    const page = source("src/app/va-reference/service-branches/page.tsx");
    const referenceLayout = source("src/app/va-reference/layout.tsx");
    const presumptiveLayout = source("src/app/presumptive/layout.tsx");

    expect(loader).toContain('"service-branches"');
    expect(loader).toContain("responseSchema.safeParse");
    expect(loader).toContain("Local branch fallback");
    expect(page).toContain("item.description");
    expect(referenceLayout).toContain('href="/va-reference/service-branches"');
    expect(presumptiveLayout).toContain('href="/va-reference/service-branches"');
  });
});
