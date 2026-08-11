# Phase 3 VA Review Demo Script

## Purpose

Provide a repeatable 30–60 minute walkthrough showing the product's bounded claim-preparation value, safety framing, privacy controls, graceful fallback behavior, and the exact reason the initial production request is limited to VA Forms and Benefits Reference Data.

## Demo prerequisites

Before the demo:

- Use the deployed application on the exact green `main` commit selected for review.
- Confirm normal repository CI and Azure deployment are green for that commit.
- Confirm `/privacy`, `/terms`, `/about`, `/va-forms`, and `/va-reference` render.
- Confirm `WORKFLOW_SESSION_SECRET` is configured in the production runtime.
- If demonstrating live sandbox-backed responses, close issue #189 first and use only approved sandbox credentials. Never display or print the API key.
- Prepare one non-sensitive demonstration scenario. Do not use a real Veteran's PII, PHI, claim number, SSN, medical record, or service-history record.

## Recommended agenda

### 0–5 minutes — Product scope and boundaries

Show `/about`.

Explain:

- The primary user is a Veteran researching and organizing information for their own disability-benefit claim preparation.
- The tool supports research and organization; it does not diagnose, determine eligibility, promise ratings, file claims, or provide legal representation.
- The core secondary and presumptive workflows are local and remain usable when VA APIs are unavailable.
- The initial production request is limited to two open-data reference APIs.

### 5–15 minutes — Core claim-preparation workflow

Use the secondary workflow with a prepared non-sensitive sample scenario.

Demonstrate:

1. selecting a diagnosed condition;
2. identifying a service-connected condition/rating as required by the workflow;
3. navigating to possible secondary conditions to explore;
4. viewing rationale, evidence gaps, and source references;
5. explaining that a known catalog condition is not automatically a publishable mapping;
6. pointing out conservative language and the legal/medical disclaimer.

Emphasize that 38 CFR §3.310 is treated as legal framework and is not presented as clinical evidence.

### 15–22 minutes — Presumptive workflow and URL privacy

Open the presumptive workflow with demonstration-only service history.

Show that:

- service locations and dates are submitted through the server action;
- the resulting URL does not contain the service locations or dates;
- encrypted/authenticated short-lived workflow state is used instead;
- this workflow does not depend on the VA sandbox APIs.

### 22–30 minutes — VA Forms API value

Open `/va-forms`.

Explain:

- The implemented use case is intentionally bounded to public Form 21-526EZ reference metadata.
- When the VA API is available, the adapter validates the returned metadata before showing it.
- If the API is disabled, unavailable, times out, returns an HTTP error, or returns an invalid payload, the page safely uses a local VA.gov reference instead of breaking the application.
- No Veteran-specific claim, diagnosis, rating, PII, PHI, or service-history payload is required by this feature.

If live sandbox proof is available, show only the user-facing result and non-sensitive request observation. Do not show the API key or raw response payload.

### 30–38 minutes — Benefits Reference Data value

Open `/va-reference`.

Explain:

- The server requests the public `/disabilities` list without user search text.
- The user's filter text stays in the browser and does not become a VA request parameter or URL query string.
- Retired/end-dated values are filtered from the sandbox-backed display.
- When the API is unavailable, the page falls back to the application's local catalog and labels that fallback as not an official VA list.
- A matching term is not a diagnosis, eligibility finding, rating, or proof of service connection.

### 38–45 minutes — Privacy, logging, and credentials

Open `/privacy` and summarize:

- encrypted/authenticated workflow cookies;
- no health/disability or presumptive service-history state in URLs;
- aggregate-only recommendation-event metrics;
- sanitized telemetry behavior;
- no public-reference VA API response-body persistence.

Explain credential handling:

- server-only environment settings;
- sandbox/production separation;
- no `NEXT_PUBLIC_*` credential exposure;
- no API key logging;
- credential rotation on exposure/incident and per platform/VA requirements.

### 45–50 minutes — Reliability and rate limiting

Explain the adapter behavior:

- 4-second default per-attempt timeout;
- maximum two attempts;
- one bounded retry for 429, 503, 504, timeout, or transient network failure;
- invalid payloads fail closed;
- operational observations include request ID, service, path, attempt, status/outcome, and duration only;
- core workflows continue through local fallback.

### 50–55 minutes — Why only two APIs

Show the API request section in `docs/phase3-production-access-package.md`.

Explain that the first request contains only:

1. VA Forms API;
2. Benefits Reference Data API.

Explicitly state that Benefits Intake, Benefits Claims, Benefits Documents, and Veteran health APIs are not required for this first production use case and are therefore deferred.

### 55–60 minutes — Questions and known limitations

Acknowledge:

- sandbox data is test data and may not be current;
- live credentialed sandbox evidence remains pending until issue #189 is closed;
- citation verification status is governed per source and should not be generalized as universally verified;
- production API access does not change the application's non-diagnostic, non-adjudicative scope;
- any later authenticated API expansion would require a separate privacy/authentication review and bounded user-value demonstration.

## Expected reviewer questions

### What Veteran data is sent to these VA APIs?

For the initial two integrations, none is required. VA Forms receives only the bounded public form lookup. The current Benefits Reference Data `/disabilities` request has no user input parameters. User filter text is client-side.

### What happens if VA is down or rate-limits you?

The adapter performs at most one bounded retry for supported transient failures, then returns local fallback behavior. The secondary and presumptive workflows do not depend on these APIs.

### Do you store diagnoses or Veteran selections in logs?

Recommendation event persistence is aggregate-only and excludes condition identifiers and intake details. VA adapter observations exclude request query values, response bodies, credentials, and workflow selections.

### Why not request Benefits Intake now?

The first production use case does not submit claims or documents. Requesting Benefits Intake now would expand compliance and end-user requirements without being necessary to demonstrate current user value.

### How do users know this is not VA advice or a VA decision?

The application repeatedly states that it is a claim-preparation research aid, not legal or medical advice, and that outputs are possibilities to explore rather than diagnoses, eligibility findings, ratings, or adjudications.

## Demo pass criteria

The demo is ready when:

- all planned routes render without manual fixes;
- secondary and presumptive scenarios complete without sensitive values in URLs;
- both VA reference routes demonstrate sandbox-backed or clearly labeled fallback behavior;
- privacy/terms/product-scope pages match actual behavior;
- the presenter can explain each requested API's necessity and the reason higher-sensitivity APIs are excluded;
- no real Veteran PII/PHI or secret credential appears on screen, in logs, or in demo artifacts.
