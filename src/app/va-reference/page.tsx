import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { DisabilityReferenceExplorer } from "@/components/va/DisabilityReferenceExplorer";
import { loadDisabilityReference } from "@/lib/va/disability-reference";

export const metadata: Metadata = {
  title: "Disability Reference | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";

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
        Phase 2 demonstration of the VA Benefits Reference Data integration.
        The page loads public disability-reference values through the sandbox
        adapter when configured, with a clearly labeled local fallback when it
        is not.
      </p>

      <div
        role="note"
        className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
      >
        {reference.notice}
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">Privacy boundary</p>
        <p className="mt-1">
          The server request retrieves the public reference list without your
          condition search text. The filter below runs only in the browser, so
          the text you type is not sent to VA, written into the URL, or needed
          by the sandbox adapter.
        </p>
      </div>

      <DisabilityReferenceExplorer items={reference.items} />

      <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="font-semibold text-slate-900">What this does not mean</h2>
        <p className="mt-2">
          Finding a term here does not establish a diagnosis, service
          connection, claim eligibility, or disability rating. The reference
          data is used only to demonstrate a low-sensitivity VA API integration
          and to help identify terminology that may appear in VA benefits
          workflows.
        </p>
      </section>

      <DisclaimerFooter />
    </main>
  );
}
