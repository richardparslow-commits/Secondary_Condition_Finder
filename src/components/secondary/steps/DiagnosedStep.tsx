"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { isExposureRelated } from "@/lib/catalog/exposure-tags";
import { useClientCorpus } from "@/lib/client-corpus";
import { applyDiagnosedStep, persistStepResult } from "@/lib/secondary-workflow/client-steps";
import { useBrowserWorkflowContext } from "@/lib/secondary-workflow/use-browser-context";
import {
  SECONDARY_VALIDATION_MESSAGES,
  secondaryValidationMessage,
  type SecondaryValidationCode,
} from "@/lib/secondary-workflow/validation";

const DATABASE_MAPPED_EXPLANATION =
  "Database mapped means this condition already has authored secondary-condition relationships in the knowledge base.";

/**
 * Condition badges for one catalog row. Exported as a pure presentation unit
 * so the toxic-exposure/mapped markers can be rendered directly in tests.
 */
export function ConditionBadges({
  conditionId,
  mapped,
}: {
  conditionId: string;
  mapped: boolean;
}) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {isExposureRelated(conditionId) ? (
        <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">toxic exposure related</span>
      ) : null}
      {mapped ? (
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800" title={DATABASE_MAPPED_EXPLANATION}>database mapped</span>
      ) : (
        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">mapping in progress</span>
      )}
    </span>
  );
}

/**
 * Step 1 — diagnosed conditions (PRIV-01 stage 2).
 *
 * Runs entirely in the browser: the catalog comes from the public client
 * corpus, prior selections come from the browser-local context record, and a
 * successful submit persists the context locally before navigating. No field
 * of this form is ever posted to the server.
 */
export function DiagnosedStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { corpus, loading, error: corpusError } = useClientCorpus();
  const { context, ready, persist } = useBrowserWorkflowContext();
  const [localError, setLocalError] = useState<SecondaryValidationCode | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const validationMessage = localError
    ? SECONDARY_VALIDATION_MESSAGES[localError]
    : secondaryValidationMessage(searchParams.get("error") ?? undefined);
  const validationId = validationMessage ? "diagnosed-validation-error" : undefined;

  const conditions = useMemo(
    () => (corpus ? [...corpus.conditions].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [corpus],
  );
  const mapped = useMemo(
    () => new Set(corpus?.publishedMappings.map((mapping) => mapping.id) ?? []),
    [corpus],
  );
  const selectedDiagnosed = new Set(context?.diagnosedConditionIds ?? []);
  const selectedConditions = conditions.filter((condition) => selectedDiagnosed.has(condition.id));

  function hasUnsavedDiagnosedChanges(): boolean {
    const form = formRef.current;
    if (!form) return false;
    const current = new Set(
      new FormData(form).getAll("diagnosed").map((value) => String(value)),
    );
    if (current.size !== selectedDiagnosed.size) return true;
    for (const id of current) {
      if (!selectedDiagnosed.has(id)) return true;
    }
    return false;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!corpus) return;
    const result = applyDiagnosedStep(context, new FormData(event.currentTarget), corpus.conditions);
    if (!result.ok) {
      // Validation failures carry the owning step, so the error code lives in
      // the URL exactly like the retired server redirect did; that keeps the
      // static error-URL contract e2e/validation-errors.mjs asserts.
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
    // The validation failure was pushed as its own history entry. Replacing it
    // on success keeps browser Back on the clean Step 1 address instead of
    // restoring the stale ?error= alert beside the fixed selection.
    if (searchParams.has("error")) {
      router.replace(outcome.next);
      return;
    }
    router.push(outcome.next);
  }

  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Step 1 of 6</p>
        <h1>Diagnosed Conditions</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">Select only conditions that a medical professional has already diagnosed. You provide the diagnoses; this application does not diagnose or infer conditions from your records.</p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" role="group" aria-label="Workflow progress">
        <strong className="text-blue-700">1 Diagnosed</strong><span>2 Service-connected</span><span>3 Ratings</span><span>4 Documents</span><span>5 Connections</span><span>6 Evidence</span>
      </div>

      {validationMessage && (
        <div id={validationId} role="alert" className="ui-callout mb-5 text-sm">
          <strong>Check this step:</strong> {validationMessage}
        </div>
      )}
      {corpusError && (
        <div role="alert" className="ui-callout mb-5 text-sm">
          <strong>Condition list unavailable:</strong> the public knowledge-base artifact could not be loaded ({corpusError}). Reload the page to try again — no selections have left this browser.
        </div>
      )}

      {!ready || loading ? (
        <div className="ui-callout text-sm" aria-live="polite">
          Loading the condition list and your browser-local session…
        </div>
      ) : (
        <form ref={formRef} onSubmit={onSubmit} aria-describedby={validationId} onChange={() => setShowLeaveWarning(false)}>
          <div className="ui-grid">
            <aside className="ui-card" aria-label="How to use this step">
              <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">How to Use This Step</h2></div>
              <div className="space-y-5 text-sm">
                <div><h3 className="font-bold">Search or browse</h3><p className="mt-1">Browse the condition catalog and select each diagnosis you want to research.</p></div>
                <div><h3 className="font-bold">Select diagnosed conditions</h3><p className="mt-1">Choose only conditions you have actually been diagnosed with by a qualified medical professional.</p></div>
                <div><h3 className="font-bold">Review your selections</h3><p className="mt-1">Previously selected conditions are summarized on the right and can be changed before continuing.</p></div>
              </div>
              <div className="ui-callout mt-6"><strong>Important note:</strong><p className="mt-1 text-sm">Do not include a condition solely because you suspect it. This tool does not diagnose conditions.</p></div>
            </aside>

            <fieldset className="ui-card min-w-0 p-5" aria-describedby={validationId}>
              <legend className="sr-only">Diagnosed conditions</legend>
              <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><div><h2 className="text-xl font-bold">Select Diagnosed Conditions</h2><p className="text-sm text-slate-600">Choose one or more, then continue.</p></div></div>
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Browse {conditions.length} catalog conditions. The list does not infer diagnoses from free text.</div>
              <ul className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {conditions.map((condition) => (
                  <li key={condition.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                      <input type="checkbox" name="diagnosed" value={condition.id} defaultChecked={selectedDiagnosed.has(condition.id)} className="mt-1 h-5 w-5 rounded border-slate-300" />
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold text-slate-900">{condition.name}</span>
                        <span className="block text-xs text-muted">{condition.bodySystem}</span>
                      </span>
                      <ConditionBadges conditionId={condition.id} mapped={mapped.has(condition.id)} />
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <aside className="ui-stack" aria-label="Selected diagnosed conditions">
              <section className="ui-card">
                <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Selected Diagnosed Conditions</h2></div>
                {selectedConditions.length === 0 ? <p className="text-sm text-slate-600">No saved selections yet.</p> : <ul className="space-y-2">{selectedConditions.map((condition) => <li key={condition.id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">{condition.name}</li>)}</ul>}
              </section>
              <section className="ui-card">
                <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">?</span><h2 className="text-xl font-bold">Why This Matters</h2></div>
                <p className="text-sm">Later steps separate these diagnoses into already service-connected conditions and diagnosed conditions that are not service connected, then evaluate possible relationships between those two sets.</p>
                <div className="ui-callout mt-5 text-sm">Your selections are stored only in this browser tab. They are never placed in the URL or sent to the application server.</div>
              </section>
            </aside>
          </div>

          {showLeaveWarning && (
            <div role="alert" className="ui-callout border-amber-300 bg-amber-50 text-sm text-amber-950">
              <p id="diagnosed-leave-warning"><strong>Your selections have not been saved.</strong> Going back now will discard the conditions you ticked or unticked.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href="/secondary" className="ui-button">Leave and discard</Link>
                <button type="button" className="ui-button-secondary" onClick={() => setShowLeaveWarning(false)}>Keep editing</button>
              </div>
            </div>
          )}
          <div className="ui-actions">
            <Link href="/secondary" className="ui-button-secondary" onClick={(event) => { if (!hasUnsavedDiagnosedChanges()) return; event.preventDefault(); setShowLeaveWarning(true); }} aria-describedby={showLeaveWarning ? "diagnosed-leave-warning" : undefined}>← Back</Link>
            <button type="submit" className="ui-button" disabled={!corpus}>Continue to Step 2 <span aria-hidden="true">→</span></button>
          </div>
        </form>
      )}
      <DisclaimerFooter />
    </main>
  );
}
