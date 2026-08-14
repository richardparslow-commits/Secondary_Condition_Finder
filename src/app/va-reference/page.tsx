import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { DisabilityReferenceExplorer } from "@/components/va/DisabilityReferenceExplorer";
import { loadDisabilityReference } from "@/lib/va/disability-reference";

export const metadata: Metadata = {
  title: "Disability Reference | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";

function formatRetrievedAt(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC" : "Not available";
}

export default async function VaReferencePage() {
  const reference = await loadDisabilityReference();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/" className="text-sm underline hover:text-slate-900">
        Back to home
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          VA disability reference terms
        </h1>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
          {reference.sourceLabel}
        </span>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700">
        Public administrative disability-reference terminology from VA Benefits Reference Data when the configured VA environment is available, with a clearly labeled local fallback when it is not.
      </p>

      <div
        role="note"
        className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
      >
        {reference.notice}
      </div>

      <dl className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600 sm:grid-cols-3">
        <div><dt className="font-semibold text-slate-800">Environment</dt><dd>{reference.environment ?? "local fallback"}</dd></div>
        <div><dt className="font-semibold text-slate-800">Last successful retrieval</dt><dd>{formatRetrievedAt(reference.retrievedAt)}</dd></div>
        <div><dt className="font-semibold text-slate-800">Cache</dt><dd>{reference.live ? reference.cacheStatus : "not used"}</dd></div>
      </dl>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">Privacy boundary</p>
        <p className="mt-1">
          The server request retrieves the public reference list without your
          condition search text. The filter below runs only in the browser, so
          the text you type is not sent to VA, written into the URL, or needed
          by the VA adapter.
        </p>
      </div>

      <DisabilityReferenceExplorer items={reference.items} />

      <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="font-semibold text-slate-900">What this does not mean</h2>
        <p className="mt-2">
          Finding a term here does not establish a diagnosis, service
          connection, claim eligibility, or disability rating. The reference
          data is administrative terminology only and remains separate from the
          app&apos;s medical-evidence and recommendation logic.
        </p>
      </section>

      <DisclaimerFooter />
    </main>
  );
}
