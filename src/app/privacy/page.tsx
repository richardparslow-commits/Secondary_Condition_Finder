import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-gray-600 mb-6">Last updated: September 2026</p>

      <section className="space-y-4 text-sm leading-relaxed">
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
          <h2 className="font-semibold text-blue-900">Zero PII Policy</h2>
          <p className="text-blue-800 text-xs mt-1">
            This tool has no accounts, no profiles, and no database of what you
            entered. It does not collect, persist, or transmit Personally
            Identifiable Information (PII), medical records, or raw intake free
            text.
          </p>
        </div>

        <h2 className="text-xl font-semibold mt-6">1. Where research runs</h2>
        <p>
          This is a claim-preparation research aid. The pages you use are
          rendered by the application&apos;s server, which reads a condition
          catalog and a knowledge base that ship with the app. Your choices for
          a given run travel in the page address (URL) only, so the next step
          can restore your earlier selections. We do not store those choices on
          our servers and cannot use them to identify you.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. Server event logging</h2>
        <p>
          When the deployed environment enables event logging, a short record
          of a completed research run may be written to the host&apos;s server
          logs or to a database file that the operator configures. Those
          records contain only anonymized details: resolved condition names,
          counts of unrecognized entries, recommended condition ids, an engine
          version, and a timestamp. Free text, names, Social Security numbers,
          and document contents are not part of the event schema and are never
          logged.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Optional analytics</h2>
        <p>
          Some builds of this site include Microsoft Application Insights to
          measure overall page views and catch runtime errors. Telemetry is off
          by default. If the version you are using has it configured, you will
          see a consent prompt at the bottom of the page before anything is
          sent, and you can decline. Declining disables analytics completely
          and does not limit the tool. Your choice is remembered only in your
          browser and can be changed by clearing your browser&apos;s site data.
        </p>
        <p>
          When you allow analytics, telemetry covers page views, routes, and
          browser type. It never includes the conditions you select, ratings,
          file names, or any medical information, and it is the only mechanism
          on the site that could set third-party cookies — it is not loaded
          unless you consent.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Uploads and VA data</h2>
        <p>
          The optional document picker on the upload step is local to your
          browser in this phase: no file contents or file names are uploaded,
          transmitted, or stored. The VA sandbox integration planned for later
          phases runs server-side behind a feature flag, is disabled by
          default, and is not active today. No VA records are read by this app.
        </p>
      </section>

      <div className="mt-8 pt-4 border-t">
        <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">
          &larr; Return to Home
        </Link>
      </div>
    </main>
  );
}
