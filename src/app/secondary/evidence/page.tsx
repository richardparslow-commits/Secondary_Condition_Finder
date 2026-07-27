import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { indexById } from "@/lib/catalog/lookup";
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

export default async function EvidenceReviewStepPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = indexById(catalog);
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
          We need your full workflow selections, including the upload-step choice, before building
          an evidence checklist.
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
        href={`/secondary/suggestions?${workflowStateToSearchParams(state).toString()}`}
        className="text-sm underline hover:text-slate-900"
      >
        Back to suggested secondary conditions
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 6 of 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Evidence review checklist</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This page is a structured gap review to help you organize evidence for follow-up with a
          provider or accredited representative. It does not parse records or determine eligibility.
        </p>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Current workflow context</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {state.serviceConnectedConditionIds.map((id) => {
            const condition = byId.get(id);
            if (!condition) return null;
            const rating = state.ratingsByConditionId[id];
            return (
              <li key={id}>
                <span className="font-medium text-slate-900">{condition.name}</span>
                <span className="text-slate-600"> — {rating === null ? "rating not provided" : `${rating}%`}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-slate-700">
          Documents flagged: {state.documentsShared ? "Yes, user has documents to review manually" : "No"}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Document processing limits</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          This MVP does not read C-files, parse uploaded records, or extract medical findings. Use
          this page as an organizer for manual review with your provider or representative.
        </p>
      </section>

      <section className="mt-6 space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Evidence gaps by primary condition</h2>
        {grouped.map((group) => (
          <article key={group.primaryId} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{group.primaryName}</h3>
            {group.recommendations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-700">
                This primary condition is recognized, but no authored secondary mappings are
                published for it yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                {group.recommendations.map((recommendation) => (
                  <li key={`${group.primaryId}-${recommendation.conditionId}`}>
                    <p className="font-medium text-slate-900">{recommendation.condition}</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {recommendation.evidenceGaps.map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>

      <p className="mt-8 text-sm text-slate-600">
        Done with this run? You can start a new secondary workflow from the{" "}
        <Link href="/secondary" className="underline hover:text-slate-900">
          secondary overview
        </Link>
        .
      </p>

      <DisclaimerFooter />
    </main>
  );
}
