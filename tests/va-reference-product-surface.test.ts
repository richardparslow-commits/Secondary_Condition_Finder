import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildConditionVaReferenceMap,
  mapConditionToVaReference,
} from "@/lib/va/condition-reference";
import { matchExactVaReferenceTerm } from "@/lib/va/terminology-match";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("VA reference product surfaces", () => {
  it("keeps terminology matching conservative and exact with explicit aliases only", () => {
    const items = [
      { id: "30", name: "Migraine Headaches" },
      { id: "31", name: "Sleep Apnea" },
    ];

    expect(matchExactVaReferenceTerm("migraine-headaches", items)).toEqual(items[0]);
    expect(matchExactVaReferenceTerm("Migraine", items)).toBeNull();
    expect(matchExactVaReferenceTerm("Sleep Apnea Syndrome", items)).toBeNull();

    expect(mapConditionToVaReference({ id: "migraine", name: "Migraine" }, items).term).toBeNull();
    expect(
      mapConditionToVaReference(
        { id: "migraine", name: "Migraine" },
        items,
        { migraine: ["Migraine Headaches"] },
      ),
    ).toEqual(expect.objectContaining({ term: items[0], matchKind: "alias" }));
    expect(buildConditionVaReferenceMap([{ id: "osa", name: "Sleep Apnea" }], items).get("osa")?.term).toEqual(items[1]);
  });

  it("uses one shared bounded cache and exposes source status across public-reference loaders", () => {
    const cache = source("src/lib/va/reference-cache.ts");
    const forms = source("src/lib/va/forms-finder.ts");
    const disabilities = source("src/lib/va/disability-reference.ts");
    const branches = source("src/lib/va/service-branches.ts");

    expect(cache).toContain("VA_REFERENCE_CACHE_TTL_MS = 5 * 60 * 1_000");
    expect(cache).toContain("retrievedAt: string | null");
    expect(cache).toContain("cacheStatus: VaReferenceCacheStatus");
    expect(forms).toContain("readVaReferenceCache<VaFormsFinderView>");
    expect(disabilities).toContain("readVaReferenceCache<DisabilityReferenceView>");
    expect(branches).toContain("readVaReferenceCache<ServiceBranchReferenceView>");
  });

  it("ships a searchable Forms Finder with current-record filtering and visible source status", () => {
    const loader = source("src/lib/va/forms-finder.ts");
    const page = source("src/app/va-forms/finder/page.tsx");

    expect(loader).toContain("fetchVaForms(normalizedQuery, { config })");
    expect(loader).toContain("cacheStatus: \"hit\"");
    expect(loader).toContain(".filter((item) => !item.attributes.deleted_at)");
    expect(page).toContain('name="q"');
    expect(page).toContain("form.lastRevisionOn");
    expect(page).toContain("form.validPdf");
    expect(page).toContain("reference.retrievedAt");
    expect(page).toContain("reference.cacheStatus");
  });

  it("adds VA reference information inside each secondary result without changing recommend input", () => {
    const suggestions = source("src/app/secondary/suggestions/page.tsx");
    const card = source("src/components/SecondarySuggestionItem.tsx");

    expect(suggestions).toContain("buildConditionVaReferenceMap");
    expect(suggestions).toContain("loadDisabilityReference");
    expect(suggestions).toContain("vaReferenceMap.get(recommendation.conditionId)");
    const recommendCall = suggestions.slice(
      suggestions.indexOf("const recommendationsResult = recommend("),
      suggestions.indexOf("const linked ="),
    );
    expect(recommendCall).not.toContain("vaReference");
    expect(card).toContain("VA reference information");
    expect(card).toContain("VBA terminology");
    expect(card).toContain("it does not affect this recommendation");
    expect(card).toContain('href="/va-reference"');
  });

  it("wires standardized service branches into encrypted intake context but not presumptive matching", () => {
    const page = source("src/app/presumptive/page.tsx");
    const form = source("src/components/ServiceHistoryForm.tsx");
    const action = source("src/app/presumptive/actions.ts");
    const match = source("src/lib/presumptive/match.ts");

    expect(page).toContain("loadServiceBranchReference");
    expect(form).toContain('name="serviceBranchCode"');
    expect(form).toContain("do not change the presumptive matching logic");
    expect(action).toContain("serviceBranchCodes: formData");
    expect(match).toContain("serviceBranchCodes:");
    const matchBody = match.slice(match.indexOf("export function matchPresumptives"));
    expect(matchBody).not.toContain("history.serviceBranchCodes");
  });

  it("documents environment-aware production preparation without weakening the separate sandbox gate", () => {
    const adapter = source("src/lib/va/sandbox.ts");
    const docs = source("docs/va-api-runtime-configuration.md");

    expect(adapter).toContain('export type VaApiEnvironment = "sandbox" | "production"');
    expect(adapter).toContain("VA_API_ENV");
    expect(adapter).toContain("VA_API_ENABLED");
    expect(adapter).toContain("VA_FORMS_PRODUCTION_API_KEY");
    expect(adapter).toContain("VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY");
    expect(adapter).toContain("VA_SANDBOX_ENABLED");
    expect(docs).toContain("Issue #189 remains the separate credentialed sandbox connectivity gate");
  });
});
