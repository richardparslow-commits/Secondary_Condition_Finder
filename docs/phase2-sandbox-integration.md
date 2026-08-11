# Phase 2 VA Sandbox Integration

## Scope of the first integration slice

This slice implements the roadmap's lowest-sensitivity sandbox integrations:

- VA Forms API: form search and current form metadata.
- Benefits Reference Data API: disability reference values.

These adapters are deliberately separate from authenticated Veteran-specific APIs. The Benefits Reference Data API is documented by VA as sending and receiving no PII or PHI, and VA Forms exposes public form information.

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

## Known limitations

- This slice does not place sandbox-backed data into the veteran-facing UI yet.
- It does not integrate Benefits Intake, claims, health, or other authenticated Veteran-specific APIs.
- Sandbox data is test data and may not be current.
- Production access and production endpoint use remain out of scope until sandbox behavior is demonstrated and the production-access package is approved.

## Next Phase 2 slice

After this adapter remains green in CI, wire one bounded, clearly labeled sandbox-backed reference feature into the app with local fallback and a demo scenario. VA Forms is the preferred first UI integration because the data is public and directly supports claim-preparation form discovery.
