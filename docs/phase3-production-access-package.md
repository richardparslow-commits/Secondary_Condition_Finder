# Phase 3 Production Access Package

## Package status

**Draft for VA production-access review. Do not submit yet.**

Repository implementation is current for the selected public/reference API scope, but submission remains blocked by external/final gates:

1. Credentialed live sandbox proof in issue #189.
2. Manual deployed-app Section 508/accessibility evidence in issue #195.
3. Truthful applicant/organization/business information.
4. Final absolute public URL verification.
5. Final 30–60 minute deployed-app rehearsal.
6. Fresh exact-commit CI, Vercel production deployment, alias convergence, and Production Runtime Readiness immediately before submission.

### Current verified production checkpoint

At this package refresh:

- `main`: `193f26030b9b90b81c832c6a645f179717abf307`
- CI #797: success on that exact commit, including real-browser E2E
- Vercel production deployment: `dpl_BwX77rhfw5Bank2oRe3zjgYaykR6` — READY for that exact commit
- canonical production alias: serving that deployment
- Production Runtime Readiness #156: success on the same exact lineage
- production `/va-reference`: HTTP 200 with clearly labeled local fallback because VA access is disabled

This is objective current evidence, not a permanent submission-time guarantee.

## Product description

Secondary Condition Finder is a claim-preparation research and organization tool for Veterans. It helps users distinguish secondary-service-connection and presumptive-service-connection research paths, organize diagnosed/service-connected conditions, review possible secondary conditions to explore, identify evidence gaps, analyze supported documents locally in the browser, and consult bounded public VA administrative reference information.

The application does **not** diagnose medical conditions, determine benefit eligibility, calculate or promise ratings, submit claims, or provide legal representation.

## Primary end users

The initial production use case is intentionally narrow:

- Veterans researching and organizing information for their own VA disability-benefit claim preparation.
- A Veteran may use the output when speaking with a VSO, accredited representative/attorney, or health-care professional.

The initial request does not require authenticated access to an individual Veteran's VA account, claims file, or health records.

## First production use case

A Veteran can:

1. Explore secondary or presumptive claim-preparation concepts using the local knowledge base.
2. Review rationale, evidence gaps, and source references without the app making an eligibility or medical determination.
3. Optionally analyze supported medical-evidence documents locally in the browser without raw document upload to the application server.
4. Search public VA form metadata through the VA Forms Finder.
5. Review standardized public VBA disability terminology and service-branch reference data through Benefits Reference Data.
6. See a separate administrative VA-reference block on Secondary results when a conservative exact/curated terminology mapping exists.
7. Continue to VA or an accredited representative for filing, representation, or official adjudication.

VA reference capabilities are supporting administrative enrichments. The core recommendation, evidence-review, and presumptive workflows remain functional without VA API availability.

## Production APIs requested

### 1. VA Forms API — Open Data

**Requested access:** production API key for the existing public Forms reference/Finder workflow.

**Implemented value:**

- `/va-forms` provides the direct Form 21-526EZ reference surface.
- `/va-forms/finder` accepts bounded public form number/title/keyword search text and displays validated current-record metadata such as title, revision date, page count, PDF validity, and official form link.
- Successful live responses use the shared five-minute reference cache and non-sensitive source/retrieval/cache status.
- Failure or disabled mode degrades to clearly labeled local/reference behavior rather than breaking the product.

**Why necessary:** authoritative machine-readable public form metadata helps reduce the risk of directing users to outdated or invalid form references.

**Data sent:** only public form lookup text needed by the Finder. No Veteran-specific claim payload, diagnosis, rating, service history, PII, or PHI is required.

### 2. Benefits Reference Data API — Open Data

**Requested access:** production API key for the existing public disability/service-branch reference workflows.

**Implemented value:**

- `/va-reference` loads the public `/disabilities` list without user disability-search text; browser filtering occurs after the list is loaded.
- `/va-reference/service-branches` loads standardized service-branch reference values.
- Secondary result cards can display VA/VBA administrative terminology and reference ID after local conservative matching against the already loaded reference list.
- Presumptive intake can store optional standardized service-branch context in the encrypted workflow session.

**Why necessary:** Benefits Reference Data provides standardized VBA administrative terminology that can improve consistency and reduce ambiguity in claim-preparation research.

**Data sent:** the current disability and service-branch list requests require no Veteran-specific input parameters. Secondary condition selections and presumptive branch selections are not sent to VA for matching.

## Administrative-reference guardrail

VA reference data is deliberately separated from medical/evidence decision logic:

- secondary recommendations are computed independently before VA terminology annotation;
- VA terminology does not change evidence strength, recommendation rank, or nexus reasoning;
- terminology matching uses normalized exact names or explicitly curated aliases only, not fuzzy matching;
- `matchPresumptives()` does not consume service-branch reference context;
- a VA reference match is not presented as diagnosis, service connection, eligibility, or rating evidence.

## APIs deliberately not requested

The initial request excludes Benefits Intake, Benefits Claims, Benefits Documents, Veteran health APIs, and other authenticated Veteran-specific APIs. They are not required to demonstrate the first production use case and would add unnecessary authorization/privacy obligations.

## Runtime configuration and credential handling

The server-side contract is documented in `docs/va-api-runtime-configuration.md`.

Safe default: VA network access is disabled.

Environment controls:

- `VA_API_ENV=sandbox|production`
- `VA_API_ENABLED=true` for environment-neutral activation
- `VA_SANDBOX_ENABLED=true` retained only as the backward-compatible Phase 2 sandbox-enable path

Service-specific sandbox credentials:

- `VA_FORMS_SANDBOX_API_KEY`
- `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`

Service-specific production credentials:

- `VA_FORMS_PRODUCTION_API_KEY`
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`

Production mode must remain disabled until VA grants production access. Merely setting `VA_API_ENV=production` does not activate traffic; the explicit enable flag and relevant production service key are also required.

Credentials are stored only in the hosting platform's protected server environment, never in source control, browser-exposed variables, logs, URLs, screenshots, or artifacts. The current production host is Vercel and runtime values are configured in its **Production** environment.

## Data handling summary

### Workflow state

Secondary and presumptive state is stored in short-lived first-party cookies encrypted/authenticated with AES-256-GCM. Cookies are HttpOnly, SameSite=Strict, path-scoped, and expire after 30 minutes. Sensitive workflow values are not propagated through query strings.

### Browser-local evidence analysis

Supported PDF, DOCX, and text evidence processing occurs locally in the browser. Raw selected document bytes/text are not intentionally sent to application server state, URLs, cookies, telemetry, logs, or user accounts. Temporary excerpt objects are tab-scoped.

Current resource ceilings include 20 MB/file, 10 files/batch, 50 MB accepted bytes/batch, 300 PDF pages/source, 500,000 extracted/pasted characters/source, and 10 retained source analyses/browser tab.

### Application logging and VA observations

The current application does not persist workflow/recommendation event history through an application event logger.

VA adapter observations are limited to request ID, service, endpoint path, attempt, outcome/status, and duration. They exclude credentials, query values, response bodies, and workflow selections.

### Reference caching/status

Forms search, disability terminology, and service branches share a bounded five-minute successful-response cache. User-facing status may expose only source label, environment, last successful retrieval time, and cache hit/miss state. Local fallback is not retained as a successful VA cache entry.

## Reliability, rate limiting, and failures

The adapter uses bounded behavior:

- default per-attempt timeout: 4 seconds;
- maximum two attempts per request;
- one retry only for HTTP 429, 503, 504 or transient timeout/network failure;
- invalid payloads fail closed;
- HTTPS-only configurable endpoints;
- upstream failure falls back locally and does not break core intake/recommendation/presumptive flows;
- no background polling or bulk synchronization is implemented.

## Security controls

Current controls include:

- server-only API credentials with service separation;
- encrypted/authenticated workflow cookies;
- privacy-sensitive workflow state excluded from URLs;
- browser-local evidence parsing/resource ceilings;
- source-restrictive production CSP and route-wide security headers;
- read-only active CI permissions and immutable action pins where applicable;
- dependency audit, citation audit, KB validation, lint, typecheck, tests, build, and real-browser E2E in CI;
- exact-commit Vercel status/deployment/alias verification;
- non-sensitive `/runtime-readiness` crypto self-test from trusted CI lineage;
- private vulnerability reporting in `SECURITY.md` and operational response guidance in `docs/security-operations.md`.

The former Azure Static Web Apps path is retained only as manual legacy fallback infrastructure and is not the normal production deployment/readiness signal.

## Public URLs

Canonical deployed root:

- `https://secondary-condition-finder.vercel.app`

Relevant routes:

- `/about`
- `/privacy`
- `/terms`
- `/va-forms`
- `/va-forms/finder`
- `/va-reference`
- `/va-reference/service-branches`

Absolute URLs must be rechecked immediately before submission.

## Business model response

The repository does not define the applicant's current commercial/funding model. The applicant must provide truthful current organization/business information and explicitly confirm whether Veteran data is sold or monetized.

**Do not invent a revenue model** or organization facts for the production-access request.

## Section 508 / accessibility response

Automated/browser regression evidence supports structural accessibility safeguards but is **not a conformance certification**.

Before submission, complete issue #195 against the exact deployed build using synthetic/non-sensitive data, including keyboard-only operation, form/error behavior, NVDA and/or VoiceOver, 200% zoom/reflow, contrast, and forced-colors/high-contrast review. Any material finding must be remediated and retested before making a conformance claim.

## Security, incident response, and vulnerability management

Use `SECURITY.md` and `docs/security-operations.md` as the operating sources. Responses should describe private reporting, minimum/sanitized incident records, containment, credential rotation where needed, reviewed remediation through full CI, exact-commit production recovery verification, and post-incident review. Do not invent a universal notification deadline; obligations depend on applicable facts and agreements.

## Current readiness status

Repository implementation and production runtime lineage are healthy on the current checkpoint. Submission is **not ready** until:

- issue #189 has objective credentialed sandbox success evidence;
- issue #195 has objective manual accessibility evidence;
- applicant/business facts and final public URLs are supplied;
- final deployed-app rehearsal passes; and
- fresh exact-commit production readiness is verified immediately before submission.

Issue #287 remains the external VA production-reference transition gate. Configuration readiness is not the same as granted/verified production API access.
