import Link from "next/link";

import { DisclaimerBanner } from "@/components/Disclaimer";
import { DISCLAIMER_NONDIAGNOSTIC, SECONDARY_CONTINUE_CTA } from "@/lib/legal/phrases";
import { SECONDARY_AGGRAVATED_BY_TITLE, SECONDARY_CAUSED_BY_TITLE } from "@/lib/legal/secondary-title";
import { CANONICAL_REFERENCES } from "@/lib/legal/references";

export default function SecondaryLandingPage() {
  return (
    <main className="min-h-screen">
      {/* Header — Black background with white text */}
      <header className="bg-black text-white">
        <div className="px-6 py-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Secondary Service Connection Conditions
          </h1>
          <p className="mt-3 text-lg text-gray-100">
            Explore how your service may have contributed to additional health conditions. This includes conditions that
            <strong>were caused</strong> by your service-connected disability or conditions that
            <strong>were permanently worsened</strong> by your service.
          </p>
        </div>
      </header>

      {/* Green Disclaimer Box — Centered */}
      <div className="flex justify-center px-6 mb-6">
        <DisclaimerBanner />
      </div>

      {/* Orange Main Content Box — Only Cards */}
      <div className="bg-orange-500 border-2 border-black rounded-lg p-6 mb-8">
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Caused By Card */}
          <Link 
            href="/secondary/condition-caused-by" 
            className="block bg-slate-50 border border-gray-200 rounded-lg p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {SECONDARY_CAUSED_BY_TITLE}
            </h2>
            <p className="text-sm text-gray-800">
              A secondary condition that is proximately due to or the result of
              your already service-connected primary condition. Governed by{" "}
              <strong>38 CFR § 3.310(a)</strong>.
            </p>
          </Link>

          {/* Aggravated By Card */}
          <Link 
            href="/secondary/condition-aggravation"
            className="block bg-slate-50 border border-gray-200 rounded-lg p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {SECONDARY_AGGRAVATED_BY_TITLE}
            </h2>
            <p className="text-sm text-gray-800">
              A pre-existing or non-service-connected condition that was
              permanently worsened or accelerated beyond its natural progression
              by your service-connected condition. Governed by{" "}
              <strong>38 CFR § 3.310(b)</strong>.
            </p>
          </Link>
        </div>
      </div>

      {/* Dark Gray Box */}
      <div className="bg-gray-900 text-white rounded-lg p-6 mb-8">
        <p className="text-sm leading-relaxed">
          {DISCLAIMER_NONDIAGNOSTIC}
        </p>
        <p className="mt-4 text-sm leading-relaxed">
          {CANONICAL_REFERENCES.map((reference) => (
            <span key={reference.id}>
              <strong>{reference.citation}</strong>: {reference.description}{" "}
            </span>
          ))}
        </p>
      </div>

      {/* Track Note Section - Light Gray Background */}
      <section className="mt-8 mb-6 bg-slate-100 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-800">
          If your condition may be tied to where and when you served, use the
          separate{" "}
          <Link href="/presumptive" className="underline hover:text-slate-900">
            presumptive track
          </Link>
          .
        </p>
      </section>

      {/* Orange Box with Green Button */}
      <div className="bg-orange-500 border-2 border-black rounded-lg p-6 mb-8 text-center">
        <p className="text-base font-semibold text-black mb-4">
          Ready to Start Your Research?
        </p>
        <p className="text-sm text-gray-100 mb-6 max-w-lg mx-auto">
          Proceed to enter your diagnosed conditions and explore
          evidence-backed secondary connection pathways.
        </p>
        <Link
          href="/secondary/diagnosed"
          className="inline-block px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          {SECONDARY_CONTINUE_CTA}
        </Link>
      </div>

      {/* Dark Gray Box with Recommendations */}
      <div className="bg-gray-800 text-white rounded-lg p-6 mt-8">
        <p className="text-sm leading-relaxed">
          <strong>Recommendation:</strong> These suggestions are based on a curated
          knowledge base and are not ranked by likelihood of approval. Always
          verify against current VA guidance at va.gov and consult an accredited
          representative before filing a claim.
        </p>
      </div>

      <footer className="mt-12 pt-6 text-xs leading-relaxed text-white bg-red-800">
        <p>
          Suggestions come from a curated knowledge base, not from your medical
          records, and are not ranked by likelihood of approval. Citations are
          starting points for your own verification and have not yet been
          confirmed by a qualified reviewer. Confirm everything against current VA
          guidance at va.gov and consult an accredited representative or VSO
          before filing.
        </p>
      </footer>
    </main>
  );
}
