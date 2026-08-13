"use client";

import { useMemo, useState } from "react";

import { matchExactVaReferenceTerm, type VaReferenceTerm } from "@/lib/va/terminology-match";

interface Props {
  catalogNames: string[];
  referenceItems: VaReferenceTerm[];
  referenceAvailable: boolean;
}

export function ReferenceTermExplorer({ catalogNames, referenceItems, referenceAvailable }: Props) {
  const [selected, setSelected] = useState(catalogNames[0] ?? "");
  const match = useMemo(
    () => (referenceAvailable ? matchExactVaReferenceTerm(selected, referenceItems) : null),
    [referenceAvailable, referenceItems, selected],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold">Compare terminology</h2>
      <p className="mt-2 text-sm text-slate-600">The comparison runs in this browser after the public reference list loads.</p>
      <label htmlFor="reference-term" className="mt-4 block text-sm font-semibold">App catalog term</label>
      <select id="reference-term" value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
        {catalogNames.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm" role="status" aria-live="polite">
        {!referenceAvailable ? <p>Reference matching is unavailable while the local fallback is active.</p> : match ? <p>Exact reference match: <strong>{match.name}</strong> <span className="text-slate-500">({match.id})</span></p> : <p>No exact reference-term match was found for {selected}.</p>}
      </div>
    </section>
  );
}
