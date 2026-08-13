"use client";

import { useMemo, useState } from "react";

import { matchExactVaReferenceTerm, type VaReferenceTerm } from "@/lib/va/terminology-match";

interface Props {
  referenceItems: VaReferenceTerm[];
  referenceAvailable: boolean;
}

export function ReferenceTermInput({ referenceItems, referenceAvailable }: Props) {
  const [value, setValue] = useState("");
  const match = useMemo(
    () => (referenceAvailable ? matchExactVaReferenceTerm(value, referenceItems) : null),
    [referenceAvailable, referenceItems, value],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold">Compare a term</h2>
      <p className="mt-2 text-sm text-slate-600">The text entered here stays in the browser.</p>
      <label htmlFor="reference-term-input" className="mt-4 block text-sm font-semibold">Term to compare</label>
      <input
        id="reference-term-input"
        type="text"
        maxLength={160}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm" role="status" aria-live="polite">
        {!referenceAvailable ? (
          <p>Reference matching is unavailable while the local fallback is active.</p>
        ) : !value.trim() ? (
          <p>Enter a term to compare.</p>
        ) : match ? (
          <p>Exact reference match: <strong>{match.name}</strong> <span className="text-slate-500">({match.id})</span></p>
        ) : (
          <p>No exact reference-term match was found.</p>
        )}
      </div>
    </section>
  );
}
