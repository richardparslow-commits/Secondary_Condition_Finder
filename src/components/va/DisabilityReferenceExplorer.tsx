"use client";

import { useMemo, useState } from "react";

import type { DisabilityReferenceItem } from "@/lib/va/disability-reference";
import { matchExactVaReferenceTerm } from "@/lib/va/terminology-match";

interface Props {
  items: DisabilityReferenceItem[];
  totalAvailable: number;
  incomplete?: boolean;
}

const MAX_VISIBLE_RESULTS = 50;

export function DisabilityReferenceExplorer({ items, totalAvailable, incomplete }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const matches = useMemo(() => {
    if (!normalizedQuery) return items.slice(0, MAX_VISIBLE_RESULTS);

    return items
      .filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, MAX_VISIBLE_RESULTS);
  }, [items, normalizedQuery]);
  const exactMatch = useMemo(
    () => matchExactVaReferenceTerm(query, items),
    [items, query],
  );

  return (
    <section className="mt-6">
      <label htmlFor="va-disability-reference-search" className="block text-sm font-semibold text-slate-900">
        Filter reference terms
      </label>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Filtering happens only in your browser after the public reference list is loaded. Your search text is not submitted to VA or added to the page URL.
      </p>
      <input
        id="va-disability-reference-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Example: migraine"
        autoComplete="off"
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
      />

      {query.trim() && (
        <div role="status" aria-live="polite" className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
          {exactMatch ? (
            <span>Exact VA reference match: <strong>{exactMatch.name}</strong> <span className="text-muted">(ID {exactMatch.id})</span></span>
          ) : (
            <span>No exact VA reference-name match for the entered text.</span>
          )}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-4 flex items-center justify-between gap-4 text-xs text-slate-600"
      >
        <span>
          Showing {matches.length} of {items.length} loaded reference terms
        </span>
        {matches.length === MAX_VISIBLE_RESULTS && (
          <span>Refine the filter to narrow results.</span>
        )}
      </div>

      {incomplete ? (
        <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          VA could not fully load the disability reference list. The terms below are only the part VA returned; try again later to load the complete list.
        </p>
      ) : totalAvailable > items.length ? (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          VA publishes {totalAvailable} disability reference terms, and this page loads the first {items.length}. A term outside that prefix will not appear below even though VA publishes it.
        </p>
      ) : null}

      {matches.length === 0 ? (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No loaded reference term contains that text.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {matches.map((item) => (
            <li key={item.id} className="px-4 py-3 text-sm text-slate-800">
              {item.name}
              <span className="ml-2 font-mono text-xs text-muted">{item.id}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
