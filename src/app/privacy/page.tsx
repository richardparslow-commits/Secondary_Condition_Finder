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
      <p className="text-sm text-gray-600 mb-6">Last updated: October 4, 2026</p>

      <section className="space-y-4 text-sm leading-relaxed">
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
          <h2 className="font-semibold text-blue-900">Privacy by design</h2>
          <p className="text-blue-800 text-sm mt-1">
            Secondary-workflow health/disability selections and presumptive-workflow service history are not placed in page URLs. Short-lived first-party workflow cookies are encrypted and authenticated before being sent to the browser, and the current application does not initialize a client analytics or telemetry SDK.
          </p>
        </div>

        <h2 className="text-xl font-semibold mt-6">1. Workflow session state</h2>
        <p>
          Diagnosed-condition selections, service-connected selections, rating choices, document-checklist choices, optional bounded medication/treatment context, selected service locations, and service dates are submitted only to move through their respective workflows. The app encrypts and authenticates workflow state with AES-256-GCM before placing it in HttpOnly, SameSite=Strict cookies scoped to the applicable workflow path. These cookies expire after 30 minutes and are not used as advertising or cross-site tracking identifiers. Modified or invalid workflow cookies are rejected rather than processed.
        </p>
        <p>
          The secondary workflow also provides explicit completion controls. Choosing Finish Review or Start a new review deletes the encrypted secondary-workflow cookie before redirecting. Presumptive results also provide Clear saved service history to remove that workflow&apos;s cookie. These controls are additive to the 30-minute expiry rather than a replacement for it.
        </p>
        <p>
          Medication/treatment context is optional and limited to short entries intended for pathway research. Users should provide only the minimum necessary medication, treatment, procedure, or device terms and should not enter Social Security numbers, claim numbers, addresses, or unrelated medical details in those fields.
        </p>

        <h2 className="text-xl font-semibold mt-6">1a. Voice input</h2>
        <p>Voice input is disabled. Browser speech services may send audio off-device, so this application does not request microphone access or start speech recognition. Typed input and location selection remain available.</p>

        <h2 className="text-xl font-semibold mt-6">2. URLs and browser history</h2>
        <p>
          The secondary workflow does not encode diagnosis, service-connected status, disability ratings, document-sharing choices, or medication/treatment context in query strings. The presumptive workflow does not encode selected service locations or service dates in query strings. The legacy query-based secondary-results route no longer processes health-related URL state, and the application exposes no helper that serializes complete secondary-workflow state back into a URL. This reduces exposure through copied links, browser history, referrer headers, and URL-based logs.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Browser telemetry and server-side operational tracing</h2>
        <p>
          The current application does not initialize Application Insights or another client analytics/telemetry SDK and does not authorize third-party browser telemetry egress. The production Content Security Policy restricts browser network connections to the application&apos;s own origin.
        </p>
        <p>
          The server runtime does not currently enable automatic server trace export. Automatic HTTP tracing can attach full request URLs (including query strings), span names, and exception text without passing through the application&apos;s log redaction, so it stays disabled until URL/name/exception sanitization and collector retention are reviewed. The application does not add condition selections, disability ratings, medication/treatment context, local evidence excerpts, or decrypted workflow-cookie contents as custom telemetry attributes.
        </p>
        <p>
          The application emits allowlisted operational workflow and recommendation events containing action, route, status, counts and duration to server stdout/stderr, which hosting platforms may retain. These events are not a medical-record database, but they are event logging; hosting retention, access controls and exception channels require separate review. The sandbox account adapter does not log tokens, OAuth callback values, identity subjects or API response content. Any new telemetry fields require an explicit event-schema allowlist and privacy/security review.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Optional browser-local evidence review</h2>
        <p>
          Supporting-document review is optional. PDF, DOCX, supported text files, and pasted evidence text are analyzed locally in your browser. Raw document bytes and raw document text are not submitted to the application server, added to workflow cookies, written to application logs, or stored in a user account. PDF.js and Mammoth are bundled application libraries; the selected record is not uploaded to those projects, a CDN, or another document-analysis service.
        </p>
        <p>
          Local analysis is bounded by the analysis depth chosen on the Supporting Documents step. The default Standard depth limits a source to {formatLimitBytes(STANDARD_LIMITS.fileBytes)} per file, {STANDARD_LIMITS.batchSources} selected files and {formatLimitBytes(STANDARD_LIMITS.batchBytes)} per batch, {STANDARD_LIMITS.pdfPages} pages per PDF source, and {formatLimitChars(STANDARD_LIMITS.textChars)} extracted or pasted characters per source. The optional Extended depth raises those bounds for large local document sets — {formatLimitBytes(EXTENDED_LIMITS.fileBytes)} per file, {EXTENDED_LIMITS.batchSources} selected files and {formatLimitBytes(EXTENDED_LIMITS.batchBytes)} per batch, {EXTENDED_LIMITS.pdfPages} pages per PDF source, and {formatLimitChars(EXTENDED_LIMITS.textChars)} extracted or pasted characters per source — and should be chosen only when this browser tab can handle the larger in-memory workload. Oversized files are rejected. Page or text limits can result in explicitly warned partial OCR; partial results are not a review of the entire source. Excerpts retained for the Step 6 checklist are likewise bounded per depth: the most recent {STANDARD_LIMITS.storedSources} analyzed sources in Standard and up to {EXTENDED_LIMITS.storedSources} in Extended, each limited to a small excerpt window per source.
        </p>
        <p>
          The browser may temporarily retain extracted evidence excerpts and source/locator metadata, review checkmarks, checklist selections, walkthrough progress, and the analysis-depth preference in tab-scoped session storage. OCR additionally saves full recognized text and a document-name fingerprint for resume; checkpoints expire after 15 minutes and are discarded when next accessed, on successful OCR completion, or when their source is removed. Clear local evidence removes excerpts, checkpoints, selected files, and pasted text from the view. Finish Review and Start a new review clear all six registered secondary-workflow stores. No contents are copied to the server while clearing. Browser session restoration may preserve session storage; closing a tab is not a secure-erasure guarantee.
        </p>
        <p>
          Image-only or scanned PDF pages contain no extractable text layer. The app reports those pages instead of guessing. If you choose to run Local OCR on a scanned PDF, recognition is performed entirely in this browser tab by a bundled, self-hosted OCR engine — the page images and recognized text are not sent to the application server, an OCR provider, a CDN, or another external service. OCR results are then classified under the same local rules and temporary session-storage boundaries described above.
        </p>

        <p>
          <strong>Guided VA.gov download walkthrough (Step 4).</strong> The Step 4 “Guided VA.gov download” card mirrors the VA.gov/ID.me sign-in and medical-records download flow as a reference checklist. It never collects, transmits, or stores VA.gov or ID.me credentials, MFA codes, or session data: every link opens VA.gov in a new browser tab and any sign-in happens there, between you and VA.gov. The card&apos;s only local state is a set of boolean progress checkmarks in the tab-scoped session-storage store described above, plus an optional browser-generated text export of the public step list. The application does not automate, script, or observe the VA.gov session, and VA.gov may change its flow at any time.
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
          The accredited-representative finder is a public-directory ZIP lookup. The ZIP you enter is used only for that lookup and is not persisted to a workflow cookie or account. Results are public directory data, not Veteran PII, and are cached for a short window for performance under a cache key that hashes the lookup parameters instead of storing the ZIP as raw key material. Verify accreditation on VA&apos;s OGC directory before sharing personal information.
        </p>
        <h2 className="text-xl font-semibold mt-6">5b. DD-214 upload (browser-local)</h2>
        <p>
          DD-214 upload is optional and browser-local only. PDF or image bytes are not sent to the application server. Text is extracted in this tab (including OCR for scanned pages where needed). SSN is masked to XXX-XX-1234 before any preview; the full SSN is never displayed, persisted, or logged. Extracted dates and locations must be verified by you before the app saves them as service history. Clear the draft at any time to remove in-memory bytes and preview text.
        </p>

        <h2 className="text-xl font-semibold mt-6">6. VA API and claim-submission boundary</h2>
        <p>
          This application does not connect to a production Veteran account, submit a disability claim, or upload the user&apos;s workflow or local evidence to VA. A separately enabled sandbox-only account experiment at /va-account can read a signed-in test Veteran&apos;s rating summary or existing claim statuses after explicit authorization. Use only approved sandbox test accounts, never real records or identifiers. The environment-aware VA public-reference adapter is disabled by default; credentialed sandbox connectivity and future production connectivity remain separate external gates. Public VA form/reference features fall back to clearly labeled local reference data when configured VA access is disabled or unavailable.
        </p>
        <p>
          <strong>Read-only sandbox account connections.</strong> Sign-in navigates to the VA-authorized sandbox identity flow; this application does not collect passwords or MFA codes. Separate service scopes authorize only rating summaries or existing claim reads. OAuth access/refresh tokens and identity subject binding are encrypted in an isolated server-side session store, not browser storage or workflow cookies. The browser holds an opaque HttpOnly connection handle; a five-minute SameSite=Lax callback cookie binds the one-use login transaction, while the connected session cookie is SameSite=Strict. Account sessions expire after 30 minutes without extending on refresh. Displayed results omit ICNs, claim/rating identifiers and diagnosis text, are not cached by this application, and do not influence recommendations. Disconnect invalidates the application session and attempts provider token revocation, reporting when cleanup or revocation cannot be confirmed; it does not sign you out of VA. Production account access, representatives, submissions and uploads remain disabled. Callback URLs necessarily contain temporary OAuth code/state: hosting request-log scrubbing and retention must be reviewed before any credentialed hosted use.
        </p>
        <p>
          A credentialed VA sandbox or production integration must be objectively verified before it is described as live connectivity. Any future scope that transmits Veteran-specific workflow or evidence data to a VA API requires a separately reviewed privacy and security change. Local fallback behavior or mock data must not be described as proof of live VA connectivity.
        </p>
        <p>
          <strong>Public-reference lookups (Forms, Benefits Reference Data, service branches).</strong> A Forms search sends the text you enter as a GET query parameter to the configured VA Forms API, and the directory lookup sends the ZIP/radius/type you select. When live VA access is disabled or unavailable, only clearly labeled local reference data is shown and no request leaves the origin. Cached reference views — including the public-directory payload, which may echo the lookup parameters — expire within five minutes, and cache keys store a hash of user-supplied parameters rather than the raw query or ZIP. Do not enter SSNs, claim numbers, addresses, or other identifiers into a reference search; enter only terms about the form or reference data you are looking for.
        </p>
        <p>
          <strong>Accredited-representative locator (Phase 3.1).</strong> The “Find Help Near You” card on Steps 5/6 and presumptive results is an optional public-directory lookup. It sends only the 5-digit zip code you enter (and optional radius/type) to the configured VA accredited-representative directory; it does not send your diagnosed conditions, ratings, medications/treatments, evidence excerpts, or workflow selections. The zip is used only for the lookup and is not persisted to the encrypted workflow cookie, session storage, or application logs. Directory results are public data cached for five minutes (LRU-32) under the same VA reference-cache contract as forms/reference data, gated by <code>VA_ACCREDITED_REP_ENABLED</code> and the shared <code>VA_API_ENABLED</code> / distributed-runtime fail-closed boundary. When the integration is disabled or unavailable, the locator shows a clearly labeled local fallback with no directory results and links to VA’s OGC directory on va.gov.
        </p>

        <h2 className="text-xl font-semibold mt-6">7. Retention summary</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Encrypted workflow cookies expire after 30 minutes and can also be cleared by the workflow completion controls.</li>
          <li>Local evidence excerpts, evidence-gap checkmarks, pathway-record-checklist selections, and VA.gov walkthrough progress checkmarks use browser session storage scoped to the current tab and can be cleared from the workflow.</li>
          <li>The local evidence feature does not create a server-side medical-record store or user account.</li>
          <li>Operational count/status events may be retained by the hosting platform; deployed retention and exception export settings require review.</li>
          <li>Read-only sandbox account server sessions expire after 30 minutes and can be disconnected; temporary login transactions expire after five minutes.</li>
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
