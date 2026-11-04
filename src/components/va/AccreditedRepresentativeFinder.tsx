"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { searchAccreditedRepresentatives } from "@/lib/actions/accredited-representatives";
import type { AccreditedRepresentativeView } from "@/lib/va/accredited-representatives";
import {
  ACCREDITED_REP_VALIDATION_MESSAGES,
  APPROVED_RADIUS_MILES,
} from "@/lib/va/accredited-representative-constants";
// Constants and the state type come from the plain shared module, not the
// Server Action module: a Server Action module has no non-function exports in
// the client graph and importing them from there answers 500 in the browser.
import {
  ACCREDITED_REP_REFUSAL_MESSAGE,
  ACCREDITED_REP_UNAVAILABLE_MESSAGE,
  type AccreditedRepSearchState,
} from "@/lib/va/accredited-rep-search";

interface Props {
  /**
   * The page this finder is rendered on. It is submitted with the search and
   * used **only** to attribute the audit event — it is never concatenated into
   * a URL, because the action returns its result as state instead of
   * redirecting (audit A01).
   */
  returnTo: string;
}

const RADIUS_OPTIONS = APPROVED_RADIUS_MILES;
const INITIAL_VISIBLE_REPRESENTATIVES = 25;
const VISIBLE_REPRESENTATIVES_STEP = 25;

/**
 * The lookup results, with a bounded first page.
 *
 * The loader keeps the nearest representatives up to the cache DTO's bound;
 * this renders a short first page and reveals the rest on request. Showing a
 * dense ZIP's whole list at once buried the page, while rendering none of it
 * (the old over-limit path) told the visitor no one was nearby
 * (Heal s1-many-reps-shown-as-none-found-1).
 */
export function RepresentativeResults({ view }: { view: AccreditedRepresentativeView }) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE_REPRESENTATIVES);

  if (view.items.length === 0) {
    // An empty list means two different things, and the loader distinguishes
    // them with `live`: a live directory answered with no matches, or the
    // directory could not be read at all. Rendering the first copy for both
    // told a visitor during an outage that nobody was nearby, which is a claim
    // the app cannot make (Heal s2-rep-directory-failure-shown-as-no-results-1).
    return view.live ? (
      <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        No accredited representatives found within {view.params.radiusMiles ?? 50} miles of {view.params.zip}. Try a larger radius or search{" "}
        <a href="https://www.va.gov/ogc/apps/accreditation/index.asp" target="_blank" rel="noreferrer" className="underline">
          va.gov/ogc/apps/accreditation
        </a>
        .
      </p>
    ) : (
      <p role="status" className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        VA&apos;s accredited-representative directory could not be loaded just now, so no nearby representatives can be shown. Try again later or search{" "}
        <a href="https://www.va.gov/ogc/apps/accreditation/index.asp" target="_blank" rel="noreferrer" className="underline">
          va.gov/ogc/apps/accreditation
        </a>
        .
      </p>
    );
  }

  const shown = view.items.slice(0, visible);
  return (
    <>
      <p className="mt-4 text-xs text-slate-600">
        Showing {shown.length} of {view.items.length} accredited representatives, nearest first.
      </p>
      <ul className="mt-2 space-y-3">
        {shown.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {item.name}
              <span className="ml-2 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">{item.accreditationType}</span>
            </p>
            {item.organization && <p className="text-sm text-slate-700">{item.organization}</p>}
            {item.specializations && item.specializations.length > 0 && (
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Specializations: </span>
                {item.specializations.join(", ")}
              </p>
            )}
            <p className="text-xs text-muted">
              {item.address ? `${item.address} · ` : ""}
              {item.zip}
              {item.distanceMiles != null ? ` · ${item.distanceMiles.toFixed(1)} mi` : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs">
              {item.phone && <a href={`tel:${item.phone}`} className="underline">{item.phone}</a>}
              {item.website && (
                <a href={item.website} target="_blank" rel="noreferrer" className="underline">
                  Website
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {shown.length < view.items.length && (
        <button
          type="button"
          onClick={() => setVisible((count) => count + VISIBLE_REPRESENTATIVES_STEP)}
          className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Show more representatives
        </button>
      )}
    </>
  );
}

/**
 * Accredited-representative locator (audit A01).
 *
 * The lookup is submitted through a Server Action, so the ZIP travels in the
 * request **body**. This surface never navigates and never rewrites browser
 * history: there is no `?zip=` URL, no client-side navigation, and no redirect
 * built from the lookup. That is the point of this component — a URL is copied,
 * bookmarked, synced, and written to the hosting request line, and a ZIP is a
 * quasi-identifier that the visitor does not owe the log a copy of.
 * (`tests/va-accredited-rep-no-url-exposure.test.ts` pins the absence of every
 * URL-building and navigation API here.)
 */
export function AccreditedRepresentativeFinder({ returnTo }: Props) {
  const [state, formAction, pending] = useActionState<
    AccreditedRepSearchState,
    FormData
  >(async (previous, formData) => {
    try {
      return await searchAccreditedRepresentatives(previous, formData);
    } catch {
      // The request never reached the server (offline, DNS failure, an
      // interrupted tunnel). Returning a state keeps the page — and the
      // suggestions around this finder — mounted; letting the rejection escape
      // replaced the whole route with an error boundary
      // (Heal s4-offline-rep-search-blanks-suggestions-1). The copy is fixed and
      // names no submitted value, so it is not a reflection channel either.
      return { view: null, error: "unavailable" as const };
    }
  }, { view: null, error: null });

  const [zip, setZip] = useState("");
  const [radiusMiles, setRadiusMiles] = useState<number>(50);
  const [type, setType] = useState<string>("");

  // React 19 resets a function-action form when the action completes. That
  // reset restores a select's first option, and because the controlled
  // `radiusMiles` / `type` values did not change, React does not write them
  // back: a 100-mile/VSO search came back showing 25 miles/Any, and the next
  // search quietly used those (Heal s6-rep-search-filters-snap-back-1).
  // Re-keying the selects once per completed action remounts them with their
  // current controlled values, so the reset cannot leave the boxes disagreeing
  // with the search that produced the results.
  const [resultVersion, setResultVersion] = useState(0);
  const lastResult = useRef(state);
  useEffect(() => {
    if (lastResult.current === state) return;
    lastResult.current = state;
    setResultVersion((version) => version + 1);
  }, [state]);

  const view = state.view;
  // The alert shows a fixed constant: for a field validation it is the
  // locator's own copy, and for any other refusal it is the PHI-free contract's
  // generic message. Neither branch names or echoes a submitted value.
  const errorMessage = state.error
    ? state.error === "refused"
      ? ACCREDITED_REP_REFUSAL_MESSAGE
      : state.error === "unavailable"
        ? ACCREDITED_REP_UNAVAILABLE_MESSAGE
        : ACCREDITED_REP_VALIDATION_MESSAGES[state.error]
    : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="accredited-rep-heading">
      <h2 id="accredited-rep-heading" className="text-lg font-semibold text-slate-900">
        Find an accredited representative near you
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Public directory lookup by ZIP. Your workflow selections and evidence are not sent with this request. The ZIP is submitted in the request body, so it is not written into the page URL or your browser history. Results are public directory data, not Veteran PII.
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            ZIP code
            <input
              name="zip"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              autoComplete="off"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="12345"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Radius
            <select
              key={`radius-${resultVersion}`}
              name="radiusMiles"
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r} miles
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Type
            <select
              key={`type-${resultVersion}`}
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="VSO">VSO representative</option>
              <option value="agent">Accredited agent</option>
              <option value="attorney">Attorney</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "Searching…" : "Search directory"}
        </button>
      </form>

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          {errorMessage}
        </p>
      )}

      {view && (
        <div className="mt-5">
          <p className="text-xs text-muted">
            Source: {view.sourceLabel} · {view.live ? "live" : "local fallback"} · {view.cacheStatus === "hit" ? "cache hit" : view.cacheStatus}
            {view.retrievedAt ? ` · ${view.retrievedAt}` : ""} · {view.environment ?? "n/a"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{view.notice}</p>

          <RepresentativeResults
            key={`${view.params.zip}:${view.params.radiusMiles ?? 50}:${view.params.type ?? "any"}:${view.retrievedAt ?? "fallback"}`}
            view={view}
          />
        </div>
      )}

      <p className="mt-4 text-sm text-muted">
        Accredited representatives may help prepare and submit a claim at no upfront cost; representatives may only charge for services after VA issues the decision and approves a fee agreement (38 U.S.C. § 5904). Verify accreditation and contact details on VA&apos;s OGC directory before sharing personal information. This lookup does not determine eligibility and does not persist your ZIP.
      </p>
    </section>
  );
}
