"use client";

import { useMemo } from "react";

import {
  analyzeCombinationInsights,
  combinationRelationLabel,
  formatCombinationInsights,
} from "@/lib/secondary-workflow/combination-insights";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

interface Props {
  results: NonServiceConnectedConditionResult[];
}

function relationTone(relation: string): string {
  if (relation === "synergistic") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (relation === "conflicting") return "border-orange-300 bg-orange-50 text-orange-950";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export function CombinationInsightsPanel({ results }: Props) {
  const insights = useMemo(() => analyzeCombinationInsights(results), [results]);

  if (insights.length === 0) return null;

  function downloadInsights() {
    const content = formatCombinationInsights(insights);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "condition-combination-insights.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <section className="mt-6 rounded-xl border border-violet-200 bg-white p-5" aria-labelledby="combination-insights-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">◇</span>
        <div>
          <h2 id="combination-insights-heading" className="text-xl font-bold">Condition Combination Insights</h2>
          <p className="text-sm text-slate-600">
            Pairwise strategy for the top matched secondaries in this review — whether to file together or sequence — based only on shared primaries and same-system overlap. Not a VA filing instruction.
          </p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Informational only:</strong> Counts and system labels come from the current catalog/KB snapshot. A <em>synergistic</em> pair shares a service-connected primary; a <em>conflicting</em> pair shares a body system and may face VA overlap review; <em>independent</em> pairs stand alone. VA makes final determinations.
      </div>

      <div className="mt-4 space-y-4">
        {insights.map((insight) => (
          <article key={`${insight.conditionA.id}::${insight.conditionB.id}`} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">
                {insight.conditionA.name} + {insight.conditionB.name}
              </h3>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${relationTone(insight.relation)}`}>
                {combinationRelationLabel(insight.relation)}
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-sm leading-relaxed">
              <div>
                <dt className="font-semibold text-slate-800">Why this label</dt>
                <dd className="text-slate-700">{insight.reason}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Evidence signal</dt>
                <dd className="text-slate-700">{insight.evidence}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Suggested strategy</dt>
                <dd className="text-slate-700">{insight.recommendation}</dd>
              </div>
              {insight.riskNote && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <strong>Risk note: </strong>
                  {insight.riskNote}
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button" onClick={downloadInsights}>
          Download combination insights
        </button>
        <p className="text-xs text-slate-600">
          Exports the current pairwise analysis as a text file in this browser. Use it alongside the checklist and comparison when planning which research packet to prepare first.
        </p>
      </div>
    </section>
  );
}
