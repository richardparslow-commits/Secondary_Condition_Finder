import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { CausedByExplainer, AggravatedByExplainer } from "@/lib/legal/phrases";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header — Gray background with black text, large title with subtitle */}
      <header className="bg-gray-100 text-black px-6 py-8">
        <h1 className="text-4xl font-bold tracking-tight">
          SECONDARY CONDITIONS
        </h1>
        <p className="mt-3 text-lg text-black">
          A research aid for VA claim preparation. Choose a track below to explore how your condition may connect to your service.
        </p>
      </header>

      {/* Two Secondary Cards — Side by side with gray background */}
      <div className="flex flex-col md:flex-row items-stretch gap-6 px-6 py-8 mb-8">
        {/* Left Card — Secondary Condition Caused By Service Connected Condition */}
        <Link
          href="/secondary/condition-caused-by"
          className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-lg border border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <div className="flex-1 w-full">
            <div className="mb-2">
              <span className="font-bold text-2xl block">Secondary</span>
              <span className="text-gray-900 font-semibold">Condition Caused By Service Connected Condition</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              A secondary claim that is <strong>proximately due to or the result of</strong> your service-connected disability.
            </p>
            <CausedByExplainer />
          </div>
          <Link
            href="/secondary/condition-caused-by"
            className="px-6 py-3 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition-colors mt-6 md:mt-0 shadow-sm"
          >
            Learn More
          </Link>
        </Link>

        {/* Right Card — Secondary Conditions via Aggravation */}
        <Link
          href="/secondary/condition-aggravation"
          className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-lg border border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <div className="flex-1 w-full">
            <div className="mb-2">
              <span className="font-bold text-2xl block">SECONDARY</span>
              <span className="text-gray-900 font-semibold">Conditions via Aggravation</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              A pre-existing condition that was <strong>permanently worsened</strong> beyond its natural progression by your service.
            </p>
            <AggravatedByExplainer />
          </div>
          <Link
            href="/secondary/condition-aggravation"
            className="px-6 py-3 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition-colors mt-6 md:mt-0 shadow-sm"
          >
            Learn More
          </Link>
        </Link>
      </div>

      {/* Green Disclaimer Box — Centered */}
      <div className="flex justify-center px-6 mb-8">
        <div
          role="note"
          className="rounded-lg border border-green-300 bg-green-100 p-6 text-sm leading-relaxed text-green-900 max-w-4xl"
        >
          <p className="font-semibold">This is a research aid, not advice.</p>
          <p className="mt-2">
            This tool helps organize claim-preparation research. It does not
            diagnose conditions, determine eligibility, or provide medical or legal
            advice. Every suggestion is a possibility to explore with a qualified
            provider or an accredited representative, not a determination.
          </p>
        </div>
      </div>

      {/* Gray Disclaimer Box — Below green banner, centered */}
      <div className="flex justify-center px-6 mb-8">
        <div className="rounded-lg border border-gray-300 bg-gray-50 p-6 text-sm leading-relaxed text-gray-900 max-w-4xl">
          <p>
            This page is for research purposes only and not a replacement for legal or professional advice.
            The content provided is based on general research and should be verified with official VA resources.
          </p>
        </div>
      </div>

      {/* Presumptive Service Connection Box — Gray */}
      <div className="max-w-4xl px-6 mb-8">
        <article className="rounded-lg border border-gray-200 bg-gray-100 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Presumptive Service Connection
          </h2>
          <p className="text-sm text-gray-700 mt-2 leading-relaxed">
            Presumptive service connection applies to conditions tied to qualifying service exposures
            (e.g., herbicide, radiation, burn pit, cold exposure). VA presumes service connection if you
            served during a qualifying period and are diagnosed with a recognized condition. No nexus opinion required.
          </p>

          <Link
            href="/presumptive"
            className="mt-6 inline-block px-6 py-3 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Check Presumptive / Continuous Check
          </Link>
        </article>
      </div>

      {/* Secondary Service Connection Box — Gray */}
      <div className="max-w-4xl px-6 mb-8">
        <article className="rounded-lg border border-gray-200 bg-gray-100 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Secondary Service Connection
          </h2>
          <p className="text-sm text-gray-700 mt-2 leading-relaxed">
            Explore conditions caused by or aggravated by your service-connected disability. This track
            involves organizing your conditions to identify potential secondary connections.
          </p>

          <Link
            href="/secondary"
            className="mt-6 inline-block px-6 py-3 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Click Here to Proceed to Wizard Step 1
          </Link>
        </article>
      </div>

      {/* Note about tracks not being mutually exclusive — Centered, small text */}
      <div className="text-center px-6 mb-8">
        <p className="text-xs text-gray-600">
          Note: The Secondary and Presumptive tracks are not mutually exclusive. A condition may be claimable through both Secondary and Presumptive paths if the evidence supports both theories.
        </p>
      </div>

      {/* Footer — Large red button with links */}
      <footer className="bg-red-800 px-6 py-6">
        <div className="flex flex-col sm:flex-row justify-center gap-6 text-white">
          <Link href="/scenarios" className="hover:underline text-sm">Demo Scenarios</Link>
          <Link href="/privacy" className="hover:underline text-sm">Privacy</Link>
          <Link href="/terms" className="hover:underline text-sm">Terms</Link>
        </div>
      </footer>

      <DisclaimerFooter />
    </main>
  );
}