import Link from "next/link";

import { DisclaimerBanner } from "@/components/Disclaimer";
import { AggravatedByExplainer } from "@/components/secondary/AggravatedByExplainer";
import { SECONDARY_AGGRAVATED_BY_TITLE } from "@/lib/legal/secondary-title";

export const metadata = {
  title: "Secondary Condition via Aggravation | VA Secondary Connection Finder",
  description:
    "Explore conditions that were aggravated by your service-connected disability. This track is for conditions that were worsened beyond their natural progression by your service.",
};

export default function ConditionAggravationPage() {
  return (
    <main className="min-h-screen bg-orange-500">
      <header className="bg-black text-white">
        <div className="px-6 py-8">
          <h1 className="mb-3 text-4xl font-bold tracking-tight">{SECONDARY_AGGRAVATED_BY_TITLE}</h1>
          <p className="mt-3 text-lg text-gray-100">
            Exploring conditions that were aggravated by your service-connected disability. This track is for conditions that
            <strong> were permanently worsened</strong> beyond their natural progression by your service.
          </p>
        </div>
      </header>

      <div className="mb-6 flex justify-center px-6">
        <DisclaimerBanner />
      </div>

      <div className="mb-6 px-6">
        <Link href="/secondary" className="inline-flex items-center gap-2 rounded-md border border-blue-900 bg-blue-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800">
          ← Back to Secondary Conditions
        </Link>
      </div>

      <div className="mb-6 px-6">
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 text-sm leading-relaxed text-gray-100">
          <p>
            Suggestions come from a curated knowledge base, not from your medical records, and are not ranked by likelihood of approval. Citations are starting points for your own verification and have not yet been confirmed by a qualified reviewer. Confirm everything against current VA guidance at va.gov and consult an accredited representative or VSO before filing.
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-black bg-orange-500 p-6">
        <AggravatedByExplainer />
      </div>

      <footer className="px-6 py-4">
        <Link href="/secondary" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-600 bg-red-600 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-red-700">
          Secondary Conditions | Demo Scenarios | Privacy | Terms
        </Link>
      </footer>
    </main>
  );
}
