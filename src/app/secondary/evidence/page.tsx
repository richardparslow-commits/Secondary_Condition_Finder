import Link from "next/link";

import { EvidenceGapCoverage } from "@/components/evidence/EvidenceGapCoverage";
import { SymptomDiscussionReview } from "@/components/SymptomDiscussionReview";
import { MedicalRecordChecklist } from "@/components/secondary/MedicalRecordChecklist";
import { ActionPlan } from "@/components/secondary/ActionPlan";
import { PrintReportButton } from "@/components/secondary/PrintReportButton";
import { RatingGuide } from "@/components/secondary/RatingGuide";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { EvidenceGapReview } from "@/components/evidence/EvidenceGapReview";
import { LocalEvidenceReview } from "@/components/evidence/LocalEvidenceReview";
import { PathwayEvidenceMapper } from "@/components/evidence/PathwayEvidenceMapper";
import { RegulatoryPreflightStatus } from "@/components/RegulatoryPreflightStatus";
import {
  SecondaryWorkflowCompletionActions,
  SecondaryWorkflowRestartButton,
} from "@/components/secondary/SecondaryWorkflowCompletionActions";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { buildEvidenceConditionTerms } from "@/lib/evidence/condition-terms";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import {
  loadLockedRegulatorySnapshot,
  missingLockedRegulatorySnapshot,
  prepareRegulatoryReview,
  relevantChangesForSnapshot,
} from "@/lib/regulatory/preflight";
import { buildSecondaryRecommendationIntake } from "@/lib/secondary-workflow/recommendation-intake";
import { buildMedicalRecordChecklist } from "@/lib/secondary-workflow/medical-record-checklist";
import { buildNonServiceConnectedConditionResults } from "@/lib/secondary-workflow/suggestions";
import { buildSymptomDiscussionPrompts } from "@/lib/secondary-workflow/symptom-bridge";
import { AccreditedRepresentativeFinder } from "@/components/va/AccreditedRepresentativeFinder";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { readSecondaryWorkflowSession, workflowSessionToQueryParams } from "@/lib/secondary-workflow/session";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";

export const dynamic = "force-dynamic";

interface EvidenceReviewStepPageProps {
  searchParams?: Promise<{ regSnapshot?: string | string[]; zip?: string; radiusMiles?: string; type?: string }>;
}

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function EvidenceReviewStepPage({ searchParams }: EvidenceReviewStepPageProps = {}) {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = indexById(catalog);
  const session = await readSecondaryWorkflowSession();

  let state;
  try { state = parseWorkflowState(workflowSessionToQueryParams(session), catalog); }
  catch {
    return (
      <main>
        <header className="page-hero">
          <h1>Complete prior steps first</h1>
          <p>We need the full workflow selections before building an evidence checklist.</p>
        </header>
        <SecondaryWorkflowRestartButton label="Clear saved review state and start over" />
      </main>
    );
  }

  // Step 6 must use the same regulatory snapshot that Step 5 locked. If a user
  // opens Step 6 directly, establish a snapshot before recommendation/evidence
  // output. If a prior lock disappeared, fail closed to medical-only instead of
  // substituting a newer legal snapshot mid-review.
  const lockedSnapshotId = firstParam((await searchParams)?.regSnapshot);
  const lockedSnapshot = loadLockedRegulatorySnapshot(lockedSnapshotId);
  const regulatoryReview = lockedSnapshot
    ? {
        snapshot: lockedSnapshot,
        relevantChanges: relevantChangesForSnapshot(lockedSnapshot),
      }
    : lockedSnapshotId
      ? {
          snapshot: missingLockedRegulatorySnapshot(lockedSnapshotId),
          relevantChanges: [],
        }
      : await prepareRegulatoryReview({
          reviewScope: {
            conditionIds: [...new Set([
              ...state.diagnosedConditionIds,
              ...state.serviceConnectedConditionIds,
            ])],
          },
        });

  const medications = state.medications ?? [];
  const treatments = state.treatments ?? [];
  const recommendationsResult = recommend(
    catalog,
    kb,
    buildSecondaryRecommendationIntake(state),
  );
  const nonServiceConnectedResults = buildNonServiceConnectedConditionResults(
    catalog,
    state.diagnosedConditionIds,
    state.serviceConnectedConditionIds,
    recommendationsResult.recommendations,
  );
  const linkedRecommendations = nonServiceConnectedResults.flatMap((result) =>
    result.recommendation ? [result.recommendation] : [],
  );
  const conditionTermsByResultId = new Map<string, string[]>();
  for (const result of nonServiceConnectedResults) {
    const condition = byId.get(result.conditionId);
    conditionTermsByResultId.set(
      result.conditionId,
      condition ? buildEvidenceConditionTerms([condition]) : [],
    );
  }
  const consultationRecommendations = linkedRecommendations.map((recommendation) => ({
    ...recommendation,
    matchedIntakeContext: [],
  }));
  const conditionNamesById = new Map([...byId].map(([id, condition]) => [id, condition.name] as const));
  const symptomDiscussionPrompts = buildSymptomDiscussionPrompts(
    state.symptomIds ?? [],
    conditionNamesById,
  );
  const evidenceGapRecommendations = linkedRecommendations.map((recommendation) => ({
    conditionId: recommendation.conditionId,
    condition: recommendation.condition,
    evidenceGaps: recommendation.evidenceGaps,
  }));
  const suggestionsHref = `/secondary/suggestions?regSnapshot=${encodeURIComponent(regulatoryReview.snapshot.snapshotId)}`;
  const qp2 = await searchParams;
  const zipParam2 = typeof qp2?.zip === "string" ? qp2.zip : undefined;
  const accreditedRepView2 = zipParam2 && /^\d{5}$/.test(zipParam2)
    ? await loadAccreditedRepresentatives({
        zip: zipParam2,
        radiusMiles: typeof qp2?.radiusMiles === "string" ? Number(qp2.radiusMiles) : 50,
        type: (typeof qp2?.type === "string" ? qp2.type : undefined) as "VSO" | "agent" | "attorney" | undefined,
      })
    : null;

  return (
    <main>
      <header className="page-hero text-center"><p className="ui-kicker">Step 6 of 6</p><h1>Evidence &amp; Research Checklist</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Review evidence questions for the same diagnosed non-service-connected conditions evaluated in Step 5. This page does not add new diagnoses, determine eligibility, or decide whether a relationship has been medically established.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><span>✓ Documents</span><span>✓ Connections</span><strong className="text-blue-700">6 Evidence</strong><span className="ml-auto no-print"><PrintReportButton label="Print this checklist" /></span></div>
      <RegulatoryPreflightStatus snapshot={regulatoryReview.snapshot} changes={regulatoryReview.relevantChanges} />

      <div className="ui-grid">
        <aside className="ui-card">
          <SymptomDiscussionReview prompts={symptomDiscussionPrompts} />
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Condition Summary</h2></div>
          <p className="ui-kicker">Already service connected</p>
          <ul className="mt-3 space-y-3">{state.serviceConnectedConditionIds.map((id) => { const condition = byId.get(id); if (!condition) return null; const rating = state.ratingsByConditionId[id]; return <li key={id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><strong className="block text-blue-900">{condition.name}</strong><span>{rating === null ? "Rating not provided" : `${rating}% current rating entered`}</span></li>; })}</ul>
          <div className="ui-divider" />
          <p className="ui-kicker">Diagnosed, not service connected</p>
          {nonServiceConnectedResults.length > 0 ? <ul className="mt-3 space-y-2">{nonServiceConnectedResults.map((result) => <li key={result.conditionId} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><strong className="text-amber-950">{result.conditionName}</strong></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No non-service-connected diagnoses remain in this review.</p>}
          <div className="ui-divider" />
          <p className="text-sm"><strong>Documents flagged:</strong> {state.documentsShared ? "Yes — evidence available or reviewed" : "No"}</p>
          {(medications.length > 0 || treatments.length > 0) && <div className="mt-4"><p className="text-sm font-semibold">Optional context retained for this run</p>{medications.length > 0 && <p className="mt-1 text-sm"><strong>Medications:</strong> {medications.join(", ")}</p>}{treatments.length > 0 && <p className="mt-1 text-sm"><strong>Treatments:</strong> {treatments.join(", ")}</p>}</div>}
          <div className="ui-callout mt-5 text-sm"><strong>Privacy boundary:</strong> Raw Step 4 evidence text and extracted excerpts do not enter server workflow state. The document yes/no flag and any bounded medication/treatment entries are stored only in the encrypted short-lived workflow cookie and are kept out of URLs, telemetry, and recommendation logs.</div>
        </aside>

        <section className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">☑</span><div><h2 className="text-xl font-bold">Evidence by Non-Service-Connected Diagnosis</h2><p className="text-sm text-slate-600">Only the diagnoses and possible service-connected relationships reviewed in Step 5 appear here.</p></div></div>
          {nonServiceConnectedResults.length === 0 ? <p className="rounded-xl border border-slate-200 p-4 text-sm">There are no non-service-connected diagnoses to review.</p> : <div className="space-y-6">{nonServiceConnectedResults.map((result) => <article key={result.conditionId} className="rounded-xl border border-slate-200 p-4 shadow-none"><h3 className="text-lg font-bold">{result.conditionName}</h3>{!result.recommendation ? <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>No mapped relationship evidence checklist is available for this diagnosis.</strong><p className="mt-1">The current knowledge base did not identify a published relationship from any service-connected condition selected in this review. This is not a medical finding that no relationship exists.</p></div> : <div className="mt-4"><p className="text-sm"><strong>Service-connected conditions associated with the Step 5 relationship review:</strong> {result.recommendation.contributingPrimaries.map((primary) => primary.name).join(", ")}</p>{(result.recommendation.intermediatePathways?.length ?? 0) > 0 && <div className="mt-3 rounded-lg border border-violet-300 bg-violet-50 p-3 text-sm text-violet-950"><strong>Intermediate-chain research pathway:</strong><p className="mt-1">This is a bounded two-edge research path, not a direct nexus finding. Each link requires separate clinical support.</p><ul className="mt-2 list-disc space-y-1 pl-5">{result.recommendation.intermediatePathways?.map((pathway) => <li key={`${pathway.primaryId}-${pathway.intermediateId}-${pathway.targetId}`}><strong>{pathway.causalChain}</strong><ul className="mt-1 list-disc pl-5 text-xs">{pathway.edges.map((edge) => <li key={`${edge.conditionId}-${edge.targetConditionId}`}>{edge.conditionName} → {edge.targetConditionName}: {edge.nexusClassification}; sources: {edge.sourceReferences.map((reference) => reference.citation).join(", ")}</li>)}</ul></li>)}</ul></div>}{(result.recommendation.clinicalFrictionWarnings?.length ?? 0) > 0 && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>Alternative-etiology review:</strong><ul className="mt-1 list-disc space-y-1 pl-5">{result.recommendation.clinicalFrictionWarnings?.map((warning) => <li key={`${warning.primaryId}-${warning.message}`}>{warning.message}</li>)}</ul></div>}{(result.recommendation.chronologyWarnings?.length ?? 0) > 0 && <div className="mt-3 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950"><strong>Chronology question:</strong><ul className="mt-1 list-disc space-y-1 pl-5">{result.recommendation.chronologyWarnings?.map((warning) => <li key={`${warning.primaryId}-${warning.message}`}>{warning.message}</li>)}</ul></div>}{result.recommendation.matchedIntakeContext.length > 0 && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><strong>Reported context appearing in authored mapping text:</strong> {result.recommendation.matchedIntakeContext.join(", ")}<p className="mt-1 text-xs">Text overlap is a research cue only; it does not establish individual causation, aggravation, or a medical nexus.</p></div>}<h4 className="mt-4 font-semibold text-slate-900">Evidence questions to review</h4><p className="mt-1 text-sm text-slate-600">Coverage chips compare your browser-local Step 4 excerpts with this condition. A chip is a research cue that excerpts exist in the relevant category — it does not mean the evidence satisfies VA&apos;s standard.</p><ul className="mt-2 space-y-2">{result.recommendation.evidenceGaps.map((gap) => <li key={gap} className="rounded-lg border border-slate-200 p-2"><div className="flex gap-3 text-sm"><span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-700 text-xs text-white" aria-hidden="true">✓</span><span>{gap}</span></div><div className="mt-1 pl-8"><EvidenceGapCoverage gap={gap} conditionTerms={conditionTermsByResultId.get(result.conditionId) ?? []} /></div></li>)}</ul></div>}</article>)}</div>}
          <div className="ui-callout mt-5 text-sm"><strong>Citations, context matches, and evidence gaps are starting points, not proof.</strong> Confirm current VA guidance and review condition-specific evidence with a qualified provider or accredited representative.</div>
        </section>

        <aside className="ui-stack">
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">⇩</span><h2 className="text-xl font-bold">Consultation Summary</h2></div><p className="mb-4 text-sm">Downloads are in the Pathway Evidence Mapping section below: the standalone summary, or one combined file with the mapping plus summary.</p></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✎</span><h2 className="text-xl font-bold">Research Notes</h2></div><p className="text-sm">Use your own secure notes or records to track questions such as potential nexus literature, providers to ask, symptom history, and missing treatment records. This app does not store free-text research notes on the server.</p></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">→</span><h2 className="text-xl font-bold">Next Steps</h2></div><ol className="space-y-3 text-sm"><li><strong>1.</strong> Review the relationship rationale and citations for each non-service-connected diagnosis.</li><li><strong>2.</strong> Compare mapped evidence gaps with exact local excerpts and any reported context match.</li><li><strong>3.</strong> Discuss causation, contribution, or aggravation questions with a qualified provider.</li><li><strong>4.</strong> Consider an accredited representative, attorney, or VSO.</li></ol></section>
        </aside>
      </div>

      <MedicalRecordChecklist groups={buildMedicalRecordChecklist(nonServiceConnectedResults)} />
      <RatingGuide results={nonServiceConnectedResults} catalog={catalog} />
      <ActionPlan results={nonServiceConnectedResults} />
      <AccreditedRepresentativeFinder initialView={accreditedRepView2} returnTo="/secondary/evidence" />
      <EvidenceGapReview recommendations={evidenceGapRecommendations} />
      <LocalEvidenceReview />
      <PathwayEvidenceMapper results={nonServiceConnectedResults} recommendations={consultationRecommendations} />

      <div className="ui-actions">
        <Link href={suggestionsHref} className="ui-button-secondary">← Back to Connections</Link>
        <SecondaryWorkflowCompletionActions />
      </div>
      <div className="ui-footer-note"><strong>Privacy on completion:</strong> Finish Review and Start a new review clear the encrypted workflow cookie, browser-local evidence excerpts, and browser-local checklist selections before leaving this review. Relationship results come from a curated knowledge base and are not approval probabilities.</div>
      <DisclaimerFooter />
    </main>
  );
}
