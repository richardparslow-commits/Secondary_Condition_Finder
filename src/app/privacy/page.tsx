import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-gray-600 mb-6">Last updated: July 2026</p>
      
      <section className="space-y-4 text-sm leading-relaxed">
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
          <h2 className="font-semibold text-blue-900">Zero PII Policy</h2>
          <p className="text-blue-800 text-xs mt-1">
            This tool does not collect, persist, or transmit Personally Identifiable Information (PII), medical records, or raw intake free text.
          </p>
        </div>

        <h2 className="text-xl font-semibold mt-6">1. Data Storage & Local Event Logging</h2>
        <p>
          All claim research calculations run entirely in your local browser environment. Event logging is strictly anonymized and confined to an offline local database recording only aggregate condition selection counts.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. External Network Communications</h2>
        <p>
          No personal data is sent to external servers or third-party analytics services. Optional VA Sandbox integrations operate purely on a client-side pull model with immediate local fallback when offline.
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
