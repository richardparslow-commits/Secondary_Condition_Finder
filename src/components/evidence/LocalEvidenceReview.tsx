"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
  type EvidenceExcerpt,
} from "@/lib/evidence/extract";
import { parseStoredEvidence } from "@/lib/evidence/storage";

const EMPTY_SNAPSHOT = "[]";

function getSnapshot(): string {
  try {
    return window.sessionStorage.getItem(evidenceAnalysisStorageKey) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function subscribe(): () => void {
  // The evidence payload is written on Step 4 before this component mounts on
  // Step 6. No live subscription is required while the review page is open.
  return () => undefined;
}

function flatten(analyses: EvidenceAnalysis[]): EvidenceExcerpt[] {
  return analyses.flatMap((analysis) => analysis.excerpts);
}

export function LocalEvidenceReview() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  // Audit HARD-01: the retained payload is read through the store's own guard
  // (byte ceiling before `JSON.parse`, retention window, per-field ceilings)
  // rather than parsed here, so this surface cannot disagree with the analyzer
  // about what the store holds.
  const analyses = useMemo(() => parseStoredEvidence(snapshot), [snapshot]);
  const excerpts = useMemo(() => flatten(analyses), [analyses]);
  const nexus = excerpts.filter((excerpt) => excerpt.strength === "nexus-relevant");
  const supporting = excerpts.filter((excerpt) => excerpt.strength === "supporting");

  return (
    <section className="ui-card mt-5" aria-labelledby="local-evidence-review-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">“</span>
        <div>
          <h2 id="local-evidence-review-heading" className="text-xl font-bold">Veteran-Specific Evidence Excerpts</h2>
          <p className="text-sm text-slate-600">Exact excerpts retained only in this browser tab from Step 4 local analysis.</p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Important evidence limitation:</strong> “Nexus-relevant” means the excerpt came from a source you identified as clinician-authored, contains causation/aggravation language, and mentions a selected condition. The app does not determine legal competency, credibility, probative weight, or whether the evidence is sufficient for VA adjudication.
      </div>

      {analyses.length === 0 ? (
        <p className="mt-5 text-sm text-slate-600">No local evidence analysis is available in this browser tab. You can return to Step 4 to review supported text or paste text exported from another document format.</p>
      ) : (
        <div className="mt-5 space-y-6">
          <section>
            <h3 className="text-lg font-bold">Nexus-relevant excerpts</h3>
            {nexus.length === 0 ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                No clinician-authored causation or aggravation excerpt was identified by the conservative local classifier. A possible mapped pathway may still exist, but additional competent medical evidence may be needed.
              </div>
            ) : (
              <ul className="mt-3 space-y-4">
                {nexus.map((excerpt, index) => (
                  <li key={`${excerpt.sourceName}-${excerpt.locator}-${index}`} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-blue-900">
                      <span>{excerpt.category.replace(/-/g, " ")}</span>
                      <span>{excerpt.sourceName} · {excerpt.locator}</span>
                    </div>
                    <blockquote className="mt-3 border-l-4 border-blue-700 pl-4 text-sm leading-relaxed text-slate-900">“{excerpt.quote}”</blockquote>
                    {excerpt.matchedTerms.length > 0 && <p className="mt-2 text-xs text-blue-900">Matched selected condition term(s): {excerpt.matchedTerms.join(", ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-lg font-bold">Supporting excerpts</h3>
            <p className="mt-1 text-sm text-slate-600">These may help establish diagnosis, treatment, medications, timeline, or other context but are not labeled nexus evidence.</p>
            {supporting.length === 0 ? <p className="mt-3 text-sm text-slate-600">No supporting excerpts were identified.</p> : (
              <ul className="mt-3 space-y-3">
                {supporting.map((excerpt, index) => (
                  <li key={`${excerpt.sourceName}-${excerpt.locator}-support-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold text-slate-600">{excerpt.category.replace(/-/g, " ")} · {excerpt.sourceName} · {excerpt.locator}</div>
                    <blockquote className="mt-2 border-l-4 border-slate-300 pl-4 text-sm leading-relaxed">“{excerpt.quote}”</blockquote>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
