import type { Metadata } from "next";
import Link from "next/link";

import { loadServiceBranchReference } from "@/lib/va/service-branches";

export const metadata: Metadata = {
  title: "VA Service Branch Reference | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";

export default async function ServiceBranchesPage() {
  const reference = await loadServiceBranchReference();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="underline">Home</Link>
        <Link href="/va-reference" className="underline">VA disability reference</Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">VA service branch reference</h1>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">{reference.sourceLabel}</span>
      </div>
      <p className="mt-3 text-sm text-slate-700">
        Standardized service-branch labels for structured workflow inputs.
      </p>
      <div role="note" className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{reference.notice}</div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {reference.items.map((item) => (
          <li key={`${item.code}-${item.description}`} className="rounded-lg border border-slate-200 bg-white p-4">
            <strong className="text-slate-900">{item.description}</strong>
            <span className="mt-1 block font-mono text-xs text-slate-500">{item.code}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
