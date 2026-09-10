"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { formatClaimSummary } from "@/lib/engine/export";
import type { Recommendation } from "@/lib/engine/types";
import { pathwayRecordChecklistStorageKey } from "@/lib/secondary-workflow/local-state";
import {
  MECHANISM_CATEGORY_LABEL,
  NEXUS_THEORY_LABEL,
  PATHWAY_RECORD_CATEGORY_LABEL,
  PATHWAY_TYPE_LABEL,
  buildPathwayRecordChecklist,
  combineChecklistWithSummary,
  formatPathwayRecordChecklist,
} from "@/lib/secondary-workflow/pathway-record-checklist";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

interface Props {
  results: NonServiceConnectedConditionResult[];
  /**
   * Optional already-stripped recommendations (matchedIntakeContext cleared)
   * used to append the consultation summary to the checklist export. The
   * caller on Step 6 passes its consultationRecommendations so both exports
   * stay identical in privacy exclusions.
   */
  summaryRecommendations?: Recommendation[];
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

const CHANGE_EVENT = "secondary-condition-finder:pathway-record-checklist-change";
const EMPTY_SNAPSHOT = "{}";

function getSnapshot(): string {
  try {
    return window.sessionStorage.getItem(pathwayRecordChecklistStorageKey) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function parseLocatedState(raw: string): Record<string, true> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const state: Record<string, true> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === true) state[key] = true;
    }
    return state;
  } catch {
    return {};
  }
}

function writeLocatedState(state: Record<string, true>): void {
  try {
    window.sessionStorage.setItem(pathwayRecordChecklistStorageKey, JSON.stringify(state));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Browser storage may be unavailable. The checklist remains informational
    // without moving any selection state to the server.
  }
}

function clearLocatedState(): void {
  try {
    window.sessionStorage.removeItem(pathwayRecordChecklistStorageKey);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Browser storage may be unavailable; nothing to clear in that case.
  }
}

export function PathwayRecordChecklist({ results, summaryRecommendations }: Props) {
  const groups = useMemo(() => buildPathwayRecordChecklist(results), [results]);
  // Checkmarks persist in this browser tab's session storage (same boundary as
  // the EvidenceGapReview store) so they survive navigating Steps 5 → 6, and are
  // cleared by Finish Review / Start a new review. Never in cookies or on the server.
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const located = useMemo(() => parseLocatedState(snapshot), [snapshot]);
  // Only selections matching the current review count — stale keys from a
  // previous run in the same tab are ignored, mirroring EvidenceGapReview.
  const validKeyCount = useMemo(() => {
    let count = 0;
    for (const group of groups) {
      for (const pathway of group.pathways) {
        for (const item of pathway.items) {
          if (located[`${group.conditionId}:${pathway.primaryId}:${item.record}`]) count += 1;
        }
      }
    }
    return count;
  }, [groups, located]);

  const toggle = useCallback(
    (key: string) => {
      const next = { ...located };
      if (next[key]) delete next[key];
      else next[key] = true;
      writeLocatedState(next);
    },
    [located],
  );

  const clearAll = useCallback(() => clearLocatedState(), []);

  if (groups.length === 0) return null;

  const totalItems = groups.reduce(
    (sum, group) => sum + group.pathways.reduce((pathwaySum, pathway) => pathwaySum + pathway.items.length, 0),
    0,
  );
  const checkedCount = validKeyCount;

  function downloadChecklist() {
    downloadText(formatPathwayRecordChecklist(groups), "pathway-medical-record-checklist.txt");
  }

  function downloadChecklistWithSummary() {
    if (!summaryRecommendations) return;
    const checklist = formatPathwayRecordChecklist(groups);
    const summary = formatClaimSummary(summaryRecommendations, []);
    downloadText(combineChecklistWithSummary(checklist, summary), "pathway-checklist-with-consultation-summary.txt");
  }

  return (
    <section
      className="mt-6 rounded-xl border border-emerald-200 bg-white p-5"
      aria-labelledby="pathway-record-checklist-heading"
    >
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">☑</span>
        <div>
          <h2 id="pathway-record-checklist-heading" className="text-xl font-bold">
            Prepare Evidence — Pathway-Specific Record Checklist
          </h2>
          <p className="text-sm text-slate-600">
            For each claim pathway (a service-connected condition linked to a diagnosed condition by an authored theory
            and mechanism), the records most likely to matter. Take it with you when requesting records from providers or VA.
          </p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Records-gathering aid, not proof:</strong> Items are derived from the authored knowledge base for this
        review only. Gathering a record supports a qualified clinician&apos;s evaluation — it does not establish a nexus,
        satisfy VA&apos;s standard, or predict an outcome.
      </div>

      <p className="mt-4 text-sm" aria-live="polite">
        <strong>{checkedCount}</strong> of <strong>{totalItems}</strong> records marked as located across{" "}
        <strong>{groups.reduce((sum, group) => sum + group.pathways.length, 0)}</strong> pathway(s).
      </p>

      <div className="mt-4 space-y-6">
        {groups.map((group) => (
          <fieldset key={group.conditionId} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-blue-900">
              {group.conditionName}
              <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-normal text-slate-600">
                {group.bodySystem}
              </span>
              <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-900">
                {group.etiologicalConsensus}
              </span>
            </legend>
            <div className="mt-3 space-y-4">
              {group.pathways.map((pathway) => (
                <div key={pathway.primaryId} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                  <p className="text-sm font-bold text-slate-900">
                    {pathway.primaryName} → {group.conditionName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pathway.nexusClassification && (
                      <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-900">
                        {NEXUS_THEORY_LABEL[pathway.nexusClassification]}
                      </span>
                    )}
                    {pathway.mechanismCategory && (
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-900">
                        Via {MECHANISM_CATEGORY_LABEL[pathway.mechanismCategory]} mechanism
                        {pathway.mechanismHypothesizedOnly ? " (hypothesized)" : ""}
                      </span>
                    )}
                    {pathway.pathwayTypes.map((type) => (
                      <span key={type} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                        {PATHWAY_TYPE_LABEL[type]}
                      </span>
                    ))}
                    {pathway.etiologicalConsensus && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
                        {pathway.etiologicalConsensus}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {pathway.items.map((item) => {
                      const key = `${group.conditionId}:${pathway.primaryId}:${item.record}`;
                      const isChecked = Boolean(located[key]);
                      return (
                        <label key={key} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0"
                            checked={isChecked}
                            onChange={() => toggle(key)}
                            aria-label={`${pathway.primaryName} to ${group.conditionName}: ${item.record}`}
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <strong className="text-slate-900">Obtain: {item.record}</strong>
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                                {PATHWAY_RECORD_CATEGORY_LABEL[item.category]}
                              </span>
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.why}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button" onClick={downloadChecklist}>
          Download pathway checklist
        </button>
        {summaryRecommendations && summaryRecommendations.length > 0 && (
          <button type="button" className="ui-button-secondary" onClick={downloadChecklistWithSummary}>
            Download checklist with consultation summary
          </button>
        )}
        <p className="text-xs text-slate-600">
          Creates a text file in this browser only. The export mirrors this checklist and — when combined — the
          consultation summary, without raw excerpts or optional medication/treatment context.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button-secondary" onClick={clearAll} disabled={checkedCount === 0}>
          Clear checkmarks
        </button>
        <p className="text-xs text-slate-600">
          Unchecks every item in this browser tab. Finish Review and Start a new review also clear these selections
          automatically.
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Checkmarks are kept only in session storage for the current browser tab, so they follow you between Steps 5 and 6;
        they are cleared by Finish Review or Start a new review and are never sent to the server. Confirm current VA
        guidance with a qualified provider or accredited representative.
      </p>
    </section>
  );
}
