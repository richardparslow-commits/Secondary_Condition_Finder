import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { SecondaryWorkflowHiddenFields } from "@/components/SecondaryWorkflowHiddenFields";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  parseDocumentsSharedPrefill,
  parseRatingsSelection,
  parseServiceConnectedSelection,
  ratingFieldName,
} from "@/lib/secondary-workflow/state";

export const dynamic = "force-dynamic";

export default async function UploadStepPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const catalog = loadConditionCatalog();
  const byId = indexById(catalog);
  const params = await searchParams;

  let diagnosedConditionIds: string[];
  let serviceConnectedConditionIds: string[];
  let ratingsByConditionId: Record<string, number | null>;
  const documentsShared = parseDocumentsSharedPrefill(params.documentsShared);
  let guardHref = "/secondary/diagnosed";
  let guardLabel = "Start over at diagnosed conditions";

  try {
    const parsed = parseRatingsSelection(params, catalog);
    diagnosedConditionIds = parsed.diagnosedConditionIds;
    serviceConnectedConditionIds = parsed.serviceConnectedConditionIds;
    ratingsByConditionId = parsed.ratingsByConditionId;
  } catch {
    try {
      const parsed = parseServiceConnectedSelection(params, catalog);
      guardHref = `/secondary/ratings?${new URLSearchParams([
        ...parsed.diagnosedConditionIds.map((id) => ["diagnosed", id]),
        ...parsed.serviceConnectedConditionIds.map((id) => ["serviceConnected", id]),
      ]).toString()}`;
      guardLabel = "Back to current ratings";
    } catch {
      // Fall back to diagnosed step.
    }

    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">Enter ratings first</h1>
<div className="my-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
    <span className="font-semibold">🔒 Evidence Upload Privacy Contract:</span> Uploading documents is strictly optional. Files are processed locally or through secure non-retentive extraction boundaries. We do <span className="underline font-semibold">not</span> store raw text logs, medical record files, or personal identifiers (PII).
  </div>
        <p className="mt-2 text-sm text-slate-600">
          Complete the ratings step before you continue to document upload.
        </p>
        <Link href={guardHref} className="mt-5 inline-block text-sm underline hover:text-slate-900">
          {guardLabel}
        </Link>
      </main>
    );
  }

  return (
    <main>
      <Link
        href={`/secondary/ratings?${new URLSearchParams([
          ...diagnosedConditionIds.map((id) => ["diagnosed", id]),
          ...serviceConnectedConditionIds.map((id) => ["serviceConnected", id]),
          ...serviceConnectedConditionIds.map((id) => [
            ratingFieldName(id),
            ratingsByConditionId[id] === null ? "decline" : String(ratingsByConditionId[id]),
          ]),
        ]).toString()}`}
        className="text-sm underline hover:text-slate-900"
      >
        Back to current ratings
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 4 of 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Optional document upload</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Uploads are optional. Use this step only if you want a reminder in your checklist that
          you have records to review manually with your provider or representative.
        </p>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">What this step does today</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Helps you prepare a document checklist for your next representative meeting.</li>
          <li>Does not medically interpret, summarize, or rate what is inside your files.</li>
          <li>Does not save document text in event logs or user accounts.</li>
        </ul>
      </section>

      <form action="/secondary/suggestions" method="get" className="space-y-6">
        <SecondaryWorkflowHiddenFields
          diagnosedConditionIds={diagnosedConditionIds}
          serviceConnectedConditionIds={serviceConnectedConditionIds}
          ratingsByConditionId={ratingsByConditionId}
        />

        <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <span className="block text-sm font-semibold text-slate-900">Optional local file picker</span>
          <span className="mt-1 block text-xs text-slate-500">
            Files selected here are not uploaded for AI analysis in this Phase 1 MVP.
          </span>
          <input
            type="file"
            multiple
            className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            aria-describedby="upload-processing-limit"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">
            Do you want this reflected in your checklist?
          </legend>
          <p id="upload-processing-limit" className="mt-1 text-sm text-slate-600">
            This choice only updates checklist wording. It does not trigger document parsing.
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="documentsShared"
                value="yes"
                defaultChecked={documentsShared}
                className="h-4 w-4"
              />
              Yes, I have documents ready to review manually
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="documentsShared"
                value="no"
                defaultChecked={!documentsShared}
                className="h-4 w-4"
              />
              No, continue without documents
            </label>
          </div>
        </fieldset>

        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <h2 className="font-semibold text-slate-900">Your service-connected conditions in this run</h2>
          <ul className="mt-2 space-y-1">
            {serviceConnectedConditionIds.map((id) => {
              const condition = byId.get(id);
              if (!condition) return null;
              const rating = ratingsByConditionId[id];
              return (
                <li key={id}>
                  <span className="font-medium text-slate-900">{condition.name}</span>
                  <span className="text-slate-600"> — {rating === null ? "rating not provided" : `${rating}%`}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Continue to suggested secondary conditions
        </button>
      </form>

      <DisclaimerFooter />
    </main>
  );
}
