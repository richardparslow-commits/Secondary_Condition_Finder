import type { Metadata } from "next";
import Link from "next/link";

import { loadVaFormsFinder } from "@/lib/va/forms-finder";

interface PageProps {
  searchParams?: Promise<{ q?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "VA Form Finder | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";

function formatRetrievedAt(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC" : "Not available";
}

export default async function VaFormsFinderPage({ searchParams }: PageProps = {}) {
  const rawQuery = (await searchParams)?.q;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
  const reference = await loadVaFormsFinder(query ?? "21-526EZ");

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="underline">Home</Link>
        <Link href="/va-forms" className="underline">VA form reference</Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">VA Form Finder</h1>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">{reference.sourceLabel}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">Search public VA form metadata by form number, keyword, or title. Never enter personal identifiers (for example, a Social Security number) — searches run as GET requests, so the text appears in the address bar and browser history.</p>

      <form method="get" className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <label htmlFor="va-form-query" className="block text-sm font-semibold">Search VA forms</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input id="va-form-query" name="q" type="search" maxLength={120} autoComplete="off" spellCheck={false} defaultValue={reference.query} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Search</button>
        </div>
      </form>

      <div role="note" className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{reference.notice}</div>
      <dl className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600 sm:grid-cols-3">
        <div><dt className="font-semibold text-slate-800">Environment</dt><dd>{reference.environment ?? "local fallback"}</dd></div>
        <div><dt className="font-semibold text-slate-800">Last successful retrieval</dt><dd>{formatRetrievedAt(reference.retrievedAt)}</dd></div>
        <div><dt className="font-semibold text-slate-800">Cache</dt><dd>{reference.live ? reference.cacheStatus : "not used"}</dd></div>
      </dl>

      <section className="mt-6" aria-labelledby="forms-results-heading">
        <h2 id="forms-results-heading" className="text-xl font-semibold">Search results</h2>
        <p className="mt-1 text-sm text-slate-600">{reference.items.length} result{reference.items.length === 1 ? "" : "s"} shown for {reference.query}.</p>
        <div className="mt-4 space-y-4">
          {reference.items.map((form) => (
            <article key={`${form.formName}-${form.url}`} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold">VA Form {form.formName}</h3>
              <p className="mt-1 text-sm text-slate-700">{form.title}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div><dt className="font-medium">Last revision</dt><dd>{form.lastRevisionOn ?? "Not reported"}</dd></div>
                <div><dt className="font-medium">Pages</dt><dd>{form.pages ?? "Not reported"}</dd></div>
                <div><dt className="font-medium">PDF status</dt><dd>{form.validPdf === null ? "Not reported" : form.validPdf ? "Valid" : "Not confirmed"}</dd></div>
              </dl>
              <a href={form.url} target="_blank" rel="noreferrer" className="mt-4 inline-block underline">Open official form reference</a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
