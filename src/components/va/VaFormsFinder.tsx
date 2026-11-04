"use client";

import { useActionState, useState } from "react";

import { searchVaFormsFinder } from "@/lib/actions/va-forms-finder";
import type { VaFormsFinderView } from "@/lib/va/forms-finder";
// Constants and the state type come from the plain shared module, not the
// Server Action module: a Server Action module has no non-function exports in
// the client graph, and importing them from there answered 500 in the browser.
import {
  FORMS_FINDER_QUERY_MAX_LENGTH,
  FORMS_FINDER_REFUSAL_MESSAGE,
  FORMS_FINDER_UNAVAILABLE_MESSAGE,
  type VaFormsFinderSearchState,
} from "@/lib/va/forms-finder-search";

interface Props {
  /** Default view, rendered server-side so the surface works before any submit. */
  initialView: VaFormsFinderView;
}

function formatRetrievedAt(value: string | null): string {
  return value
    ? new Date(value).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC"
    : "Not available";
}

/**
 * Forms Finder (audit A01).
 *
 * Search text is submitted through a Server Action, so it travels in the
 * request **body**. This surface never navigates and never rewrites browser
 * history: there is no GET form, no client-side navigation, and no redirect
 * built from what was typed. That is the whole point of this component — a URL
 * is copied, bookmarked, synced, and written to the hosting request log, and
 * the text a visitor types here is not theirs to have recorded that way.
 * (tests/va-forms-finder-no-url-exposure.test.ts pins the absence of every
 * navigation and URL-building API in this file.)
 */
export function VaFormsFinder({ initialView }: Props) {
  const [state, formAction, pending] = useActionState<
    VaFormsFinderSearchState,
    FormData
  >(async (previous, formData) => {
    try {
      return await searchVaFormsFinder(previous, formData);
    } catch {
      // The request never reached the server (offline, DNS failure, an
      // interrupted tunnel). Returning the prior view keeps the finder, its
      // results and the page around it mounted; letting the rejection escape
      // replaced the whole route with the error boundary and lost the typed
      // query. The copy is fixed and names no submitted text.
      return { ...previous, refusal: "unavailable" as const };
    }
  }, { view: initialView, refusal: null });

  const reference = state.view;
  // Controlled so the implicit reset after an action cannot clear what was
  // typed: a failed search must leave the query in place for a retry.
  const [query, setQuery] = useState(reference.query);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">VA Form Finder</h1>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
          {reference.sourceLabel}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Search public VA form metadata by form number, keyword, or title. Never
        enter personal identifiers (for example, a Social Security number) — the
        text is submitted in the request body, so it does not appear in the
        address bar, browser history, or a link you copy. It is sent to the VA
        Forms service only while live VA access is explicitly enabled.
      </p>

      <form action={formAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <label htmlFor="va-form-query" className="block text-sm font-semibold">
          Search VA forms
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="va-form-query"
            name="q"
            type="search"
            maxLength={FORMS_FINDER_QUERY_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {state.refusal && (
        <p
          role="alert"
          className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          {state.refusal === "unavailable"
            ? FORMS_FINDER_UNAVAILABLE_MESSAGE
            : FORMS_FINDER_REFUSAL_MESSAGE}
        </p>
      )}

      <div role="note" className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {reference.notice}
      </div>
      <dl className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-800">Environment</dt>
          <dd>{reference.environment ?? "local fallback"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Last successful retrieval</dt>
          <dd>{formatRetrievedAt(reference.retrievedAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Cache</dt>
          <dd>{reference.live ? reference.cacheStatus : "not used"}</dd>
        </div>
      </dl>

      <section className="mt-6" aria-labelledby="forms-results-heading">
        <h2 id="forms-results-heading" className="text-xl font-semibold">
          Search results
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {reference.items.length} result{reference.items.length === 1 ? "" : "s"} shown for{" "}
          {reference.query}.
        </p>
        <div className="mt-4 space-y-4">
          {reference.items.map((form) => (
            <article
              key={`${form.formName}-${form.url}`}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <h3 className="text-lg font-semibold">VA Form {form.formName}</h3>
              <p className="mt-1 text-sm text-slate-700">{form.title}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-medium">Last revision</dt>
                  <dd>{form.lastRevisionOn ?? "Not reported"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Pages</dt>
                  <dd>{form.pages ?? "Not reported"}</dd>
                </div>
                <div>
                  <dt className="font-medium">PDF status</dt>
                  <dd>
                    {form.validPdf === null ? "Not reported" : form.validPdf ? "Valid" : "Not confirmed"}
                  </dd>
                </div>
              </dl>
              <a
                href={form.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block underline"
              >
                Open official form reference
              </a>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
