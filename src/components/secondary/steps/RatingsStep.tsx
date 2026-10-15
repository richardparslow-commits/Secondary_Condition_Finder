"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";

import { indexById } from "@/lib/catalog/lookup";
import { useClientCorpus } from "@/lib/client-corpus";
import { applyRatingsStep, persistStepResult } from "@/lib/secondary-workflow/client-steps";
import { VALID_RATINGS } from "@/lib/secondary-workflow/ratings";
import { ratingFieldName } from "@/lib/secondary-workflow/state";
import { useBrowserWorkflowContext } from "@/lib/secondary-workflow/use-browser-context";
import {
  SECONDARY_VALIDATION_MESSAGES,
  secondaryValidationMessage,
  type SecondaryValidationCode,
} from "@/lib/secondary-workflow/validation";

interface RatingOption { label: string; value: string; }

export function getRatingOptions(): RatingOption[] {
  return Array.from(VALID_RATINGS.reduce((options, rating) => {
    const value = rating === "100% P&T" ? "100" : rating.replace("%", "");
    options.set(value, { label: rating, value });
    return options;
  }, new Map<string, RatingOption>()).values());
}

/**
 * One rating field. Exported as a pure presentation unit so the stored-value
 * prefill contract (number, 100% P&T, and "I prefer not to answer") can be
 * rendered directly in tests.
 */
export function RatingSelect({
  conditionId,
  conditionName,
  stored,
  validationId,
}: {
  conditionId: string;
  conditionName: string;
  stored: number | null | undefined;
  validationId?: string;
}) {
  const fieldName = ratingFieldName(conditionId);
  const currentValue = stored === null ? "decline" : typeof stored === "number" ? String(stored) : "";
  const ratingOptions = getRatingOptions();
  return (
    <div className="grid items-center gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_11rem]">
      <label className="font-semibold" htmlFor={fieldName}>Rating for {conditionName}</label>
      <select id={fieldName} name={fieldName} required aria-describedby={validationId} defaultValue={currentValue} className="w-full px-3">
        <option value="">Select current rating...</option>
        {ratingOptions.map((rating) => <option key={rating.label} value={rating.value}>{rating.label}</option>)}
        <option value="decline">I prefer not to answer</option>
      </select>
    </div>
  );
}

/**
 * Step 3 — disability ratings (PRIV-01 stage 2). Ratings stay in the
 * browser-local context; the form keeps native validation disabled so the
 * application validator owns incomplete selections (same mobile behavior as
 * the retired `RatingsFormValidationBridge`).
 */
export function RatingsStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { corpus, loading, error: corpusError } = useClientCorpus();
  const { context, ready, persist } = useBrowserWorkflowContext();
  const [localError, setLocalError] = useState<SecondaryValidationCode | null>(null);

  useLayoutEffect(() => {
    const form = document.querySelector<HTMLFormElement>("main form");
    if (!form) return;
    form.noValidate = true;
  }, [ready, loading]);

  const validationMessage = localError
    ? SECONDARY_VALIDATION_MESSAGES[localError]
    : secondaryValidationMessage(searchParams.get("error") ?? undefined);
  const validationId = validationMessage ? "ratings-validation-error" : undefined;

  const catalogById = useMemo(() => (corpus ? indexById(corpus.conditions) : new Map()), [corpus]);
  const diagnosedConditionIds = context?.diagnosedConditionIds ?? [];
  const serviceConnectedConditionIds = context?.serviceConnectedConditionIds ?? [];
  const ratingsByConditionId = context?.ratingsByConditionId ?? {};
  const ratingOptions = getRatingOptions();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!corpus) return;
    const result = applyRatingsStep(context, new FormData(event.currentTarget), corpus.conditions);
    if (!result.ok) {
      if (result.next) {
        router.push(`${result.next}?error=${result.code}`);
        return;
      }
      setLocalError(result.code);
      return;
    }
    const outcome = persistStepResult(persist, result);
    if (!outcome.ok) {
      setLocalError(outcome.code);
      return;
    }
    router.push(outcome.next);
  }

  if (!ready || loading) {
    return (
      <main>
        <header className="page-hero text-center"><p className="ui-kicker">Step 3 of 6</p><h1>Disability Ratings</h1></header>
        <div className="ui-callout text-sm" aria-live="polite">Loading the condition list and your browser-local session…</div>
      </main>
    );
  }

  if (diagnosedConditionIds.length === 0 || serviceConnectedConditionIds.length === 0) {
    return <main><header className="page-hero"><h1>Set service-connected status first</h1><p>Complete the prior workflow steps before entering current ratings.</p></header>{corpusError && <div role="alert" className="ui-callout mb-5 text-sm"><strong>Condition list unavailable:</strong> {corpusError}</div>}<Link href="/secondary/service-connected" className="ui-button">Back to service-connected status</Link></main>;
  }

  return (
    <main>
      <header className="page-hero text-center"><p className="ui-kicker">Step 3 of 6</p><h1>Disability Ratings</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Select the current VA evaluation for each service-connected condition in this research session, or choose not to provide it.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" role="group" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><strong className="text-blue-700">3 Ratings</strong><span>4 Documents</span><span>5 Connections</span><span>6 Evidence</span></div>

      {validationMessage && (
        <div id={validationId} role="alert" className="ui-callout mb-5 text-sm">
          <strong>Check this step:</strong> {validationMessage}
        </div>
      )}

      <form onSubmit={onSubmit} aria-describedby={validationId}>
        <div className="ui-grid">
          <aside className="ui-stack" aria-label="Why ratings matter">
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">%</span><h2 className="text-xl font-bold">Why Ratings Matter</h2></div><p className="text-sm">Ratings provide current context for the service-connected disabilities in this research session. The app does not calculate or predict a VA rating decision.</p></section>
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Accepted Values</h2></div><div className="grid grid-cols-3 gap-2">{ratingOptions.map((rating) => <span key={rating.label} className="rounded-lg border border-slate-200 px-2 py-2 text-center text-sm font-semibold text-blue-700">{rating.label}</span>)}</div><p className="mt-3 text-xs text-slate-600">You may also choose “I prefer not to answer.”</p></section>
          </aside>

          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><div><h2 className="text-xl font-bold">Enter Ratings for Selected Conditions</h2><p className="text-sm text-slate-600">Choose the evaluation that is currently in effect.</p></div></div>
            <div className="space-y-3">
              {serviceConnectedConditionIds.map((conditionId) => (
                <RatingSelect
                  key={conditionId}
                  conditionId={conditionId}
                  conditionName={catalogById.get(conditionId)?.name ?? conditionId.replace(/-/g, " ")}
                  stored={ratingsByConditionId[conditionId]}
                  validationId={validationId}
                />
              ))}
            </div>
            <div className="ui-callout mt-5 text-sm"><strong>Important:</strong> Use the rating currently in effect, not a future or requested increase. You can revise these selections before continuing.</div>
          </section>

          <aside className="ui-stack" aria-label="Current summary">
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">Σ</span><h2 className="text-xl font-bold">Current Summary</h2></div><ul className="space-y-3">{serviceConnectedConditionIds.map((id) => { const name = catalogById.get(id)?.name ?? id; const rating = ratingsByConditionId[id]; return <li key={id} className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-sm"><span className="font-medium">{name}</span><strong className="text-blue-700">{rating === null ? "Not provided" : typeof rating === "number" ? `${rating}%` : "—"}</strong></li>; })}</ul></section>
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">Helpful Reminder</h2></div><p className="text-sm">This is a research aid, not a rating calculator or decision. VA evaluates ratings under the applicable schedule and the complete evidentiary record.</p></section>
          </aside>
        </div>
        <div className="ui-actions"><Link href="/secondary/service-connected" className="ui-button-secondary">← Back to Step 2</Link><button type="submit" className="ui-button" disabled={!corpus}>Continue to Step 4 <span aria-hidden="true">→</span></button></div>
      </form>
    </main>
  );
}
