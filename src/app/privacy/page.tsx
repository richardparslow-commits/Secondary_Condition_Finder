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
            Secondary-workflow health/disability selections and presumptive-workflow service history are not placed in page URLs. Short-lived first-party workflow cookies are encrypted and authenticated before being sent to the browser, and the current application does not initialize a client analytics or telemetry SDK.
          </p>
        </div>

        <h2 className="text-xl font-semibold mt-6">1. Workflow session state</h2>
        <p>
          Diagnosed-condition selections, service-connected selections, rating choices, document-checklist choices, optional bounded medication/treatment context, selected service locations, and service dates are submitted only to move through their respective workflows. The app encrypts and authenticates workflow state with AES-256-GCM before placing it in HttpOnly, SameSite=Strict cookies scoped to the applicable workflow path. These cookies expire after 30 minutes and are not used as advertising or cross-site tracking identifiers. Modified or invalid workflow cookies are rejected rather than processed.
        </p>
        <p>
          The secondary workflow also provides explicit completion controls. Choosing Finish Review or Start a new review deletes the encrypted secondary-workflow cookie before redirecting. This is additive to the 30-minute expiry rather than a replacement for it.
        </p>
        <p>
          Medication/treatment context is optional and limited to short entries intended for pathway research. Users should provide only the minimum necessary medication, treatment, procedure, or device terms and should not enter Social Security numbers, claim numbers, addresses, or unrelated medical details in those fields.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. URLs and browser history</h2>
        <p>
          The secondary workflow does not encode diagnosis, service-connected status, disability ratings, document-sharing choices, or medication/treatment context in query strings. The presumptive workflow does not encode selected service locations or service dates in query strings. The legacy query-based secondary-results route no longer processes health-related URL state, and the application exposes no helper that serializes complete secondary-workflow state back into a URL. This reduces exposure through copied links, browser history, referrer headers, and URL-based logs.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Browser telemetry and operational logging</h2>
        <p>
          The current application does not initialize Application Insights or another client analytics/telemetry SDK and does not authorize third-party browser telemetry egress. The production Content Security Policy restricts browser network connections to the application&apos;s own origin.
        </p>
        <p>
          The current application does not persist workflow or recommendation event history through an application event logger. There is no dormant event-sanitizer API intended to make such logging implicitly safe. Any future persistent telemetry or logging integration requires a separately reviewed, explicit event-schema allowlist plus privacy and security review before it is enabled.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Optional browser-local evidence review</h2>
        <p>
          Supporting-document review is optional. PDF, DOCX, supported text files, and pasted evidence text are analyzed locally in your browser. Raw document bytes and raw document text are not submitted to the application server, added to workflow cookies, written to application logs, or stored in a user account. PDF.js and Mammoth are bundled application libraries; the selected record is not uploaded to those projects, a CDN, or another document-analysis service.
        </p>
        <p>
          Local analysis is bounded to 20 MB per file, 10 selected files and 50 MB per batch, 300 pages per PDF source, and 500,000 extracted or pasted characters per source. Sources over those limits are rejected rather than silently truncated.
        </p>
        <p>
          The browser may temporarily retain only the extracted evidence excerpts and their source/locator metadata, plus user-selected evidence-gap review checkmarks, in session storage so they can be displayed on Step 6. Session storage is scoped to the current browser tab and is cleared when the tab is closed. You can clear local evidence selectively from Step 4 without ending the workflow. Finish Review and Start a new review clear both secondary-workflow session-storage stores before leaving Step 6; the clearing operation does not copy their contents to the server, telemetry, logs, or a VA API.
        </p>
        <p>
          Image-only or scanned PDF pages may contain no extractable text. The app reports those pages instead of guessing or sending the record to an OCR provider. OCR must be performed separately in a trusted tool before that text can be reviewed here.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Evidence and context classification limits</h2>
        <p>
          The local evidence classifier is intentionally conservative. An excerpt is labeled “nexus-relevant” only when you identify the source as clinician-authored, the excerpt includes causation, aggravation, or alternative-cause language, and it mentions at least one condition selected in the workflow. This label does not determine legal competency, credibility, probative weight, medical correctness, or whether VA will find the evidence sufficient.
        </p>
        <p>
          Medication/treatment entries are used only to surface literal normalized text overlap with authored recommendation rationale or evidence-gap text. A match does not change recommendation ranking, infer a drug class or mechanism, or establish individual causation, aggravation, or medical nexus.
        </p>

        <h2 className="text-xl font-semibold mt-6">6. VA API and claim-submission boundary</h2>
        <p>
          This application does not connect to a Veteran&apos;s VA account, does not submit a disability claim, and does not upload the user&apos;s workflow or local evidence to VA. The environment-aware VA public-reference adapter is disabled by default; credentialed sandbox connectivity and future production connectivity remain separate external gates. Public VA form/reference features fall back to clearly labeled local reference data when configured VA access is disabled or unavailable.
        </p>
        <p>
          A credentialed VA sandbox or production integration must be objectively verified before it is described as live connectivity. Any future scope that transmits Veteran-specific workflow or evidence data to a VA API requires a separately reviewed privacy and security change. Local fallback behavior or mock data must not be described as proof of live VA connectivity.
        </p>

        <h2 className="text-xl font-semibold mt-6">7. Retention summary</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Encrypted workflow cookies expire after 30 minutes and can also be cleared by the workflow completion controls.</li>
          <li>Local evidence excerpts and evidence-gap checkmarks use browser session storage scoped to the current tab and can be cleared from the workflow.</li>
          <li>The local evidence feature does not create a server-side medical-record store or user account.</li>
          <li>The current application does not persist workflow or recommendation event history through an application event logger.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">8. Policy changes</h2>
        <p>
          This policy must be updated when application data flows materially change, including before enabling any integration that transmits Veteran-specific workflow or evidence data to an external API. The “Last updated” date above should move with those reviewed changes.
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
