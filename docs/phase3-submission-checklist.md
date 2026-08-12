# Phase 3 Production Access Submission Checklist

Use this checklist immediately before completing the VA API Platform production-access form. The production form does not preserve progress, so gather every answer and URL before starting.

## Submission gate

Do not submit until all blocking items are complete.

- [x] Issue #189 is closed with non-sensitive credentialed sandbox smoke-test evidence for VA Forms and Benefits Reference Data.
- [ ] Production `WORKFLOW_SESSION_SECRET` is verified in Azure application settings.
- [ ] Latest `main` CI is green.
- [ ] Latest Azure deployment for the same `main` commit is green.
- [ ] Final deployed-app demo rehearsal passes `docs/phase3-demo-script.md`.
- [ ] Issue #195 is closed with recorded manual Section 508 accessibility evidence and any material findings remediated/retested.
- [ ] Final accessibility/Section 508 evidence is reviewed and the form answer is supportable.

## Applicant and organization information

Prepare the truthful current values for:

- [ ] US-based applicant/company confirmation.
- [ ] Company/organization legal name.
- [ ] Primary technical contact.
- [ ] Primary business/product contact.
- [ ] Notification email for API status updates.
- [ ] Current business/operating model and how the service is funded.
- [ ] Explicit confirmation that Veteran data is not sold or monetized.

Do not infer or invent an organization, revenue model, or compliance status from repository code.

## Application information

- [ ] Application name: Secondary Condition Finder.
- [ ] Public product URL.
- [ ] Public `/about` URL.
- [ ] Public `/privacy` URL.
- [ ] Public `/terms` URL.
- [ ] Brief app description derived from `docs/phase3-production-access-package.md`.
- [ ] Primary users: Veterans researching and organizing their own VA disability-benefit claim preparation.
- [ ] Compatible browsers/devices confirmed from the deployed application and testing evidence.
- [ ] Veteran value statement prepared.

## APIs requested

Request only:

- [ ] Benefits Reference Data API — Open Data.
- [ ] VA Forms API — Open Data.

Do not request in this initial package unless a separately approved scope change occurs:

- Benefits Intake API
- Benefits Claims API
- Benefits Documents API
- Veteran health APIs
- other authenticated Veteran-specific APIs

## Per-API justification

### VA Forms API

- [ ] Explain the existing `/va-forms` 21-526EZ metadata use case.
- [ ] Explain how revision/PDF metadata improves form-reference accuracy.
- [ ] State that no Veteran-specific PII/PHI or claim payload is required.
- [ ] Explain local fallback behavior when the API is unavailable.

### Benefits Reference Data API

- [ ] Explain the existing `/va-reference` disability-terminology use case.
- [ ] State that the current `/disabilities` request is made without user search input.
- [ ] Explain that filtering is client-side.
- [ ] Explain the local-catalog fallback and its explicit non-official labeling.

## Credential storage answer

Prepare a concise description covering:

- server-only protected application settings;
- no API keys in source control;
- no `NEXT_PUBLIC_*` API credentials;
- sandbox/production credential separation;
- no credential logging;
- rotation on exposure/incident and according to VA/hosting requirements.

## PII/PHI and data handling answer

State only behavior that is currently implemented and verified:

- public-reference VA API calls do not require Veteran-specific PII/PHI;
- user disability filtering on `/va-reference` remains client-side;
- health/disability and service-history workflow state is kept out of URLs;
- workflow state uses short-lived encrypted/authenticated cookies;
- recommendation event persistence is aggregate-only;
- VA adapter observations omit credentials, query values, response bodies, and workflow selections;
- no VA public-reference response body is intentionally persisted;
- optional medical-evidence ingestion is browser-local; raw document bytes/text are not sent to application server state, URLs, telemetry, logs, or user accounts.

## Security safeguards answer

Include:

- HTTPS-only VA endpoints;
- encrypted/authenticated workflow cookies;
- browser security headers;
- dependency audit and full CI gate;
- bounded retries and timeouts;
- payload validation and fail-closed fallback;
- pinned Azure deployment action;
- production deployment verification on the exact `main` commit.

## Unauthorized or duplicate request safeguards

Explain:

- feature flag defaults VA integration off;
- no automatic background polling is implemented;
- requests are initiated only by rendering the bounded reference features;
- at most two attempts are allowed per request;
- retries occur only for defined transient failures;
- invalid payloads do not trigger uncontrolled repeated requests.

## Breach/incident response answer

Prepare the operating sequence:

1. revoke/rotate affected credentials;
2. disable the affected integration or contain the deployment;
3. preserve non-sensitive diagnostic evidence;
4. patch through the normal review and full CI gate;
5. redeploy and verify the exact production commit;
6. notify VA and affected parties if required by policy, contract, or law.

## Vulnerability and patch management answer

- [ ] Describe high-severity dependency auditing in CI.
- [ ] Describe lint/typecheck/test/build gating.
- [ ] Describe security fixes through reviewed PRs.
- [ ] Describe post-merge production deployment verification.

## Rate-limit answer

- [ ] State that the implementation is designed around VA's published standard limit.
- [ ] State that HTTP 429 receives at most one retry before local fallback.
- [ ] State the maximum two-attempt request behavior.
- [ ] State that no background polling or bulk synchronization is part of the initial use case.

## Accessibility / Section 508

Automated preflight now enforces structural headings/landmarks, a keyboard skip link, visible-focus CSS, reflow safeguards, reduced-motion handling, and a forced-colors ruleset. These are positive regression evidence, not a conformance determination.

Before answering the form:

- [x] Review and strengthen `docs/accessibility-audit.md` and current regression tests.
- [ ] Complete issue #195 against the exact deployed production build, using synthetic/non-sensitive data only.
- [ ] Confirm the skip link, keyboard order, focus visibility, and absence of keyboard traps in a real browser.
- [ ] Record tester/date/OS/browser/assistive-technology evidence for keyboard, screen-reader, zoom/reflow, contrast, and forced-colors checks.
- [ ] Include the Priority 1/1B evidence-upload/review workflow in the manual review using synthetic documents only.
- [ ] Record any known limitations and remediation/retest links.
- [ ] Answer VA's compliance question based on objective current evidence, not project intent or automated tests alone.

## Demo package

- [ ] Presenter has `docs/phase3-demo-script.md`.
- [ ] Demo uses non-sensitive synthetic/sample data only.
- [ ] No API key can appear in screen sharing, terminal output, browser developer tools, or artifacts.
- [ ] Both local fallback and API-backed source labeling can be explained.
- [ ] Presenter can explain why only the two open-data APIs are requested.
- [ ] Presenter can explain why authenticated Veteran-specific APIs are deferred.

## Final review

- [ ] Product description matches `/about`.
- [ ] Data-handling statements match `/privacy` and actual implementation.
- [ ] Legal/medical scope matches `/terms`.
- [ ] API list matches implemented routes and `docs/va-api-access-strategy.md`.
- [x] Credentialed sandbox validation is complete and issue #189 is closed.
- [ ] No claim is made that Section 508 conformance is complete unless issue #195 is closed with objective evidence.
- [ ] No unsupported business, accessibility, security-certification, or regulatory-compliance claim is included.
