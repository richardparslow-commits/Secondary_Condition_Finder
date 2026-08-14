import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { loadClaimFormReference } from "@/lib/va/form-reference";

export const metadata: Metadata = {
  title: "VA Form Reference | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";

function formatRevision(value: string | null): string {
  if (!value) return "Revision date unavailable in this source";
  return value;
}

export default async function VaFormsPage() {
  const reference = await loadClaimFormReference();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/" className="text-sm underline hover:text-slate-900">
        Back to home
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        VA Form reference
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Public VA form metadata demonstration. This page does not access a Veteran account or send claim, health, diagnosis, or service-history data to VA.
      </p>

      <article className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">
            VA Form {reference.formName}
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {reference.sourceLabel}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-700">{reference.title}</p>
        <p className="mt-2 text-xs text-slate-500">
          {formatRevision(reference.lastRevisionOn)}
        </p>

        <div
          role="note"
          className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
        >
          {reference.notice}
        </div>

        <a
          href={reference.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open form reference
        </a>
      </article>

      <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="font-semibold text-slate-900">Integration boundary</h2>
        <p className="mt-2">
          When the configured VA API environment and service credential are enabled, the app can retrieve and validate public VA Forms metadata through the adapter layer. If access is disabled or unavailable, the page falls back to a local reference instead of breaking the claim-research workflow.
        </p>
      </section>

      <DisclaimerFooter />
    </main>
  );
}
