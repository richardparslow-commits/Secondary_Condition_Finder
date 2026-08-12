"use client";

import { useMemo, useSyncExternalStore } from "react";

export type EvidenceGapReviewItem = {
  conditionId: string;
  condition: string;
  evidenceGaps: string[];
};

type EvidenceGapReviewProps = {
  recommendations: EvidenceGapReviewItem[];
};

type ReviewedGapState = Record<string, true>;

const STORAGE_KEY = "secondary-condition-finder:evidence-gap-review:v1";
const CHANGE_EVENT = "secondary-condition-finder:evidence-gap-review-change";
const EMPTY_SNAPSHOT = "{}";

function gapKey(conditionId: string, gap: string): string {
  return `${conditionId}:${gap}`;
}

function getSnapshot(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? EMPTY_SNAPSHOT;
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

function parseReviewedGapState(raw: string): ReviewedGapState {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const state: ReviewedGapState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === true) state[key] = true;
    }
    return state;
  } catch {
    return {};
  }
}

function writeReviewedGapState(state: ReviewedGapState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Browser storage may be unavailable. The checklist remains informational
    // without moving any review state to the server.
  }
}

export function EvidenceGapReview({ recommendations }: EvidenceGapReviewProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const reviewed = useMemo(() => parseReviewedGapState(snapshot), [snapshot]);
  const totalGaps = recommendations.reduce((sum, recommendation) => sum + recommendation.evidenceGaps.length, 0);
  const reviewedCount = recommendations.reduce(
    (sum, recommendation) =>
      sum + recommendation.evidenceGaps.filter((gap) => reviewed[gapKey(recommendation.conditionId, gap)]).length,
    0,
  );

  function setReviewed(conditionId: string, gap: string, checked: boolean) {
    const next = { ...reviewed };
    const key = gapKey(conditionId, gap);
    if (checked) next[key] = true;
    else delete next[key];
    writeReviewedGapState(next);
  }

  if (recommendations.length === 0 || totalGaps === 0) return null;

  return (
    <section className="ui-card mt-5" aria-labelledby="evidence-gap-review-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">☑</span>
        <div>
          <h2 id="evidence-gap-review-heading" className="text-xl font-bold">Evidence Gap Review</h2>
          <p className="text-sm text-slate-600">Compare the authored research checklist with the records you reviewed in this browser tab.</p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>User-controlled research aid:</strong> Check an item only when you personally found material you want to discuss for that gap. A checkmark does not mean the evidence is legally or medically sufficient, competent, credible, or accepted by VA. The app does not automatically mark gaps from extracted text.
      </div>

      <p className="mt-4 text-sm" aria-live="polite">
        <strong>{reviewedCount}</strong> of <strong>{totalGaps}</strong> authored gap items marked as material found for review.
      </p>

      <div className="mt-5 space-y-5">
        {recommendations.map((recommendation) => (
          <fieldset key={recommendation.conditionId} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 font-bold text-blue-900">{recommendation.condition}</legend>
            <div className="mt-2 space-y-3">
              {recommendation.evidenceGaps.map((gap) => {
                const key = gapKey(recommendation.conditionId, gap);
                return (
                  <label key={key} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={Boolean(reviewed[key])}
                      onChange={(event) => setReviewed(recommendation.conditionId, gap, event.currentTarget.checked)}
                    />
                    <span>
                      <strong className="block">{gap}</strong>
                      <span className="text-xs text-slate-600">Material found for review</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Checklist selections are stored only in this browser tab using session storage. They are not added to workflow cookies, URLs, telemetry, recommendation logs, VA API requests, or the consultation-summary export.
      </p>
    </section>
  );
}
