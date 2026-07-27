import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { SecondaryWorkflowHiddenFields } from "@/components/SecondaryWorkflowHiddenFields";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  parseDiagnosedSelection,
  parseServiceConnectedSelection,
  ratingFieldName,
} from "@/lib/secondary-workflow/state";

export const dynamic = "force-dynamic";

const RATING_OPTIONS = Array.from({ length: 101 }, (_, index) => index);

export default async function RatingsStepPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const catalog = loadConditionCatalog();
  const byId = indexById(catalog);
  const params = await searchParams;

  let diagnosedConditionIds: string[];
  let serviceConnectedConditionIds: string[];
  let guardHref = "/secondary/diagnosed";
  let guardLabel = "Start over at diagnosed conditions";

  try {
    const parsed = parseServiceConnectedSelection(params, catalog);
    diagnosedConditionIds = parsed.diagnosedConditionIds;
    serviceConnectedConditionIds = parsed.serviceConnectedConditionIds;
  } catch {
    try {
      const diagnosed = parseDiagnosedSelection(params, catalog);
      guardHref = `/secondary/service-connected?${new URLSearchParams(
        diagnosed.diagnosedConditionIds.map((id) => ["diagnosed", id]),
      ).toString()}`;
      guardLabel = "Back to service-connected status";
    } catch {
      // Fall back to diagnosed step.
    }

    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">Set service-connected status first</h1>
        <p className="mt-2 text-sm text-slate-600">
          Mark at least one condition as already service connected before entering ratings.
        </p>
        <Link href={guardHref} className="mt-5 inline-block text-sm underline hover:text-slate-900">
          {guardLabel}
        </Link>
      </main>
    );
  }

  const serviceConnected = serviceConnectedConditionIds
    .map((id) => byId.get(id))
    .filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

  return (
    <main>
      <Link
        href={`/secondary/service-connected?${new URLSearchParams([
          ...diagnosedConditionIds.map((id) => ["diagnosed", id]),
          ...serviceConnectedConditionIds.map((id) => ["serviceConnected", id]),
        ]).toString()}`}
        className="text-sm underline hover:text-slate-900"
      >
        Back to service-connected status
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3 of 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Enter current ratings</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Ratings are optional context for your checklist. You can decline to answer for any
          condition.
        </p>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <form action="/secondary/upload" method="get" className="space-y-4">
        <SecondaryWorkflowHiddenFields
          diagnosedConditionIds={diagnosedConditionIds}
          serviceConnectedConditionIds={serviceConnectedConditionIds}
        />

        {serviceConnected.map((condition) => (
          <label
            key={condition.id}
            className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="block text-sm font-semibold text-slate-900">{condition.name}</span>
            <span className="block text-xs text-slate-500">{condition.bodySystem}</span>

            <select
              name={ratingFieldName(condition.id)}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              defaultValue="decline"
            >
              <option value="decline">I prefer not to answer</option>
              {RATING_OPTIONS.map((rating) => (
                <option key={rating} value={rating}>
                  {rating}%
                </option>
              ))}
            </select>
          </label>
        ))}

        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Continue to optional document upload
        </button>
      </form>

      <DisclaimerFooter />
    </main>
  );
}
