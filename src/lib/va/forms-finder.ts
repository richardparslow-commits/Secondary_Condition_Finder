import "server-only";

import { fetchVaForms } from "./sandbox";

export interface VaFormSearchItem {
  formName: string;
  title: string;
  url: string;
  lastRevisionOn: string | null;
  pages: number | null;
  validPdf: boolean | null;
}

export interface VaFormsFinderView {
  query: string;
  items: VaFormSearchItem[];
  sourceLabel: string;
  notice: string;
  live: boolean;
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
  const result = await fetchVaForms(normalizedQuery);

  if (!result.success || !result.data) {
    return {
      query: normalizedQuery,
      items: localResults(normalizedQuery),
      sourceLabel: "Local reference fallback",
      notice:
        "VA Forms search is unavailable or disabled. Only matching local references can be shown; confirm current forms on VA.gov.",
      live: false,
    };
  }

  return {
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
    sourceLabel: "VA Forms sandbox",
    notice:
      "Results came from the VA Forms sandbox. Sandbox data is for testing and may not be current; confirm forms on VA.gov before filing.",
    live: true,
  };
}
