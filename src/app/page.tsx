import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { CausedByExplainer } from "@/components/secondary/CausedByExplainer";
import { AggravatedByExplainer } from "@/components/secondary/AggravatedByExplainer";
import { UNVERIFIED_REFERENCE_NOTICE } from "@/lib/legal/phrases";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="bg-gray-100 px-6 py-8 text-black">
        <h1 className="text-4xl font-bold tracking-tight">SECONDARY CONDITIONS</h1>
        <p className="mt-3 text-lg text-black">A research aid for VA claim preparation. Choose a track below to explore how your condition may connect to your service.</p>
      </header>

      <div className="mb-8 flex flex-col items-stretch gap-6 px-6 py-8 md:flex-row">
        <Link href="/secondary/condition-caused-by" className="flex flex-col items-start gap-6 rounded-lg border border-gray-200 bg-gray-100 p-6 transition-colors hover:bg-gray-200 md:flex-row md:items-center">
          <div className="w-full flex-1">
            <div className="mb-2"><span className="block text-2xl font-bold">Secondary</span><span className="font-semibold text-gray-900">Condition Caused By Service Connected Condition</span></div>
            <p className="mt-2 text-sm text-gray-600">A secondary claim that is <strong>proximately due to or the result of</strong> your service-connected disability.</p>
            <CausedByExplainer />
          </div>
          <span className="mt-6 rounded-full bg-red-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-red-700 md:mt-0">Learn More</span>
        </Link>

        <Link href="/secondary/condition-aggravation" className="flex flex-col items-start gap-6 rounded-lg border border-gray-200 bg-gray-100 p-6 transition-colors hover:bg-gray-200 md:flex-row md:items-center">
          <div className="w-full flex-1">
            <div className="mb-2"><span className="block text-2xl font-bold">SECONDARY</span><span className="font-semibold text-gray-900">Conditions via Aggravation</span></div>
            <p className="mt-2 text-sm text-gray-600">A pre-existing condition that was <strong>permanently worsened</strong> beyond its natural progression by your service.</p>
            <AggravatedByExplainer />
          </div>
          <span className="mt-6 rounded-full bg-red-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-red-700 md:mt-0">Learn More</span>
        </Link>
      </div>

      <div className="mb-8 flex justify-center px-6">
        <div role="note" className="max-w-4xl rounded-lg border border-green-300 bg-green-100 p-6 text-sm leading-relaxed text-green-900">
          <p className="font-semibold">This is a research aid, not advice.</p>
          <p className="mt-2">This tool helps organize claim-preparation research. It does not diagnose conditions, determine eligibility, or provide medical or legal advice. Every suggestion is a possibility to explore with a qualified provider or an accredited representative, not a determination.</p>
        </div>
      </div>

      <div className="mb-8 flex justify-center px-6">
        <div className="max-w-4xl rounded-lg border border-gray-300 bg-gray-50 p-6 text-sm leading-relaxed text-gray-900">
          <p>{UNVERIFIED_REFERENCE_NOTICE}</p>
          <p className="mt-2">This page is for research purposes only and not a replacement for legal or professional advice. The content provided is based on general research and should be verified with official VA resources.</p>
        </div>
      </div>

      <div className="mb-8 max-w-4xl px-6">
        <article className="rounded-lg border border-gray-200 bg-gray-100 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Presumptive Service Connection</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">Presumptive service connection applies to conditions tied to qualifying service exposures (e.g., herbicide, radiation, burn pit, cold exposure). VA presumes service connection if you served during a qualifying period and are diagnosed with a recognized condition. No nexus opinion required.</p>
          <Link href="/presumptive" className="mt-6 inline-block rounded-full bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700">Check Presumptive / Continuous Check</Link>
        </article>
      </div>

      <div className="mb-8 max-w-4xl px-6">
        <article className="rounded-lg border border-gray-200 bg-gray-100 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Secondary Service Connection</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">Explore conditions caused by or aggravated by your service-connected disability. This track involves organizing your conditions to identify potential secondary connections.</p>
          <Link href="/secondary" className="mt-6 inline-block rounded-full bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700">Click Here to Proceed to Wizard Step 1</Link>
        </article>
      </div>

      <div className="mb-8 grid max-w-4xl gap-6 px-6 md:grid-cols-2">
        <article className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">VA Form Reference</h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900">Phase 2 sandbox demo</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">View a bounded reference for VA Form 21-526EZ. When sandbox access is configured, the page validates public VA Forms metadata through the adapter layer; otherwise it uses a local reference and clearly labels the fallback.</p>
          <Link href="/va-forms" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700">Open VA Form Reference</Link>
        </article>

        <article className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">VA Disability Reference Terms</h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900">Phase 2 sandbox demo</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">Explore public Benefits Reference Data terms. The sandbox request retrieves the public list without user condition input, and filtering happens locally in the browser. A local catalog fallback is clearly labeled when sandbox access is unavailable.</p>
          <Link href="/va-reference" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700">Open VA Reference Terms</Link>
        </article>
      </div>

      <div className="mb-8 px-6 text-center"><p className="text-xs text-gray-600">Note: The Secondary and Presumptive tracks are not mutually exclusive. A condition may be claimable through both Secondary and Presumptive paths if the evidence supports both theories.</p></div>

      <footer className="bg-red-800 px-6 py-6">
        <div className="flex flex-col justify-center gap-6 text-white sm:flex-row">
          <Link href="/scenarios" className="text-sm hover:underline">Demo Scenarios</Link>
          <Link href="/va-forms" className="text-sm hover:underline">VA Form Reference</Link>
          <Link href="/va-reference" className="text-sm hover:underline">VA Reference Terms</Link>
          <Link href="/privacy" className="text-sm hover:underline">Privacy</Link>
          <Link href="/terms" className="text-sm hover:underline">Terms</Link>
        </div>
      </footer>

      <DisclaimerFooter />
    </main>
  );
}
