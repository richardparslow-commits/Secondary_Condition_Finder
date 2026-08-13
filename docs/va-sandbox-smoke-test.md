# VA Sandbox Smoke-Test Gate

This runbook closes the final external Phase 2 gate tracked in issue #189 without exposing the VA sandbox API key or raw VA response payloads.

## Preconditions

1. Obtain an issued VA sandbox API key for the selected public/reference APIs.
2. Store it as the repository Actions secret `VA_SANDBOX_API_KEY`.
3. Do not place the key in source code, workflow inputs, issue comments, pull-request text, or `NEXT_PUBLIC_*` variables.
4. The dedicated workflow itself declares `VA_SANDBOX_ENABLED=true` and fails closed if that sandbox-mode precondition is not present. Operators do not need to supply the flag as a workflow input.

## Run procedure

After `.github/workflows/va-sandbox-smoke.yml` is present on `main`:

1. Open GitHub Actions.
2. Select **VA Sandbox Smoke Test**.
3. Run the workflow from `main`.
4. The workflow first verifies that the dedicated execution has `VA_SANDBOX_ENABLED=true` and that the server-side `VA_SANDBOX_API_KEY` secret is available.
5. The workflow calls only:
   - VA Forms sandbox `GET /forms?query=21-526EZ`;
   - Benefits Reference Data sandbox `GET /disabilities`.
6. The workflow requires HTTP 200 and validates the expected top-level array shape for each response.
7. Raw JSON is written only to restrictive temporary runner files and removed before the job exits.
8. On success, the workflow records only timestamp, high-level sandbox-mode state, service result, request ID, HTTP success, result count, and the workflow-run URL in issue #189, then closes the issue as completed.

## Privacy and credential contract

The workflow must not:

- print or persist `VA_SANDBOX_API_KEY`;
- upload raw response bodies as artifacts;
- send Veteran-specific, claim, diagnosis, rating, service-history, or free-text data;
- call authenticated Veteran-specific claims or health APIs;
- run automatically on pull requests or pushes where untrusted code could gain access to the secret.

The workflow is therefore `workflow_dispatch` only and uses a server-side GitHub Actions secret. The `VA_SANDBOX_ENABLED=true` value is a non-sensitive execution-mode flag; it is not a credential and does not replace the issued API key requirement.

## Failure behavior

A missing/incorrect sandbox-mode flag, missing secret, non-200 HTTP response, invalid response shape, or empty expected result set fails the workflow. Failure does not close issue #189 and does not change the Phase 2 status from **code-complete / externally pending**.

## Evidence retained

Successful retained evidence is intentionally narrow:

- UTC timestamp;
- high-level confirmation that the dedicated smoke-test run used sandbox mode;
- VA Forms request ID, HTTP status, and validated result count;
- Benefits Reference Data request ID, HTTP status, and validated result count;
- GitHub Actions run URL.

No API key or raw VA response payload is retained by this gate.
