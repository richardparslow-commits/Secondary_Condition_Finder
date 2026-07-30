import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import {
  SecondaryWorkflowHiddenFields,
  toHiddenFieldState,
} from "@/components/SecondaryWorkflowHiddenFields";
import { SecondarySuggestionItem } from "@/components/SecondarySuggestionItem";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { groupSuggestionsByPrimary } from "@/lib/secondary-workflow/suggestions";
import {
  parseRatingsSelection,
  parseWorkflowState,
  ratingFieldName,
  workflowStateToSearchParams,
} from "@/lib/secondary-workflow/state";

export const dynamic = "force-dynamic";

export default async function SuggestionsStepPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const params = await searchParams;

  let state;
  let guardHref = "/secondary/diagnosed";
  let guardLabel = "Start over at diagnosed conditions";

  try {
    state = parseWorkflowState(params, catalog);
  } catch {
    try {
      const parsed = parseRatingsSelection(params, catalog);
      guardHref = `/secondary/upload?${new URLSearchParams([
        ...parsed.diagnosedConditionIds.map((id) => ["diagnosed", id]),
        ...parsed.serviceConnectedConditionIds.map((id) => ["serviceConnected", id]),
        ...parsed.serviceConnectedConditionIds.map((id) => [
          ratingFieldName(id),
          parsed.ratingsByConditionId[id] === null ? "decline" : String(parsed.ratingsByConditionId[id]),
        ]),
      ]).toString()}`;
      guardLabel = "Back to optional document upload";
    } catch {
      // Fall back to diagnosed step.
    }

    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">Complete prior steps first</h1>
        <p className="mt-2 text-sm text-slate-600">
          We need your diagnosed conditions, service-connected selections, ratings context, and
          upload-step choice before showing grouped suggestions.
        </p>
        <Link href={guardHref} className="mt-5 inline-block text-sm underline hover:text-slate-900">
          {guardLabel}
        </Link>
      </main>
    );
  }

  const recommendationsResult = recommend(catalog, kb, {
    primaryConditions: state.serviceConnectedConditionIds,
    symptoms: [],
    medications: [],
    exposures: [],
    notes: "",
  });

  const grouped = groupSuggestionsByPrimary(
    catalog,
    state.serviceConnectedConditionIds,
    recommendationsResult.recommendations,
  );

  return (
    <main>
      <Link
        href={`/secondary/upload?${workflowStateToSearchParams(state).toString()}`}
        className="text-sm underline hover:text-slate-900"
      >
        Back to optional document upload
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 5 of 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Suggested secondary conditions</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Suggestions are grouped by each service-connected primary condition you selected. These
          are possibilities to explore, not determinations.
        </p>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      {recommendationsResult.unmappedPrimaries.length > 0 && (
        <section className="mb-6 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <h2 className="font-semibold text-slate-900">Recognized, but not yet mapped</h2>
          <p className="mt-1 leading-relaxed">
            {recommendationsResult.unmappedPrimaries.join(", ")} {recommendationsResult.unmappedPrimaries.length === 1 ? "is" : "are"} in the catalog, but no
            authored secondary mappings are published yet. Their absence here does not mean a
            secondary claim is impossible.
          </p>
        </section>
      )}

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          No authored secondary mappings were found for the currently selected service-connected
          conditions.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.primaryId} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">{group.primaryName}</h2>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                Service-connected primary condition
              </p>
              {group.recommendations.length === 0 ? (
                <p className="mt-3 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
                  This condition is recognized, but no authored secondary mappings are published for
                  it yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {group.recommendations.map((recommendation) => (
                    <SecondarySuggestionItem
                      key={`${group.primaryId}-${recommendation.conditionId}`}
                      recommendation={recommendation}
                      primaryId={group.primaryId}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <form action="/secondary/evidence" method="get" className="mt-8">
        <SecondaryWorkflowHiddenFields {...toHiddenFieldState(state)} />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Continue to evidence review
        </button>
      </form>

      <DisclaimerFooter />
    </main>
  );
}
