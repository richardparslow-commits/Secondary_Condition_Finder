import Link from "next/link";

import { DisclaimerBanner } from "@/components/Disclaimer";
import { DISCLAIMER_NONDIAGNOSTIC, SECONDARY_CONTINUE_CTA, UNVERIFIED_REFERENCE_NOTICE } from "@/lib/legal/phrases";
import { SECONDARY_AGGRAVATED_BY_TITLE, SECONDARY_CAUSED_BY_TITLE } from "@/lib/legal/secondary-title";
import { CANONICAL_REFERENCES } from "@/lib/legal/references";

export default function SecondaryLandingPage() {
  return (
    <main className="min-h-screen">
      <header className="bg-black text-white">
        <div className="px-6 py-8">
          <h1 className="mb-3 text-4xl font-bold tracking-tight">Secondary Service Connection Conditions</h1>
          <p className="mt-3 text-lg text-gray-100">Explore how your service may have contributed to additional health conditions. This includes conditions that <strong>were caused</strong> by your service-connected disability or conditions that <strong>were permanently worsened</strong> by your service.</p>
        </div>
      </header>

      <div className="mb-6 flex justify-center px-6"><DisclaimerBanner /></div>

      <div className="mb-8 rounded-lg border-2 border-black bg-orange-500 p-6">
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Link href="/secondary/condition-caused-by" className="block rounded-lg border border-gray-200 bg-slate-50 p-6 transition-colors hover:border-gray-400">
            <h2 className="mb-2 text-lg font-bold text-gray-900">{SECONDARY_CAUSED_BY_TITLE}</h2>
            <p className="text-sm text-gray-800">A secondary condition that is proximately due to or the result of your already service-connected primary condition. Governed by <strong>38 CFR § 3.310(a)</strong>.</p>
          </Link>
          <Link href="/secondary/condition-aggravation" className="block rounded-lg border border-gray-200 bg-slate-50 p-6 transition-colors hover:border-gray-400">
            <h2 className="mb-2 text-lg font-bold text-gray-900">{SECONDARY_AGGRAVATED_BY_TITLE}</h2>
            <p className="text-sm text-gray-800">A pre-existing or non-service-connected condition that was permanently worsened or accelerated beyond its natural progression by your service-connected condition. Governed by <strong>38 CFR § 3.310(b)</strong>.</p>
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-lg bg-gray-900 p-6 text-white">
        <p className="text-sm leading-relaxed">{DISCLAIMER_NONDIAGNOSTIC}</p>
        <p className="mt-4 text-sm leading-relaxed">{UNVERIFIED_REFERENCE_NOTICE}</p>
        <div className="mt-4 text-sm leading-relaxed">
          {CANONICAL_REFERENCES.map((reference) => (
            <span key={reference.id}><strong>{reference.citation}</strong>: {reference.description}{" "}</span>
          ))}
        </div>
      </div>

      <section className="mb-6 mt-8 rounded-lg bg-slate-100 p-4 text-center">
        <p className="text-sm text-gray-800">If your condition may be tied to where and when you served, use the separate <Link href="/presumptive" className="underline hover:text-slate-900">presumptive track</Link>.</p>
      </section>

      <div className="mb-8 rounded-lg border-2 border-black bg-orange-500 p-6 text-center">
        <p className="mb-4 text-base font-semibold text-black">Ready to Start Your Research?</p>
        <p className="mx-auto mb-6 max-w-lg text-sm text-gray-100">Proceed to enter your diagnosed conditions and explore evidence-backed secondary connection pathways.</p>
        <Link href="/secondary/diagnosed" className="inline-block rounded-lg bg-green-600 px-8 py-3 font-semibold text-white shadow-md transition-colors hover:bg-green-700">{SECONDARY_CONTINUE_CTA}</Link>
      </div>

      <div className="mt-8 rounded-lg bg-gray-800 p-6 text-white"><p className="text-sm leading-relaxed"><strong>Recommendation:</strong> These suggestions are based on a curated knowledge base and are not ranked by likelihood of approval. Always verify against current VA guidance at va.gov and consult an accredited representative before filing a claim.</p></div>

      <footer className="mt-12 bg-red-800 pt-6 text-xs leading-relaxed text-white">
        <p>Suggestions come from a curated knowledge base, not from your medical records, and are not ranked by likelihood of approval. Citations are starting points for your own verification and have not yet been confirmed by a qualified reviewer. Confirm everything against current VA guidance at va.gov and consult an accredited representative or VSO before filing.</p>
      </footer>
    </main>
  );
}
