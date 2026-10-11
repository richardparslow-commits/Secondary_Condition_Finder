import React from "react";
import Link from "next/link";
import { CANONICAL_REFERENCES, DISCLAIMERS } from "@/lib/legal/references";

export default function SecondaryLegalPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <div className="border-b border-gray-200 pb-5 mb-6">
        <span className="text-xs font-semibold text-blue-700">38 CFR § 3.310 Authority</span>
        <h1 className="text-3xl font-bold mt-1">Secondary Service Connection Legal & Policy Framework</h1>
        <p className="text-sm text-gray-600 mt-2">
          A comprehensive research guide to the governing statutes, VA M21-1 adjudication manuals, and 38 CFR regulations governing secondary claims.
        </p>
      </div>

      <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-8 rounded">
        <h2 className="font-semibold text-red-900">Important Disclaimers</h2>
        <p className="text-red-800 text-xs mt-1">{DISCLAIMERS.nonDiagnostic} {DISCLAIMERS.noGuarantee}</p>
        <p className="text-red-800 text-xs mt-1">{DISCLAIMERS.unverifiedCitations}</p>
      </div>

      <section className="space-y-6 mb-10">
        <h2 className="text-2xl font-semibold border-b pb-2">Governing Authorities & Policy References</h2>
        {CANONICAL_REFERENCES.map((ref) => (
          <div key={ref.id} className="border rounded-md p-4 bg-white shadow-sm relative">
            {ref.verificationStatus === "unverified" && (
              <span className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-300">
                UNVERIFIED
              </span>
            )}
            <h3 className="text-md font-bold text-gray-800">{ref.citation} — {ref.title}</h3>
            <p className="text-xs text-gray-600 my-1">{ref.sourceType}</p>
            <p className="text-sm text-gray-700">{ref.description}</p>
          </div>
        ))}
      </section>

      <div className="bg-gray-50 border rounded-xl p-6 text-center shadow-md">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Explore Secondary Claims?</h3>
        <p className="text-sm text-gray-600 mb-6 max-w-xl mx-auto">
          Use our interactive wizard to research secondary conditions linked to your primary disability.
        </p>
        <Link href="/secondary/diagnosed" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors">
          Click Here to Proceed to Secondary Wizard →
        </Link>
      </div>
    </main>
  );
}
