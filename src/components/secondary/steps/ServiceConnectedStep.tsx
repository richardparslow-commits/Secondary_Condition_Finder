"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { indexById } from "@/lib/catalog/lookup";
import { useClientCorpus } from "@/lib/client-corpus";
import {
  applyServiceConnectedStep,
  persistStepContext,
  persistStepResult,
} from "@/lib/secondary-workflow/client-steps";
import { useBrowserWorkflowContext } from "@/lib/secondary-workflow/use-browser-context";
import {
  SECONDARY_VALIDATION_MESSAGES,
  secondaryValidationMessage,
  type SecondaryValidationCode,
} from "@/lib/secondary-workflow/validation";

/**
 * Step 2 — service-connected selections (PRIV-01 stage 2). All answers stay in
 * the browser-local context; partial answers are preserved as a draft exactly
 * like the retired Server Action did.
 */
export function ServiceConnectedStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { corpus, loading, error: corpusError } = useClientCorpus();
  const { context, ready, persist } = useBrowserWorkflowContext();
  const [localError, setLocalError] = useState<SecondaryValidationCode | null>(null);

  const validationMessage = localError
    ? SECONDARY_VALIDATION_MESSAGES[localError]
    : secondaryValidationMessage(searchParams.get("error") ?? undefined);
  const validationId = validationMessage ? "service-connected-validation-error" : undefined;

  const byId = useMemo(() => (corpus ? indexById(corpus.conditions) : new Map()), [corpus]);
  const diagnosedConditionIds = context?.diagnosedConditionIds ?? [];
  const selectedServiceConnectedIds = new Set(context?.serviceConnectedConditionIds ?? []);
  const answerDraft = context?.serviceConnectedAnswerDraft;
  const hasPriorSelection = context?.serviceConnectedConditionIds !== undefined;
  const diagnosed = diagnosedConditionIds
    .map((id) => byId.get(id))
    .filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
  const selected = diagnosed.filter((condition) => selectedServiceConnectedIds.has(condition.id));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!corpus) return;
    const result = applyServiceConnectedStep(
      context,
      new FormData(event.currentTarget),
      corpus.conditions,
    );
    if (!result.ok) {
      if (result.context) {
        const draftOutcome = persistStepContext(persist, result.context);
        if (!draftOutcome.ok) {
          setLocalError(draftOutcome.code);
          return;
        }
      }
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
        <header className="page-hero text-center"><p className="ui-kicker">Step 2 of 6</p><h1>Service-Connected Conditions</h1></header>
        <div className="ui-callout text-sm" aria-live="polite">Loading the condition list and your browser-local session…</div>
      </main>
    );
  }

  if (diagnosedConditionIds.length === 0) {
    return (
      <main>
        <header className="page-hero"><h1>Select diagnosed conditions first</h1><p>Choose at least one diagnosed condition before setting service-connected status.</p></header>
        {corpusError && <div role="alert" className="ui-callout mb-5 text-sm"><strong>Condition list unavailable:</strong> {corpusError}</div>}
        <Link href="/secondary/diagnosed" className="ui-button">Back to diagnosed conditions</Link>
      </main>
    );
  }

  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Step 2 of 6</p>
        <h1>Service-Connected Conditions</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">Mark which selected diagnoses VA has already recognized as service connected. The diagnoses you mark “No” become the conditions Step 5 evaluates for possible relationships to the conditions you mark “Yes.”</p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><strong className="text-blue-700">2 Service-connected</strong><span>3 Ratings</span><span>4 Documents</span><span>5 Connections</span><span>6 Evidence</span></div>

      {validationMessage && (
        <div id={validationId} role="alert" className="ui-callout mb-5 text-sm">
          <strong>Check this step:</strong> {validationMessage}
        </div>
      )}

      <form onSubmit={onSubmit} aria-describedby={validationId}>
        <div className="ui-grid">
          <aside className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Step Guidance</h2></div>
            <h3 className="text-lg font-bold">Choose only established service-connected conditions</h3>
            <p className="mt-2 text-sm">Use your VA rating decision or benefit summary to confirm which diagnoses have already been granted service connection.</p>
            <div className="ui-divider" />
            <p className="text-sm"><strong>Why this matters:</strong> Step 5 starts with the diagnoses marked “No” and checks whether any diagnosis marked “Yes” has an authored published relationship that may help explain or connect to it.</p>
            <div className="ui-callout mt-5 text-sm"><strong>Do not mark a new condition as service connected</strong> unless VA has already granted that status.</div>
          </aside>

          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↗</span><div><h2 className="text-xl font-bold">Select Your Service-Connected Conditions</h2><p className="text-sm text-slate-600">Mark yes or no for every diagnosed condition below. No answer is assumed for you.</p></div></div>
            <div className="space-y-3">
              {diagnosed.map((condition) => (
                <fieldset key={condition.id} className="rounded-xl border border-slate-200 p-4 shadow-none" aria-describedby={validationId}>
                  <legend className="font-semibold text-slate-900">{condition.name}</legend>
                  <p className="text-xs text-slate-500">{condition.bodySystem}</p>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="radio" name={`serviceConnected-${condition.id}`} value="yes" defaultChecked={answerDraft ? answerDraft[condition.id] === "yes" : hasPriorSelection && selectedServiceConnectedIds.has(condition.id)} className="h-5 w-5" />Yes, already service connected</label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="radio" name={`serviceConnected-${condition.id}`} value="no" defaultChecked={answerDraft ? answerDraft[condition.id] === "no" : hasPriorSelection && !selectedServiceConnectedIds.has(condition.id)} className="h-5 w-5" />No, not service connected</label>
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="ui-callout mt-5 text-sm"><strong>How this helps:</strong> The workflow compares the “No” diagnoses against the “Yes” diagnoses. It does not use the “Yes” diagnoses to generate a separate list of conditions you did not report.</div>
          </section>

          <aside className="ui-stack">
            <section className="ui-card">
              <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Selected Service-Connected Conditions</h2></div>
              {selected.length === 0 ? <p className="text-sm text-slate-600">No saved selections yet.</p> : <ul className="space-y-2">{selected.map((condition) => <li key={condition.id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">{condition.name} <span className="float-right rounded bg-white px-1.5 text-xs">SC</span></li>)}</ul>}
            </section>
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">?</span><h2 className="text-xl font-bold">Need Help?</h2></div><p className="text-sm">Check your most recent VA rating decision, benefit summary, or rating code sheet. These documents identify granted service-connected disabilities and their evaluations.</p></section>
          </aside>
        </div>
        <div className="ui-actions"><Link href="/secondary/diagnosed" className="ui-button-secondary">← Back to Step 1</Link><button type="submit" className="ui-button" disabled={!corpus}>Continue to Step 3 <span aria-hidden="true">→</span></button></div>
      </form>
      <DisclaimerFooter />
    </main>
  );
}
