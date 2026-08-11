"use client";

import { useState } from "react";

import { saveServiceHistory } from "@/app/presumptive/actions";

interface Props {
  locations: string[];
}

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

export function ServiceHistoryForm({ locations }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(location: string) {
    setSelected((current) =>
      current.includes(location)
        ? current.filter((item) => item !== location)
        : [...current, location],
    );
  }

  return (
    <form action={saveServiceHistory} className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          Where did you serve?
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Select every location. Presumptive eligibility depends on location and
          dates, not on any condition you are already service connected for.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {locations.map((location) => (
            <label
              key={location}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-slate-400"
            >
              <input
                type="checkbox"
                name="location"
                value={location}
                checked={selected.includes(location)}
                onChange={() => toggle(location)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{location}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          When did you serve there?
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Optional, but without dates the results cannot confirm you fall inside
          a qualifying window. Check your DD-214 for exact dates.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-700">Start date</span>
            <input type="date" name="serviceStart" className={`mt-1 ${fieldClass}`} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">End date</span>
            <input type="date" name="serviceEnd" className={`mt-1 ${fieldClass}`} />
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={selected.length === 0}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        Show presumptive conditions
      </button>
    </form>
  );
}
