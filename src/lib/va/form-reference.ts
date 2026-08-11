import { fetchVaForms, type VaSandboxResult } from "./sandbox";

export interface ClaimFormReference {
  formName: string;
  title: string;
  url: string;
  lastRevisionOn: string | null;
  source: "va-sandbox-api" | "local-fallback";
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
    "VA sandbox data is unavailable or disabled. Confirm the current form and revision on VA.gov before filing.",
};

type FormsFetcher = (
  query?: string,
) => Promise<VaSandboxResult<{
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
  const result = await fetcher("21-526EZ");
  if (!result.success || !result.data) return LOCAL_FORM_REFERENCE;

  const current = result.data.data.find(
    (item) =>
      item.attributes.form_name.toUpperCase() === "21-526EZ" &&
      !item.attributes.deleted_at,
  );

  if (!current) return LOCAL_FORM_REFERENCE;

  return {
    formName: current.attributes.form_name,
    title: current.attributes.title,
    url: current.attributes.url,
    lastRevisionOn: current.attributes.last_revision_on ?? null,
    source: "va-sandbox-api",
    sourceLabel: "VA sandbox reference",
    notice:
      "This metadata came from the VA sandbox environment. Sandbox data is for testing and may not be current; confirm the form on VA.gov before filing.",
  };
}
