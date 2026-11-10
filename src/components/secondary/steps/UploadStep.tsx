"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import { MedicationContextUploadExplainer } from "@/components/secondary/MedicationContextExplainer";
import { VaGovRecordWalkthrough } from "@/components/secondary/VaGovRecordWalkthrough";
import { VoiceInputHotkeyBridge, VoiceInputTextarea } from "@/components/secondary/VoiceInputTextarea";
import { indexById } from "@/lib/catalog/lookup";
import { buildEvidenceConditionTerms } from "@/lib/evidence/condition-terms";
import type {
  RecordClaimStatus, RecordConditionCandidate,
} from "@/lib/evidence/record-condition-discovery";
import {
  clearRecordDerivedConditions,
  confirmRecordDerivedConditions,
  withdrawRecordCondition,
  withdrawRecordSource,
} from "@/lib/secondary-workflow/record-derived-confirmation";
import { useClientCorpus } from "@/lib/client-corpus";
import {
  applyDocumentsStep,
  persistStepContext,
  persistStepResult,
  toBrowserWorkflowContextInput,
} from "@/lib/secondary-workflow/client-steps";
import { ratingDisplayLabel } from "@/lib/secondary-workflow/ratings";
import { listSymptomBridgeEntries } from "@/lib/secondary-workflow/symptom-bridge";
import {
  MAX_TIMELINE_YEAR,
  MIN_TIMELINE_YEAR,
  timelineField,
} from "@/lib/secondary-workflow/state";
import {
  readSessionContext, useBrowserWorkflowContext,
} from "@/lib/secondary-workflow/use-browser-context";
import {
  SECONDARY_VALIDATION_MESSAGES,
  type SecondaryValidationCode,
} from "@/lib/secondary-workflow/validation";

/**
 * Document-availability choice. Exported as a pure presentation unit so the
 * prefill contract can be rendered directly in tests.
 */
export function DocumentsSharedChoice({
  documentsShared,
  onDocumentsSharedChange,
}: {
  documentsShared?: boolean;
  onDocumentsSharedChange?: (documentsShared: boolean) => void;
}) {
  // The static prefill contract renders this unit without a callback, so keep
  // the uncontrolled form there. The live step controls it, allowing a failed
  // draft write to fall back to the stored answer instead of showing an
  // unpersisted selection.
  const controlled = onDocumentsSharedChange !== undefined;
  return (
    <fieldset className="rounded-xl border border-slate-200 p-4 shadow-none">
      <legend className="font-semibold">Do you want document availability reflected in your checklist?</legend>
      <p className="mt-1 text-sm text-slate-600">This choice stores a yes/no workflow flag. Raw evidence text and locally extracted excerpts are not added to the browser-local workflow context.</p>
      <div className="mt-4 grid gap-3">
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="yes" checked={controlled ? documentsShared === true : undefined} defaultChecked={controlled ? undefined : documentsShared === true} onChange={() => onDocumentsSharedChange?.(true)} className="h-5 w-5" />Yes, I reviewed or have documents available</label>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><input type="radio" name="documentsShared" value="no" checked={controlled ? documentsShared === false : undefined} defaultChecked={controlled ? undefined : documentsShared === false} onChange={() => onDocumentsSharedChange?.(false)} className="h-5 w-5" />No, continue without documents</label>
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
  const searchParams = useSearchParams();
  const { corpus, loading, error: corpusError } = useClientCorpus();
  const { context, ready, persist } = useBrowserWorkflowContext();
  const [localError, setLocalError] = useState<SecondaryValidationCode | null>(null);
  const [hasUnanalyzedPastedText, setHasUnanalyzedPastedText] = useState(false);
  const [showPasteLeaveWarning, setShowPasteLeaveWarning] = useState(false);
  const [recordCandidates, setRecordCandidates] = useState<RecordConditionCandidate[]>([]);
  // Not stored until the veteran explicitly opts in on this screen. Quotes and
  // filenames are NEVER copied into the workflow context.
  const [reviewedRecords, setReviewedRecords] = useState<Record<string, RecordClaimStatus>>({});
  const handleUnsavedPastedTextChange = useCallback((hasUnsavedText: boolean) => {
    setHasUnanalyzedPastedText(hasUnsavedText);
    if (!hasUnsavedText) setShowPasteLeaveWarning(false);
  }, []);

  // Query-param validation on this step is owned by the upload layout's
  // `SecondaryValidationQueryAlert` (pinned accessibility contract); this
  // component only reports errors raised by its own submit.
  const validationMessage = localError ? SECONDARY_VALIDATION_MESSAGES[localError] : null;

  const byId = useMemo(() => (corpus ? indexById(corpus.conditions) : new Map()), [corpus]);
  const diagnosedConditionIds = useMemo(() => context?.diagnosedConditionIds ?? [], [context]);
  const serviceConnectedConditionIds = context?.serviceConnectedConditionIds ?? [];
  const ratingsByConditionId = context?.ratingsByConditionId;
  const permanentAndTotalConditionIds = context?.permanentAndTotalConditionIds ?? [];
  const documentsShared = context?.documentsShared;
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
  const recordGroups = useMemo(() => {
    const byCondition = new Map<string, RecordConditionCandidate[]>();
    const chosen = new Set(diagnosedConditionIds);
    for (const candidate of recordCandidates) {
      if (!byId.has(candidate.conditionId) || chosen.has(candidate.conditionId)) continue;
      const existing = byCondition.get(candidate.conditionId) ?? [];
      existing.push(candidate);
      byCondition.set(candidate.conditionId, existing);
    }
    return [...byCondition.entries()].map(([id, mentions]) => ({
      id,
      name: byId.get(id)?.name ?? id,
      mentions,
      // A term in an assessment alone is insufficient. Only a clinician-
      // authored affirmative statement, with no contradictory negative or
      // family-history mention, may be opted into the research intake.
      eligible: mentions.some((m) => m.category === "diagnosis-statement" && m.clinicianAuthored) &&
        !mentions.some((m) => m.category === "ruled-out" || m.category === "family-history"),
    })).sort((a,b) => a.name.localeCompare(b.name));
  }, [recordCandidates, byId, diagnosedConditionIds]);

  const handleRecordCandidatesChange = useCallback((next: RecordConditionCandidate[]) => {
    setRecordCandidates(next);
    const active = new Set(next.map((entry) => entry.conditionId));
    setReviewedRecords((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => active.has(id))),
    );
  }, []);

  const handleRecordSourceRemoved = useCallback((sourceId: string) => {
    const latest = readSessionContext();
    if (!latest) return;
    const next = withdrawRecordSource(toBrowserWorkflowContextInput(latest), sourceId);
    const result = persistStepContext(persist, next);
    if (!result.ok) setLocalError(result.code);
  }, [persist]);

  const handleRecordEvidenceCleared = useCallback(() => {
    setReviewedRecords({});
    const latest = readSessionContext();
    if (!latest) return;
    const result = persistStepContext(
      persist, clearRecordDerivedConditions(toBrowserWorkflowContextInput(latest)),
    );
    if (!result.ok) setLocalError(result.code);
  }, [persist]);

  function removePreviouslyReviewedCondition(id: string) {
    if (!context) return;
    const next = withdrawRecordCondition(toBrowserWorkflowContextInput(context), id);
    const outcome = persistStepContext(persist, next);
    if (!outcome.ok) setLocalError(outcome.code);
    else setReviewedRecords((current) => {
      const copy = { ...current }; delete copy[id]; return copy;
    });
  }

  function onDocumentsSharedChange(next: boolean) {
    if (!context) return;
    const outcome = persistStepContext(persist, {
      ...toBrowserWorkflowContextInput(context),
      documentsShared: next,
    });
    if (!outcome.ok) {
      setLocalError(outcome.code);
      return;
    }
    setLocalError(null);
  }

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
    // Existing context may contain earlier record-derived selections from a
    // previous Step 4 visit; the general Step 4 parser intentionally does not
    // understand these new browser-only fields, so preserve them explicitly.
    const previousRecordContext = {
      ...result.context,
      recordDiscoveredConditionIds: context?.recordDiscoveredConditionIds ?? [],
      recordClaimStatusByConditionId: context?.recordClaimStatusByConditionId ?? {},
      recordSourceIdsByConditionId: context?.recordSourceIdsByConditionId ?? {},
      recordDerivedSafeguardVersion: context?.recordDerivedSafeguardVersion,
      recordDerivedReReviewRequired: context?.recordDerivedReReviewRequired,
    };
    const approved = recordGroups.filter((group) =>
      group.eligible && reviewedRecords[group.id] !== undefined,
    ).map((group) => ({
      conditionId: group.id,
      claimStatus: reviewedRecords[group.id],
      sourceIds: [...new Set(group.mentions.map((entry) => entry.sourceId))].slice(0, 8),
    }));
    let nextRecordContext;
    try {
      nextRecordContext = confirmRecordDerivedConditions(
        previousRecordContext, approved, corpus.conditions,
      );
    } catch {
      setLocalError("invalid-context");
      return;
    }
    const outcome = persistStepResult(persist, { ...result, context: nextRecordContext });
    if (!outcome.ok) {
      setLocalError(outcome.code);
      return;
    }
    // The upload layout renders the ?error= alert. Replacing that entry on a
    // successful resubmit keeps Back from Step 5 on the clean Step 4 address.
    if (searchParams.has("error")) {
      router.replace(outcome.next);
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

          <LocalEvidenceAnalyzer
            conditionTerms={conditionTerms}
            recordDiscoveryCatalog={corpus?.conditions}
            onRecordCandidatesChange={handleRecordCandidatesChange}
            onRecordSourceRemoved={handleRecordSourceRemoved}
            onRecordEvidenceCleared={handleRecordEvidenceCleared}
            onUnsavedPastedTextChange={handleUnsavedPastedTextChange}
          />

          {context?.recordDerivedReReviewRequired && (
            <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Record research topics need review again.</strong> An earlier
              detection version could have treated negative findings or a
              relative&apos;s diagnosis as your condition. Those previously added
              record-only topics have been excluded from this review. Your
              manually entered conditions and VA ratings were preserved.
              Re-analyze the relevant record and confirm any new research topic.
            </p>
          )}
          <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-labelledby="record-discovery-heading">
            <h2 id="record-discovery-heading" className="text-xl font-semibold text-blue-950">
              Possible additional conditions found in your records
            </h2>
            <p className="mt-2 text-sm text-blue-950">
              This is a local term search, not a diagnosis or medical opinion. Terms may
              be historical, suspected, excluded, or about family members. Review the
              exact passage and ask a medical professional to confirm whether it applies.
              Only an affirmative clinician-authored diagnosis statement can be selected
              for additional research here. No selection is made automatically.
            </p>
            {recordGroups.length === 0 ? (
              <p className="mt-3 text-sm text-blue-900">
                No additional catalog condition mentions have been found in the records analyzed in this tab.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {recordGroups.map((group) => (
                  <article key={group.id} className="rounded-lg border border-blue-200 bg-white p-3">
                    <h3 className="font-semibold">{group.name}</h3>
                    <ul className="mt-2 space-y-2 text-sm">
                      {group.mentions.slice(0, 3).map((entry, index) => (
                        <li key={entry.sourceId + ":" + entry.category + ":" + index}>
                          <span className="font-medium">{entry.category.replaceAll("-", " ")}{entry.clinicianAuthored ? " (author identified as clinician)" : " (author unverified/non-clinician)"}</span>
                          <span className="block text-slate-600">{entry.sourceName} — {entry.locator}</span>
                          <q className="block text-slate-800">{entry.quote}</q>
                        </li>
                      ))}
                    </ul>
                    {group.eligible ? (
                      <div className="mt-3 space-y-2">
                        <label className="flex items-start gap-2 text-sm font-medium">
                          <input type="checkbox" className="mt-1" checked={reviewedRecords[group.id] !== undefined}
                            onChange={(event) => setReviewedRecords((prev) => {
                              const next = { ...prev };
                              if (event.target.checked) next[group.id] = "unknown";
                              else delete next[group.id];
                              return next;
                            })} />
                          I want to add this as a possible research topic, not as a verified diagnosis.
                        </label>
                        {reviewedRecords[group.id] !== undefined && (
                          <label className="block text-sm">
                            Current VA claim status (your understanding)
                            <select className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
                              value={reviewedRecords[group.id]} onChange={(event) =>
                                setReviewedRecords((prev) => ({
                                  ...prev, [group.id]: event.target.value as RecordClaimStatus,
                                }))}>
                              <option value="unknown">Unsure / unknown</option>
                              <option value="not-yet-claimed">Not yet claimed</option>
                              <option value="pending">Claim pending</option>
                              <option value="denied">Previously denied</option>
                            </select>
                          </label>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-amber-900">
                        Held for medical clarification: there is no uncontradicted
                        clinician-authored affirmative diagnosis statement for this term.
                        It will not be treated as a diagnosed condition.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
            {(context?.recordDiscoveredConditionIds?.length ?? 0) > 0 && (
              <div className="mt-5 border-t border-blue-200 pt-3">
                <h3 className="font-semibold text-blue-950">Research topics you previously added</h3>
                <ul className="mt-2 space-y-2">
                  {context?.recordDiscoveredConditionIds?.map((id) => (
                    <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{byId.get(id)?.name ?? id} — {context.recordClaimStatusByConditionId?.[id] ?? "unknown"}</span>
                      <button type="button" className="ui-button-secondary"
                        onClick={() => removePreviouslyReviewedCondition(id)}>
                        Remove research topic
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

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

            <DocumentsSharedChoice
              documentsShared={documentsShared}
              onDocumentsSharedChange={onDocumentsSharedChange}
            />

            <div className="ui-callout text-sm"><strong>Evidence Upload Privacy Contract:</strong> {PRIVACY_CONTRACT_COPY}</div>

            {showPasteLeaveWarning && hasUnanalyzedPastedText && (
              <div role="alert" className="ui-callout border-amber-300 bg-amber-50 text-sm text-amber-950">
                <p id="paste-leave-warning"><strong>Pasted text has not been analyzed.</strong> Going back to Step 3 now will discard it.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href="/secondary/ratings" className="ui-button">Leave and discard</Link>
                  <button type="button" className="ui-button-secondary" onClick={() => setShowPasteLeaveWarning(false)}>Keep editing</button>
                </div>
              </div>
            )}
            <div className="ui-actions"><Link href="/secondary/ratings" className="ui-button-secondary" onClick={(event) => { if (!hasUnanalyzedPastedText) return; event.preventDefault(); setShowPasteLeaveWarning(true); }} aria-describedby={showPasteLeaveWarning ? "paste-leave-warning" : undefined}>← Back to Step 3</Link><button type="submit" className="ui-button" disabled={!corpus}>Review Possible Connections <span aria-hidden="true">→</span><span className="hidden" aria-hidden="true">View Suggestions</span></button></div>
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
