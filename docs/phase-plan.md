# Secondary Condition Finder Phase Plan

## Purpose

This plan defines a narrow, defensible delivery path that proves product value without requiring sensitive live VA data up front. It is organized into three phases so the team can build a working product, validate usefulness, and then pursue only the minimum required production API access.

## Product Guardrails (applies to all phases)

- The tool supports claim-preparation research and organization only.
- The tool does **not** diagnose conditions or provide legal advice.
- Outputs are framed as “possible secondary conditions to explore,” not determinations.
- Recommendations must include rationale and evidence-gap prompts.
- Data handling must follow least-privilege and minimum-necessary principles.

---

## Phase 1: Version 1 Web App (No Live VA Data)

### Scope

- Deliver a usable web app experience that works without production VA credentials.
- Convert current prototype logic into structured product components.
- Focus on intake, condition exploration, and conservative explanation output.

### Deliverables

- Version 1 functional specification and acceptance criteria.
- Intake flow supporting one or more service-connected primary conditions.
- Optional intake fields for symptoms, medications, exposures, and notes.
- Structured condition knowledge base replacing hardcoded prototype lookups.
- Recommendation output that includes:
  - possible secondary conditions to explore
  - concise rationale for each suggestion
  - confidence style that is conservative and non-diagnostic
  - evidence-gap prompts describing missing documentation or details
- Clear disclaimers throughout UI and output surfaces.
- Sample veteran scenarios for demo walkthroughs.
- Basic event logging for recommendation rationale traceability.

### Acceptance Criteria

- A user can complete intake and receive ranked exploration suggestions.
- Every suggestion includes explanation text and at least one source placeholder.
- The app works end-to-end with no dependency on live VA production data.
- Disclaimers are visible in intake and results views.
- At least three demo scenarios can be executed consistently.

---

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

Confirm all five conditions are true:

1. The app solves one clearly defined user problem.
2. The current product works without production VA data.
3. The requested API set is minimal and justified.
4. The demo is polished for a 30–60 minute review session.
5. Public privacy/terms/scope documentation is complete and clear.
