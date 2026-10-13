import "server-only";

import { formsFinderCacheDto, VA_FORMS_CACHE_MAX_ITEMS } from "./cached-view-guard";
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

/**
 * A01: identifier-like input guard. The finder is a GET form, so the raw
 * query lands in browser history, request URLs, upstream VA traffic, and the
 * cached view value. A pasted SSN, phone, or claim number can never match a
 * form number, keyword, or title, so when the whole trimmed input is digits
 * (ignoring common separators) at identifier length, the search is refused
 * before any upstream send or cache write, and the raw value is not echoed
 * back in the view. Substring matches are deliberately out of scope: mixed
 * text still flows, and short numeric fragments (form pieces like "123-45")
 * stay searchable.
 */
const IDENTIFIER_DIGIT_FLOOR = 8;

export function looksLikePersonalIdentifier(query: string): boolean {
  const digits = query.replace(/[\s\-.()]+/g, "");
  return digits.length >= IDENTIFIER_DIGIT_FLOOR && /^\d+$/.test(digits);
}

export async function loadVaFormsFinder(
  query = "21-526EZ",
): Promise<VaFormsFinderView> {
  const trimmed = query.trim();
  if (trimmed && looksLikePersonalIdentifier(trimmed)) {
    return {
      query: "",
      items: [],
      ...vaFallbackStatus("forms-finder"),
      notice:
        "This search was not run because the query looks like a personal identifier (for example, a Social Security number). Search by form number, keyword, or title — never enter personal identifiers.",
    };
  }
  const normalizedQuery = trimmed.slice(0, 120) || "21-526EZ";
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

  const cacheDto = formsFinderCacheDto(configuredEnvironment, cacheKey);

  // A01 cache-value slice: the cached *value* never carries the raw query —
  // only the hashed key does. The loader builds cacheable views with an empty
  // query and the request's normalized text is re-attached after the cache
  // tiers, so a shared-KV dump, key listing, or promoted process-local entry
  // cannot replay what the user typed. The GET URL, browser history, and the
  // live upstream query still carry legitimate text by design (see page note).
  const cached = await withVaReferenceCache<VaFormsFinderView>(
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
          lookupKey: cacheKey,
          query: "",
          items: result.data.data
            .filter((item) => !item.attributes.deleted_at)
            .slice(0, VA_FORMS_CACHE_MAX_ITEMS)
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
      // A04: exact redacted lookup binding plus bounded per-loader fields.
      acceptSharedCached: (view) => cacheDto.safeParse(view).success,
    },
  );

  // Re-attach the request's text for display only — it was never written to
  // either cache tier. Fallbacks already carry it (they are never cached).
  if (!cached.live) return cached;
  return { ...cached, query: normalizedQuery };
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
