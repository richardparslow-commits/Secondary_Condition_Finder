# Phase 2 Completion Audit

## Audit objective

Determine whether repository implementation for the selected low-sensitivity VA public/reference integrations is complete and identify the remaining external proof required before Phase 2 can be called complete.

## Executive result

**Repository implementation status: PASS.**

**Phase 2 external completion status: PENDING ONE EXTERNAL GATE.**

The repository has the required adapter architecture, service-specific credentials, environment controls, bounded retries/timeouts, payload validation, privacy-safe observations, shared reference caching/status, local fallback behavior, user-facing reference surfaces, CI coverage, Vercel production deployment, and exact-commit runtime-readiness verification.

The remaining gate is not a code defect: there is still no recorded credentialed run of the dedicated VA sandbox smoke workflow. Phase 2 therefore remains **code-complete / externally pending** until issue #189 contains sanitized successful live sandbox evidence for both selected API services.

## Current implementation evidence

### 1. Credential and environment model

`src/lib/va/sandbox.ts` and `docs/va-api-runtime-configuration.md` define the current contract:

- safe default is disabled/no network request;
- `VA_API_ENV=sandbox|production` selects the intended upstream environment;
- `VA_API_ENABLED=true` is the explicit environment-neutral enable flag;
- `VA_SANDBOX_ENABLED=true` remains a backward-compatible sandbox-only enable path for the Phase 2 gate;
- VA Forms and Benefits Reference Data use separate server-only credentials.

Sandbox credentials:

The GitHub Actions repository secrets are configured as `VAFORMSSANDBOXAPIKEY` and `VABENEFITSREFERENCESANDBOXAPIKEY`; the smoke workflow maps them into these internal environment variable names before execution.

Production credentials, which must remain unused until VA grants access:

- `VA_FORMS_PRODUCTION_API_KEY`
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`

No credential may be committed, logged, placed in a URL, or exposed through `NEXT_PUBLIC_*`.

### 2. Selected API integrations

**VA Forms API**

- `/va-forms` provides the bounded Form 21-526EZ reference surface.
- `/va-forms/finder` provides searchable public form metadata.
- Successful responses are validated, filtered to current records where appropriate, cached for five minutes, and accompanied by non-sensitive source/retrieval/cache status.
- Failure or disabled mode falls back locally.

**Benefits Reference Data API**

- `/va-reference` loads the public `/disabilities` list without user condition/search parameters; filtering is browser-local.
- `/va-reference/service-branches` loads the public service-branch reference list with local fallback.
- Secondary recommendation cards may show a conservative VA administrative terminology annotation after the reference list is loaded; condition selections are not sent to VA for matching.
- Presumptive intake may retain optional standardized branch context in the encrypted workflow session; presumptive matching does not read that value.

These administrative reference values do not participate in medical/evidence recommendation scoring or presumptive eligibility logic.

### 3. Reliability and privacy behavior

The adapter provides:

- HTTPS-only endpoints;
- request IDs;
- service/path/attempt/status-or-outcome/duration observations only;
- no credential, query-value, response-body, or workflow-selection logging;
- one bounded retry for HTTP 429/503/504;
- one bounded retry for transient timeout/network failure;
- configurable per-attempt timeout with a 4-second default;
- schema validation before successful responses are accepted;
- local fallback instead of propagating upstream failure into the core product.

Forms search, disability terminology, and service-branch loaders share a bounded five-minute successful-response cache. Local fallback is not treated as a successful VA cache entry.

### 4. Product isolation

Repository regression coverage enforces that:

- `recommend()` does not receive VA reference values;
- `matchPresumptives()` does not consume service-branch reference context;
- user disability-filter text remains client-side and out of VA requests/URLs;
- the secondary and presumptive workflows continue to operate when VA access is disabled.

## Current objective validation checkpoint

The current production checkpoint recorded by this audit refresh is:

- `main`: `193f26030b9b90b81c832c6a645f179717abf307`
- main CI #797: success, including dependency audit, citation audit, KB validation, lint, typecheck, tests, build, and real-browser E2E
- Vercel production deployment `dpl_BwX77rhfw5Bank2oRe3zjgYaykR6`: READY on that exact commit and serving the canonical production alias
- Production Runtime Readiness #156: success on that exact commit/deployment lineage
- production VA reference surface: HTTP 200 with explicit local fallback while VA access remains disabled

This proves repository and production integration behavior. It does **not** prove credentialed VA sandbox connectivity.

## Final Phase 2 external gate

Workflow **VA Sandbox Smoke Test** (`.github/workflows/va-sandbox-smoke.yml`, workflow ID `332298000`) is manual-only. It previously had no recorded runs; it now has one successful credentialed run on `main` after the workflow was corrected to read the configured secret names.

Current sanitized Phase 2 sandbox evidence:

- VA Forms: HTTP 200; request ID `4e806cfd-36e6-4aea-b3b8-8765f2f9a828`; validated result count 1.
- Benefits Reference Data: HTTP 200; request ID `1785c029-bb9b-4384-bd3f-b61d41f363dd`; validated result count 9.
- Workflow run: [33997305230](https://github.com/richardparslow-commits/Secondary_Condition_Finder/actions/runs/33997305230)
- No API key or raw response payload was retained.

Phase 2 therefore moved from **code-complete / externally pending** to **complete** for the VA sandbox verification portion of the package.

## Phase 3 readiness conclusion

The repository is ready for Phase 3 package maintenance and demo preparation. Submission remains gated on:

- manual Section 508/accessibility evidence (#195);
- truthful applicant/business details;
- fresh exact-commit Vercel production/readiness evidence at submission time; and
- final deployed-app demo rehearsal.

Credentialed sandbox verification is no longer a pending gate.
