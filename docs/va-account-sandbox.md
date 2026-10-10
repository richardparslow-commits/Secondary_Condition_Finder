# Read-only VA Account Sandbox Phase

## Scope and gate status

This phase implements `/va-account` for **Veterans acting for themselves using VA-approved sandbox test accounts**. It is disabled by default and cannot select production endpoints. It is separate from the existing public Forms/Benefits Reference Data production request.

- B01: sandbox implementation of S256 PKCE/ACG, verified OIDC identity, rating-summary reads and existing-claim-status reads. Credentialed end-to-end proof still requires issued VA client registrations and matching callback URIs. This is not a completed all-API integration.
- B02 / #287: **externally blocked** until VA grants the requested production access and an authorized identified-build connectivity check succeeds. This phase neither enables production nor claims approval.
- B03 / #195: human accessibility evidence remains open; automated checks cannot sign off Section 508.
- Claims submission and Benefits Intake document upload are deferred. No `.write` scope, representative demographic headers, arbitrary veteran identifier, uploaded records, or mutation routes exist in this phase.

No release operation is required to exercise local tests. Preserve the October 11 release freeze; do not commit/push/deploy or submit a production request without authorization.

## Official contracts used

Checked October 4, 2026:

- [VA provider registry](https://developer.va.gov/platform-backend/v0/providers/transformations/legacy.json?environment=sandbox) distinguishes ACG from CCG; Claims v1 is the non-VA ACG scope, not v2 internal VA CCG.
- [Claims sandbox ACG discovery](https://sandbox-api.va.gov/oauth2/claims/v1/.well-known/openid-configuration).
- [Ratings sandbox ACG discovery](https://sandbox-api.va.gov/oauth2/veteran-verification/v1/.well-known/openid-configuration).
- [Claims v1 OpenAPI](https://api.va.gov/internal/docs/benefits-claims/v1/openapi.json): authenticated veteran GET `/claims`, scope `claim.read`, no representative headers for self-service.
- [Veteran verification v2 OpenAPI](https://api.va.gov/internal/docs/veteran-verification/v2/openapi.json): GET `/summary/disability_rating`, scope `disability_rating_summary.read`, veteran resolved from OAuth launch context, not an application-supplied ICN.

The live ACG discovery and provider registry agree on `/oauth2/claims/v1` and `/oauth2/veteran-verification/v1`. Older OpenAPI OAuth examples show inconsistent generic/system paths; those are not used for this ACG implementation. Discovery advertises S256, RS256, refresh and revocation; actual client authentication method/authorized scopes must match the issued registration. Provider token lifetime/refresh behavior is not hardcoded from an unverified snippet: access lifetime comes from `expires_in`, and the application's absolute session lifetime is 30 minutes.

## Exact setup interface

Use [.env.example](../.env.example). No real values should be committed, logged or sent in this thread.

| Variable | Meaning |
| --- | --- |
| `VA_ACCOUNT_SANDBOX_ENABLED` | Must be exactly `true` to opt in; defaults disabled. |
| `VA_ACCOUNT_ENV` | Must be exactly `sandbox`; production is rejected. |
| `APP_URL` | Exact canonical app origin, no credentials/path/query/fragment. HTTPS required except explicit loopback HTTP development. |
| `VA_ACCOUNT_SESSION_SECRET` | Independent random encryption secret, at least 32 characters; no development fallback. Rotation invalidates stored sessions. |
| `VA_ACCOUNT_RATINGS_CLIENT_ID` / `VA_ACCOUNT_CLAIMS_CLIENT_ID` | Separate issued sandbox ACG registrations. Each service can be configured independently. |
| `VA_ACCOUNT_RATINGS_AUTH_METHOD` / `VA_ACCOUNT_CLAIMS_AUTH_METHOD` | `none` for registered public PKCE clients, or `client_secret_basic` for confidential clients. Do not guess the issued method. |
| Corresponding `*_CLIENT_SECRET` | Required only for `client_secret_basic`; supplying one with `none` fails closed rather than ignoring it. |
| `VA_ACCOUNT_STORE_URL` / `VA_ACCOUNT_STORE_TOKEN` | Separate HTTPS Redis-REST store/credential with atomic SET NX, GETDEL and EVAL/CAS. Do not use the public-reference cache for token records. |
| `VA_ACCOUNT_LOCAL_ONLY` | Explicit `true` permits capped process-local encrypted storage only on loopback development/test, never production or hosted markers. |
| `VA_ACCOUNT_DEMO_FIXTURES` | Rehearsal only. Explicit `true` answers the authorization, token, JWKS, read and revocation calls from a synthetic provider at the network boundary (`src/lib/va/account/demo-fixtures.ts`, entered through `account/transport.ts`). The real PKCE, transaction, cookie, CSRF and revocation code still runs, no route serves veteran-shaped data, and the gate refuses any runtime the shared fact calls distributed. Never use it for a live review. |
| `VA_ACCOUNT_DEMO_FAULT` | Rehearsal only, and only meaningful with the flag above: `none` (default), `timeout`, `503`, `429`, `invalid-payload`, or `401`, so the failure demonstrations are reproducible without asking the provider to fail. Any unrecognized value means no fault. |

Register these exact callback URLs with VA, substituting the exact approved APP_URL origin:

- `{APP_URL}/va-account/oauth/ratings/callback`
- `{APP_URL}/va-account/oauth/claims/callback`

The registered callback must match exactly, including localhost versus 127.0.0.1 and port. Next normalizes loopback IP hosts in development unless configured otherwise; prefer the documented localhost development origin. There are no arbitrary return-to parameters or token/API host overrides.

Requested scopes are only `openid offline_access` plus the selected read scope. `profile`, demographics and write scopes are not requested. Connect each service separately; the app does not infer cross-service identity equivalence or merge records into the research workflow.

## Routes and consent

- `GET /va-account`: clearly labeled sandbox page, safe notice codes, per-service status, minimal account DTOs and disconnect controls. Disabled configuration shows a truthful blocked state, never mock “live” data.
- `POST /va-account/oauth/{ratings|claims}/start`: requires exact same Origin and canonical request origin, form-urlencoded body ≤1 KiB and `consent=sandbox-read-only`. Returns a no-store authorization navigation URL and a browser-binding HttpOnly cookie. No GET login or implicit prefetch side effects.
- `GET /va-account/oauth/{service}/callback`: accepts a unique bounded state/code, validates browser binding and one-use server transaction before exchanging the code. Always redirects to a fixed local safe notice; never echoes upstream error text/code/state into HTML.
- `POST /va-account/oauth/{service}/disconnect`: same-origin protected; removes session state and browser cookies, attempts refresh/access-token revocation, and distinguishes cleanup/revocation failure from confirmed success.

The client sends a same-origin POST then navigates at top level to the fixed sandbox authorization endpoint. This preserves global `connect-src 'self'` and `form-action 'self'`; no cross-origin form/fetch allowance is added.

## Security and data lifecycle

- Cryptographically random state, nonce, verifier and handles; S256 verifier remains server-side; transaction expires after five minutes and is atomically consumed.
- Callback browser-binding cookie is HttpOnly/SameSite=Lax, service-path scoped for cross-site GET return. Connected handle is HttpOnly/SameSite=Strict, scoped to `/va-account`. HTTPS cookies are Secure. Research workflows use no cookie-backed state; retired workflow-cookie names are expired by the edge proxy when still presented.
- Tokens are encrypted/authenticated with existing AES-256-GCM envelope code using a separate secret. Browser cookies contain only random opaque handles; store keys hash handles, values include service/client fingerprint and verified subject.
- ID tokens are cryptographically verified with bounded JWKS fetched from a fixed official sandbox URL. RS256, issuer, audience, subject, expiry, issued-at, nonce and authorized-party semantics are checked; unverified JWT decoding is not identity.
- Claims/ratings authorization is the token's signed-in veteran context. No user-supplied ICN, SSN, claim ID selector or representative headers are supported.
- Refresh uses atomic compare-and-swap to a non-readable generation. Concurrent readers fail closed. Logout deletion cannot be resurrected by late refresh. Expiry is absolute, not sliding. Invalid token/refresh results require new authorization.
- API calls are fixed GETs, no-store, redirect-denied, four-second per-attempt deadline including body read, byte/item/text capped and schema validated. Account responses are not persisted or substituted with local KB data. ICNs, claim/rating identifiers and diagnosis text are dropped from display DTOs.
- Conservative atomic per-service/client read pacing permits one read per two seconds. No retries/background polling. 429 records a bounded retry-not-before deadline, without holding a page request open. This does not constitute a grant-specific quota certification.
- Failures use code-controlled messages; provider descriptions/token/API bodies are not logged or returned. Global optional tracing/host access logs remain a separate privacy boundary: callback query logging must be scrubbed, body logging disabled, and retention/access reviewed before any hosted credentialed use.
- Disconnect invalidates the app connection, not the user's VA/identity-provider browser session. Provider revocation is attempted, not guaranteed if unavailable. When store deletion fails, UI explicitly reports uncertainty; entries have bounded TTL.

## External evidence needed — do not send secrets

1. Issued sandbox client type/auth method, allowed read scopes and exact redirect URI metadata for each service; official sandbox test accounts.
2. Isolated store configuration with GETDEL and EVAL support, access controls, encrypted transport, retention/expiry behavior and failure-mode evidence.
3. Sanitized credentialed sandbox flow evidence: service, timestamp, exact tested build, HTTP/result categories, no tokens/callback values/identity/records.
4. For B02: VA production grant naming eligible API/version/grant/scope, accepted terms/attestations, approved use case and any demo feedback. The current public-reference request does not cover this account phase automatically.
5. Final build identity, CI/readiness lineage, host log/query/body policy, WAF/forwarded-header settings, secret rotation and reviewed callback sanitation.
6. Identified-build human accessibility findings/retests/sign-off. Never manufacture PASS or close #195 from automation.

Grant and connectivity are distinct: after an explicit grant and authorized check procedure, public-reference acknowledgement may enable that controlled check; #287 stays open until connectivity evidence succeeds. No account production path is implemented in this phase. Real production work requires a separately reviewed release after the freeze.

## Verification and remaining limits

Synthetic tests in [va-account-sandbox.test.ts](../tests/va-account-sandbox.test.ts) exercise configuration rejection, PKCE binding, nonce/issuer/audience/signature/expiry, replay/concurrency, null/malformed/oversized responses, minimal DTOs, invalid tokens, pacing, refresh/token rotation, logout races, encrypted storage/command errors, and consent/CSRF/cookie behavior. These are not live VA approval or credentialed end-to-end proof.

The browser's disabled/default page and synthetic local consent start are checked separately under real app headers. No real credentials, VA sign-in, or veteran records are used by automated verification. Store production operation, OAuth registration, actual refresh/revocation behavior and assistive-technology conformance remain external/manual gates.
