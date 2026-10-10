"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  normalizeServiceHistoryDraft,
  persistServiceHistory,
  SERVICE_HISTORY_MESSAGES,
  type ServiceHistoryFailureCode,
} from "@/lib/presumptive/browser-history";

interface ServiceBranchOption {
  code: string;
  description: string;
}

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

export interface ServiceHistoryFormProps {
  locations: string[];
  serviceBranches: ServiceBranchOption[];
  serviceBranchSourceLabel: string;
  serviceBranchNotice: string;
}

export function ServiceHistoryForm({
  locations,
  serviceBranches,
  serviceBranchSourceLabel,
  serviceBranchNotice,
}: ServiceHistoryFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [serviceStart, setServiceStart] = useState("");
  const [serviceEnd, setServiceEnd] = useState("");
  const [error, setError] = useState<ServiceHistoryFailureCode | null>(null);

  function toggle(location: string) {
    setSelected((current) =>
      current.includes(location)
        ? current.filter((item) => item !== location)
        : [...current, location],
    );
  }

  function toggleBranch(code: string) {
    setSelectedBranches((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

  /**
   * Service history is confirmed and stored in this browser tab; nothing is
   * posted. The membership allowlist still runs (against the authored catalog
   * labels this form rendered), so a crafted value cannot be stored.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = persistServiceHistory(
      window.sessionStorage,
      normalizeServiceHistoryDraft({
        serviceBranchCodes: selectedBranches,
        locations: selected,
        serviceStart,
        serviceEnd,
      }),
      locations,
    );

    if (!result.ok) {
      setError(result.code);
      return;
    }
    setError(null);
    router.push("/presumptive/results");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="text-sm text-slate-600">
        Everything you enter here stays in this browser tab. It is not sent to
        the server and is not written to a cookie.
      </p>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          Which service branch or branches apply to you?
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Optional. These standardized values are saved as administrative reference context only. They do not change the presumptive matching logic.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {serviceBranches.map((branch) => (
            <label
              key={branch.code}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-slate-400"
            >
              <input
                type="checkbox"
                name="serviceBranchCode"
                value={branch.code}
                checked={selectedBranches.includes(branch.code)}
                onChange={() => toggleBranch(branch.code)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>
                {branch.description}
                <span className="ml-2 font-mono text-xs text-slate-500">{branch.code}</span>
              </span>
            </label>
          ))}
        </div>

        <div role="note" className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <strong className="text-slate-800">Reference source:</strong> {serviceBranchSourceLabel}. {serviceBranchNotice}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          Where did you serve?
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Select every location. Presumptive eligibility depends on location and
          dates, not on any condition you are already service connected for.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Voice input is disabled because browser speech services may send audio off-device. Select locations below instead.
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
            <input
              type="date"
              name="serviceStart"
              value={serviceStart}
              onChange={(event) => setServiceStart(event.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">End date</span>
            <input
              type="date"
              name="serviceEnd"
              value={serviceEnd}
              onChange={(event) => setServiceEnd(event.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <div role="alert" className="ui-callout text-sm">
          <strong>Check the service history form:</strong>{" "}
          {SERVICE_HISTORY_MESSAGES[error]}
        </div>
      )}

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
