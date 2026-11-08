import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NonServiceConnectedConditionResult } from "@/components/NonServiceConnectedConditionResult";
import { DisabilityReferenceExplorer } from "@/components/va/DisabilityReferenceExplorer";
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

  it("does not claim there is no VA term when only a bounded prefix was loaded", () => {
    const result = {
      conditionId: "tinnitus",
      conditionName: "Tinnitus",
      bodySystem: "Auditory",
      recommendation: null,
    };
    const render = (loadedCount: number, totalAvailable: number) => renderToStaticMarkup(
      NonServiceConnectedConditionResult({
        result,
        vaReference: {
          live: true,
          sourceLabel: "VA sandbox reference",
          environment: "sandbox",
          loadedCount,
          totalAvailable,
          match: null,
        },
      }),
    );

    const partial = render(200, 201);
    expect(partial).toContain("Only 200 of 201 current VA reference terms were loaded");
    expect(partial).not.toContain("No exact or curated VA reference terminology match was found");

    // Control: a complete live list still reports a genuine no-match.
    const complete = render(201, 201);
    expect(complete).toContain("No exact or curated VA reference terminology match was found");
  });

  it("shows a retry notice when the VA list is incomplete", () => {
    const html = renderToStaticMarkup(
      createElement(DisabilityReferenceExplorer, {
        items: [{ id: "1", name: "Asthma" }],
        totalAvailable: 450,
        incomplete: true,
      }),
    );

    expect(html).toContain("could not fully load");
    expect(html).toContain("try again later");
    expect(html).not.toContain("VA publishes 450 disability reference terms");
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
    expect(access).toContain("readVaSharedReferenceCacheSnapshot<T>(cacheKey)");
    expect(access).toContain(
      "writeVaSharedReferenceCache(cacheKey, view, ttlMs, undefined, sharedEpoch)",
    );

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
    // The search surface moved from the page into the action-driven component
    // (audit A01: the query is no longer URL-borne, so the form is owned by the
    // client component that submits it). Every assertion below is unchanged —
    // only the file that renders them is.
    const page = source("src/components/va/VaFormsFinder.tsx");

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
    expect(shell).toContain("totalAvailable: vaReference.totalAvailable");
    expect(suggestions).toContain("buildConditionVaReferenceMap");
    expect(suggestions).toContain("loadedCount: vaReference.items.length");
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

    expect(docs).toContain("#189 is already complete with credentialed sandbox evidence");
    expect(docs).toContain("A fallback page returning HTTP 200 is not production API evidence");
    expect(docs).toContain("VA_SHARED_CONSUMER_BUDGET=true");
    // Issue #287 closed on 2026-10-15 as a recorded scope decision (activation not
    // pursued). The activation threshold must still be stated, and the closure must
    // stay distinguishable from a completed transition.
    expect(docs).toContain("VA production activation is not being pursued");
    expect(docs).toContain("If activation is ever revived, it must be tracked as a new issue and may be closed only after the grant, controlled evidence, deployed-runtime verification, full CI and deployment readiness all have objective recorded evidence");
    expect(docs).toContain("VA_PRODUCTION_ACCESS_GRANTED");
  });
});
