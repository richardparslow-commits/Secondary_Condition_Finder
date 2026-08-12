import Link from "next/link";

import { ConsultationSummaryDownload } from "@/components/ConsultationSummaryDownload";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { EvidenceGapReview } from "@/components/evidence/EvidenceGapReview";
import { LocalEvidenceReview } from "@/components/evidence/LocalEvidenceReview";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { groupSuggestionsByPrimary } from "@/lib/secondary-workflow/suggestions";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { readSecondaryWorkflowSession, workflowSessionToQueryParams } from "@/lib/secondary-workflow/session";

export const dynamic = "force-dynamic";

export default async function EvidenceReviewStepPage() {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = indexById(catalog);
  const session = await readSecondaryWorkflowSession();

  let state;
  try { state = parseWorkflowState(workflowSessionToQueryParams(session), catalog); }
  catch { return <main><header className="page-hero"><h1>Complete prior steps first</h1><p>We need the full workflow selections before building an evidence checklist.</p></header><Link href="/secondary/diagnosed" className="ui-button">Start over at diagnosed conditions</Link></main>; }

  const medications = state.medications ?? [];
  const treatments = state.treatments ?? [];
  const recommendationsResult = recommend(catalog, kb, {
    primaryConditions: state.serviceConnectedConditionIds,
    symptoms: [],
    medications,
    treatments,
    exposures: [],
    notes: "",
  });
  const grouped = groupSuggestionsByPrimary(catalog, state.serviceConnectedConditionIds, recommendationsResult.recommendations);
  const consultationRecommendations = recommendationsResult.recommendations.map((recommendation) => ({
    ...recommendation,
    matchedIntakeContext: [],
  }));
  const evidenceGapRecommendations = recommendationsResult.recommendations.map((recommendation) => ({
    conditionId: recommendation.conditionId,
    condition: recommendation.condition,
    evidenceGaps: recommendation.evidenceGaps,
  }));

  return (
    <main>
      <header className="page-hero text-center"><p className="ui-kicker">Step 6 of 6</p><h1>Evidence &amp; Research Checklist</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Review published evidence gaps together with exact excerpts identified during optional browser-local evidence analysis. This page does not determine eligibility or whether VA will accept an excerpt as sufficient nexus evidence.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><span>✓ Documents</span><span>✓ Suggestions</span><strong className="text-blue-700">6 Evidence</strong></div>

      <div className="ui-grid">
        <aside className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Condition Summary</h2></div>
          <p className="ui-kicker">Service-connected context</p>
          <ul className="mt-3 space-y-3">{state.serviceConnectedConditionIds.map((id) => { const condition = byId.get(id); if (!condition) return null; const rating = state.ratingsByConditionId[id]; return <li key={id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><strong className="block text-blue-900">{condition.name}</strong><span>{rating === null ? "Rating not provided" : `${rating}% current rating entered`}</span></li>; })}</ul>
          <div className="ui-divider" />
          <p className="text-sm"><strong>Documents flagged:</strong> {state.documentsShared ? "Yes — evidence available or reviewed" : "No"}</p>
          {(medications.length > 0 || treatments.length > 0) && <div className="mt-4"><p className="text-sm font-semibold">Optional context retained for this run</p>{medications.length > 0 && <p className="mt-1 text-sm"><strong>Medications:</strong> {medications.join(", ")}</p>}{treatments.length > 0 && <p className="mt-1 text-sm"><strong>Treatments:</strong> {treatments.join(", ")}</p>}</div>}
          <div className="ui-callout mt-5 text-sm"><strong>Privacy boundary:</strong> Raw Step 4 evidence text and extracted excerpts do not enter server workflow state. The document yes/no flag and any bounded medication/treatment entries are stored only in the encrypted short-lived workflow cookie and are kept out of URLs, telemetry, and recommendation logs.</div>
        </aside>

        <section className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">☑</span><div><h2 className="text-xl font-bold">Recommended Evidence</h2><p className="text-sm text-slate-600">Evidence gaps surfaced by published knowledge-base mappings.</p></div></div>
          {grouped.length === 0 ? <p className="rounded-xl border border-slate-200 p-4 text-sm">No published recommendation evidence gaps are available for the selected primary conditions.</p> : <div className="space-y-6">{grouped.map((group) => <article key={group.primaryId} className="rounded-xl border border-slate-200 p-4 shadow-none"><h3 className="text-lg font-bold">{group.primaryName}</h3>{group.recommendations.length === 0 ? <p className="mt-2 text-sm">This primary condition is recognized, but no authored secondary mappings are published for it yet.</p> : <div className="mt-4 space-y-5">{group.recommendations.map((recommendation) => <section key={`${group.primaryId}-${recommendation.conditionId}`} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0"><h4 className="font-bold text-blue-900">{recommendation.condition}</h4>{recommendation.matchedIntakeContext.length > 0 && <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><strong>Reported context appearing in authored pathway text:</strong> {recommendation.matchedIntakeContext.join(", ")}<p className="mt-1 text-xs">Text overlap is a research cue only; it does not establish individual causation, aggravation, or a medical nexus.</p></div>}<ul className="mt-2 space-y-2">{recommendation.evidenceGaps.map((gap) => <li key={gap} className="flex gap-3 text-sm"><span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-700 text-xs text-white" aria-hidden="true">✓</span><span>{gap}</span></li>)}</ul></section>)}</div>}</article>)}</div>}
          <div className="ui-callout mt-5 text-sm"><strong>Citations, context matches, and evidence gaps are starting points, not proof.</strong> Confirm current VA guidance and review condition-specific evidence with a qualified provider or accredited representative.</div>
        </section>

        <aside className="ui-stack">
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">⇩</span><h2 className="text-xl font-bold">Consultation Summary</h2></div><p className="mb-4 text-sm">Download the authored research checklist for discussion with an accredited representative or qualified provider.</p>{consultationRecommendations.length > 0 ? <ConsultationSummaryDownload recommendations={consultationRecommendations} /> : <p className="text-sm text-slate-600">No published recommendations are available to export for this run.</p>}</section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✎</span><h2 className="text-xl font-bold">Research Notes</h2></div><p className="text-sm">Use your own secure notes or records to track questions such as potential nexus literature, providers to ask, symptom history, and missing treatment records. This app does not store free-text research notes on the server.</p></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">→</span><h2 className="text-xl font-bold">Next Steps</h2></div><ol className="space-y-3 text-sm"><li><strong>1.</strong> Review citations and current VA guidance.</li><li><strong>2.</strong> Compare mapped evidence gaps with exact local excerpts and any reported context match.</li><li><strong>3.</strong> Discuss causation/aggravation questions with a qualified provider.</li><li><strong>4.</strong> Consider an accredited representative, attorney, or VSO.</li></ol></section>
        </aside>
      </div>

      <EvidenceGapReview recommendations={evidenceGapRecommendations} />
      <LocalEvidenceReview />

      <div className="ui-actions"><Link href="/secondary/suggestions" className="ui-button-secondary">← Back to Suggestions</Link><Link href="/secondary" className="ui-button">Finish Review <span aria-hidden="true">→</span></Link></div>
      <div className="ui-footer-note"><strong>Reminder:</strong> Suggestions come from a curated knowledge base and are not ranked by likelihood of approval. Reported medication/treatment matches, checklist selections, and locally extracted record excerpts are evidence-review aids, not adjudicative findings.</div>
      <DisclaimerFooter />
    </main>
  );
}
