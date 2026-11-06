"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  normalizeServiceHistoryDraft,
  persistServiceHistory,
  SERVICE_HISTORY_MESSAGES,
  type ServiceHistoryFailureCode,
} from "@/lib/presumptive/browser-history";
import { useBrowserServiceHistory } from "@/lib/presumptive/use-browser-history";

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
  const { history: savedHistory, ready } = useBrowserServiceHistory();
  const [locationEdits, setLocationEdits] = useState<string[] | null>(null);
  const [branchEdits, setBranchEdits] = useState<string[] | null>(null);
  const [error, setError] = useState<ServiceHistoryFailureCode | null>(null);
  const serviceStartRef = useRef<HTMLInputElement>(null);
  const serviceEndRef = useRef<HTMLInputElement>(null);
  const restoredDatesRef = useRef(false);

  const availableLocations = new Set(locations);
  const availableBranches = new Set(
    serviceBranches.map((branch) => branch.code),
  );
  // Returning from the results view mounts a fresh form. Derive the initial
  // controls from the record this tab saved on the previous check so Back does
  // not silently erase what the visitor already confirmed (Heal
  // s6-service-history-lost-on-back-1). An edit takes over once the visitor
  // changes a control, so a late storage read cannot overwrite it.
  const selected =
    locationEdits ??
    (savedHistory?.locations ?? []).filter((location) =>
      availableLocations.has(location),
    );
  const selectedBranches =
    branchEdits ??
    (savedHistory?.serviceBranchCodes ?? []).filter((code) =>
      availableBranches.has(code),
    );

  // Dates stay uncontrolled so the quick-start templates can write them. This
  // effect only writes the restored values into those inputs; it does not set
  // React state.
  useEffect(() => {
    if (!ready || restoredDatesRef.current || !savedHistory) return;
    restoredDatesRef.current = true;
    if (serviceStartRef.current) {
      serviceStartRef.current.value = savedHistory.serviceStart ?? "";
    }
    if (serviceEndRef.current) {
      serviceEndRef.current.value = savedHistory.serviceEnd ?? "";
    }
  }, [ready, savedHistory]);

  function toggle(location: string) {
    setLocationEdits((current) => {
      const base = current ?? selected;
      return base.includes(location)
        ? base.filter((item) => item !== location)
        : [...base, location];
    });
  }

  function toggleBranch(code: string) {
    setBranchEdits((current) => {
      const base = current ?? selectedBranches;
      return base.includes(code)
        ? base.filter((item) => item !== code)
        : [...base, code];
    });
  }

  /**
   * Service history is confirmed and stored in this browser tab; nothing is
   * posted. The membership allowlist still runs (against the authored catalog
   * labels this form rendered), so a crafted value cannot be stored.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Dates are intentionally uncontrolled so the quick-start templates can
    // write them directly; read the submitted values rather than stale state.
    const formData = new FormData(event.currentTarget);
    const result = persistServiceHistory(
      window.sessionStorage,
      normalizeServiceHistoryDraft({
        serviceBranchCodes: selectedBranches,
        locations: selected,
        serviceStart: String(formData.get("serviceStart") ?? ""),
        serviceEnd: String(formData.get("serviceEnd") ?? ""),
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
                <span className="ml-2 font-mono text-xs text-muted">{branch.code}</span>
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
              ref={serviceStartRef}
              type="date"
              name="serviceStart"
              defaultValue=""
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">End date</span>
            <input
              ref={serviceEndRef}
              type="date"
              name="serviceEnd"
              defaultValue=""
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

      {/* The disabled colours are declared in globals.css, not here: the legacy
          bg-slate-9 palette normalization wins with !important, so a
          `disabled:bg-*` utility in this class list renders nothing while
          reading as if the disabled state were styled. See L-02 in
          globals.css and tests/design-token-contrast.test.ts. */}
      <button
        type="submit"
        disabled={selected.length === 0}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed sm:w-auto"
      >
        Show presumptive conditions
      </button>
    </form>
  );
}
