"use client";

import { useMemo, useState } from "react";

export interface IntakeOption {
  id: string;
  name: string;
  bodySystem: string;
  aliases: string[];
  /** True when authored secondary-condition research exists for this entry. */
  hasResearch: boolean;
}

interface Props {
  options: IntakeOption[];
}

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

const MAX_VISIBLE = 40;

export function IntakeForm({ options }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IntakeOption[]>([]);
  const [researchOnly, setResearchOnly] = useState(true);

  const selectedIds = useMemo(
    () => new Set(selected.map((option) => option.id)),
    [selected],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options
      .filter((option) => !selectedIds.has(option.id))
      .filter((option) => (researchOnly ? option.hasResearch : true))
      .filter((option) => {
        if (!needle) return true;
        return (
          option.name.toLowerCase().includes(needle) ||
          option.bodySystem.toLowerCase().includes(needle) ||
          option.aliases.some((alias) => alias.toLowerCase().includes(needle))
        );
      });
  }, [options, query, researchOnly, selectedIds]);

  const visible = matches.slice(0, MAX_VISIBLE);
  const researchCount = options.filter((option) => option.hasResearch).length;

  return (
    <form action="/results" method="get" className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          Conditions you are already rated for
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Search {options.length} conditions and select every one you are
          service connected for.
        </p>

        {selected.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {selected.map((option) => (
              <li key={option.id}>
                <input type="hidden" name="primary" value={option.id} />
                <button
                  type="button"
                  onClick={() =>
                    setSelected((current) =>
                      current.filter((item) => item.id !== option.id),
                    )
                  }
                  className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                >
                  {option.name}
                  <span aria-hidden className="text-slate-300">
                    &times;
                  </span>
                  <span className="sr-only">Remove {option.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by condition or body system"
          aria-label="Search conditions"
          className={`mt-3 ${fieldClass}`}
        />

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={researchOnly}
            onChange={(event) => setResearchOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Only show the {researchCount} conditions with secondary research
          written
        </label>

        <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {visible.length === 0 && (
            <li className="px-3 py-4 text-sm text-slate-600">
              No conditions match that search.
            </li>
          )}
          {visible.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setSelected((current) => [...current, option])}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <span>
                  {option.name}
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {option.bodySystem}
                  </span>
                </span>
                {option.hasResearch ? (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    research available
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    no mappings yet
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {matches.length > visible.length && (
          <p className="mt-2 text-xs text-slate-500">
            Showing {visible.length} of {matches.length}. Keep typing to narrow
            the list.
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">
          Optional context
        </legend>
        <p className="-mt-1 text-sm text-slate-600">
          Used to highlight relevant details in your results. It does not change
          which suggestions appear or how they are ordered.
        </p>

        <label className="block">
          <span className="text-sm text-slate-700">
            Symptoms <span className="text-slate-400">(comma separated)</span>
          </span>
          <input
            className={`mt-1 ${fieldClass}`}
            name="symptoms"
            placeholder="trouble sleeping, daytime fatigue"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">
            Medications <span className="text-slate-400">(comma separated)</span>
          </span>
          <input
            className={`mt-1 ${fieldClass}`}
            name="medications"
            placeholder="sertraline, meloxicam"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">
            Exposures <span className="text-slate-400">(comma separated)</span>
          </span>
          <input
            className={`mt-1 ${fieldClass}`}
            name="exposures"
            placeholder="burn pits, aircraft engine noise"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">Notes</span>
          <textarea
            className={`mt-1 ${fieldClass}`}
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="Anything else that may be relevant."
          />
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={selected.length === 0}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        Show conditions to explore
      </button>
    </form>
  );
}
