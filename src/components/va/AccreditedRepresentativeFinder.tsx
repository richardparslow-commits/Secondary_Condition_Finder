"use client";

import { useState } from "react";

import { searchAccreditedRepresentatives } from "@/lib/actions/accredited-representatives";
import type {
  AccreditedRepresentativeView,
} from "@/lib/va/accredited-representatives";

interface Props {
  initialView?: AccreditedRepresentativeView | null;
  returnTo: string;
}

const RADIUS_OPTIONS = [25, 50, 100] as const;

export function AccreditedRepresentativeFinder({ initialView, returnTo }: Props) {
  const [zip, setZip] = useState(initialView?.params.zip ?? "");
  const [radiusMiles, setRadiusMiles] = useState<number>(initialView?.params.radiusMiles ?? 50);
  const [type, setType] = useState<string>(initialView?.params.type ?? "");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="accredited-rep-heading">
      <h2 id="accredited-rep-heading" className="text-lg font-semibold text-slate-900">
        Find an accredited representative near you
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Public directory lookup by ZIP. Your workflow selections and evidence are not sent with this request. Results are public directory data, not Veteran PII.
      </p>

      <form action={searchAccreditedRepresentatives} className="mt-4 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            ZIP code
            <input
              name="zip"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
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
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Search directory
        </button>
      </form>

      {initialView && (
        <div className="mt-5">
          <p className="text-xs text-muted">
            Source: {initialView.sourceLabel} · {initialView.live ? "live" : "local fallback"} · {initialView.cacheStatus === "hit" ? "cache hit" : initialView.cacheStatus}
            {initialView.retrievedAt ? ` · ${initialView.retrievedAt}` : ""} · {initialView.environment ?? "n/a"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{initialView.notice}</p>

          {initialView.items.length === 0 ? (
            <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              No accredited representatives found within {initialView.params.radiusMiles ?? 50} miles of {initialView.params.zip}. Try a larger radius or search{" "}
              <a href="https://www.va.gov/ogc/apps/accreditation/index.asp" target="_blank" rel="noreferrer" className="underline">
                va.gov/ogc/apps/accreditation
              </a>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {initialView.items.map((item) => (
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
          )}
        </div>
      )}

      <p className="mt-4 text-sm text-muted">
        Accredited representatives may help prepare and submit a claim at no upfront cost; representatives may only charge for services after VA issues the decision and approves a fee agreement (38 U.S.C. § 5904). Verify accreditation and contact details on VA&apos;s OGC directory before sharing personal information. This lookup does not determine eligibility and does not persist your ZIP.
      </p>
    </section>
  );
}
