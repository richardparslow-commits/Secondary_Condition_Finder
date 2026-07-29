import React from "react";
import Link from "next/link";
import { CANONICAL_REFERENCES, DISCLAIMERS } from "@/lib/legal/references";

export default function SecondaryLandingPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <div className="border-b border-gray-200 pb-5 mb-6">
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">38 CFR § 3.310 Claim Pathway</span>
        <h1 className="text-3xl font-bold mt-1">Secondary Service Connection Research Hub</h1>
        <p className="text-sm text-gray-600 mt-2">
          Understand how to connect a new disability to an existing, VA-rated service-connected condition either through direct causation or legal aggravation.
        </p>
      </div>

      {/* Caused vs Aggravated Distinction Box */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-blue-900 mb-2">Caused By (Direct Secondary)</h2>
          <p className="text-sm text-blue-800">
            A secondary condition that is proximately due to or the result of your already service-connected primary condition (e.g., radiculopathy resulting from service-connected lumbar strain). Governed by <strong>38 CFR § 3.310(a)</strong>.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-indigo-900 mb-2">Aggravated By (Worsening)</h2>
          <p className="text-sm text-indigo-800">
            A pre-existing or non-service-connected condition that was permanently worsened or accelerated beyond its natural progression by your service-connected condition. Governed by <strong>38 CFR § 3.310(b)</strong>.
          </p>
        </div>
      </div>

      {/* Supporting Legal References from Canonical Source */}
      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold border-b pb-2">Supporting Legal References</h2>
        {CANONICAL_REFERENCES.map((ref) => (
          <div key={ref.id} className="border rounded-md p-4 bg-white shadow-sm">
            <span className="text-xs font-bold text-blue-600 uppercase">{ref.citation}</span>
            <h3 className="text-md font-bold text-gray-800">{ref.title}</h3>
            <p className="text-xs text-gray-700 mt-1">{ref.description}</p>
          </div>
        ))}
      </section>

      {/* Safety Notice */}
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-8 rounded text-xs text-yellow-900">
        <span className="font-semibold">Compliance Note:</span> {DISCLAIMERS.nonDiagnostic}
      </div>

      {/* Proceed CTA */}
      <div className="bg-gray-50 border rounded-xl p-8 text-center shadow-md">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Start Your Research?</h3>
        <p className="text-sm text-gray-600 mb-6 max-w-lg mx-auto">
          Proceed to enter your diagnosed conditions and explore evidence-backed secondary connection pathways.
        </p>
        <Link
          href="/secondary/diagnosed"
          className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          Click Here to Proceed to Wizard Step 1 →
        </Link>
      </div>
    </main>
  );
}
