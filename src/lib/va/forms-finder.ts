import "server-only";

import { type VaReferenceSourceStatus } from "./reference-cache";
import {
  clearVaReferenceNamespace,
  VA_REFERENCE_NAMESPACES,
  vaReferenceCacheKey,
  withVaReferenceCache,
} from "./reference-cache-access";
import { fetchVaForms, loadVaApiConfig } from "./sandbox";

export interface VaFormSearchItem {
  formName: string;
  title: string;
  url: string;
  lastRevisionOn: string | null;
  pages: number | null;
  validPdf: boolean | null;
}

export interface VaFormsFinderView extends VaReferenceSourceStatus {
  query: string;
  items: VaFormSearchItem[];
}

const LOCAL_526EZ: VaFormSearchItem = {
  formName: "21-526EZ",
  title: "Application for Disability Compensation and Related Compensation Benefits",
  url: "https://www.va.gov/find-forms/about-form-21-526ez/",
  lastRevisionOn: null,
  pages: null,
  validPdf: null,
};

function localResults(query: string): VaFormSearchItem[] {
  const normalized = query.toLowerCase();
  return LOCAL_526EZ.formName.toLowerCase().includes(normalized) ||
    LOCAL_526EZ.title.toLowerCase().includes(normalized)
    ? [LOCAL_526EZ]
    : [];
}

export async function loadVaFormsFinder(
  query = "21-526EZ",
): Promise<VaFormsFinderView> {
  const normalizedQuery = query.trim().slice(0, 120) || "21-526EZ";
  const config = loadVaApiConfig();
  const environment = config.environment ?? "sandbox";
  const cacheKey = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.formsFinder,
    environment,
    normalizedQuery.toLowerCase(),
  );

  return withVaReferenceCache<VaFormsFinderView>(
    cacheKey,
    async () => {
      const result = await fetchVaForms(normalizedQuery, { config });

      if (!result.success || !result.data) {
        return {
          cacheable: false,
          view: {
            query: normalizedQuery,
            items: localResults(normalizedQuery),
            source: "local-fallback",
            sourceLabel: "Local reference fallback",
            notice:
              "VA Forms search is unavailable or disabled. Only matching local references can be shown; confirm current forms on VA.gov.",
            live: false,
            environment: null,
            retrievedAt: null,
            cacheStatus: "miss",
          },
        };
      }

      const retrievedAt = new Date().toISOString();
      return {
        cacheable: true,
        view: {
          query: normalizedQuery,
          items: result.data.data
            .filter((item) => !item.attributes.deleted_at)
            .slice(0, 25)
            .map((item) => ({
              formName: item.attributes.form_name,
              title: item.attributes.title,
              url: item.attributes.url,
              lastRevisionOn: item.attributes.last_revision_on ?? null,
              pages: item.attributes.pages ?? null,
              validPdf: item.attributes.valid_pdf ?? null,
            })),
          source: result.source,
          sourceLabel:
            environment === "production"
              ? "VA Forms production"
              : "VA Forms sandbox",
          notice:
            environment === "production"
              ? "Results came from the VA Forms production API. Confirm the form on VA.gov before filing because forms and revisions can change."
              : "Results came from the VA Forms sandbox. Sandbox data is for testing and may not be current; confirm forms on VA.gov before filing.",
          live: true,
          environment,
          retrievedAt,
          cacheStatus: "miss",
        },
      };
    },
    { decorateHit: (view) => ({ ...view, cacheStatus: "hit" }) },
  );
}

/**
 * Clears only this module's `forms-finder:` entries.
 *
 * This previously cleared the `"forms:"` prefix, which also matched the
 * `form-reference` module's `forms:reference:` keys — one module silently
 * invalidating another's cache. Namespaces are now disjoint by construction.
 */
export function clearVaFormsFinderCache(): number {
  return clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.formsFinder);
}
