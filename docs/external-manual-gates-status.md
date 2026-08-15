# External and Manual Gates Status

This record separates repository-complete work from evidence that cannot legitimately be manufactured by repository automation.

## Issue #189 — credentialed VA sandbox smoke test

**Status: OPEN / EXTERNALLY BLOCKED.**

The repository-side VA Forms and Benefits Reference Data sandbox adapters/workflow are implemented. Closing the gate requires a real non-production run with issued server-only credentials configured as `VA_FORMS_SANDBOX_API_KEY` and `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`, followed by objective non-sensitive success evidence.

Current automation in this environment cannot complete the gate because:

- no GitHub secret-management action is available through the connected tool surface;
- no workflow-dispatch action is available through the connected tool surface; and
- credential values must never be pasted into chat, committed, printed, or inferred.

The remaining action is therefore external configuration plus a credentialed dispatch of the existing `VA Sandbox Smoke Test` workflow on `main`. Only timestamp/service/HTTP-success/request-ID/high-level validation evidence should be recorded; credentials and raw payloads must remain secret.

Repository automation must not close #189 or claim live sandbox verification until that objective run exists.

## Issue #195 — manual Section 508 accessibility review

**Status: OPEN / HUMAN-ONLY.**

Repository CI, Chrome E2E, source-level accessibility contracts, deployment reachability, and Runtime Readiness are supporting evidence only. The issue explicitly requires human keyboard, assistive-technology, zoom/reflow, contrast, and forced-colors testing with synthetic/non-sensitive data plus reviewer sign-off.

Automation can keep the workbook, routes, and supporting evidence ready, but it cannot truthfully record PASS for an unperformed human test. The canonical manual evidence record remains `docs/section508-manual-review-workbook.md`.

Repository automation must not close #195 or state Section 508 conformance until the human evidence matrix, retests for any material findings, and final sign-off are complete.

## Issue #213 — production workflow-session secret

**Status: COMPLETE / CLOSED.**

The production `WORKFLOW_SESSION_SECRET` runtime gate has already been objectively verified through the real server-side crypto path, exact deployment lineage, successful production Runtime Readiness, and non-sensitive evidence. It is not an outstanding blocker.

## Completion boundary

The clinical evidence/remediation program can be repository-complete while #189 and #195 remain externally pending. Those two gates require evidence outside the authority of an automated repository agent. Keeping them open is the correct completed automation state until the required external/human actions occur.
