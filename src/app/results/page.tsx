import { randomUUID } from "node:crypto";

import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { SuggestionCard } from "@/components/SuggestionCard";
import { ENGINE_VERSION, recommend } from "@/lib/engine/recommend";
import { intakeSchema } from "@/lib/engine/types";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { getEventLogger } from "@/lib/log";

export const dynamic = "force-dynamic";

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const parsed = intakeSchema.safeParse({
    primaryConditions: toArray(params.primary),
    symptoms: toArray(params.symptoms),
    medications: toArray(params.medications),
    exposures: toArray(params.exposures),
    notes: typeof params.notes === "string" ? params.notes : "",
  });

  if (!parsed.success) {
    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nothing to show yet
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Select at least one service-connected condition to see suggestions.
        </p>
        <Link
          href="/secondary"
          className="mt-6 inline-block text-sm underline hover:text-slate-900"
        >
          Back to intake
        </Link>
      </main>
    );
  }

  const result = recommend(
    loadConditionCatalog(),
    loadKnowledgeBase(),
    parsed.data,
  );

  const eventLogger = await getEventLogger();
  eventLogger.record({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    recognizedPrimaries: result.recognizedPrimaries,
    unrecognizedPrimaryCount: result.unrecognizedPrimaries.length,
    recommendedConditions: result.recommendations.map((r) => r.conditionId),
    engineVersion: ENGINE_VERSION,
  });

  return (
    <main>
      <header className="mb-6">
        <Link href="/secondary" className="text-sm underline hover:text-slate-900">
          Back to intake
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Conditions to explore
        </h1>
        {result.recognizedPrimaries.length > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Based on {result.recognizedPrimaries.join(", ")}.
          </p>
        )}
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      {result.unmappedPrimaries.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">
            No secondary research written yet
          </p>
          <p className="mt-1">
            {result.unmappedPrimaries.join(", ")}. These are recognized
            conditions, but nobody has authored the secondary-condition
            research for them yet. Nothing below reflects them, and their
            absence says nothing about whether a secondary claim is possible.
          </p>
        </div>
      )}

      {result.unrecognizedPrimaries.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Not recognized</p>
          <p className="mt-1">
            {result.unrecognizedPrimaries.join(", ")}. We could not match these
            to a known condition. Check the spelling, or search for them on the
            intake page.
          </p>
        </div>
      )}

      {result.recommendations.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          No suggestions available for that combination. Try a different
          condition, or check back as the knowledge base grows.
        </p>
      ) : (
        <div className="space-y-4">
          {result.recommendations.map((recommendation, index) => (
            <SuggestionCard
              key={recommendation.conditionId}
              recommendation={recommendation}
              position={index + 1}
            />
          ))}
        </div>
      )}

      <DisclaimerFooter />
    </main>
  );
}
