"use client";

import { useMemo, useState } from "react";

import type {
  AccreditedRepresentative,
  AccreditedRepresentativeView,
} from "@/lib/va/accredited-representatives";
import {
  APPROVED_RADIUS_MILES,
  ACCREDITED_REP_TYPE_VALUES,
} from "@/lib/va/accredited-representative-constants";
import { searchRepresentatives } from "@/lib/actions/accredited-representatives";

interface Props {
  initialView?: AccreditedRepresentativeView | null;
  returnTo: string;
  existingQuery?: string;
  initialZip?: string;
  initialRadius?: string;
  initialType?: string;
  validationMessage?: string | null;
}

function formatDistance(miles: number | null): string {
  if (miles === null || miles === undefined) return "Distance not reported";
  return `${miles.toFixed(1)} mi`;
}

function typeLabel(value: string): string {
  if (value === "VSO" || value === "vso") return "VSO";
  if (value === "agent") return "Accredited Agent";
  if (value === "attorney") return "Attorney";
  return value;
}

export function AccreditedRepresentativeFinder({
  initialView,
  returnTo,
  existingQuery,
  initialZip = "",
  initialRadius = "",
  initialType = "",
  validationMessage,
}: Props) {
  const [localFilter, setLocalFilter] = useState("");

  const filtered = useMemo(() => {
    if (!initialView) return [];
    const q = localFilter.trim().toLowerCase();
    if (!q) return initialView.items;
    return initialView.items.filter((item) => {
      const hay = `${item.name} ${item.organization ?? ""} ${item.city ?? ""} ${item.state ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [initialView, localFilter]);

  return (
    <section className="ui-card" aria-labelledby="accredited-rep-finder-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">
          ☆
        </span>
        <div>
          <h2 id="accredited-rep-finder-heading" className="text-xl font-bold">
            Find Help Near You
          </h2>
          <p className="text-sm text-slate-600">
            Accredited representatives &amp; VSOs — talk about your research with a qualified person.
          </p>
        </div>
      </div>

      <div className="ui-callout mt-4 text-sm">
        <strong>Privacy:</strong> This search is a public directory lookup. Your workflow selections, ratings, and
        evidence are not sent with this request. Only the zip code (and optional radius/type) is used for the lookup.
        <span className="mt-1 block text-xs text-slate-600">
          Accredited representatives can file claims at no upfront cost (fees may be allowed only after claim approval).
        </span>
      </div>

      {validationMessage && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Check this search:</strong> {validationMessage}
        </div>
      )}

      <form action={searchRepresentatives} className="mt-5 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        {existingQuery !== undefined && <input type="hidden" name="existingQuery" value={existingQuery} />}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor="accredited-rep-zip" className="block text-sm font-semibold text-slate-900">
              Zip code <span className="font-normal text-slate-500">(5 digits)</span>
            </label>
            <input
              id="accredited-rep-zip"
              name="zip"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              defaultValue={initialZip}
              placeholder="90210"
              required
              autoComplete="postal-code"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label htmlFor="accredited-rep-radius" className="block text-sm font-semibold text-slate-900">
              Radius
            </label>
            <select
              id="accredited-rep-radius"
              name="radius"
              defaultValue={initialRadius}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">Any distance</option>
              {APPROVED_RADIUS_MILES.map((m) => (
                <option key={m} value={String(m)}>
                  {m} miles
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="accredited-rep-type" className="block text-sm font-semibold text-slate-900">
              Type
            </label>
            <select
              id="accredited-rep-type"
              name="type"
              defaultValue={initialType}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">Any type</option>
              {ACCREDITED_REP_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t === "VSO" ? "VSO" : t === "agent" ? "Accredited Agent" : "Attorney"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="ui-button w-full sm:w-auto">
          Search directory
        </button>
      </form>

      {initialView && (
        <>
          <dl className="mt-5 grid gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-800">Source</dt>
              <dd>{initialView.sourceLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">Last successful retrieval</dt>
              <dd>
                {initialView.retrievedAt
                  ? new Date(initialView.retrievedAt).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC"
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">Cache</dt>
              <dd>{initialView.live ? initialView.cacheStatus : "not used"}</dd>
            </div>
          </dl>

          <div role="note" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {initialView.notice}
          </div>

          {initialView.items.length > 5 && (
            <div className="mt-4">
              <label htmlFor="accredited-rep-filter" className="block text-sm font-semibold text-slate-900">
                Filter these results
              </label>
              <p className="mt-1 text-xs text-slate-600">Filtering happens only in your browser after results load.</p>
              <input
                id="accredited-rep-filter"
                type="search"
                value={localFilter}
                onChange={(e) => setLocalFilter(e.target.value)}
                placeholder="Filter by name or city"
                autoComplete="off"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <p className="mt-2 text-xs text-slate-600">
                Showing {filtered.length} of {initialView.items.length} results
              </p>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">No accredited representatives found</p>
              <p className="mt-1">
                No accredited representatives were found within the selected distance. Try a larger radius (50 or 100
                miles) or search the official directory on{" "}
                <a
                  href="https://www.va.gov/ogc/apps/accreditation/index.asp"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  va.gov/ogc/apps/accreditation
                </a>
                .
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {filtered.map((item: AccreditedRepresentative) => (
                <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.organization && <p className="text-sm text-slate-600">{item.organization}</p>}
                    </div>
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                      {typeLabel(item.accreditationType)}
                    </span>
                  </div>

                  {(item.address || item.city || item.state || item.zip) && (
                    <p className="mt-2 text-sm text-slate-700">
                      {[item.address, [item.city, item.state].filter(Boolean).join(", "), item.zip]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {item.phone && (
                      <a href={`tel:${item.phone}`} className="underline">
                        {item.phone}
                      </a>
                    )}
                    {item.website && (
                      <a href={item.website} target="_blank" rel="noreferrer" className="underline">
                        Website
                      </a>
                    )}
                    <span className="text-xs text-slate-500">{formatDistance(item.distanceMiles)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Directory data is public. Confirm accreditation status and contact details on{" "}
            <a href="https://www.va.gov/ogc/apps/accreditation/index.asp" target="_blank" rel="noreferrer" className="underline">
              va.gov
            </a>{" "}
            before you rely on a listing.
          </p>
        </>
      )}

      {!initialView && (
        <p className="mt-4 text-sm text-slate-600">
          Enter a zip code to search the VA accredited-representative directory.{" "}
          <a
            href="https://www.va.gov/ogc/apps/accreditation/index.asp"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Browse on va.gov
          </a>
          .
        </p>
      )}
    </section>
  );
}
