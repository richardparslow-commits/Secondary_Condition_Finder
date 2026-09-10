"use client";

import { useMemo, useState } from "react";

import {
  buildRatingGuide,
  formatRatingGuide,
  GENERIC_RATING_SCALE,
  GENERIC_FUNCTIONAL_PROMPTS,
  RATING_SCALE_NOTE,
  type RatingGuideEntry,
} from "@/lib/secondary-workflow/rating-guide";
import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

interface Props {
  results: NonServiceConnectedConditionResult[];
  catalog: ConditionCatalog;
}

function checkedCount(checked: Record<string, boolean>): number {
  return Object.values(checked).filter(Boolean).length;
}

export function RatingGuide({ results, catalog }: Props) {
  const byId = useMemo(() => indexById(catalog), [catalog]);
  const catalogById = useMemo(() => new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>, [byId]);
  const entries: RatingGuideEntry[] = useMemo(() => buildRatingGuide(results, catalogById), [results, catalogById]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<string>("");

  if (entries.length === 0) return null;

  const filtered = filter.trim()
    ? entries.filter((entry) => entry.conditionName.toLowerCase().includes(filter.trim().toLowerCase()))
    : entries;

  function toggle(prompt: string) {
    setChecked((previous) => ({ ...previous, [prompt]: !previous[prompt] }));
  }

  function downloadGuide() {
    const content = formatRatingGuide(entries);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "rating-schedule-guide.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="rating-guide-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">§</span>
        <div>
          <h2 id="rating-guide-heading" className="text-xl font-bold">VA Rating Schedule Guide</h2>
          <p className="text-sm text-slate-600">
            Interactive explorer for the rating framework citations recorded for each diagnosed condition. Shows the VA schedule note, a generic scale, and a symptom-to-notes matcher. <strong>Does not predict a percentage.</strong>
          </p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Research reference only:</strong> Rating schedule text describes how VA evaluates severity under 38 CFR Part 4. It is not evidence of service connection, and it must never be presented as nexus evidence. Final diagnostic code and percentage are determined by VA from documented findings.
      </div>

      {/* Generic scale (educational, not computed) */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">Generic VA scale (educational)</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{RATING_SCALE_NOTE}</p>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
          {GENERIC_RATING_SCALE.map((value) => (
            <span key={value} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {value}%
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Example: a condition rated under 38 CFR 4.130 may use only a subset (e.g., 0/10/30/50/70/100). Other body systems use different levels. Check the citation&apos;s criteria text.
        </p>
      </div>

      {/* Symptom matcher — generic functional prompts, NOT condition criteria */}
      <fieldset className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <legend className="px-1 text-sm font-bold text-amber-900">Symptom & functional-limitation matcher — notes for your clinician (not a rating)</legend>
        <p className="mt-1 text-xs leading-relaxed text-amber-950">
          Check functional limitations you experience to create notes to discuss with a qualified clinician. <strong>Checking a box does not assign a rating category.</strong> Bring these notes plus exam findings to your appointment; the clinician determines which rating criteria the documented findings meet.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {GENERIC_FUNCTIONAL_PROMPTS.map((prompt) => (
            <label key={prompt} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800">
              <input type="checkbox" className="h-4 w-4 shrink-0" checked={Boolean(checked[prompt])} onChange={() => toggle(prompt)} />
              <span>{prompt}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-amber-950" aria-live="polite">
          <strong>{checkedCount(checked)}</strong> of <strong>{GENERIC_FUNCTIONAL_PROMPTS.length}</strong> notes selected. Export with the button below to include with your checklist — still not a rating.
        </p>
        <p className="mt-1 text-xs italic text-amber-950">Example disclosure: notes like these help a clinician document examined findings against the schedule criteria; the tool does not decide the percentage.</p>
      </fieldset>

      {/* Per-condition framework citations */}
      <div className="mt-4">
        <label className="text-sm font-semibold text-slate-700">
          Filter conditions
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Type a condition name"
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="mt-3 space-y-4">
        {filtered.map((entry) => (
          <article key={entry.conditionId} className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-base font-bold text-slate-900">
              {entry.conditionName}
              <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-normal text-slate-600">{entry.bodySystem}</span>
              <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-900">{entry.etiologicalConsensus}</span>
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Via {entry.contributingPrimaryNames.join(", ")} · {entry.citationCount} citation(s) · {entry.evidenceGapCount} gap(s) · research score {entry.score}
            </p>
            {entry.ratingSchedule.length === 0 ? (
              <p className="mt-2 text-sm text-slate-700">
                <strong>Rating schedule:</strong> Refer to VA schedule — no single diagnostic code asserted for this identity. Discuss the diagnosed condition with an accredited representative to identify the applicable evaluation criteria.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {entry.ratingSchedule.map((ref) => (
                  <li key={`${entry.conditionId}-${ref.citation}-${ref.note.slice(0, 24)}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-mono text-xs text-slate-600">{ref.citation}</p>
                    <p className="mt-1 leading-relaxed text-slate-800">{ref.note}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Status: <strong>{ref.verified ? "VERIFIED" : "UNVERIFIED — confirm before relying"}</strong>
                      {ref.verified ? "" : " (all catalog citations ship unverified until qualified-human review — see copilot-instructions rule 4)"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {entry.reviewNotes.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">Review notes ({entry.reviewNotes.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
                  {entry.reviewNotes.map((note) => (
                    <li key={note.slice(0, 64)}>{note}</li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button" onClick={downloadGuide}>
          Download rating guide
        </button>
        <span className="text-xs text-slate-600">Exports the current guide as a text file in this browser, including any symptom-note selections and the required disclaimer.</span>
      </div>
    </section>
  );
}
