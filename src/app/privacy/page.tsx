import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-gray-600 mb-6">Last updated: August 2026</p>

      <section className="space-y-4 text-sm leading-relaxed">
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
          <h2 className="font-semibold text-blue-900">Privacy by design</h2>
          <p className="text-blue-800 text-xs mt-1">
            Secondary-workflow selections are not placed in page URLs. They are kept in a short-lived, encrypted first-party session cookie scoped to the secondary workflow and are not attached to analytics events.
          </p>
        </div>

        <h2 className="text-xl font-semibold mt-6">1. Workflow session state</h2>
        <p>
          Diagnosed-condition selections, service-connected selections, rating choices, and the document-checklist choice are submitted to this application only to move between workflow steps. The app encrypts and authenticates that state with AES-256-GCM before placing it in an HttpOnly, SameSite=Strict session cookie scoped to <code>/secondary</code>. The cookie expires after 30 minutes and is not used as an advertising or cross-site tracking identifier. Modified or invalid session cookies are rejected rather than processed.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. URLs and browser history</h2>
        <p>
          The secondary workflow does not encode diagnosis, service-connected status, disability ratings, or document-sharing choices in query strings. The legacy query-based secondary-results route no longer processes health-related URL state. This reduces exposure through copied links, browser history, referrer headers, and URL-based logs.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Application telemetry and operational logs</h2>
        <p>
          When Application Insights is configured, page-view telemetry is limited to the route path. Automatic route, AJAX, and fetch tracking are disabled, and telemetry URLs are stripped of query strings and fragments before transmission. Workflow selections and disability ratings are not intentionally included in telemetry payloads. Recommendation event logging is limited to aggregate operational counts and does not retain condition identifiers, diagnoses, symptoms, medications, exposures, or intake notes.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Optional document picker</h2>
        <p>
          The Phase 1 document picker is optional and does not upload files for AI analysis. The workflow records only whether you want the checklist to note that documents are available for manual review.
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
