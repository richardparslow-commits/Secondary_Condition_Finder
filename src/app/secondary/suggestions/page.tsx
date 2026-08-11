import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { SecondarySuggestionItem } from "@/components/SecondarySuggestionItem";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { findLinkedNonServiceConnectedConditions, groupSuggestionsByPrimary } from "@/lib/secondary-workflow/suggestions";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { readSecondaryWorkflowSession, workflowSessionToQueryParams, type StoredSecondaryWorkflowState } from "@/lib/secondary-workflow/session";

interface SuggestionsPageProps { workflowState?: StoredSecondaryWorkflowState; }
export const dynamic = "force-dynamic";

export default async function SuggestionsStepPage({ workflowState }: SuggestionsPageProps = {}) {
  const catalog = loadConditionCatalog();
  const byId = indexById(catalog);
  const kb = loadKnowledgeBase();
  const session = workflowState ?? (await readSecondaryWorkflowSession());

  let state;
  try { state = parseWorkflowState(workflowSessionToQueryParams(session), catalog); }
  catch { return <main><header className="page-hero"><h1>Complete prior steps first</h1><p>We need the prior workflow selections before showing grouped suggestions.</p></header><Link href="/secondary/upload" className="ui-button">Back to optional document upload</Link></main>; }

  const recommendationsResult = recommend(catalog, kb, { primaryConditions: state.serviceConnectedConditionIds, symptoms: [], medications: [], exposures: [], notes: "" });
  const linked = findLinkedNonServiceConnectedConditions(state.diagnosedConditionIds, state.serviceConnectedConditionIds, recommendationsResult.recommendations);
  const grouped = groupSuggestionsByPrimary(catalog, state.serviceConnectedConditionIds, recommendationsResult.recommendations);
  const diagnosedNames = state.diagnosedConditionIds.map((id) => byId.get(id)?.name).filter(Boolean);
  const primaryNames = state.serviceConnectedConditionIds.map((id) => byId.get(id)?.name).filter(Boolean);

  return (
    <main>
      <header className="page-hero text-center"><p className="ui-kicker">Step 5 of 6</p><h1>Secondary Suggestions</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Possible claim-preparation pathways based on your selected service-connected conditions and published knowledge-base mappings.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><span>✓ Documents</span><strong className="text-blue-700">5 Suggestions</strong><span>6 Evidence</span></div>

      <div className="ui-grid">
        <aside className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Your Inputs</h2></div>
          <h3 className="font-bold">Diagnosed conditions</h3><div className="mt-2 flex flex-wrap gap-2">{diagnosedNames.map((name) => <span key={name} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-900">{name}</span>)}</div>
          <div className="ui-divider" />
          <h3 className="font-bold">Service-connected conditions</h3><div className="mt-2 flex flex-wrap gap-2">{primaryNames.map((name) => <span key={name} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-900">{name}</span>)}</div>
          <div className="ui-callout mt-5 text-sm">These inputs were used to generate the suggestions shown. Suggestions are not approval predictions.</div>
          <Link href="/secondary/diagnosed" className="ui-button-secondary mt-5 w-full">Edit Inputs</Link>
        </aside>

        <section className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↗</span><div><h2 className="text-xl font-bold">Published Secondary Pathways</h2><p className="text-sm text-slate-600">Grouped by service-connected primary condition.</p></div></div>
          {linked.length > 0 && <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="font-bold">Already diagnosed, not yet service connected</h3><ul className="mt-3 space-y-3">{linked.map((item) => <li key={item.conditionId}><strong>{item.conditionName}</strong><ul className="mt-1 list-disc pl-5 text-sm">{item.linkingPrimaries.map((primary) => <li key={primary.id}><strong>{primary.name}:</strong> {primary.rationale}</li>)}</ul></li>)}</ul></div>}
          {recommendationsResult.unmappedPrimaries.length > 0 && <div className="ui-callout mb-5 text-sm"><strong>Recognized, but not yet mapped:</strong> {recommendationsResult.unmappedPrimaries.join(", ")}. Their absence does not mean a secondary claim is impossible.</div>}
          {grouped.length === 0 ? <p className="rounded-xl border border-slate-200 p-5 text-sm">No authored secondary mappings were found for the selected primary conditions.</p> : <div className="space-y-5">{grouped.map((group, index) => <article key={group.primaryId} className="rounded-xl border border-slate-200 p-4 shadow-none"><div className="flex gap-3"><span className="ui-icon" aria-hidden="true">{index + 1}</span><div><h3 className="text-lg font-bold">{group.primaryName}</h3><p className="text-xs uppercase tracking-wide text-slate-500">Service-connected primary condition</p></div></div>{group.recommendations.length === 0 ? <p className="mt-3 text-sm">This condition is recognized, but no authored secondary mappings are published for it yet.</p> : <div className="mt-4 space-y-3">{group.recommendations.map((recommendation) => <SecondarySuggestionItem key={`${group.primaryId}-${recommendation.conditionId}`} recommendation={recommendation} primaryId={group.primaryId} />)}</div>}</article>)}</div>}
        </section>

        <aside className="ui-stack">
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">How to Interpret Results</h2></div><ul className="space-y-4 text-sm"><li><strong>Not ranked by likelihood.</strong><p>Results are not approval probabilities or rankings.</p></li><li><strong>Starting points only.</strong><p>Use suggestions to guide evidence gathering and questions for qualified professionals.</p></li><li><strong>Confirm with evidence.</strong><p>Each pathway must be evaluated against your actual medical history and current VA requirements.</p></li></ul></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Next Review</h2></div><p className="text-sm">The final workflow page turns published recommendation evidence gaps into a structured review checklist.</p></section>
        </aside>
      </div>

      <div className="ui-actions"><Link href="/secondary/upload" className="ui-button-secondary">← Back to Documents</Link><Link href="/secondary/evidence" className="ui-button">Open Evidence Checklist <span aria-hidden="true">→</span></Link></div>
      <DisclaimerFooter />
    </main>
  );
}
