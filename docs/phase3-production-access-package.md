# Phase 3 Production Access Package

## Package status

**Draft for VA production-access review. Do not submit yet.**

Credentialed live sandbox validation for VA Forms and Benefits Reference Data remains externally pending in issue #189. The repository implementation and manual smoke-test workflow are in place, but objective workflow history currently contains no completed credentialed run.

The production workflow-session crypto path has now been verified on Vercel with non-sensitive runtime evidence. Issue #213 remains the exact-current-commit closure record until the production-readiness workflow re-verifies the final `main` commit after hosting finalization.

Submission remains gated on:

1. Recording successful non-sensitive credentialed sandbox smoke-test evidence in issue #189.
2. Closing issue #213 on exact-current-commit Vercel production evidence from `docs/deployment-readiness.md`.
3. Completing the deployed-app manual accessibility/Section 508 review tracked in issue #195 and remediating/retesting material findings.
4. Supplying truthful applicant/business information and absolute deployed URLs.
5. Completing a final demo rehearsal against the deployed application.

## Product description

Secondary Condition Finder is a claim-preparation research and organization tool for Veterans. It helps a user distinguish secondary-service-connection and presumptive-service-connection research paths, organize diagnosed and service-connected conditions, review possible secondary conditions to explore, identify evidence gaps, and locate relevant public VA reference information.

The application does not diagnose medical conditions, determine benefit eligibility, calculate or promise ratings, submit claims, or provide legal representation. Recommendations are framed as possibilities to research with a qualified medical professional, Veterans Service Officer, accredited representative, or attorney as appropriate.

## Primary end users

The first production use case is intentionally narrow:

- Veterans researching and organizing information for their own VA disability-benefit claim preparation.
- A Veteran may use the output when speaking with an accredited VSO, accredited agent/attorney, or health-care professional.

The initial production request does **not** depend on a representative acting on a Veteran's behalf and does not request access to authenticated Veteran-specific claims or health records.

## First production use case

A Veteran uses the application to:

1. Explore secondary or presumptive claim-preparation concepts using the local knowledge base.
2. Review evidence gaps and supporting-source references without the application making an eligibility or medical determination.
3. Optionally analyze supported medical-evidence documents locally in the browser and review exact extracted excerpts without sending raw document content to the application server.
4. Confirm current public metadata for a relevant VA form through VA Forms.
5. Review standardized public VBA disability terminology through Benefits Reference Data.
6. Continue to VA or an accredited representative for filing, representation, or official adjudication.

The VA API features are supporting reference capabilities. The core recommendation, evidence-review, and presumptive workflows remain functional without VA API availability.

## Production APIs requested

### 1. VA Forms API — Open Data

**Requested access:** production API key for the existing public-reference workflow.

**Current implemented value:** `/va-forms` retrieves and validates public metadata for VA Form 21-526EZ and falls back to a local VA.gov reference when the API is unavailable.

**Why necessary:** The API provides an authoritative machine-readable source for form metadata, revision information, PDF links, and validity status. This helps reduce the risk of directing a user to an outdated form reference.

**Data sent:** only the bounded public form lookup needed by the feature. No Veteran account data, diagnosis, rating, claim payload, service history, PII, or PHI is required.

### 2. Benefits Reference Data API — Open Data

**Requested access:** production API key for the existing disability-reference workflow.

**Current implemented value:** `/va-reference` loads the public `/disabilities` reference list. User search/filter text is applied client-side after the public list is loaded and is not sent to VA.

**Why necessary:** The API supplies standardized VBA terminology that can improve consistency when a user reviews disability terms during claim-preparation research.

**Data sent:** the current `/disabilities` request requires no user input parameters. No Veteran-specific data, PII, or PHI is sent.

## APIs deliberately not requested

The initial request excludes Benefits Intake, Benefits Claims, Benefits Documents, Veteran health APIs, and other authenticated Veteran-specific APIs. Those APIs add privacy, authorization, and workflow obligations that are not necessary to prove the first production use case.

Any later expansion must satisfy the decision rule in `docs/va-api-access-strategy.md`: demonstrated incremental user value, documented privacy/auth implications, and a bounded compliant workflow.

## Data handling summary

### Workflow state

Secondary and presumptive workflow state is stored only in short-lived first-party cookies that are encrypted and authenticated with AES-256-GCM. The cookies are HttpOnly, SameSite=Strict, scoped to their workflow paths, and expire after 30 minutes. Sensitive workflow values are not placed in query strings.

### Browser-local medical-evidence analysis

Optional evidence ingestion is processed locally in the browser. Supported PDF, DOCX, and text sources are parsed client-side; raw document bytes and raw document text are not submitted to application server state, URLs, cookies, telemetry, logs, or user accounts. Extracted excerpt objects are retained only temporarily in tab-scoped `sessionStorage` for the evidence-review step. PDF excerpts retain page provenance; DOCX excerpts retain deterministic paragraph provenance. Image-only PDF pages are reported as requiring OCR rather than silently treated as readable text.

### Application logging

Recommendation event persistence is limited to aggregate operational counts. It does not retain condition identifiers, diagnoses, symptoms, medications, exposures, intake notes, service locations, or service dates.

VA adapter observations are limited to operational metadata such as request ID, service, endpoint path, attempt, outcome/status, and duration. API keys, request query values, response bodies, and workflow selections are excluded from adapter observations.

### Browser telemetry

When Application Insights is configured, route telemetry is sanitized and automatic AJAX/fetch tracking is disabled. Health/disability workflow state and service-history state are not intentionally attached to telemetry events.

### Retention and deletion

- Workflow cookies expire after 30 minutes and are rejected if modified or invalid.
- Browser-local evidence excerpts are temporary and tab-scoped; raw selected document bytes/text are not intentionally persisted by the application.
- The current public-reference API integrations do not create a server-side Veteran profile or persistent Veteran-specific API record.
- Aggregate operational metrics contain no condition identifiers or free-text intake content.
- No VA API response body is intentionally persisted by the public-reference adapter.

## Credential handling

- VA API keys are server-only environment settings.
- VA API keys are never stored in source control or exposed through `NEXT_PUBLIC_*` variables.
- Production credentials are stored in the hosting platform's protected environment facility and must not be logged.
- The current production host is Vercel; production-only runtime values are configured in the Vercel **Production** environment and activated through a new production deployment.
- Credentials should be rotated if exposed, during security incident response, and on any schedule required by VA or the hosting environment.
- Sandbox and production credentials must remain environment-separated.

## Authentication and authorization

The two APIs in this initial request are open-data APIs accessed with an API key. The application does not request OAuth scopes or authorization to access an individual Veteran's VA account in the initial production use case.

## Rate limiting, retries, and failures

The adapter uses bounded retries rather than unbounded traffic amplification:

- maximum two attempts per request;
- retry only for HTTP 429, 503, or 504 and transient timeout/network failure;
- configurable per-attempt timeout, default 4 seconds;
- invalid response payloads fail closed;
- API failure returns local-reference behavior instead of breaking the core claim-preparation workflow.

The operating plan assumes VA's published standard rate limit and will not intentionally exceed it. A 429 is treated as a transient failure and receives at most one retry before fallback.

## Security controls

Current repository controls include:

- HTTPS-only configurable VA API base URLs;
- server-only API credentials;
- encrypted/authenticated workflow cookies;
- query-string minimization for health/disability and service-history state;
- browser-local medical-evidence parsing with no raw document upload endpoint;
- aggregate-only recommendation-event persistence;
- baseline CSP, HSTS, frame-denial, referrer, content-type, and permissions headers;
- dependency audit, citation audit, knowledge-base validation, lint, typecheck, tests, and production build in CI;
- explicit Node 22 runtime contract and Vercel-native standard Next.js build;
- exact-commit Vercel deployment-status verification, production-alias convergence, and a non-sensitive runtime crypto self-test before production readiness is accepted.

The former Azure Static Web Apps workflow is retained only as a manual legacy fallback and is no longer an automatic production deployment path.

## Privacy, terms, and product URLs

Public routes in the application:

- `/about` — product description and end-user/use-case boundaries.
- `/privacy` — privacy policy.
- `/terms` — terms of use and legal/medical disclaimers.
- `/va-forms` — VA Forms reference demonstration.
- `/va-reference` — Benefits Reference Data demonstration.

Canonical deployed application root:

- `https://secondary-condition-finder.vercel.app`

The exact absolute route URLs should be rechecked during final submission preparation.

## Business model response

The repository does not currently define a commercial monetization model. Before submission, the applicant should provide the truthful current operating/funding model in the VA form and explicitly confirm that Veteran data is not sold or monetized.

Do not invent a revenue model for the production-access request.

## Section 508 / accessibility response

The repository contains automated accessibility preflight evidence for landmarks/headings on tested routes, keyboard bypass, visible-focus styling, reflow safeguards, forced-colors handling, and reduced-motion behavior. This is not a conformance certification.

Before the production form is submitted, complete issue #195 against the exact deployed build using synthetic data, including keyboard-only operation, form/error behavior, NVDA and/or VoiceOver, 200% zoom/reflow, contrast, and Windows forced-colors/high-contrast testing. Answer VA's Section 508 question only from the completed evidence record.

## Security and incident-response response

For the VA form, describe the implemented preventive controls above and the operating response process:

1. Revoke/rotate affected credentials.
2. Contain the affected deployment or feature flag.
3. Preserve non-sensitive diagnostic evidence.
4. Patch and validate through the full CI gate.
5. Redeploy and verify the exact production commit.
6. Notify VA and affected parties when required by applicable policy, contract, or law.

## Vulnerability management response

The repository performs high-severity dependency auditing in CI on every gated change. Security-relevant fixes are merged only after lint, typecheck, tests, build, and other repository gates pass. Vercel production deployments are verified against the exact `main` commit before runtime readiness is accepted.

## Current readiness status

The Vercel production workflow-session crypto path has been verified with a reachable HTTP 200 `/runtime-readiness` page and the high-level `ready` marker on a green `main` commit. Issue #213 remains open only until the final hosting-contract commit is reverified and recorded automatically.

Credentialed live sandbox validation remains pending in issue #189. Production-access submission also remains blocked on manual accessibility/Section 508 evidence in issue #195, truthful applicant/business details and final absolute URLs, and the final demo rehearsal.
