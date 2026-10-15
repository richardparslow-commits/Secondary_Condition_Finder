# Phase 3 Production Access Submission Checklist

Use this immediately before completing the VA API Platform production-access form. Gather all answers and URLs first; do not submit while any blocking item below is incomplete.

## Blocking submission gate

- [x] Issue #189 is closed with sanitized credentialed sandbox success evidence for VA Forms and Benefits Reference Data.
- [ ] Issue #195 is closed with recorded manual Section 508/accessibility evidence and any material findings remediated/retested.
- [ ] `docs/section508-manual-review-workbook.md` contains build-specific human evidence rather than automated-test substitutes.
- [ ] Truthful applicant/organization/business-model details are supplied.
- [ ] Final public URLs are rechecked against the deployed application.
- [ ] Final deployed-app rehearsal passes `docs/phase3-demo-script.md` with synthetic/non-sensitive data.
- [ ] The exact production `main` commit selected for submission has green repository CI.
- [ ] The same commit has a READY Vercel production deployment serving the canonical production alias.
- [ ] Production Runtime Readiness succeeded from that same successful `main` CI lineage.
- [ ] `SECURITY.md`, `docs/security-operations.md`, `docs/deployment-readiness.md`, and `docs/va-api-runtime-configuration.md` match the final production architecture.

## Historical production checkpoint — not current submission proof

The following repository-recorded checkpoint is historical; resolve and verify the exact final submission build instead of copying these values into current evidence:

- [x] `main` `193f26030b9b90b81c832c6a645f179717abf307` verified.
- [x] CI #797 succeeded on that exact commit, including real-browser E2E.
- [x] Vercel production deployment `dpl_BwX77rhfw5Bank2oRe3zjgYaykR6` is READY on that exact commit.
- [x] Canonical `https://secondary-condition-finder.vercel.app` served that deployment.
- [x] Production Runtime Readiness #156 succeeded on that exact lineage.
- [x] Production `/va-reference` returned HTTP 200 and clearly labeled local fallback while VA access remained disabled.

This checkpoint does not replace the separately recorded #189 sandbox evidence, does not satisfy #195, and is not a production grant or live VA production connectivity check.

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

Do not request Benefits Intake, Benefits Claims, Benefits Documents, Veteran health APIs, or other authenticated Veteran-specific APIs in this package unless a separately reviewed scope change occurs. The read-only `/va-account` sandbox experiment is a separate phase and remains excluded from this production request; see [sandbox account gates](va-account-sandbox.md).

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
- Sandbox GitHub Actions secrets are configured as `VAFORMSSANDBOXAPIKEY` and `VABENEFITSREFERENCESANDBOXAPIKEY`; the workflow maps them to the internal runtime names `VA_FORMS_SANDBOX_API_KEY` and `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`.
- Production keys are separate: `VA_FORMS_PRODUCTION_API_KEY` and `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`.
- Production mode remains disabled until VA grants production access.
- No VA key is stored in source control, exposed through `NEXT_PUBLIC_*`, logged, placed in URLs, or copied into artifacts.
- Vercel **Production** environment settings become active through a new production deployment.
- Research workflow state is browser-local and uses no workflow-session cookie; `/runtime-readiness` non-sensitively verifies only the legacy `WORKFLOW_SESSION_SECRET` crypto-readiness marker. It does not prove VA-account sandbox store configuration.

## PII/PHI and data-handling answer

State only implemented behavior:

- public-reference VA calls require no Veteran-specific PII/PHI;
- Forms Finder sends only public form lookup text;
- `/disabilities` and service-branch list requests require no user-specific matching parameter;
- user disability filtering stays in the browser;
- health/disability/service-history workflow state is kept out of URLs;
- workflow state uses versioned, schema-bounded, tab-scoped browser records; retired workflow cookies are tombstoned if a stale copy is presented;
- optional evidence ingestion is browser-local and raw selected document bytes/text are not intentionally sent to application server state;
- operational workflow/recommendation events include allowlisted action/status/route/count/duration fields and are emitted to platform logs; client error boundaries and optional LangSmith failures use fixed content-free messages; verify deployed trace settings and host retention/access rather than claiming no event logging;
- VA adapter observations omit credentials, query values, response bodies, and workflow selections;
- successful public-reference response views are cached for five minutes, including lookup parameters echoed inside cache values; hashing keys does not anonymize those values;
- shared reference status exposes only source/environment/retrieval/cache state.

## Reliability and rate-limit answer

- [ ] State default 4-second per-attempt timeout.
- [ ] State at most three attempts for public-reference network/timeout and HTTP 503/504 failures, with bounded backoff/jitter.
- [ ] State that HTTP 429/500 returns fallback without an immediate retry, and state the single exception: an upstream that explicitly authorizes retrying at once (Retry-After of 0, or an already-past HTTP-date) is retried once in the same request after the minimum backoff delay. Do not claim faithful fleet Retry-After handling until the audited circuit/coordination defects are repaired.
- [ ] Identify the separate read-only sandbox account transport: one bounded attempt, no background polling, no account-data fallback.
- [ ] State invalid payloads fail closed.
- [ ] State no background polling/bulk synchronization is implemented.
- [ ] Explain shared five-minute successful-response caching.
- [ ] Explain local fallback after bounded failure.

## Security safeguards answer

Include:

- HTTPS-only VA endpoints;
- service-specific server-only credentials;
- versioned, schema-bounded, tab-scoped browser workflow records; retired workflow cookies are tombstoned if stale copies are presented;
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

**Automated corroboration behind the manual review (updated 2026-10-15).** The evidence that supports the #195 session — and that must not be used in place of it — is now broader than it was, because the real-browser gate `e2e/a11y-contrast.mjs` runs axe's `color-contrast` rule **and** WCAG 1.4.1 `link-in-text-block` across all 26 shipped routes, with the blocking bar unchanged at critical/serious, and because that second rule's first run found and closed a real Level A defect: links inside text blocks were distinguished by colour alone on `/secondary` (2.66:1 against the surrounding text) and `/privacy/request` (1.12:1 against the paragraph one of them sits in, 2.66:1 for another). A local real-browser sweep over the same routes additionally remediated three findings machine-checkable outside jsdom — the layout cross-link strip sitting outside any landmark (`region`), two unnamed `aside` landmarks per two-column step (`landmark-unique`), and `aria-label` on the workflow-progress `div`, where the generic role prohibits it and the label reached nobody (`aria-prohibited-attr`). Measured both ways: with the fixes the gate exits 0 (26/26 routes, 0 axe violations each), and removing only the stylesheet rule makes it exit 1 on `/secondary` with `[serious] link-in-text-block`; the full suite passes 380 files / 3722 tests.

**This does not tick the Section 508 line, and no box above changes because of it.** Every item under this heading still requires the identified-build human session: keyboard-only operation, NVDA/VoiceOver, real 200% zoom/reflow, a real Windows forced-colours/high-contrast session, and the interaction-dependent states automation cannot reach. Issue #195 remains open, its workbook rows all remain `NOT TESTED`, and no tester, session date or sign-off exists. What has changed is only that a human tester now starts from a build where the automated half of the matrix is clean, corroborated in a browser rather than asserted from source.

Before answering VA's accessibility question:

- [ ] Complete issue #195 against the exact deployed Vercel build using synthetic/non-sensitive data.
- [ ] Record the session identity and every required result in `docs/section508-manual-review-workbook.md`.
- [ ] Record keyboard-only operation, form/error behavior, NVDA, VoiceOver, 200% zoom/reflow, contrast, and forced-colors/high-contrast evidence.
- [ ] Include the evidence-upload/review workflow using synthetic PDF, DOCX, and text documents only.
- [ ] Cover `/va-forms/finder` and `/va-reference/service-branches` in addition to the core route/workflow matrix.
- [ ] Remediate and retest material findings against an identified build.
- [ ] Update `docs/accessibility-audit.md` from the completed human evidence.
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
- [x] #189 is closed only with objective sanitized credentialed evidence.
- [ ] #195 is closed only with objective manual accessibility evidence recorded in the workbook.
- [ ] Issue #287 remains open until VA production access is granted and live production connectivity is verified.
- [ ] No unsupported business, accessibility, security-certification, regulatory-compliance, or production-access claim is included.
