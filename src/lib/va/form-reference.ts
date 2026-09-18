import "server-only";

import {
  clearVaReferenceNamespace,
  VA_REFERENCE_NAMESPACES,
  vaReferenceCacheKey,
  withVaReferenceCache,
} from "./reference-cache-access";
import {
  fetchVaForms,
  loadVaApiConfig,
  type VaApiResult,
  type VaApiSource,
} from "./sandbox";

export interface ClaimFormReference {
  formName: string;
  title: string;
  url: string;
  lastRevisionOn: string | null;
  source: VaApiSource;
  sourceLabel: string;
  notice: string;
}

const LOCAL_FORM_REFERENCE: ClaimFormReference = {
  formName: "21-526EZ",
  title: "Application for Disability Compensation and Related Compensation Benefits",
  url: "https://www.va.gov/find-forms/about-form-21-526ez/",
  lastRevisionOn: null,
  source: "local-fallback",
  sourceLabel: "Local reference",
  notice:
    "VA Forms API data is unavailable or disabled. Confirm the current form and revision on VA.gov before filing.",
};

type FormsFetcher = (
  query?: string,
) => Promise<VaApiResult<{
  data: Array<{
    attributes: {
      form_name: string;
      title: string;
      url: string;
      last_revision_on?: string | null;
      deleted_at?: string | null;
    };
  }>;
}>>;

export async function loadClaimFormReference(
  fetcher: FormsFetcher = fetchVaForms,
): Promise<ClaimFormReference> {
  const configuredEnvironment = loadVaApiConfig().environment ?? "sandbox";
  const useSharedCache = fetcher === fetchVaForms;
  const cacheKey = vaReferenceCacheKey(
    VA_REFERENCE_NAMESPACES.formReference,
    configuredEnvironment,
  );

  return withVaReferenceCache<ClaimFormReference>(
    cacheKey,
    async () => {
      const result = await fetcher("21-526EZ");
      if (!result.success || !result.data) {
        return { view: LOCAL_FORM_REFERENCE, cacheable: false };
      }

      const current = result.data.data.find(
        (item) =>
          item.attributes.form_name.toUpperCase() === "21-526EZ" &&
          !item.attributes.deleted_at,
      );

      if (!current) {
        return { view: LOCAL_FORM_REFERENCE, cacheable: false };
      }

      const production = result.source === "va-production-api";
      return {
        cacheable: true,
        view: {
          formName: current.attributes.form_name,
          title: current.attributes.title,
          url: current.attributes.url,
          lastRevisionOn: current.attributes.last_revision_on ?? null,
          source: result.source,
          sourceLabel: production
            ? "VA production reference"
            : "VA sandbox reference",
          notice: production
            ? "This metadata came from the VA Forms production API. Confirm the form on VA.gov before filing because forms and revisions can change."
            : "This metadata came from the VA sandbox environment. Sandbox data is for testing and may not be current; confirm the form on VA.gov before filing.",
        },
      };
    },
    // No `decorateHit`: `ClaimFormReference` carries no `cacheStatus` field.
    { enabled: useSharedCache },
  );
}

/**
 * Clears only this module's `forms-reference:` entries.
 *
 * This module previously exported no clear function at all, unlike its four
 * siblings — an inconsistency copy-paste drift had introduced. It appeared to
 * work only because `clearVaFormsFinderCache` cleared the shared `"forms:"`
 * prefix on its behalf. Namespaces are now disjoint and each is cleared by its
 * own owner.
 */
export function clearClaimFormReferenceCache(): number {
  return clearVaReferenceNamespace(VA_REFERENCE_NAMESPACES.formReference);
}
