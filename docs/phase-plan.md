# Secondary Condition Finder Phase Plan

## Purpose

This plan defines a narrow, defensible delivery path that proves product value without requiring sensitive live VA data up front. It is organized into three phases so the team can build a working product, validate usefulness, and then pursue only the minimum required production API access.
Phase-level merge/release gates are tracked in `docs/phase-gates.md`.

## Product Guardrails (applies to all phases)

- The tool supports claim-preparation research and organization only.
- The tool does **not** diagnose conditions or provide legal advice.
- Outputs are framed as “possible secondary conditions to explore,” not determinations.
- Recommendations must include rationale and evidence-gap prompts.
- Data handling must follow least-privilege and minimum-necessary principles.

---

## Phase 1: MVP & Core Evaluation Engine

### Core Deliverables
- [x] **Secondary Track (38 CFR 3.310):** Given service-connected conditions, returns ranked secondary condition exploration recommendations with reasoning, evidence gaps, and citations.
- [x] **Presumptive Track (38 CFR 3.307 / 3.309):** Sourced criteria for Agent Orange and PACT Act airborne hazards/burn pits.
- [x] **Offline Data Model:** Statically served catalog (191 conditions) and local JSON knowledge-base mappings.
- [x] **Public Legal Routes:** Dedicated app pages published at `/privacy` (Zero PII policy) and `/terms` (Scope, legal disclaimers, unverified citations notice).

### Phase 1 Validation Gate Status
- [x] **Clear user problem:** Claim-preparation research aid distinguishing 38 CFR 3.310 (secondary) from 38 CFR 3.307/3.309 (presumptive).
- [x] **No live-data dependency:** Fully operational client-side research tool with offline fallback.
- [x] **Minimal API need:** Local JSON datasets with optional client-side VA sandbox adapter boundary (`src/lib/va/adapter.ts`).
- [x] **Demo readiness:** Repeatable walkthroughs and scenarios (`/scenarios`) validated by green test suites.
- [x] **Public privacy/terms/scope publication:** Live dedicated routes at `/privacy` and `/terms`.
- [x] **Transparent coverage state:** Documentation explicitly states 191 catalog conditions exist (17 published mappings active in UI, 174 draft placeholders excluded from recommendations).

## Phase 2: Sandbox VA API Integration

### Scope

- Add VA API integration in a dedicated adapter layer using sandbox access only.
- Keep core recommendation engine decoupled from external API dependencies.
- Prove workflow value while limiting privacy and authorization complexity.

### Deliverables

- VA developer account setup and sandbox API key management process.
- API connector layer with environment-based configuration.
- Initial integration for selected high-value, lower-sensitivity APIs.
- Request/response logging, error handling, and retry strategy for sandbox calls.
- Internal documentation for sandbox test scenarios and known limitations.

### Acceptance Criteria

- App can call selected sandbox APIs successfully from the integration layer.
- API failures degrade gracefully without breaking core intake/exploration flow.
- Logs provide enough detail to support troubleshooting and demo explanations.
- Sandbox-dependent features can be toggled off without affecting baseline V1.

---

## Phase 3: Production-Access Readiness

### Scope

- Prepare a strong, narrow production-access request tied to a working app.
- Request only the smallest API set required for first real use case.
- Demonstrate policy awareness and responsible data handling.

### Deliverables

- Public-facing product description page.
- Privacy policy and terms of service pages.
- End-user definition (veterans and/or authorized representatives) with use-case boundaries.
- Minimal production API request package and rationale per API.
- Demo script and materials for VA platform review.
- Data-handling, authentication, and rate-limit handling documentation.

### Acceptance Criteria

- A 30–60 minute demo can be run without blockers.
- Production request package is complete and aligned to actual implemented workflows.
- API list is minimal, justified, and mapped to explicit user value.
- Privacy, terms, and scope limitations are clearly published in plain language.

---

## Execution Order

1. Finalize V1 specification and schema.
2. Build responsive intake and results experience.
3. Expand condition knowledge base and explanation outputs.
4. Add rationale/source placeholders and logging.
5. Implement sandbox API adapters and targeted integrations.
6. Prepare production-readiness documents and demo package.
7. Submit production-access request for minimum necessary APIs.

## Validation Gate Before Production Request

### Phase 1 Objective Proof & Artifact Checklist
- [x] **Core Evaluation Logic:** Verified by automated test suite (`npm test`, 79/79 tests passing).
- [x] **Public Legal & Privacy Routes:** Live at `/privacy` (`src/app/privacy/page.tsx`, zero PII policy) and `/terms` (`src/app/terms/page.tsx`, scope, disclaimers, unverified citations notice).
- [x] **Transparent Split Coverage:** 191 total catalog conditions across 14 body systems; 17 published active mappings (`draft: false`) and 174 draft placeholders (`draft: true`) audited via `scripts/kb-authoring-audit.js`.
- [x] **Strict Citation Governance:** Enforced by Zod schemas (`src/lib/kb/schema.ts` & `src/lib/presumptive/schema.ts`) requiring `verified: false` across all knowledge-base and presumptive source references.
- [x] **Accessibility Compliance:** Documented in `docs/accessibility-audit.md` targeting WCAG 2.1 Level AA and validated via semantic test suites (`tests/accessibility-ux-reliability.test.ts`).