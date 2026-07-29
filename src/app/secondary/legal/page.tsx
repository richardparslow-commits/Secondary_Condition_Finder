import React from "react";
import Link from "next/link";

export default function SecondaryLegalPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <div className="border-b border-gray-200 pb-5 mb-6">
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">38 CFR § 3.310 Authority</span>
        <h1 className="text-3xl font-bold mt-1">Secondary Service Connection Legal & Policy Framework</h1>
        <p className="text-sm text-gray-600 mt-2">
          A comprehensive research guide to the governing statutes, VA M21-1 adjudication manuals, and 38 CFR regulations governing secondary claims.
        </p>
      </div>

      {/* 3 Core Elements Checklist */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-blue-900 mb-3">The 3 Essential Legal Elements for Secondary Claims</h2>
        <ul className="space-y-3 text-sm text-blue-900">
          <li className="flex items-start">
            <span className="font-bold mr-2">1.</span>
            <div><strong>Primary Service-Connected Disability:</strong> An established, rated VA service connection (e.g., Lumbar Strain, PTSD).</div>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">2.</span>
            <div><strong>Current Secondary Diagnosis:</strong> A current medical diagnosis of a secondary condition (e.g., Radiculopathy, Depression).</div>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">3.</span>
            <div><strong>Medical Nexus Opinion (38 CFR 3.310):</strong> A qualified medical opinion stating that the secondary condition was <em>at least as likely as not (50%+ probability)</em> caused or aggravated by the primary condition.</div>
          </li>
        </ul>
      </section>

      {/* Statutory Authorities */}
      <section className="space-y-6 mb-10">
        <h2 className="text-2xl font-semibold border-b pb-2">Governing Authorities & Policy References</h2>
        
        <div className="border rounded-md p-4 bg-white shadow-sm">
          <h3 className="text-md font-bold text-gray-800">38 CFR § 3.310(a) — Direct Secondary Service Connection</h3>
          <p className="text-xs text-gray-600 my-1">Code of Federal Regulations</p>
          <p className="text-sm text-gray-700">
            Establishes that a disability proximately due to or the result of a service-connected disease or injury shall be service-connected.
          </p>
        </div>

        <div className="border rounded-md p-4 bg-white shadow-sm">
          <h3 className="text-md font-bold text-gray-800">38 CFR § 3.310(b) — Service Connection by Aggravation</h3>
          <p className="text-xs text-gray-600 my-1">Code of Federal Regulations</p>
          <p className="text-sm text-gray-700">
            Governs non-service-connected disabilities that are worsened or aggravated beyond natural progress by an established service-connected condition.
          </p>
        </div>

        <div className="border rounded-md p-4 bg-white shadow-sm">
          <h3 className="text-md font-bold text-gray-800">VA Manual M21-1, Part V, Subpart ii, Chapter 2</h3>
          <p className="text-xs text-gray-600 my-1">VA Adjudication Procedures Manual</p>
          <p className="text-sm text-gray-700">
            Provides rating veterans examiners guidelines for weighing medical nexus evidence, physician qualifications, and clinical rationale.
          </p>
        </div>
      </section>

      {/* CTA to Proceed */}
      <div className="bg-gray-50 border rounded-xl p-6 text-center shadow-md">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Explore Secondary Claims?</h3>
        <p className="text-sm text-gray-600 mb-6 max-w-xl mx-auto">
          Use our interactive wizard to research secondary conditions linked to your primary disability, review evidence gaps, and prepare for your medical nexus evaluation.
        </p>
        <Link
          href="/secondary/diagnosed"
          className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          Click Here to Proceed to Secondary Wizard →
        </Link>
      </div>
    </main>
  );
}
