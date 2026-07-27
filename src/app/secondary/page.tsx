import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";

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
          Use this track when you already have at least one service-connected condition and
          want to organize possible secondary conditions to discuss with a qualified provider
          or accredited representative.
        </p>
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
          Start secondary workflow
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
