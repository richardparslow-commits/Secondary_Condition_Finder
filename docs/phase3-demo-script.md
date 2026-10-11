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
- locations/dates remain in the tab-scoped browser `sessionStorage` record and are not submitted through a server action;
- resulting URLs do not expose service locations/dates/branch values;
- versioned, schema-bounded browser-local workflow state is used; no workflow cookie is set;
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

### 43–48 minutes — Privacy, credentials, and source status

Open `/privacy` and summarize:

- browser-local workflow state is stored in tab-scoped browser records; retired cookies are tombstoned if a stale copy appears;
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

### 48–52 minutes — Reliability and rate limiting

Explain:

- 4-second default per-attempt timeout;
- at most three public-reference attempts for HTTP 503/504, timeout, or transient network failure with bounded backoff/jitter;
- HTTP 429/500 returns fallback without an immediate retry, except when the upstream explicitly authorizes retrying at once (Retry-After of 0, or an already-past HTTP-date), which is retried once in the same request after the minimum backoff delay; do not claim verified fleet backoff until the audited coordination defects are repaired;
- HTTPS-only endpoint configuration;
- invalid payloads fail closed;
- successful reference data may be cached for five minutes;
- local fallback follows bounded failure;
- no background polling/bulk synchronization is implemented.

### 52–58 minutes — Sandbox authenticated account flow: PKCE, read, revocation, and keyboard-only proof

This segment demonstrates the **sandbox read-only account phase**, which is a separate track from the production request in the next section. Say so before starting: it is not part of the two-service request.

Never sign in with a real Veteran account. Use a VA sandbox test account, or the gated fixture described under Setup.

#### Setup before the reviewer joins

- `/va-account` appears only with `VA_ACCOUNT_SANDBOX_ENABLED=true` and `VA_ACCOUNT_ENV=sandbox`; a production endpoint cannot be selected at all.
- Credentialed sandbox: set `VA_ACCOUNT_RATINGS_CLIENT_ID` / `VA_ACCOUNT_CLAIMS_CLIENT_ID` and the matching `*_AUTH_METHOD`, `VA_ACCOUNT_SESSION_SECRET`, and `VA_ACCOUNT_LOCAL_ONLY=true` for a loopback store.
- Offline rehearsal: add `VA_ACCOUNT_DEMO_FIXTURES=true`. The application then answers the authorization, token, JWKS, read and revocation calls from a synthetic provider **at the network boundary**. The real PKCE, transaction, cookie, CSRF and revocation code still runs, no route serves veteran-shaped data, and the gate refuses any hosted or production runtime.
- Failure rehearsal: set `VA_ACCOUNT_DEMO_FAULT` to `503`, `429`, `invalid-payload`, `401`, or `timeout`, restart, and remove it before the live run.

#### Authorization (Authorization Code Grant with PKCE)

1. Open `/va-account`. With the phase off, each section states that the connection is disabled or unconfigured — that is the fail-closed default, not an error.
2. Press `Tab` twice from the address bar. Expected focus order begins: the "Skip to main content" link, then "← Back to Home", then the privacy policy link, then the ratings consent checkbox. Every stop shows the global `:focus-visible` outline. Press `Enter` on the skip link to show focus moving to the main region.
3. `Tab` to the consent checkbox and press `Space`. Expected: it checks without a pointer, and the connect button becomes the next stop.
4. Press `Enter` on "Connect sandbox ratings". Expected: the button disables and reads "Opening sandbox sign-in…", then the browser leaves this origin for `sandbox-api.va.gov/oauth2/veteran-verification/v1/authorization`.
5. Read the query string aloud: `response_type=code`, `code_challenge_method=S256`, a 43-character `code_challenge`, `state`, `nonce`, the exact registered `redirect_uri`, and `scope=openid offline_access disability_rating_summary.read`. Expected: **no `code_verifier`**, no token, and no `.write` scope anywhere in the URL.
6. Complete sign-in on the VA page with the sandbox test account. Expected: return to `/va-account?notice=connected`, and the notice states that only the selected service is connected.
7. Open devtools → Application → Cookies. Expected: one opaque 43-character `va-account-ratings` cookie, `HttpOnly`, `SameSite=Strict`, and `Secure` over HTTPS; the temporary login cookie is gone; no token, JWT, or veteran identifier appears in any cookie, URL, history entry, or `localStorage`.

#### Data retrieval

8. Read the ratings section. Expected: combined rating, both effective dates, and three service-connected rating records, each with a percentage and an effective date. Expected: **no diagnosis text** — the rating-summary schema carries no field for it and unknown provider fields are stripped, so a condition name cannot reach the page from this API. Name the scenario's three conditions from the presenter's own notes; the screen will not.
9. If a claims connection is configured, repeat step 4 for claims. Expected: existing claim statuses with type, filing date, and status, plus the on-page statement that these are existing statuses and not confirmation of a submission made by this application.
10. Trigger one more read inside two seconds. Expected: "Sandbox reads are temporarily rate limited" — the application's own one-read-per-two-seconds pacing, which is independent of any VA limit.

#### Failure handling

11. With `VA_ACCOUNT_DEMO_FAULT=503`, reload. Expected: "Sandbox data could not be retrieved or validated. No account data is shown." Expected: nothing is substituted for the missing record, and the rest of the application still works.
12. With `VA_ACCOUNT_DEMO_FAULT=invalid-payload`, reload. Expected: the same unavailable state. A well-formed HTTP 200 whose body fails the service schema is rejected rather than displayed.
13. With `VA_ACCOUNT_DEMO_FAULT=429`, reload. Expected: the rate-limited notice, with the window taken from the provider's own `Retry-After`.
14. With `VA_ACCOUNT_DEMO_FAULT=401`, reload. Expected: exactly one token refresh and one replay carrying the freshly minted token, then the unauthenticated state — never a loop, and never a replay of the token the platform already rejected.
15. With `VA_ACCOUNT_DEMO_FAULT=timeout`, reload. Expected: the read reports unavailable after the four-second per-attempt deadline instead of hanging.
16. Clear the fault variable and restart before continuing.

#### Consent revocation

17. `Tab` to "Disconnect sandbox ratings" and press `Enter`. Expected: redirect to `/va-account?notice=disconnected` and the section returns to "No active sandbox connection" — the unauthenticated state, reached without a pointer.
18. State the two effects separately: the server deleted the encrypted account session record **and** revoked the access and refresh tokens at the VA revocation endpoint. Point at the notice vocabulary: it reports "The application session was cleared, but provider token revocation could not be confirmed" when the provider refuses, so a cleared connection handle is never presented as a revoked credential.
19. Confirm in devtools that the connection cookie is gone and that the page exposes no account data.
20. State the boundary: this clears this application's connection only. It does not sign the Veteran out of VA or of its identity provider.

#### 508 proof points to state in this segment

- every control here is reachable and operable with `Tab`, `Shift+Tab`, `Space`, and `Enter` alone;
- the consent control is a labelled native checkbox inside a real form, and the busy state is announced as text as well as shown visually;
- the disconnect control is a native submit button inside a POST form, so it works with JavaScript disabled, and it is protected by a same-origin check rather than by client-side checks alone;
- status changes are exposed through `role="status"` and failures through `role="alert"`;
- no state change depends on colour, hover, or a pointer-only affordance.

### 58–60 minutes — Why only two APIs and known limitations

Show the API request section in `docs/phase3-production-access-package.md`.

Explain that the first request contains only:

1. VA Forms API;
2. Benefits Reference Data API.

Explicitly defer Benefits Intake, Benefits Claims, Benefits Documents, Veteran health APIs, and other authenticated Veteran-specific APIs because they are not required for the current user value and would expand privacy/auth obligations.

The sandbox account flow demonstrated in the previous segment is not part of this production request. It is read-only (no `.write` scope), sandbox-only (production endpoints are not selectable), disabled by default, and externally blocked pending VA's decision.

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

No. The optional branch code is browser-local context only. `matchPresumptives()` does not read it.

### What happens if VA is down or rate-limits the app?

The adapter performs at most one supported retry, then returns local fallback behavior. Core secondary/presumptive workflows remain available.

### Do you store diagnoses or Veteran selections in logs?

The application emits operational workflow/recommendation events with allowlisted counts, statuses, routes and duration. Client error boundaries emit only fixed content-free events, and optional LangSmith recommendation failures are replaced with a fixed message before trace recording. VA adapter observations exclude credentials, query values, response bodies, and workflow selections; deployed tracing configuration and host log retention/access settings still require review.

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
