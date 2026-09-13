import React from "react";
import Link from "next/link";

import {
  EXTENDED_LIMITS,
  STANDARD_LIMITS,
  formatLimitBytes,
  formatLimitChars,
} from "@/lib/evidence/limits";

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-gray-600 mb-6">Last updated: September 2026</p>

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

        <h2 className="text-xl font-semibold mt-6">3. Browser telemetry and server-side operational tracing</h2>
        <p>
          The current application does not initialize Application Insights or another client analytics/telemetry SDK and does not authorize third-party browser telemetry egress. The production Content Security Policy restricts browser network connections to the application&apos;s own origin.
        </p>
        <p>
          The server runtime registers OpenTelemetry through Vercel&apos;s OpenTelemetry integration for operational tracing. The application does not add condition selections, disability ratings, medication/treatment context, local evidence excerpts, or decrypted workflow-cookie contents as custom telemetry attributes. Export of server-side traces follows the deployment&apos;s configured observability integration rather than a browser-side analytics connection.
        </p>
        <p>
          The current application does not persist workflow or recommendation event history through an application event logger. There is no dormant event-sanitizer API intended to make such logging implicitly safe. Any future application-authored telemetry fields or persistent event logging require a separately reviewed, explicit event-schema allowlist plus privacy and security review before they are enabled.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Optional browser-local evidence review</h2>
        <p>
          Supporting-document review is optional. PDF, DOCX, supported text files, and pasted evidence text are analyzed locally in your browser. Raw document bytes and raw document text are not submitted to the application server, added to workflow cookies, written to application logs, or stored in a user account. PDF.js and Mammoth are bundled application libraries; the selected record is not uploaded to those projects, a CDN, or another document-analysis service.
        </p>
        <p>
          Local analysis is bounded by the analysis depth chosen on the Supporting Documents step. The default Standard depth limits a source to {formatLimitBytes(STANDARD_LIMITS.fileBytes)} per file, {STANDARD_LIMITS.batchSources} selected files and {formatLimitBytes(STANDARD_LIMITS.batchBytes)} per batch, {STANDARD_LIMITS.pdfPages} pages per PDF source, and {formatLimitChars(STANDARD_LIMITS.textChars)} extracted or pasted characters per source. The optional Extended depth raises those bounds for large local document sets — {formatLimitBytes(EXTENDED_LIMITS.fileBytes)} per file, {EXTENDED_LIMITS.batchSources} selected files and {formatLimitBytes(EXTENDED_LIMITS.batchBytes)} per batch, {EXTENDED_LIMITS.pdfPages} pages per PDF source, and {formatLimitChars(EXTENDED_LIMITS.textChars)} extracted or pasted characters per source — and should be chosen only when this browser tab can handle the larger in-memory workload. Sources over the active depth&apos;s limits are rejected rather than silently truncated in either depth. Excerpts retained for the Step 6 checklist are likewise bounded per depth: the most recent {STANDARD_LIMITS.storedSources} analyzed sources in Standard and up to {EXTENDED_LIMITS.storedSources} in Extended, each limited to a small excerpt window per source.
        </p>
        <p>
          The browser may temporarily retain only the extracted evidence excerpts and their source/locator metadata, plus user-selected evidence-gap review checkmarks and pathway-record-checklist selections from the Prepare Evidence aid, in session storage so they can be displayed on Steps 5 and 6. Session storage is scoped to the current browser tab and is cleared when the tab is closed. You can clear local evidence selectively from Step 4 without ending the workflow. Finish Review and Start a new review clear all three secondary-workflow session-storage stores before leaving Step 6; the clearing operation does not copy their contents to the server, telemetry, logs, or a VA API.
        </p>
        <p>
          Image-only or scanned PDF pages contain no extractable text layer. The app reports those pages instead of guessing. If you choose to run Local OCR on a scanned PDF, recognition is performed entirely in this browser tab by a bundled, self-hosted OCR engine — the page images and recognized text are not sent to the application server, an OCR provider, a CDN, or another external service. OCR results are then classified under the same local rules and temporary session-storage boundaries described above.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Evidence and context classification limits</h2>
        <p>
          The local evidence classifier is intentionally conservative. You assign each selected document its own author type on the Supporting Documents step (the default applies to newly selected documents). An excerpt is labeled “nexus-relevant” only when you identify its document as clinician-authored, the excerpt includes causation, aggravation, or alternative-cause language, and it mentions at least one condition selected in the workflow. Changing a document&apos;s author re-runs that document&apos;s local classification. This label does not determine legal competency, credibility, probative weight, medical correctness, or whether VA will find the evidence sufficient.
        </p>
        <p>
          Medication/treatment entries are used only to surface literal normalized text overlap with authored recommendation rationale or evidence-gap text. A match does not change recommendation ranking, infer a drug class or mechanism, or establish individual causation, aggravation, or medical nexus.
        </p>

        <h2 className="text-xl font-semibold mt-6">5a. Accredited-representative directory search</h2>
        <p>
          The accredited-representative finder is a public-directory ZIP lookup. The ZIP you enter is used only for that lookup and is not persisted to a workflow cookie or account. Results are public directory data, not Veteran PII, and are cached for a short window for performance. Verify accreditation on VA&apos;s OGC directory before sharing personal information.
        </p>
        <h2 className="text-xl font-semibold mt-6">5b. DD-214 upload (browser-local)</h2>
        <p>
          DD-214 upload is optional and browser-local only. PDF or image bytes are not sent to the application server. Text is extracted in this tab (including OCR for scanned pages where needed). SSN is masked to XXX-XX-1234 before any preview; the full SSN is never displayed, persisted, or logged. Extracted dates and locations must be verified by you before the app saves them as service history. Clear the draft at any time to remove in-memory bytes and preview text.
        </p>

        <h2 className="text-xl font-semibold mt-6">6. VA API and claim-submission boundary</h2>
        <p>
          This application does not connect to a Veteran&apos;s VA account, does not submit a disability claim, and does not upload the user&apos;s workflow or local evidence to VA. The environment-aware VA public-reference adapter is disabled by default; credentialed sandbox connectivity and future production connectivity remain separate external gates. Public VA form/reference features fall back to clearly labeled local reference data when configured VA access is disabled or unavailable.
        </p>
        <p>
          A credentialed VA sandbox or production integration must be objectively verified before it is described as live connectivity. Any future scope that transmits Veteran-specific workflow or evidence data to a VA API requires a separately reviewed privacy and security change. Local fallback behavior or mock data must not be described as proof of live VA connectivity.
        </p>
        <p>
          <strong>Accredited-representative locator (Phase 3.1).</strong> The “Find Help Near You” card on Steps 5/6 and presumptive results is an optional public-directory lookup. It sends only the 5-digit zip code you enter (and optional radius/type) to the configured VA accredited-representative directory; it does not send your diagnosed conditions, ratings, medications/treatments, evidence excerpts, or workflow selections. The zip is used only for the lookup and is not persisted to the encrypted workflow cookie, session storage, or application logs. Directory results are public data cached for five minutes (LRU-32) under the same VA reference-cache contract as forms/reference data, gated by <code>VA_ACCREDITED_REP_ENABLED</code> and the shared <code>VA_API_ENABLED</code> / distributed-runtime fail-closed boundary. When the integration is disabled or unavailable, the locator shows a clearly labeled local fallback with no directory results and links to VA’s OGC directory on va.gov.
        </p>

        <h2 className="text-xl font-semibold mt-6">7. Retention summary</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Encrypted workflow cookies expire after 30 minutes and can also be cleared by the workflow completion controls.</li>
          <li>Local evidence excerpts, evidence-gap checkmarks, and pathway-record-checklist selections use browser session storage scoped to the current tab and can be cleared from the workflow.</li>
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
