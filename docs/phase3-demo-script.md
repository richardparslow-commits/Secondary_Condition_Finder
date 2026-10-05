# Phase 3 VA Review Demo Script

## Purpose

Provide a repeatable 30–60 minute walkthrough showing the product's bounded claim-preparation value, safety framing, privacy controls, graceful fallback behavior, and why the initial production request is limited to VA Forms and Benefits Reference Data.

## Demo prerequisites

Before the demo:

- Use the deployed application on the exact green `main` commit selected for review.
- Confirm repository CI, Vercel production deployment, canonical alias convergence, and Production Runtime Readiness are all green for that same exact commit.
- Confirm `/about`, `/privacy`, `/terms`, `/va-forms`, `/va-forms/finder`, `/va-reference`, `/va-reference/service-branches`, and `/runtime-readiness` render.
- Require `/runtime-readiness` HTTP 200 with `data-runtime-readiness="ready"`; never inspect/display the workflow-session secret.
- If demonstrating live sandbox-backed responses, issue #189 must already contain objective successful credentialed evidence. Never display or print either service key.
- Use synthetic/sample conditions and service history only. Do not use real Veteran PII, PHI, claim numbers, SSNs, medical records, or service-history records.

## Recommended agenda

### 0–5 minutes — Product scope and boundaries

Show `/about` and explain:

- The primary user is a Veteran researching and organizing information for their own disability-benefit claim preparation.
- The tool supports research and organization; it does not diagnose, determine eligibility, promise ratings, file claims, or provide legal representation.
- Core secondary/presumptive workflows remain usable when VA APIs are disabled or unavailable.
- VA reference data is administrative enrichment only and does not influence medical/evidence scoring or presumptive matching.
- The initial production request is limited to two open-data services.

### 5–17 minutes — Secondary workflow and per-result VA reference information

Use a prepared non-sensitive scenario.

Demonstrate:

1. selecting diagnosed conditions;
2. identifying service-connected status/ratings as required;
3. progressing through supporting-document choice;
4. viewing possible secondary conditions to explore;
5. reading rationale, evidence gaps, and source references;
6. viewing the separate **VA reference information** block on a result when an exact/curated administrative terminology match exists;
7. showing unmatched/unavailable reference states where appropriate.

Explain the hard boundary:

- recommendations are computed independently of VA terminology;
- the reference block does not affect rank, evidence strength, nexus reasoning, diagnosis, eligibility, service connection, or rating;
- matching uses normalized exact names or explicitly curated aliases only, not fuzzy matching;
- workflow selections are not sent to VA for terminology matching.

Emphasize that 38 CFR §3.310 is legal framework, not clinical evidence.

### 17–25 minutes — Presumptive workflow, structured branch context, and URL privacy

Open `/presumptive` using demonstration-only data.

Show:

- standardized optional service-branch reference choices;
- locations/dates submitted through the server action;
- resulting URLs do not expose service locations/dates/branch values;
- encrypted/authenticated short-lived workflow state is used;
- `matchPresumptives()` does not read the optional service-branch codes, so branch reference data cannot change the presumptive result.

### 25–34 minutes — VA Forms Finder

Open `/va-forms`, then `/va-forms/finder`.

Demonstrate a public form-number/title/keyword query.

Explain:

- the Finder displays validated current-record metadata such as title, revision date, page count, PDF validity, and official form link;
- successful API-backed searches use a bounded five-minute cache;
- the page exposes only non-sensitive source/environment/retrieval/cache status;
- disabled/unavailable/error/invalid-payload states fall back safely rather than breaking the application;
- only public form lookup text is sent for this feature; no Veteran-specific diagnosis, rating, claim payload, service history, PII, or PHI is required.

If live sandbox proof is available, show only the user-facing result/status. Do not show raw response payloads or keys.

### 34–43 minutes — Benefits Reference Data

Open `/va-reference` and `/va-reference/service-branches`.

Explain:

- `/disabilities` is requested without user disability-search text;
- the user's disability filter stays in the browser and does not become a VA request parameter or URL value;
- retired/end-dated values are excluded from the live disability display;
- the service-branch list is public administrative reference data;
- local fallback is clearly labeled as the app's own catalog/reference set and not an official VA list;
- a matching administrative term is not a diagnosis, eligibility finding, rating, or service-connection determination.

### 43–50 minutes — Privacy, credentials, and source status

Open `/privacy` and summarize:

- encrypted/authenticated workflow cookies;
- no health/disability or presumptive service-history state in URLs;
- browser-local evidence analysis with no raw selected document upload to application server state;
- allowlisted operational workflow/recommendation count/status events enter server logs; host retention and exception channels require review;
- VA adapter observations limited to request ID, service, path, attempt, status/outcome, and duration;
- observations exclude credentials, query values, response bodies, and workflow selections;
- shared public-reference cache/status exposes only source/environment/retrieval/cache state.

Explain runtime configuration:

- `VA_API_ENV=sandbox|production` selects intended upstream environment;
- `VA_API_ENABLED=true` is the explicit environment-neutral enable flag;
- `VA_SANDBOX_ENABLED=true` remains the Phase 2 compatibility gate;
- Forms and Benefits Reference Data use separate sandbox and production credentials;
- production mode remains disabled until VA grants production access;
- no VA key is exposed through `NEXT_PUBLIC_*`, logs, URLs, or artifacts.

### 50–55 minutes — Reliability and rate limiting

Explain:

- 4-second default per-attempt timeout;
- at most three public-reference attempts for HTTP 503/504, timeout, or transient network failure with bounded backoff/jitter;
- HTTP 429/500 returns fallback without immediate retry; do not claim verified fleet backoff until the audited coordination defects are repaired;
- HTTPS-only endpoint configuration;
- invalid payloads fail closed;
- successful reference data may be cached for five minutes;
- local fallback follows bounded failure;
- no background polling/bulk synchronization is implemented.

### 55–60 minutes — Why only two APIs and known limitations

Show the API request section in `docs/phase3-production-access-package.md`.

Explain that the first request contains only:

1. VA Forms API;
2. Benefits Reference Data API.

Explicitly defer Benefits Intake, Benefits Claims, Benefits Documents, Veteran health APIs, and other authenticated Veteran-specific APIs because they are not required for the current user value and would expand privacy/auth obligations.

Acknowledge:

- sandbox data may not be current;
- issue #189 remains pending until objective credentialed workflow evidence exists;
- issue #195 remains pending until manual accessibility evidence exists;
- production API configuration readiness is not proof that production access has been granted;
- citation verification remains source-specific and should not be generalized as universally verified.

## Expected reviewer questions

### What Veteran data is sent to these VA APIs?

For the initial integrations, no Veteran-specific PII/PHI is required. Forms receives only public form lookup text. Benefits Reference Data list requests do not require the user's selected condition or branch as a matching parameter. Disability filtering and Secondary terminology matching occur after the reference list is loaded.

### Does VA terminology change the recommendation?

No. The recommendation is computed independently. The VA reference block is a separate administrative annotation and does not change rank, evidence strength, nexus reasoning, eligibility, or rating.

### Does selecting a service branch change presumptive matching?

No. The optional branch code is encrypted workflow context only. `matchPresumptives()` does not read it.

### What happens if VA is down or rate-limits the app?

The adapter performs at most one supported retry, then returns local fallback behavior. Core secondary/presumptive workflows remain available.

### Do you store diagnoses or Veteran selections in logs?

The application emits operational workflow/recommendation events with allowlisted counts, statuses, routes and duration. VA adapter observations exclude credentials, query values, response bodies, and workflow selections; host retention and exception sanitation still require review.

### Why not request Benefits Intake now?

The first production use case does not submit claims or documents. Requesting authenticated submission APIs now would add unnecessary privacy/auth requirements without being needed to demonstrate the current product value.

## Demo pass criteria

The demo is ready when:

- exact selected `main` CI and Vercel deployment are green;
- the canonical alias serves that exact deployment;
- Production Runtime Readiness reports success and `/runtime-readiness` is ready;
- all planned routes render without manual fixes;
- Secondary and presumptive scenarios complete without sensitive URL propagation;
- Forms Finder and Benefits Reference Data surfaces show API-backed or clearly labeled fallback behavior;
- per-result VA reference blocks and service-branch context preserve their algorithm-isolation boundaries;
- privacy/terms/product-scope pages match actual behavior;
- the presenter can explain the necessity of each requested API and why authenticated APIs are deferred;
- no real Veteran PII/PHI or credential appears on screen, in logs, developer tools, screenshots, or demo artifacts.
