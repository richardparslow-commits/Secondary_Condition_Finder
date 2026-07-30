# Phase Gate Checklist

Use this checklist as a merge/release gate artifact. No phase is complete until
all required checks are marked complete and linked to objective evidence.

## Global gating rules

- One ticket = one focused PR unless a pre-approved paired ticket is linked.
- Every behavior/legal/content change ships with tests in the same PR.
- No legal citation text is added or changed without explicit provenance.
- No intake free text or PII is persisted in logs or storage.
- Phase labels are mandatory on PRs (`phase:P0` through `phase:P4`).

## P0 gate — Compliance and safety foundation

- [ ] Canonical secondary legal references module is the only source for route-level secondary citations.
- [ ] Home and secondary flow present path distinction + caused/aggravated explanation + references before Step 1.
- [ ] Legal copy contract tests exist and pass.
- [ ] PR template is enforced for scope, acceptance criteria, and verification narrative.

## P1 gate — Core workflow behavior alignment

- [ ] Diagnosed-condition discoverability enhancements are implemented and tested.
- [ ] Suggestions are constrained to diagnosed-not-service-connected target pool.
- [ ] Suggestion source-count policy is codified in schema, UI, and tests.

## P2 gate — Evidence/document capability

- [ ] Upload and evidence route copy reflects final product contract.
- [ ] Evidence ingestion layer enforces data minimization and non-persistence of free text.
- [ ] Evidence evaluation output schema and wording guardrails are implemented and tested.

## P3 gate — Knowledge base operational coverage

- [ ] Coverage backlog includes owner, due date, and publish gate fields.
- [ ] Citation verification SOP is documented and referenced by PR workflow.
- [ ] Verification status is auditable with explicit unverified carry-forward.

## P4 gate — UX, reliability, readiness

- [ ] Secondary wizard copy and CTA labels are normalized and route-contract tested.
- [ ] End-to-end scenarios cover mapped/unmapped and doc/no-doc branches.
- [ ] Final acceptance matrix maps each requirement to owner, tests, and pass gate.

## End-of-phase completion checklist

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Documentation updated for all delivered requirements.
- [ ] Open risks and unverified items explicitly documented.
