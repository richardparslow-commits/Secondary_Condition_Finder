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

  it("routes every public-reference loader through one shared bounded cache", () => {
    const cache = source("src/lib/va/reference-cache.ts");
    const access = source("src/lib/va/reference-cache-access.ts");
    const loaders = [
      source("src/lib/va/forms-finder.ts"),
      source("src/lib/va/disability-reference.ts"),
      source("src/lib/va/service-branches.ts"),
      source("src/lib/va/form-reference.ts"),
      source("src/lib/va/accredited-representatives.ts"),
    ];

    expect(cache).toContain("VA_REFERENCE_CACHE_TTL_MS = 5 * 60 * 1_000");
    expect(cache).toContain("retrievedAt: string | null");
    expect(cache).toContain("cacheStatus: VaReferenceCacheStatus");

    // The bounded two-tier read/promote/write sequence lives in exactly one
    // place: the shared helper.
    expect(access).toContain("readVaReferenceCache<T>(cacheKey)");
    expect(access).toContain("readVaSharedReferenceCache<T>(cacheKey)");
    expect(access).toContain("writeVaSharedReferenceCache(cacheKey, view, ttlMs)");

    for (const loader of loaders) {
      // Every loader goes through the helper with its own registry namespace...
      expect(loader).toContain("withVaReferenceCache<");
      expect(loader).toContain("VA_REFERENCE_NAMESPACES");
      // ...and none of them hand-rolls the cache dance any more. Pinning the
      // shared entry point this way is what stops a sixth loader from quietly
      // re-introducing a copy (and, with it, a new prefix collision).
      expect(loader).not.toContain("readVaReferenceCache");
      expect(loader).not.toContain("writeVaReferenceCache");
      expect(loader).not.toContain("readVaSharedReferenceCache");
      expect(loader).not.toContain("writeVaSharedReferenceCache");
      expect(loader).not.toContain("clearVaReferenceCache");
    }
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

  it("adds VA reference information inside each non-service-connected diagnosis result without changing recommend input", () => {
    const shell = source("src/app/secondary/suggestions/page.tsx");
    const suggestions = source("src/components/secondary/steps/SuggestionsStep.tsx");
    const card = source("src/components/NonServiceConnectedConditionResult.tsx");

    // PRIV-01 stage 2: the public VA reference loads in the uniform shell and
    // travels to the client step as a prop; the reference join runs locally
    // over the browser-local selections.
    expect(shell).toContain("loadDisabilityReference");
    expect(suggestions).toContain("buildConditionVaReferenceMap");
    expect(suggestions).toContain("vaReferenceMap.get(result.conditionId)");
    const recommendCall = suggestions.slice(
      suggestions.indexOf("const recommendationsResult = recommend("),
      suggestions.indexOf("const nonServiceConnectedResults ="),
    );
    expect(recommendCall).not.toContain("vaReference");
    expect(card).toContain("VA reference terminology for this diagnosis");
    expect(card).toContain("VBA terminology");
    expect(card).toContain("Administrative terminology does not establish diagnosis, service connection, rating, or medical nexus");
    expect(card).toContain('href="/va-reference"');
  });

  it("wires standardized service branches into browser-local intake context but not presumptive matching", () => {
    const page = source("src/app/presumptive/page.tsx");
    const form = source("src/components/ServiceHistoryForm.tsx");
    const history = source("src/lib/presumptive/browser-history.ts");
    const match = source("src/lib/presumptive/match.ts");

    expect(page).toContain("loadServiceBranchReference");
    expect(form).toContain('name="serviceBranchCode"');
    expect(form).toContain("do not change the presumptive matching logic");
    expect(form).toContain("serviceBranchCodes: selectedBranches");
    expect(history).toContain("serviceBranchCodes");
    expect(match).toContain("serviceBranchCodes:");
    const matchBody = match.slice(match.indexOf("export function matchPresumptives"));
    expect(matchBody).not.toContain("history.serviceBranchCodes");
  });

  it("documents environment-aware production preparation without weakening the separate sandbox gate", () => {
    const adapter = source("src/lib/va/sandbox.ts");
    const runtimeMode = source("src/lib/va/runtime-state.ts");
    const docs = source("docs/va-api-runtime-configuration.md");

    expect(adapter).toContain('export type VaApiEnvironment = "sandbox" | "production"');
    expect(adapter).toContain("VA_FORMS_PRODUCTION_API_KEY");
    expect(adapter).toContain("VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY");

    // Issue #287: the deliberate tri-state runtime mode is the single decision
    // point, and the adapter must delegate to it rather than re-deriving flags.
    expect(adapter).toContain("resolveVaReferenceMode(env)");
    expect(runtimeMode).toContain('export type VaReferenceMode = "disabled" | "sandbox" | "production"');
    expect(runtimeMode).toContain("VA_API_ENV");
    expect(runtimeMode).toContain("VA_API_ENABLED");
    // Phase 2 compatibility flag remains honored by the resolver.
    expect(runtimeMode).toContain("VA_SANDBOX_ENABLED");
    expect(runtimeMode).toContain("VA_PRODUCTION_ACCESS_GRANTED");

    expect(docs).toContain("Issue #189 remains the separate credentialed sandbox connectivity gate");
    expect(docs).toContain("VA_PRODUCTION_ACCESS_GRANTED");
  });
});
