"use client";

import { useState } from "react";

import type { PrimaryCondition } from "@/lib/kb/schema";

interface Props {
  conditions: Pick<PrimaryCondition, "id" | "name">[];
}

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

export function IntakeForm({ conditions }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(name: string) {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  }

  return (
    <form action="/results" method="get" className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          Service-connected conditions
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Select every condition you are already service connected for. Pick at
          least one.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {conditions.map((condition) => (
            <label
              key={condition.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-slate-400"
            >
              <input
                type="checkbox"
                name="primary"
                value={condition.name}
                checked={selected.includes(condition.name)}
                onChange={() => toggle(condition.name)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{condition.name}</span>
            </label>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Only these {conditions.length} conditions are in the Phase 1 knowledge
          base. More are coming.
        </p>
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
