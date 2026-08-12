# Secondary Condition Finder Phase Plan

## Purpose

This plan defines a narrow, defensible delivery path that proves product value without requiring sensitive live VA data up front. It is organized into three phases so the team can build a working product, validate usefulness, and then pursue only the minimum required production API access.

Phase-level evidence and completion status are tracked through dedicated gate artifacts, including `docs/phase2-completion-audit.md` for the VA sandbox phase.

## Product Guardrails (applies to all phases)

- The tool supports claim-preparation research and organization only.
- The tool does **not** diagnose conditions or provide legal advice.
- Outputs are framed as possible conditions or references to explore, not determinations.
- Recommendations must include rationale and evidence-gap prompts.
- Data handling must follow least-privilege and minimum-necessary principles.
- Health/disability workflow state and service-history state must not be propagated through URLs.

---

## Phase 1: MVP & Core Evaluation Engine

### Core Deliverables

- [x] **Secondary Track (38 CFR 3.310):** Given service-connected conditions, returns ranked secondary-condition exploration recommendations with reasoning, evidence gaps, and citations.
- [x] **Presumptive Track (38 CFR 3.307 / 3.309):** Sourced criteria for Agent Orange and PACT Act airborne hazards/burn pits.
- [x] **Offline Data Model:** Version-controlled condition catalog and local JSON knowledge-base mappings.
- [x] **Public Legal Routes:** Dedicated `/privacy` and `/terms` pages aligned to current application behavior and scope limitations.
- [x] **Privacy-Hardened Workflows:** Secondary health/disability state and presumptive service history are kept out of URLs and stored only in short-lived encrypted/authenticated workflow cookies.

### Phase 1 Validation Gate Status

- [x] **Clear user problem:** Claim-preparation research aid distinguishing 38 CFR 3.310 (secondary) from 38 CFR 3.307/3.309 (presumptive).
- [x] **No live-data dependency:** Core secondary and presumptive workflows operate independently of VA API availability.
- [x] **Demo readiness:** Repeatable walkthroughs/scenarios and route-level regression coverage are maintained by the automated test suite.
- [x] **Public privacy/terms/scope publication:** Live dedicated routes at `/privacy` and `/terms`.
- [x] **Transparent coverage state:** 193 catalog conditions and 193 version-controlled knowledge-base files are validated; draft mappings remain excluded from recommendation output until publication requirements are satisfied.
- [x] **Citation governance:** Citation audits enforce hard publication safeguards while preserving explicit verified/unverified status rather than automatically promoting sources to verified.

---

## Phase 2: Sandbox VA API Integration

### Scope

- Add VA API integration in a dedicated adapter layer using sandbox access only.
- Keep the core recommendation engine decoupled from external API dependencies.
- Prove workflow value while limiting privacy and authorization complexity.

### Deliverables

- [~] **VA developer account setup and sandbox API key management process.** Repository process and secret-handling rules are documented. Credentialed live sandbox verification remains externally pending in issue #189.
- [x] **API connector layer with environment-based configuration.** Implemented in `src/lib/va/sandbox.ts`.
- [x] **Initial high-value, lower-sensitivity integrations.** VA Forms and Benefits Reference Data public/reference demonstrations are implemented.
- [x] **Request observability, error handling, and retry strategy.** Request IDs, status/outcome categories, bounded retries, timeout/network handling, payload validation, and local fallback are implemented without logging credentials or user payloads.
- [x] **Internal sandbox scenarios and known limitations.** Documented in `docs/phase2-sandbox-integration.md` and `docs/deployment-readiness.md`, with regression coverage.

### User-Facing Phase 2 Demonstrations

- [x] `/va-forms` — bounded VA Form 21-526EZ reference with validated sandbox metadata when enabled and explicit local fallback otherwise.
- [x] `/va-reference` — Benefits Reference Data disability-term explorer. The server retrieves the public reference list without user search parameters; filtering is client-side and not written to URLs or sent back to VA.

### Acceptance Criteria

- [~] **App can call selected sandbox APIs successfully from the integration layer.** Request construction/success behavior is covered by automated HTTP tests. Credentialed live VA sandbox proof is still required in issue #189.
- [x] **API failures degrade gracefully without breaking core intake/exploration flow.** Sandbox-dependent views fall back locally; core secondary/presumptive flows are independent.
- [x] **Logs provide enough detail to support troubleshooting and demo explanations.** Observations contain service/path/request ID/attempt/status-or-outcome/duration only.
- [x] **Sandbox-dependent features can be toggled off without affecting baseline V1.** `VA_SANDBOX_ENABLED` defaults to disabled, and tests assert disabled mode performs no network call.

### Phase 2 Completion Gate

See `docs/phase2-completion-audit.md`.

Current status: **code-complete / externally pending**. As of the latest objective check, VA Sandbox Smoke Test workflow ID `332298000` has zero recorded runs, so issue #189 remains open until a credentialed run records sanitized success evidence for both selected APIs.

---

## Phase 3: Production-Access Readiness

### Scope

- Prepare a strong, narrow production-access request tied to the working app.
- Request only the smallest API set required for the first real use case.
- Demonstrate policy awareness and responsible data handling.

### Deliverables

- [x] Public-facing product description page at `/about`.
- [x] Privacy policy and terms of service pages.
- [x] End-user definition with explicit first-production-use-case boundaries.
- [x] Minimal production API request package and per-API rationale in `docs/phase3-production-access-package.md`.
- [x] 30–60 minute VA platform review script in `docs/phase3-demo-script.md`.
- [x] Submission-field checklist in `docs/phase3-submission-checklist.md` covering applicant, business model, API scope, credentials, PII/PHI, security, incident response, vulnerability management, rate limits, accessibility, and demo preparation.
- [x] Data-handling, authentication, credential, rate-limit, retry, and deployment documentation consolidated across the Phase 3 package and existing readiness docs.

### Acceptance Criteria

- [~] **A 30–60 minute production-review demo can be run without blockers.** Script and route sequence are complete; final deployed-app rehearsal remains required before submission.
- [~] **Production request package is complete and aligned to actual implemented workflows.** Repository package is assembled; applicant/business details, absolute deployed URLs, accessibility response, production runtime verification, and credentialed sandbox verification must be filled from verified real-world information before submission.
- [x] **Requested API list is minimal, justified, and mapped to explicit user value.** Initial request is limited to VA Forms and Benefits Reference Data.
- [x] **Privacy, terms, product scope, and end-user boundaries are published in plain language.**

### Phase 3 Submission Gate

See:

- `docs/phase3-production-access-package.md`
- `docs/phase3-demo-script.md`
- `docs/phase3-submission-checklist.md`

Sandbox verification remains pending in issue #189. Do not submit until the credentialed sandbox gate is objectively satisfied, production runtime settings are verified, the accessibility answer is supported by current deployed evidence, truthful applicant/business details are supplied, and the final demo rehearsal passes.

---

## Execution Order

1. Finalize V1 specification and schema. **Complete.**
2. Build responsive intake and results experience. **Complete.**
3. Expand condition knowledge base and explanation outputs. **Ongoing under citation/publication governance.**
4. Add rationale/source governance and privacy-safe operational logging. **Complete for current scope.**
5. Implement sandbox API adapters and targeted integrations. **Code complete; live credentialed sandbox smoke test externally pending in issue #189.**
6. Prepare production-readiness documents and demo package. **Repository drafting complete; final external sandbox/accessibility/runtime/fields/rehearsal gates pending.**
7. Submit production-access request for minimum necessary APIs. **Not started; gated by the Phase 3 submission checklist.**

## Validation Gate Before Production Request

- [x] Core evaluation logic passes the repository CI gate.
- [x] Public privacy and terms routes are deployed.
- [x] Public product/end-user route is implemented for deployment.
- [x] Catalog/knowledge-base structural validation and citation audits are part of CI.
- [x] Privacy-sensitive workflow state is excluded from URL propagation.
- [x] Phase 2 public/reference integrations are isolated behind a feature toggle and local fallback.
- [x] Production deployment has repository-enforced runtime/security controls and a documented Azure settings boundary.
- [x] Phase 3 production-access request package, demo script, and submission checklist are assembled in the repository.
- [ ] Credentialed live VA sandbox smoke test recorded for VA Forms and Benefits Reference Data (issue #189).
- [ ] Production Azure runtime settings manually verified.
- [ ] Final deployed-app accessibility/Section 508 evidence reviewed (issue #195).
- [ ] Truthful applicant/business model and absolute public URLs filled into the submission package.
- [ ] Final 30–60 minute demo rehearsal completed without blockers.
