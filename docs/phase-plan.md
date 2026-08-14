# Secondary Condition Finder Phase Plan

## Purpose

This plan defines a narrow, defensible delivery path that proves product value without requiring sensitive live VA data up front. The core product remains usable without VA API availability, and external gates are not treated as complete until objective evidence exists.

## Product guardrails

- The tool supports claim-preparation research and organization only.
- It does **not** diagnose conditions, determine eligibility, promise ratings, or provide legal representation.
- Recommendations are possibilities to explore and must retain rationale, evidence-gap prompts, source provenance, and conservative language.
- VA administrative reference data is not medical evidence and does not influence recommendation strength or presumptive matching.
- Health/disability workflow state and service-history state must not be propagated through URLs.
- Credentials remain server-only and are never exposed through `NEXT_PUBLIC_*` variables.

---

## Phase 1: MVP & Core Evaluation Engine

### Core deliverables

- [x] Secondary track under 38 CFR §3.310 with ranked exploration recommendations, rationale, evidence gaps, and citations.
- [x] Presumptive track under 38 CFR §§3.307/3.309 with sourced criteria for Agent Orange and PACT Act airborne-hazard/burn-pit paths.
- [x] Version-controlled local condition catalog and knowledge-base mappings.
- [x] Public `/privacy`, `/terms`, and `/about` routes.
- [x] Privacy-hardened secondary and presumptive workflows using short-lived encrypted/authenticated cookies rather than URL-carried health/service-history state.
- [x] Browser-local evidence ingestion/review for supported documents with explicit resource ceilings and no raw document upload endpoint.

### Phase 1 validation status

- [x] Core workflows are independent of VA API availability.
- [x] Catalog/knowledge-base structure and citation publication safeguards are enforced in CI.
- [x] Real-browser workflow coverage is part of the final CI gate.

---

## Phase 2: VA Public-Reference Integration

### Scope

Use only lower-sensitivity public/reference VA APIs behind a dedicated server adapter. Keep the core recommendation and presumptive algorithms independent from upstream VA availability.

### Current implementation

- [~] VA developer sandbox account/credential process is documented; live credentialed proof remains externally pending in issue #189.
- [x] Environment-aware adapter in `src/lib/va/sandbox.ts` supports disabled, sandbox, and production-target configuration while failing closed by default.
- [x] Service-specific server credentials are separated for VA Forms and Benefits Reference Data.
- [x] VA Forms Finder supports bounded public form search with validated metadata, five-minute successful-response caching, status/provenance reporting, and local fallback.
- [x] Benefits Reference Data supports disability terminology and service-branch reference surfaces with shared bounded caching/status reporting and local fallback.
- [x] Secondary results can display conservative per-result VA administrative terminology blocks without feeding those values into `recommend()`.
- [x] Presumptive intake can store optional standardized service-branch context in the encrypted workflow session; `matchPresumptives()` does not read it.
- [x] Request IDs, timeout/retry rules, payload validation, HTTPS enforcement, and privacy-safe observations are implemented.

### Runtime configuration

See `docs/va-api-runtime-configuration.md`.

Safe default: no VA network traffic. `VA_API_ENV` selects `sandbox` or `production`; `VA_API_ENABLED=true` is the explicit environment-neutral enable flag. `VA_SANDBOX_ENABLED=true` remains a backward-compatible sandbox gate for issue #189. Forms and Benefits Reference Data use separate sandbox and production keys.

### Phase 2 completion gate

Current status: **code-complete / externally pending**.

Workflow **VA Sandbox Smoke Test** (workflow ID `332298000`) still has **zero recorded runs** as of the current checkpoint. Issue #189 must remain open until the dedicated manual workflow records sanitized successful live sandbox evidence for both VA Forms and Benefits Reference Data using issued server-only credentials.

Local fallback pages, CI mocks, Vercel deployment success, or production-readiness success do **not** satisfy that credentialed gate.

---

## Phase 3: Production-Access Readiness

### Scope

Prepare a narrow VA production-access request for only the public/reference capabilities already implemented and demonstrate privacy, security, reliability, accessibility awareness, and responsible credential handling.

### Repository deliverables

- [x] Public product description, privacy, and terms routes.
- [x] End-user and first-production-use-case definition.
- [x] Minimal production-access package in `docs/phase3-production-access-package.md`.
- [x] 30–60 minute review script in `docs/phase3-demo-script.md`.
- [x] Submission checklist in `docs/phase3-submission-checklist.md`.
- [x] Current VA runtime configuration contract in `docs/va-api-runtime-configuration.md`.
- [x] Current Vercel production deployment/runbook in `docs/deployment-readiness.md`.

### Current verified production checkpoint

The latest internal production checkpoint recorded during this plan refresh is:

- `main`: `193f26030b9b90b81c832c6a645f179717abf307`
- CI #797: success on that exact commit, including real-browser E2E
- Vercel production deployment: `dpl_BwX77rhfw5Bank2oRe3zjgYaykR6` — READY for that exact commit and serving the canonical alias
- Production Runtime Readiness #156: success on that exact CI/deployment lineage
- Production `/va-reference`: HTTP 200 and explicitly labeled local fallback while VA access remains disabled

This is objective current evidence, not a permanent submission-time guarantee. The final production-access submission must re-run the freshness checks against whatever commit is actually serving production at that time.

### Phase 3 external/final gates

- [ ] Credentialed live VA sandbox smoke test recorded and issue #189 closed from objective evidence.
- [ ] Manual deployed-app Section 508/accessibility review completed and issue #195 closed after any required remediation/retest.
- [ ] Truthful applicant/organization/business-model details supplied by the applicant.
- [ ] Final absolute public URLs rechecked.
- [ ] Final 30–60 minute demo rehearsal completed without blockers using synthetic/non-sensitive data.
- [ ] Fresh exact-commit CI, Vercel deployment, alias convergence, and Production Runtime Readiness verified immediately before submission.

Issue #287 tracks the eventual VA public-reference production transition. Production mode must remain disabled until VA production access is granted, production credentials are installed server-side, and live production connectivity is objectively verified.

---

## Execution order

1. Finalize V1 specification/schema — **complete**.
2. Build responsive intake/results experience — **complete**.
3. Expand the condition knowledge base under citation/publication governance — **ongoing**.
4. Maintain privacy-safe operational and evidence-handling boundaries — **complete for current scope**.
5. Implement VA public-reference adapters and product surfaces — **repository implementation complete; #189 external sandbox proof pending**.
6. Prepare and maintain the Phase 3 production-access package — **current architecture refresh complete in repository; final external/freshness fields remain pending**.
7. Submit the minimum-necessary production-access request — **not started; gated by the Phase 3 submission checklist**.

## Validation gate before production request

- [x] Core evaluation logic passes repository CI.
- [x] Public privacy, terms, and product-scope routes are deployed.
- [x] Catalog/knowledge-base validation and citation audits are part of CI.
- [x] Privacy-sensitive workflow state is excluded from URLs.
- [x] VA public-reference integrations are isolated from medical/evidence and presumptive decision logic.
- [x] Production deployment has exact-commit Vercel lineage verification and a non-sensitive runtime crypto readiness gate.
- [x] Phase 3 production-access package, demo script, and submission checklist are assembled.
- [ ] Credentialed live VA sandbox smoke test recorded for both selected API services (#189).
- [ ] Manual Section 508/accessibility evidence completed (#195).
- [ ] Truthful applicant/business information supplied.
- [ ] Final demo rehearsal completed.
- [ ] Fresh production exact-commit readiness rechecked immediately before submission.
