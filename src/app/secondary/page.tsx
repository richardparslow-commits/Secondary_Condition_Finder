import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import {
  CAUSED_AGGRAVATED_DISTINCTION,
  SECONDARY_CONTINUE_CTA,
  SECONDARY_TRACK_OVERVIEW,
  TRACK_DISTINCTION_NOTICE,
  UNVERIFIED_REFERENCE_NOTICE,
} from "@/lib/legal/phrases";
import { SECONDARY_LEGAL_REFERENCES } from "@/lib/legal/secondaryReferences";

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
    <main>
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
        <section className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Supporting references
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
            {SECONDARY_LEGAL_REFERENCES.map((reference) => (
              <li key={reference.id}>
                <span className="font-medium">{reference.citation}</span>:{" "}
                {reference.explanation}
              </li>
            ))}
          </ul>
        </section>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workflow steps</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {steps.map((step, index) => (
            <li key={step}>
              <span className="font-medium text-slate-900">{index + 1}.</span> {step}
            </li>
          ))}
        </ol>

        <Link
          href="/secondary/diagnosed"
          className="mt-5 inline-block rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          {SECONDARY_CONTINUE_CTA}
        </Link>
      </section>

      <p className="mt-6 text-sm text-slate-600">
        If your condition may be tied to where and when you served, use the separate{" "}
        <Link href="/presumptive" className="underline hover:text-slate-900">
          presumptive track
        </Link>
        .
      </p>

      <DisclaimerFooter />
    </main>
  );
}
