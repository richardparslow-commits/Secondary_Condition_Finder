# External and Manual Gates Status

This record separates repository-complete work from evidence that cannot legitimately be manufactured by repository automation.

## Issue #189 — credentialed VA sandbox smoke test

**Status: COMPLETE / CLOSED.**

The repository-side VA Forms and Benefits Reference Data sandbox adapters/workflow are implemented. Closing the gate requires a real non-production run with issued server-only credentials configured in GitHub Actions secrets `VAFORMSSANDBOXAPIKEY` and `VABENEFITSREFERENCESANDBOXAPIKEY`; the workflow maps those values to the internal `VA_FORMS_SANDBOX_API_KEY` and `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` variables before execution, followed by objective non-sensitive success evidence.

This gate was closed by a credentialed dispatch of the existing `VA Sandbox Smoke Test` workflow on `main` after the workflow was corrected to read the configured secret names. The recorded sanitized evidence is:

- VA Forms: HTTP 200; request ID `4e806cfd-36e6-4aea-b3b8-8765f2f9a828`; validated result count 1.
- Benefits Reference Data: HTTP 200; request ID `1785c029-bb9b-4384-bd3f-b61d41f363dd`; validated result count 9.
- Workflow run: [33997305230](https://github.com/richardparslow-commits/Secondary_Condition_Finder/actions/runs/33997305230)
- No API key or raw response payload was recorded in the evidence.

Repository automation did not invent this evidence; it was produced by a successful external credentialed workflow run from `main` and recorded only as sanitized timestamp/service/HTTP-success/request-ID/high-level validation evidence.

## Issue #195 — manual Section 508 accessibility review

**Status: OPEN / HUMAN-ONLY.**

Repository CI, Chrome E2E, source-level accessibility contracts, deployment reachability, and Runtime Readiness are supporting evidence only. The issue explicitly requires human keyboard, assistive-technology, zoom/reflow, contrast, and forced-colors testing with synthetic/non-sensitive data plus reviewer sign-off.

Automation can keep the workbook, routes, and supporting evidence ready, and it can reflect the current gate context in downstream documents, but it cannot truthfully record PASS for an unperformed human test. The canonical manual evidence record remains `docs/section508-manual-review-workbook.md`, and every required row still carries the default state of `NOT TESTED` until a human completes the workbook against the exact identified production build.

Issue #195 remains open. It may stay open until:

1. every required manual item has recorded human evidence on an identified production build;
2. every material finding has a remediation issue/PR and a recorded retest;
3. `docs/accessibility-audit.md` is updated with the completed review date, tester/environment evidence, known limitations, and supportable final status; and
4. `docs/phase3-submission-checklist.md` is updated from objective evidence.

Repository automation must not close #195 or claim Section 508 conformance until the human evidence matrix, retests for any material findings, and final sign-off are complete.

## Issue #213 — production workflow-session secret

**Status: COMPLETE / CLOSED.**

The production `WORKFLOW_SESSION_SECRET` runtime gate has already been objectively verified through the real server-side crypto path, exact deployment lineage, successful production Runtime Readiness, and non-sensitive evidence. It is not an outstanding blocker.

## Completion boundary

The clinical evidence/remediation program can be repository-complete while #189 and #195 remain externally pending. Those two gates require evidence outside the authority of an automated repository agent. Keeping them open is the correct completed automation state until the required external/human actions occur.
