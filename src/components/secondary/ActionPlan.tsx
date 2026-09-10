"use client";

import { useMemo } from "react";

import { actionPlanSteps, buildActionPlan, formatActionPlan } from "@/lib/secondary-workflow/action-plan";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

interface Props {
  results: NonServiceConnectedConditionResult[];
}

export function ActionPlan({ results }: Props) {
  const entries = useMemo(() => buildActionPlan(results), [results]);

  if (entries.length === 0) return null;

  function downloadPlan() {
    const content = formatActionPlan(entries);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "claim-action-plan.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <section className="mt-6 rounded-xl border border-blue-200 bg-white p-5" aria-labelledby="action-plan-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">✦</span>
        <div>
          <h2 id="action-plan-heading" className="text-xl font-bold">Your Next Steps — Personalized Claim Action Plan</h2>
          <p className="text-sm text-slate-600">
            Prioritized from the authored research in this review. Ranking favors consensus strength and fewer checklist items — <strong>not a filing order VA requires</strong>. Confirm every form and filing step with an accredited representative.
          </p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Research prioritization, not VA guidance:</strong> This plan converts suggestions into a concrete research-to-filing roadmap. It does not determine eligibility, choose the legally correct form for your claim type, or set a VA deadline. Timelines below are informational (initial processing is commonly 3–5 months but varies).
      </div>

      {/* Prioritized list */}
      <ol className="mt-4 space-y-4">
        {entries.map((entry) => {
          const steps = actionPlanSteps(entry);
          return (
            <li key={entry.conditionId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
                    {entry.rank}
                  </span>
                  {entry.conditionName}
                  <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-normal text-slate-600">{entry.bodySystem}</span>
                </h3>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">{entry.etiologicalConsensus}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Via {entry.contributingPrimaryNames.join(", ")} · Nexus {entry.nexusClassifications.join(", ")} · Score {entry.score} · {entry.evidenceGapCount} checklist item(s)
              </p>
              <ol className="mt-3 space-y-2 text-sm leading-relaxed">
                {steps.map((step) => (
                  <li key={step.action} className="flex gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white" aria-hidden="true">
                      →
                    </span>
                    <span>
                      <strong>{step.action}:</strong> {step.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ol>

      {/* Static roadmap */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">Suggested timeline (informational)</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li><strong>Weeks 1–2:</strong> Gather records using the checklist (per condition, Step 6)</li>
          <li><strong>Weeks 2–4:</strong> Clinician nexus review and DBQ or opinion, if appropriate</li>
          <li><strong>Week 4+:</strong> File with your representative; upload evidence to VA.gov</li>
          <li><strong>Months 3–5:</strong> VA evidence review and examination scheduling (typical initial window; actual processing varies)</li>
        </ul>
        <h3 className="mt-4 text-sm font-bold text-slate-900">Forms and where to find help</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            VA forms and filing:{" "}
            <a className="underline" href="https://www.va.gov/find-forms/" target="_blank" rel="noopener noreferrer">
              va.gov/find-forms
            </a>{" "}
            and{" "}
            <a className="underline" href="https://www.va.gov/disability/file-disability-claim-form-21-526ez/" target="_blank" rel="noopener noreferrer">
              Form 21-526EZ
            </a>{" "}
            (representative confirms correct form for your claim type)
          </li>
          <li>
            Presumptive categories (if applicable): <a className="underline" href="/presumptive">/presumptive</a> in this app
          </li>
          <li>
            Accredited representatives / VSOs:{" "}
            <a className="underline" href="https://www.va.gov/ogc/apps/accreditation/index.asp" target="_blank" rel="noopener noreferrer">
              VA OGC Accreditation
            </a>{" "}
            and{" "}
            <a className="underline" href="https://www.va.gov/vso/" target="_blank" rel="noopener noreferrer">
              va.gov/vso
            </a>
          </li>
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button" onClick={downloadPlan}>
          Download action plan
        </button>
        <span className="text-xs text-slate-600">Exports the prioritized plan as a text file in this browser. Print the page to include the plan with the report header.</span>
      </div>
    </section>
  );
}
