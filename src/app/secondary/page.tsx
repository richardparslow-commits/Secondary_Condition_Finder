import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import {
  CAUSED_AGGRAVATED_DISTINCTION,
  SECONDARY_TRACK_OVERVIEW,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { CANONICAL_REFERENCES, DISCLAIMERS } from "@/lib/legal/references";

const steps = [
  "Diagnosed conditions",
  "Service-connected status",
  "Current ratings",
  "Optional document upload",
  "Suggested secondary conditions",
  "Evidence review",
];

export default function SecondaryLandingPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <Link href="/" className="text-sm underline hover:text-slate-900">
        Back to start
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Secondary service-connection workflow
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {SECONDARY_TRACK_OVERVIEW}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {CAUSED_AGGRAVATED_DISTINCTION} This workflow helps organize questions
          and evidence for those two theories.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {TRACK_DISTINCTION_NOTICE}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {UNVERIFIED_REFERENCE_NOTICE}
        </p>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-blue-900 mb-2">
            Caused By (Direct Secondary)
          </h2>
          <p className="text-sm text-blue-800">
            A secondary condition that is proximately due to or the result of
            your already service-connected primary condition. Governed by{" "}
            <strong>38 CFR § 3.310(a)</strong>.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-indigo-900 mb-2">
            Aggravated By (Worsening)
          </h2>
          <p className="text-sm text-indigo-800">
            A pre-existing or non-service-connected condition that was
            permanently worsened or accelerated beyond its natural progression
            by your service-connected condition. Governed by{" "}
            <strong>38 CFR § 3.310(b)</strong>.
          </p>
        </div>
      </div>

      <section className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 mb-6">
        <h2 className="text-sm font-semibold text-slate-800">
          Supporting references
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
          {CANONICAL_REFERENCES.map((reference) => (
            <li key={reference.id}>
              <span className="font-medium">{reference.citation}</span>:{" "}
              {reference.description}
            </li>
          ))}
        </ul>
      </section>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-8 rounded text-xs text-yellow-900">
        <span className="font-semibold">Compliance Note:</span>{" "}
        {DISCLAIMERS.nonDiagnostic}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Workflow steps
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {steps.map((step, index) => (
            <li key={step}>
              <span className="font-medium text-slate-900">{index + 1}.</span>{" "}
              {step}
            </li>
          ))}
        </ol>
      </section>

      <div className="bg-gray-50 border rounded-xl p-8 text-center shadow-md mt-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Ready to Start Your Research?
        </h3>
        <p className="text-sm text-gray-600 mb-6 max-w-lg mx-auto">
          Proceed to enter your diagnosed conditions and explore
          evidence-backed secondary connection pathways.
        </p>
        <Link
          href="/secondary/diagnosed"
          className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          Click Here to Proceed to Wizard Step 1
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        If your condition may be tied to where and when you served, use the
        separate{" "}
        <Link href="/presumptive" className="underline hover:text-slate-900">
          presumptive track
        </Link>
        .
      </p>

      <DisclaimerFooter />
    </main>
  );
}
