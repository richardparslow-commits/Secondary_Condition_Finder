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
import { parseWorkflowState, workflowStateToSearchParams } from "@/lib/secondary-workflow/state";

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

  try {
    state = parseWorkflowState(params, catalog);
  } catch {
    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">Complete prior steps first</h1>
        <p className="mt-2 text-sm text-slate-600">
          We need diagnosed, service-connected, and ratings information before showing grouped
          suggestions.
        </p>
        <Link href="/secondary/diagnosed" className="mt-5 inline-block text-sm underline hover:text-slate-900">
          Start over at diagnosed conditions
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
          Suggestions are grouped by each service-connected primary condition you selected. Draft
          mappings are excluded from this output.
        </p>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          No authored secondary mappings are available for the selected service-connected
          conditions yet.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.primaryId} className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">{group.primaryName}</h2>
              {group.recommendations.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  No authored mappings were found for this primary condition.
                </p>
              ) : (
                <div className="space-y-3">
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
