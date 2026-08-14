# Phase 3 Production Access Submission Checklist

Use this immediately before completing the VA API Platform production-access form. Gather all answers and URLs first; do not submit while any blocking item below is incomplete.

## Blocking submission gate

- [ ] Issue #189 is closed with sanitized credentialed sandbox success evidence for VA Forms and Benefits Reference Data.
- [ ] Issue #195 is closed with recorded manual Section 508/accessibility evidence and any material findings remediated/retested.
- [ ] Truthful applicant/organization/business-model details are supplied.
- [ ] Final public URLs are rechecked against the deployed application.
- [ ] Final deployed-app rehearsal passes `docs/phase3-demo-script.md` with synthetic/non-sensitive data.
- [ ] The exact production `main` commit selected for submission has green repository CI.
- [ ] The same commit has a READY Vercel production deployment serving the canonical production alias.
- [ ] Production Runtime Readiness succeeded from that same successful `main` CI lineage.
- [ ] `SECURITY.md`, `docs/security-operations.md`, `docs/deployment-readiness.md`, and `docs/va-api-runtime-configuration.md` match the final production architecture.

## Current verified production checkpoint

The repository has a current objective checkpoint, but these checks must be repeated for the final submission commit:

- [x] `main` `193f26030b9b90b81c832c6a645f179717abf307` verified.
- [x] CI #797 succeeded on that exact commit, including real-browser E2E.
- [x] Vercel production deployment `dpl_BwX77rhfw5Bank2oRe3zjgYaykR6` is READY on that exact commit.
- [x] Canonical `https://secondary-condition-finder.vercel.app` served that deployment.
- [x] Production Runtime Readiness #156 succeeded on that exact lineage.
- [x] Production `/va-reference` returned HTTP 200 and clearly labeled local fallback while VA access remained disabled.

This checkpoint does not satisfy #189, #195, or future submission-time freshness by itself.

## Applicant and organization information

Prepare truthful values for:

- [ ] US-based applicant/company confirmation, if required by the form.
- [ ] Company/organization legal name.
- [ ] Primary technical contact.
- [ ] Primary business/product contact.
- [ ] Notification email.
- [ ] Current operating/funding/business model.
- [ ] Explicit truthful statement about whether Veteran data is sold or monetized.

Do not infer or invent organization, revenue, compliance, or certification facts from repository code.

## Application information

- [ ] Application name: Secondary Condition Finder.
- [ ] Public product URL.
- [ ] Public `/about` URL.
- [ ] Public `/privacy` URL.
- [ ] Public `/terms` URL.
- [ ] Brief app description derived from `docs/phase3-production-access-package.md`.
- [ ] Primary users identified as Veterans researching/organizing their own disability-benefit claim preparation.
- [ ] Compatible browsers/devices supported by current deployed testing evidence.
- [ ] Veteran value statement prepared.

## APIs requested

Request only:

- [ ] VA Forms API — Open Data.
- [ ] Benefits Reference Data API — Open Data.

Do not request Benefits Intake, Benefits Claims, Benefits Documents, Veteran health APIs, or other authenticated Veteran-specific APIs in this package unless a separately reviewed scope change occurs.

## VA Forms justification

- [ ] Explain `/va-forms` plus searchable `/va-forms/finder`.
- [ ] Explain public form number/title/keyword search and validated revision/page/PDF/link metadata.
- [ ] State that no Veteran-specific claim, diagnosis, rating, service-history, PII, or PHI is required.
- [ ] Explain five-minute successful-response caching and explicit source/retrieval/cache status.
- [ ] Explain safe local/reference fallback when VA access is disabled or unavailable.

## Benefits Reference Data justification

- [ ] Explain `/va-reference` `/disabilities` use without user search parameters.
- [ ] Explain that disability filtering is browser-local after the list is loaded.
- [ ] Explain `/va-reference/service-branches` as standardized administrative reference data.
- [ ] Explain per-result Secondary VA reference blocks as administrative annotations only.
- [ ] State that selected Secondary condition names are not sent to VA for matching.
- [ ] State that optional presumptive service-branch context is not used by `matchPresumptives()`.
- [ ] Explain explicit local fallback/non-official labeling.

## Algorithm-isolation answer

Be ready to state clearly:

- VA reference terminology does not change recommendation rank, evidence score, nexus reasoning, or clinical support.
- Secondary recommendations are computed independently before VA terminology annotation.
- VA terminology matching is normalized exact-name or explicitly curated alias matching only; no fuzzy matching is used.
- Service-branch reference context does not affect presumptive matching.
- A VA administrative term/reference ID does not establish diagnosis, service connection, eligibility, or rating.

## Credential storage and runtime answer

Describe the current server-only model:

- `VA_API_ENV=sandbox|production` selects the intended upstream environment.
- `VA_API_ENABLED=true` is the explicit environment-neutral activation flag.
- `VA_SANDBOX_ENABLED=true` remains the backward-compatible Phase 2 sandbox gate.
- Sandbox keys are separate: `VA_FORMS_SANDBOX_API_KEY` and `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`.
- Production keys are separate: `VA_FORMS_PRODUCTION_API_KEY` and `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`.
- Production mode remains disabled until VA grants production access.
- No VA key is stored in source control, exposed through `NEXT_PUBLIC_*`, logged, placed in URLs, or copied into artifacts.
- Vercel **Production** environment settings become active through a new production deployment.
- Workflow-session security uses server-only `WORKFLOW_SESSION_SECRET` and is verified through non-sensitive `/runtime-readiness`, not by exposing the secret.

## PII/PHI and data-handling answer

State only implemented behavior:

- public-reference VA calls require no Veteran-specific PII/PHI;
- Forms Finder sends only public form lookup text;
- `/disabilities` and service-branch list requests require no user-specific matching parameter;
- user disability filtering stays in the browser;
- health/disability/service-history workflow state is kept out of URLs;
- workflow state uses short-lived encrypted/authenticated cookies;
- optional evidence ingestion is browser-local and raw selected document bytes/text are not intentionally sent to application server state;
- the current application does not persist workflow/recommendation event history through an application event logger;
- VA adapter observations omit credentials, query values, response bodies, and workflow selections;
- VA public-reference response bodies are not intentionally persisted;
- shared reference status exposes only source/environment/retrieval/cache state.

## Reliability and rate-limit answer

- [ ] State default 4-second per-attempt timeout.
- [ ] State maximum two attempts.
- [ ] State one retry only for HTTP 429/503/504 or transient timeout/network failure.
- [ ] State invalid payloads fail closed.
- [ ] State no background polling/bulk synchronization is implemented.
- [ ] Explain shared five-minute successful-response caching.
- [ ] Explain local fallback after bounded failure.

## Security safeguards answer

Include:

- HTTPS-only VA endpoints;
- service-specific server-only credentials;
- encrypted/authenticated workflow cookies;
- privacy-sensitive state excluded from URLs;
- source-restrictive production CSP and route-wide security headers;
- read-only active CI permissions and immutable action pins where applicable;
- dependency audit plus full lint/typecheck/test/build/browser gate;
- browser-local evidence resource ceilings;
- exact-commit Vercel deployment-status verification and canonical-alias convergence;
- non-sensitive runtime crypto verification through `/runtime-readiness`;
- private vulnerability reporting and operational incident handling.

## Accessibility / Section 508

Automated/browser regression safeguards are positive evidence but are not a conformance determination.

Before answering VA's accessibility question:

- [ ] Complete issue #195 against the exact deployed Vercel build using synthetic/non-sensitive data.
- [ ] Record keyboard-only operation, form/error behavior, screen-reader review, 200% zoom/reflow, contrast, and forced-colors/high-contrast evidence.
- [ ] Include the evidence-upload/review workflow using synthetic documents only.
- [ ] Remediate and retest material findings.
- [ ] Answer only from the completed evidence record.

## Demo package

- [ ] Presenter has `docs/phase3-demo-script.md`.
- [ ] Demo uses synthetic/sample data only.
- [ ] No API key appears in screen sharing, developer tools, terminal output, logs, screenshots, or artifacts.
- [ ] Presenter can explain source/environment/cache status and local fallback.
- [ ] Presenter can explain the per-result VA reference block and why it does not affect recommendation scoring.
- [ ] Presenter can explain structured service-branch context and why it does not affect presumptive matching.
- [ ] Presenter can explain why only VA Forms and Benefits Reference Data are requested.
- [ ] Presenter can explain why authenticated Veteran-specific APIs are deferred.

## Final review

- [ ] Product description matches `/about` and actual product behavior.
- [ ] Data-handling statements match `/privacy` and actual implementation.
- [ ] Legal/medical scope matches `/terms`.
- [ ] API scope matches `docs/va-api-access-strategy.md` and current implemented routes.
- [ ] Runtime/credential description matches `docs/va-api-runtime-configuration.md`.
- [ ] #189 is closed only with objective sanitized credentialed evidence.
- [ ] #195 is closed only with objective manual accessibility evidence.
- [ ] Issue #287 remains open until VA production access is granted and live production connectivity is verified.
- [ ] No unsupported business, accessibility, security-certification, regulatory-compliance, or production-access claim is included.
