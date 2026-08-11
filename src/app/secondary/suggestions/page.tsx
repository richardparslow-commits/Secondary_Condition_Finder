import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { SecondarySuggestionItem } from "@/components/SecondarySuggestionItem";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { findLinkedNonServiceConnectedConditions, groupSuggestionsByPrimary } from "@/lib/secondary-workflow/suggestions";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { readSecondaryWorkflowSession, workflowSessionToQueryParams } from "@/lib/secondary-workflow/session";

export const dynamic = "force-dynamic";

export default async function SuggestionsStepPage() {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const session = await readSecondaryWorkflowSession();

  let state;
  try {
    state = parseWorkflowState(workflowSessionToQueryParams(session), catalog);
  } catch {
    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">Complete prior steps first</h1>
        <p className="mt-2 text-sm text-slate-600">We need your diagnosed conditions, service-connected selections, ratings context, and upload-step choice before showing grouped suggestions.</p>
        <Link href="/secondary/diagnosed" className="mt-5 inline-block text-sm underline hover:text-slate-900">Start over at diagnosed conditions</Link>
      </main>
    );
  }

  const recommendationsResult = recommend(catalog, kb, { primaryConditions: state.serviceConnectedConditionIds, symptoms: [], medications: [], exposures: [], notes: "" });
  const linked = findLinkedNonServiceConnectedConditions(state.diagnosedConditionIds, state.serviceConnectedConditionIds, recommendationsResult.recommendations);
  const grouped = groupSuggestionsByPrimary(catalog, state.serviceConnectedConditionIds, recommendationsResult.recommendations);

  return (
    <main>
      <Link href="/secondary/upload" className="text-sm underline hover:text-slate-900">Back to optional document upload</Link>
      <header className="mt-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 5 of 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Suggested secondary conditions</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Suggestions are grouped by each service-connected primary condition you selected. These are possibilities to explore, not determinations.</p>
      </header>
      <div className="mb-6"><DisclaimerBanner /></div>

      {linked.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Your diagnosed conditions that may qualify as secondaries</h2>
          <p className="mb-4 text-sm text-slate-600">The following conditions are already in your diagnosis history but are not yet service connected. Based on your service-connected conditions, each one may qualify as a secondary condition.</p>
          <div className="space-y-4">{linked.map((item) => (
            <article key={item.conditionId} className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <header><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Already diagnosed — not yet service connected</p><h3 className="mt-0.5 text-base font-semibold text-slate-900">{item.conditionName}</h3><p className="text-xs text-slate-500">{item.bodySystem}</p></header>
              <section className="mt-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this could be linked to your service-connected condition(s)</h4><ul className="mt-2 space-y-2">{item.linkingPrimaries.map((primary) => <li key={primary.id} className="text-sm leading-relaxed text-slate-700"><span className="font-medium text-slate-900">{primary.name}:</span>{" "}{primary.rationale}</li>)}</ul></section>
            </article>
          ))}</div>
        </section>
      )}

      {recommendationsResult.unmappedPrimaries.length > 0 && <section className="mb-6 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700"><h2 className="font-semibold text-slate-900">Recognized, but not yet mapped</h2><p className="mt-1 leading-relaxed">{recommendationsResult.unmappedPrimaries.join(", ")} {recommendationsResult.unmappedPrimaries.length === 1 ? "is" : "are"} in the catalog, but no authored secondary mappings are published yet. Their absence here does not mean a secondary claim is impossible.</p></section>}

      {grouped.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">No authored secondary mappings were found for the currently selected service-connected conditions.</p> : <div className="space-y-6">{grouped.map((group) => <section key={group.primaryId} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-semibold text-slate-900">{group.primaryName}</h2><p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Service-connected primary condition</p>{group.recommendations.length === 0 ? <p className="mt-3 rounded-md bg-slate-50 p-4 text-sm text-slate-700">This condition is recognized, but no authored secondary mappings are published for it yet.</p> : <div className="mt-4 space-y-3">{group.recommendations.map((recommendation) => <SecondarySuggestionItem key={`${group.primaryId}-${recommendation.conditionId}`} recommendation={recommendation} primaryId={group.primaryId} />)}</div>}</section>)}</div>}

      <Link href="/secondary/evidence" className="mt-8 inline-block rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">Continue to evidence review</Link>
      <DisclaimerFooter />
    </main>
  );
}
