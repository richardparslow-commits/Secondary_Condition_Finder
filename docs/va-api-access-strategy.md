# VA API Access Strategy

## Objective

Use a sandbox-first approach to validate real product value, then submit a narrow production-access request backed by a working demo, clear end-user definition, and responsible data-handling model.

## Guiding Principles

- Build first, request broad access later.
- Prefer lowest-sensitivity APIs that prove workflow value.
- Request the fewest APIs needed for the first production use case.
- Separate integration adapters from core recommendation logic.
- Treat API credentials and user data with strict confidentiality controls.

---

## Initial API Shortlist (First Production Request Candidate Set)

### Priority 1 (start in sandbox, target earliest production request)

1. **Benefits Reference Data API**
   - Why: Provides structured reference data useful for claims-preparation context.
   - Product value: Improves consistency and official terminology mapping.

2. **VA Forms API**
   - Why: Supports retrieval of official form metadata and references.
   - Product value: Helps users identify and work with correct VA forms.

### Priority 2 (evaluate after Priority 1 is proven)

3. **Benefits Intake API**
   - Why: Supports claim document upload workflows.
   - Product value: Enables document workflow only when app supports an appropriate end-user flow and compliance posture.
   - Gate: Integrate only after document workflow is fully specified and demoable.

### Deferred (not in initial production request unless required)

- Authenticated veteran-specific claims/health APIs with higher privacy and authorization complexity.
- Any API not directly tied to the first bounded production use case.

---

## Sandbox-First Integration Sequence

1. Create VA developer account and obtain sandbox key(s).
2. Confirm APIs and sandbox endpoints needed for Phase 2 experiments.
3. Implement API adapters with environment-specific configuration.
4. Add request observability (request IDs, status, error categories, retry behavior).
5. Build sandbox test scenarios mapped to product user stories.
6. Validate fallback behavior when APIs are unavailable.
7. Capture demo evidence (screens, logs, narrative) for production-access request support.

---

## Production Access Request Package Checklist

- [ ] Short app description and first production use case statement.
- [ ] Defined end-user population (veterans and/or authorized representatives).
- [ ] Exact API list requested with per-API business justification.
- [ ] Data-handling summary (what is stored, where, retention, deletion path).
- [ ] Credential handling approach (secrets management and rotation model).
- [ ] Authentication and authorization flow description (if applicable).
- [ ] Rate-limit and error-handling strategy.
- [ ] Public privacy policy URL.
- [ ] Public terms of service URL.
- [ ] Demo readiness confirmation and walkthrough agenda.

---

## Demo Readiness Checklist (for VA Review)

- [ ] Demo environment stable and repeatable.
- [ ] End-to-end scenario from intake to output runs without manual fixes.
- [ ] Conservative language and disclaimers visible throughout.
- [ ] Recommendation rationale and evidence-gap outputs shown clearly.
- [ ] API-backed features are clearly distinguished from non-API features.
- [ ] Known limitations are explicitly acknowledged.
- [ ] Team can explain why each requested API is necessary and sufficient.

---

## Compliance and Risk Controls

### Data and Privacy

- Collect only data required for the active workflow.
- Avoid storing sensitive user data unless necessary.
- Define retention and deletion behavior before production roll-out.
- Keep privacy and terms documentation aligned with actual behavior.

### Credentials and Access

- Store API keys in secure secrets management, never in source control.
- Restrict key usage by environment and role.
- Rotate credentials on schedule and on incident response triggers.

### Product Framing and Safety

- Position output as informational claim-preparation support only.
- Do not represent the tool as a medical, legal, or eligibility decision engine.
- Avoid deterministic language for uncertain condition relationships.

---

## Decision Rule for Expanding API Scope

Expand beyond initial APIs only when all are true:

1. Existing production APIs are fully utilized in a validated user workflow.
2. New API provides clear incremental user benefit not achievable otherwise.
3. Privacy and authorization implications are documented and acceptable.
4. Demo can show the new API in a bounded, policy-compliant scenario.

If any condition is unmet, defer expansion and continue product hardening.
