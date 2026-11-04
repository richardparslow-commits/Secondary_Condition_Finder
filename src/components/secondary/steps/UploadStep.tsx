"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import { MedicationContextUploadExplainer } from "@/components/secondary/MedicationContextExplainer";
import { VaGovRecordWalkthrough } from "@/components/secondary/VaGovRecordWalkthrough";
import { VoiceInputHotkeyBridge, VoiceInputTextarea } from "@/components/secondary/VoiceInputTextarea";
import { indexById } from "@/lib/catalog/lookup";
import { buildEvidenceConditionTerms } from "@/lib/evidence/condition-terms";
import { useClientCorpus } from "@/lib/client-corpus";
import { applyDocumentsStep, persistStepResult } from "@/lib/secondary-workflow/client-steps";
import { ratingDisplayLabel } from "@/lib/secondary-workflow/ratings";
import { listSymptomBridgeEntries } from "@/lib/secondary-workflow/symptom-bridge";
import {
  MAX_TIMELINE_YEAR,
  MIN_TIMELINE_YEAR,
  timelineField,
} from "@/lib/secondary-workflow/state";
import { useBrowserWorkflowContext } from "@/lib/secondary-workflow/use-browser-context";
import {
  SECONDARY_VALIDATION_MESSAGES,
  type SecondaryValidationCode,
} from "@/lib/secondary-workflow/validation";

/**
 * Document-availability choice. Exported as a pure presentation unit so the
 * prefill contract can be rendered directly in tests.
 */
export function DocumentsSharedChoice({ documentsShared }: { documentsShared: boolean }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 p-4 shadow-none">
      <legend className="font-semibold">Do you want document availability reflected in your checklist?</legend>
      <p className="mt-1 text-sm text-slate-600">This choice stores a yes/no workflow flag. Raw evidence text and locally extracted excerpts are not added to the browser-local workflow context.</p>
      <div className="mt-4 grid gap-3">
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="yes" defaultChecked={documentsShared} className="h-5 w-5" />Yes, I reviewed or have documents available</label>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="no" defaultChecked={!documentsShared} className="h-5 w-5" />No, continue without documents</label>
      </div>
    </fieldset>
  );
}

const PRIVACY_CONTRACT_COPY =
  "Raw medical document content is not sent to this application server, persisted in user accounts, included in telemetry, or written to raw text logs. Only locally extracted excerpts remain temporarily in this browser tab via session storage until cleared or the tab is closed. Optional medication/treatment entries are separate bounded browser-local context stored only in this browser tab.";

/**
 * Step 4 — supporting documents and optional bounded context (PRIV-01 stage
 * 2). Local evidence analysis was already browser-local; this component moves
 * the bounded medication/treatment/history/symptom/chronology context into the
 * same browser-local record instead of the legacy encrypted cookie.
 */
export function UploadStep() {
  const router = useRouter();
  const { corpus, loading, error: corpusError } = useClientCorpus();
  const { context, ready, persist } = useBrowserWorkflowContext();
  const [localError, setLocalError] = useState<SecondaryValidationCode | null>(null);

  // Query-param validation on this step is owned by the upload layout's
  // `SecondaryValidationQueryAlert` (pinned accessibility contract); this
  // component only reports errors raised by its own submit.
  const validationMessage = localError ? SECONDARY_VALIDATION_MESSAGES[localError] : null;

  const byId = useMemo(() => (corpus ? indexById(corpus.conditions) : new Map()), [corpus]);
  const diagnosedConditionIds = context?.diagnosedConditionIds ?? [];
  const serviceConnectedConditionIds = context?.serviceConnectedConditionIds ?? [];
  const ratingsByConditionId = context?.ratingsByConditionId;
  const permanentAndTotalConditionIds = context?.permanentAndTotalConditionIds ?? [];
  const documentsShared = context?.documentsShared ?? false;
  const medications = context?.medications ?? [];
  const treatments = context?.treatments ?? [];
  const history = context?.history ?? [];
  const symptomIds = context?.symptomIds ?? [];
  const conditionTimeline = context?.conditionTimeline ?? {};
  const symptomBridgeEntries = listSymptomBridgeEntries();

  const selectedConditions = diagnosedConditionIds.flatMap((id) => {
    const condition = byId.get(id);
    return condition ? [condition] : [];
  });
  const conditionTerms = buildEvidenceConditionTerms(selectedConditions);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!corpus) return;
    const result = applyDocumentsStep(context, new FormData(event.currentTarget), corpus.conditions);
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
        <header className="page-hero text-center"><p className="ui-kicker">Step 4 of 6</p><h1>Supporting Documents</h1></header>
        <div className="ui-callout text-sm" aria-live="polite">Loading the condition list and your browser-local session…</div>
      </main>
    );
  }

  if (
    diagnosedConditionIds.length === 0 ||
    serviceConnectedConditionIds.length === 0 ||
    !ratingsByConditionId ||
    serviceConnectedConditionIds.some((id) => ratingsByConditionId[id] === undefined)
  ) {
    return <main><header className="page-hero"><h1>Enter ratings first</h1><p>Complete the ratings step before continuing to document availability.</p></header><div className="ui-callout mb-5 text-sm"><strong>🔒 Evidence Upload Privacy Contract:</strong> Document review is <strong>strictly optional</strong>. Supported evidence text is analyzed locally in the browser. Raw document text is not sent to the application server, stored in browser workflow records, or written to <strong>raw text logs</strong>.</div>{corpusError && <div role="alert" className="ui-callout mb-5 text-sm"><strong>Condition list unavailable:</strong> {corpusError}</div>}<Link href="/secondary/ratings" className="ui-button">Back to current ratings</Link></main>;
  }

  return (
    <main>
      <VoiceInputHotkeyBridge />
      <header className="page-hero text-center"><p className="ui-kicker">Step 4 of 6</p><h1>Supporting Documents</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Optionally review evidence and add limited medication or treatment context that may help identify authored pathways worth discussing with a qualified professional.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" role="group" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><strong className="text-blue-700">4 Documents</strong><span>5 Connections</span><span>6 Evidence</span></div>

      {validationMessage && (
        <div role="alert" className="ui-callout mb-5 text-sm">
          <strong>Check this step:</strong> {validationMessage}
        </div>
      )}

      <div className="ui-grid">
        <aside className="ui-card" aria-label="Optional evidence review">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Optional Evidence Review</h2></div>
          <p className="text-sm">Use this step if you want the app to identify exact source excerpts that may be useful for later review with a qualified provider or accredited representative.</p>
          <div className="ui-divider" />
          <div className="ui-callout text-sm"><strong>This is evidence triage, not a medical or legal conclusion.</strong><p className="mt-1">The app preserves exact excerpt text and provenance. It does not decide whether an excerpt is sufficient to establish a nexus, whether an author is legally competent, or whether VA will find the evidence persuasive.</p></div>
          <p className="mt-5 text-sm">Document, medication, and treatment context are all optional. You can continue without providing them.</p>
        </aside>

        <section className="ui-card min-w-0">
          <VaGovRecordWalkthrough />

          <LocalEvidenceAnalyzer conditionTerms={conditionTerms} />

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <fieldset className="rounded-xl border border-slate-200 p-4 shadow-none">
              <legend className="font-semibold">Optional medication and treatment context</legend>
              <p className="mt-1 text-sm text-slate-600">Enter only the minimum context useful for pathway research, one item per line. Up to 20 entries per field, 160 characters each. Do not enter Social Security numbers, claim numbers, addresses, or unrelated medical details.</p>
              <div className="mt-4 grid gap-5">
                <div>
                  <label htmlFor="medications" className="block font-medium">Medications</label>
                  <p id="medications-help" className="mt-1 text-sm text-slate-600">Examples: SSRI, NSAID, prescribed corticosteroid. A reported term is highlighted only when it literally overlaps authored pathway or evidence-gap text.</p>
                  <VoiceInputTextarea id="medications" name="medications" ariaDescribedBy="medications-help" rows={4} maxLength={3220} defaultValue={medications.join("\n")} placeholder="One per line — or use the mic to dictate" className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
                </div>
                <div>
                  <label htmlFor="treatments" className="block font-medium">Treatments, procedures, or devices</label>
                  <p id="treatments-help" className="mt-1 text-sm text-slate-600">Examples: physical therapy, CPAP, knee brace, surgery. This context does not change recommendation ranking or establish causation.</p>
                  <VoiceInputTextarea id="treatments" name="treatments" ariaDescribedBy="treatments-help" rows={4} maxLength={3220} defaultValue={treatments.join("\n")} placeholder="One per line — or use the mic to dictate" className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
                </div>
                <div>
                  <label htmlFor="history" className="block font-medium">Relevant history or risk factors</label>
                  <p id="history-help" className="mt-1 text-sm text-slate-600">Optional, bounded entries such as alcohol exposure, smoking, kidney disease, prior trauma, or family history. Exact overlap may create an alternative-etiology warning for clinician review; it never changes ranking or decides causation.</p>
                  <VoiceInputTextarea id="history" name="history" ariaDescribedBy="history-help" rows={4} maxLength={3220} defaultValue={history.join("\n")} placeholder="One per line — or use the mic to dictate" className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
                </div>
              <MedicationContextUploadExplainer />
              </div>
              <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-4">
                <h3 className="font-semibold text-violet-950">Optional symptom research prompts</h3>
                <p className="mt-1 text-sm text-violet-950">Select symptoms you want to discuss with a qualified provider. The app may show possible discussion topics later, but it will not diagnose you or add these conditions to the review.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {symptomBridgeEntries.map((entry) => (
                    <label key={entry.id} className="flex items-start gap-2 rounded-lg border border-violet-200 bg-white p-3 text-sm text-slate-800">
                      <input type="checkbox" name="symptomIds" value={entry.id} defaultChecked={symptomIds.includes(entry.id)} className="mt-0.5 h-4 w-4" />
                      <span>{entry.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="ui-callout mt-4 text-sm"><strong>Workflow privacy:</strong> These optional entries are stored only in this browser tab. They are not placed in URLs, recommendation logs, telemetry, or user accounts, and they are never sent to the application server. Dictated text stays in this field until you submit — it is not sent anywhere.</div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 p-4 shadow-none">
              <legend className="font-semibold">Optional chronology context</legend>
              <p className="mt-1 text-sm text-slate-600">Enter approximate years only if known. The app uses these values to flag chronology questions; diagnosis year is not assumed to equal onset year, and missing dates produce no chronology conclusion.</p>
              <div className="mt-4 space-y-3">
                {selectedConditions.map((condition) => {
                  const timeline = conditionTimeline[condition.id] ?? {};
                  return (
                    <div key={condition.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_10rem_10rem] sm:items-end">
                      <div><p className="font-medium">{condition.name}</p><p className="text-xs text-muted">{condition.bodySystem}</p></div>
                      <label className="text-sm">Approximate onset year<input type="number" name={timelineField(condition.id, "onsetYear")} min={MIN_TIMELINE_YEAR} max={MAX_TIMELINE_YEAR} inputMode="numeric" defaultValue={timeline.onsetYear ?? ""} className="mt-1 w-full px-3" /></label>
                      <label className="text-sm">Formal diagnosis year<input type="number" name={timelineField(condition.id, "diagnosisYear")} min={MIN_TIMELINE_YEAR} max={MAX_TIMELINE_YEAR} inputMode="numeric" defaultValue={timeline.diagnosisYear ?? ""} className="mt-1 w-full px-3" /></label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <DocumentsSharedChoice documentsShared={documentsShared} />

            <div className="ui-callout text-sm"><strong>Evidence Upload Privacy Contract:</strong> {PRIVACY_CONTRACT_COPY}</div>

            <div className="ui-actions"><Link href="/secondary/ratings" className="ui-button-secondary">← Back to Step 3</Link><button type="submit" className="ui-button" disabled={!corpus}>Review Possible Connections <span aria-hidden="true">→</span><span className="hidden" aria-hidden="true">View Suggestions</span></button></div>
          </form>
        </section>

        <aside className="ui-stack" aria-label="What strong evidence includes">
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">★</span><h2 className="text-xl font-bold">What Strong Evidence Often Includes</h2></div><ul className="list-disc space-y-3 pl-5 text-sm"><li>Current diagnosis and treatment records</li><li>A timeline showing onset and progression</li><li>Relevant treatment history and medication records</li><li>A clinician-authored medical opinion addressing causation or aggravation when medical expertise is required</li><li>Evidence discussing alternative causes when clinically relevant</li></ul></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">→</span><h2 className="text-xl font-bold">Current Run</h2></div><ul className="space-y-2 text-sm">{serviceConnectedConditionIds.map((id) => { const condition = byId.get(id); if (!condition) return null; const rating = ratingsByConditionId[id]; return <li key={id} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span className="font-medium">{condition.name}</span><span className="text-blue-700">{rating === null || rating === undefined ? "Not provided" : ratingDisplayLabel(rating, permanentAndTotalConditionIds.includes(id))}</span></li>; })}</ul>{(medications.length > 0 || treatments.length > 0) && <p className="mt-4 text-xs text-slate-600">Optional context saved: {medications.length} medication item(s), {treatments.length} treatment item(s).</p>}</section>
        </aside>
      </div>
      <DisclaimerFooter />
    </main>
  );
}
