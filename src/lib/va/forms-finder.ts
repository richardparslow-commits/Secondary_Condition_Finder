import "server-only";

import { isTrustedCachedLiveView } from "./cached-view-guard";
import {
  resolveVaResultEnvironment,
  vaFallbackStatus,
  vaLiveStatus,
} from "./provenance";
import {
  hashedCacheKeySegment,
  type VaReferenceSourceStatus,
} from "./reference-cache";
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
  const configuredEnvironment = config.environment ?? "sandbox";
  // The user-supplied query is hashed, never persisted as raw key material
  // (see `hashedCacheKeySegment`); the `q` segment marks the user-supplied
  // part so it can never read as another module's namespace payload.
  const cacheKey = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.formsFinder,
    configuredEnvironment,
    "q",
    hashedCacheKeySegment(normalizedQuery.toLowerCase()),
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
            ...vaFallbackStatus("forms-finder"),
          },
        };
      }

      const environment = resolveVaResultEnvironment(
        result,
        configuredEnvironment,
      );
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
          ...vaLiveStatus("forms-finder", environment, result.source),
        },
      };
    },
    {
      // Activation first: a disabled integration must never serve a previously
      // cached live view, so the tiers are bypassed entirely when it is off.
      enabled: config.enabled,
      singleFlight: config.enabled,
      decorateHit: (view) => ({ ...view, cacheStatus: "hit" }),
      // Read-side guard: a shared value may only be served if it still carries
      // this deployment's provenance and only credential-free HTTPS links.
      acceptSharedCached: (view) =>
        isTrustedCachedLiveView(view, configuredEnvironment),
    },
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
