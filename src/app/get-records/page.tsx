import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { VaGovRecordWalkthrough } from "@/components/secondary/VaGovRecordWalkthrough";

export const metadata: Metadata = {
  title: "Get Your VA Medical Record | Secondary Condition Finder",
  description:
    "A guided, step-by-step walkthrough for signing into VA.gov and downloading your complete VA health record as a PDF. The app never sees your VA.gov or ID.me credentials.",
};

export default function GetRecordsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-gray-900">
      <header className="page-hero text-center">
        <p className="ui-kicker">Research aid — outside the numbered workflow</p>
        <h1 className="mt-2">Get Your VA Medical Record</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg">
          A guided walkthrough for signing into VA.gov and downloading your complete VA health
          record as a PDF. Signing in happens entirely on VA.gov — this application never asks
          for, receives, or stores your VA.gov or ID.me credentials, multi-factor codes, or
          session.
        </p>
      </header>

      <VaGovRecordWalkthrough />

      <section className="ui-card mt-6">
        <div className="ui-heading-row">
          <span className="ui-icon" aria-hidden="true">→</span>
          <h2 className="text-xl font-bold">After you have the PDF</h2>
        </div>
        <p className="text-sm">
          The record PDF stays on your computer. When you are ready to organize claim-preparation
          research, the secondary workflow&apos;s document step can analyze it locally in your
          browser — raw document content is never uploaded to this application&apos;s server.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/secondary" className="ui-button">
            Open the secondary workflow <span aria-hidden="true">→</span>
          </Link>
          <Link href="/privacy" className="ui-button-secondary">
            Read the privacy policy
          </Link>
        </div>
      </section>

      <DisclaimerFooter />
    </main>
  );
}
