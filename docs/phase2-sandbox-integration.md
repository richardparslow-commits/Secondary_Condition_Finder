# Phase 2 VA Sandbox Integration

## Current low-sensitivity integrations

Phase 2 currently uses two public/reference VA APIs behind one dedicated adapter layer:

- VA Forms API: form search and current form metadata.
- Benefits Reference Data API: disability reference values.

These integrations remain separate from authenticated Veteran-specific APIs. VA documents Benefits Reference Data as sending and receiving no PII or PHI, while VA Forms exposes public form information.

## Runtime configuration

Sandbox integration is off by default.

| Variable | Default | Purpose |
|---|---|---|
| `VA_SANDBOX_ENABLED` | `false` | Enables the public-reference sandbox adapter only when set to `true`. |
| `VA_SANDBOX_API_KEY` | unset | Server-side VA sandbox API key sent in the documented `apikey` header. Never expose through `NEXT_PUBLIC_*`. |
| `VA_SANDBOX_TIMEOUT_MS` | `4000` | Per-attempt request timeout. |
| `VA_FORMS_SANDBOX_BASE_URL` | `https://sandbox-api.va.gov/services/va_forms/v0` | Override for VA Forms sandbox endpoint root. HTTPS is required. |
| `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL` | `https://sandbox-api.va.gov/services/benefits-reference-data/v1` | Override for Benefits Reference Data sandbox endpoint root. HTTPS is required. |

No API key or live credential is committed to the repository.

## Adapter behavior

`src/lib/va/sandbox.ts` provides:

- `fetchVaForms(query?)`
- `fetchVaDisabilityReference()`
- `loadVaSandboxConfig()`

The adapter:

1. Fails closed to the local baseline when disabled or missing credentials.
2. Requires HTTPS endpoint configuration.
3. Uses the VA-documented `apikey` request header.
4. Validates successful responses with Zod before returning them to callers.
5. Retries one time for transient HTTP 429, 503, or 504 responses and once after a timeout/network failure.
6. Returns `local-fallback` rather than throwing upstream failures into the core workflow.
7. Generates a request ID and optionally emits structured observations containing service, path, attempt, status/outcome, and duration only.

## User-facing Phase 2 demonstrations

### `/va-forms`

- Bounded reference for VA Form 21-526EZ.
- Uses validated VA Forms sandbox metadata when enabled.
- Clearly labeled local VA.gov reference fallback when sandbox access is disabled or unavailable.
- Does not access a Veteran account or transmit claim, diagnosis, health, or service-history state.

### `/va-reference`

- Loads the public Benefits Reference Data disability list through `/disabilities` when sandbox access is enabled.
- The server sends no user condition/search input to VA; the endpoint is called without user parameters.
- User filtering happens only in a client component after the public list has loaded.
- Filter text is not written into the URL and is not sent back to the sandbox adapter.
- When sandbox access is unavailable, the page clearly switches to the app's local condition catalog and explicitly states that the fallback is not an official VA list.
- Matching a term is never presented as a diagnosis, eligibility decision, service-connection determination, or rating.

## Observability privacy contract

Observers must not receive:

- API keys or authorization credentials
- request query values
- response bodies
- condition selections from the secondary workflow
- service-history selections from the presumptive workflow
- intake free text, PII, or PHI

The adapter emits only operational request metadata needed to explain sandbox behavior and troubleshoot failures.

## Sandbox test scenarios

Automated coverage verifies:

- disabled feature flag causes no network request
- environment configuration is parsed correctly
- VA Forms requests use `apikey` and response validation
- Benefits Reference Data disability responses are validated
- one retry occurs for a transient 503 response
- observations omit query values and credentials
- invalid response shapes fail closed
- non-HTTPS endpoint overrides fail closed
- disability-reference UI filters retired/end-dated values from sandbox results
- disability-reference UI falls back cleanly when sandbox data is absent
- user filtering is not implemented through URL search parameters or client network requests

## Known limitations

- Sandbox data is test data and may not be current.
- The current Benefits Reference Data UI demonstrates only disability terminology; other public reference endpoints remain unused.
- The app does not integrate Benefits Intake, Benefits Claims, health, or other authenticated Veteran-specific APIs.
- Production API access remains out of scope until the sandbox demonstrations and production-access package are deliberately reviewed.

## Next Phase 2 decision point

After both public-reference demonstrations remain green in CI and deployment, the next expansion should be chosen by explicit user value rather than API breadth. Preferred candidates are another bounded Benefits Reference Data view (for example service branches or treatment centers) or a more complete VA Forms experience. Authenticated Veteran-specific APIs should remain out of scope until the privacy, authentication, and production-access boundaries are reviewed separately.
