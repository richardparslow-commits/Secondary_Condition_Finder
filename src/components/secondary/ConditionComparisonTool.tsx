"use client";

import { useMemo, useState } from "react";

import {
  buildComparisonRows,
  formatConditionComparison,
  consensusBadgeTone,
  type ComparisonRow,
} from "@/lib/secondary-workflow/condition-comparison";
import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

interface Props {
  results: NonServiceConnectedConditionResult[];
  catalog: ConditionCatalog;
}

const MAX_SELECT = 3;

function badgeClass(tone: string): string {
  if (tone === "strong") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (tone === "moderate") return "border-amber-300 bg-amber-50 text-amber-900";
  if (tone === "contested") return "border-orange-300 bg-orange-50 text-orange-900";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function ConditionComparisonTool({ results, catalog }: Props) {
  const byId = useMemo(() => indexById(catalog), [catalog]);
  // Allow comparing only diagnoses that actually have a published relationship;
  // unmapped ones have no recommendation to compare.
  const comparable = useMemo(
    () => results.filter((result) => result.recommendation !== null),
    [results],
  );
  const catalogById = useMemo(
    () => new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>,
    [byId],
  );

  const [selected, setSelected] = useState<string[]>(() => comparable.slice(0, 2).map((result) => result.conditionId));
  const rows: ComparisonRow[] = useMemo(
    () => buildComparisonRows(results, selected, catalogById),
    [results, selected, catalogById],
  );

  if (comparable.length < 2) return null;

  function toggle(conditionId: string) {
    setSelected((previous) => {
      if (previous.includes(conditionId)) return previous.filter((item) => item !== conditionId);
      if (previous.length >= MAX_SELECT) return previous;
      return [...previous, conditionId];
    });
  }

  function downloadComparison() {
    const content = formatConditionComparison(rows);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "condition-comparison.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="condition-comparison-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">≣</span>
        <div>
          <h2 id="condition-comparison-heading" className="text-xl font-bold">Compare Conditions</h2>
          <p className="text-sm text-slate-600">
            Side-by-side triage — pick 2–3 diagnosed conditions with a published relationship to compare authored evidence strength, rating framework, and evidence-gap load.
          </p>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-slate-700">Choose up to {MAX_SELECT} conditions to compare</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {comparable.map((result) => {
            const isSelected = selected.includes(result.conditionId);
            return (
              <label
                key={result.conditionId}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${isSelected ? "border-blue-300 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isSelected}
                  onChange={() => toggle(result.conditionId)}
                  disabled={!isSelected && selected.length >= MAX_SELECT}
                />
                <span>{result.conditionName}</span>
                <span className="text-xs text-slate-500">({result.bodySystem})</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Comparison counts only published mappings in this review. Citations, consensus tiers, and the VA schedule note do not predict a rating — they help decide which research packet to prioritize gathering.
        </p>
      </fieldset>

      {selected.length < 2 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Select at least 2 conditions to see the comparison table.
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="border-b border-slate-200 px-3 py-2">Condition</th>
                  <th className="border-b border-slate-200 px-3 py-2">Nexus</th>
                  <th className="border-b border-slate-200 px-3 py-2">Consensus</th>
                  <th className="border-b border-slate-200 px-3 py-2">Citations</th>
                  <th className="border-b border-slate-200 px-3 py-2">Gaps</th>
                  <th className="border-b border-slate-200 px-3 py-2">Primaries</th>
                  <th className="border-b border-slate-200 px-3 py-2">VA rating framework</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const tone = consensusBadgeTone(row.etiologicalConsensus);
                  return (
                    <tr key={row.conditionId} className="align-top">
                      <td className="border-b border-slate-100 px-3 py-3">
                        <strong className="block text-slate-900">{row.conditionName}</strong>
                        <span className="text-xs text-slate-600">{row.bodySystem}</span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-800">{row.nexusClassifications.join(", ")}</td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(tone)}`}>{row.etiologicalConsensus}</span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-center font-semibold">{row.citationCount}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-center font-semibold">{row.evidenceGapCount}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-700">{row.contributingPrimaryNames.join(", ")}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-600">{row.ratingFramework}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ui-callout mt-4 text-xs leading-relaxed">
            <strong>How to prioritize:</strong> Prefer a higher <em>consensus</em> tier and fewer <em>gaps</em> first — but an <code>ASSOCIATION_ONLY / NOT_ESTABLISHED</code> row can still succeed with strong individual evidence. A numeric citation count is provenance, not strength; read the actual citations. Rating-framework text is an informational VA schedule reference, never a nexus or rating determination.
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="ui-button" onClick={downloadComparison}>
              Download comparison
            </button>
            <span className="text-xs text-slate-600">
              Exports the current table as a text file in this browser. Print the page to include conditions, checklist, and comparison together (print header adds research-report disclosure).
            </span>
          </div>
        </>
      )}
    </section>
  );
}
