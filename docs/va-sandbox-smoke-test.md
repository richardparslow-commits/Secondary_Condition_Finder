# VA Sandbox Smoke-Test Gate

This runbook closes the final external Phase 2 gate tracked in issue #189 without exposing VA sandbox credentials or raw VA response payloads.

## Preconditions

1. Obtain issued sandbox credentials for both selected services.
2. Store them as repository Actions secrets using the configured names:
   - `VAFORMSSANDBOXAPIKEY` — supplied to the workflow as `VA_FORMS_SANDBOX_API_KEY`;
   - `VABENEFITSREFERENCESANDBOXAPIKEY` — supplied to the workflow as `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`.
   The workflow keeps these service-specific values separate and does not expose them to logs, artifacts, or the browser.
3. Do not place either key in source code, workflow inputs, issue comments, pull-request text, terminal transcripts, screenshots, or `NEXT_PUBLIC_*` variables.
4. The dedicated workflow declares `VA_SANDBOX_ENABLED=true` itself and fails closed if that sandbox-mode precondition is absent.

## Run procedure

After `.github/workflows/va-sandbox-smoke.yml` is present on `main`:

1. Open GitHub Actions.
2. Select **VA Sandbox Smoke Test**.
3. Run the workflow from `main`.
4. The workflow verifies sandbox mode and requires both server-only service secrets.
5. It calls only:
   - VA Forms sandbox `GET /forms?query=21-526EZ` with `VA_FORMS_SANDBOX_API_KEY`;
   - Benefits Reference Data sandbox `GET /disabilities` with `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`.
6. Each request must return HTTP 200 and pass expected response-shape/result validation.
7. Raw JSON is written only to restrictive temporary runner files and deleted before exit.
8. On success, the workflow records only sanitized timestamp, sandbox-mode state, service result, request ID, HTTP status, validated result count, and workflow-run URL in issue #189, then closes the issue as completed.

## Credential separation rule

The smoke test intentionally proves the service-specific credential model:

- the VA Forms request must use only the Forms key;
- the Benefits Reference Data request must use only the Benefits Reference Data key;
- neither key may be substituted for the other or exposed to the other request path.

## Privacy and credential contract

The workflow must not:

- print or persist either API key;
- upload raw response bodies as artifacts;
- send Veteran-specific claim, diagnosis, rating, service-history, medical-record, PII, PHI, or free-text data;
- call authenticated Veteran-specific claims or health APIs;
- run automatically on pull requests or pushes where untrusted code could gain access to the secrets.

The workflow is therefore `workflow_dispatch` only. `VA_SANDBOX_ENABLED=true` is a non-sensitive execution-mode flag, not a credential.

## Failure behavior

A missing/incorrect sandbox-mode flag, either missing service secret, non-200 HTTP response, invalid response shape, or empty expected result set fails the workflow. Failure must not close issue #189 and must not change Phase 2 from **code-complete / externally pending**.

## Evidence retained

Successful retained evidence is intentionally narrow:

- UTC timestamp;
- confirmation that the dedicated run used sandbox mode;
- VA Forms request ID, HTTP status, and validated result count;
- Benefits Reference Data request ID, HTTP status, and validated result count;
- GitHub Actions run URL.

No API key or raw VA response payload is retained by this gate.

## Current status

Workflow ID `332298000` has **zero recorded runs** at the current repository checkpoint. Until a successful credentialed run exists, local fallback behavior, unit tests, CI, Vercel deployment success, and Production Runtime Readiness are not substitutes for the required external proof.
