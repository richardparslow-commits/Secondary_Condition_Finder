# VA public-reference runtime configuration

This document defines the runtime configuration contract for the app's low-sensitivity VA Forms and Benefits Reference Data integrations. These integrations provide administrative reference information only. They do not participate in medical evidence scoring, secondary-condition recommendation logic, or presumptive matching.

## Safe default

VA API access is disabled by default. With no VA runtime variables configured, the app serves local fallback references and makes no VA public-reference request.

## Environment selection

`VA_API_ENV` selects the intended upstream environment:

- `sandbox` (default)
- `production`

`VA_API_ENABLED=true` is the explicit environment-neutral enable flag. Production mode requires this flag. This prevents merely setting `VA_API_ENV=production` from activating production traffic.

For backward compatibility with the Phase 2 sandbox gate, `VA_SANDBOX_ENABLED=true` still enables sandbox mode when `VA_API_ENABLED` is not set. The dedicated #189 sandbox smoke-test workflow and its evidence contract remain separate from production configuration.

## Service-specific credentials

Keep every API credential server-only. Never use `NEXT_PUBLIC_*` for VA credentials.

Sandbox:

- `VA_FORMS_SANDBOX_API_KEY`
- `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`

Production:

- `VA_FORMS_PRODUCTION_API_KEY`
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`

The Forms adapter sends only the Forms key. Benefits Reference Data requests send only the Benefits Reference Data key.

## Optional endpoint overrides

The adapter has VA defaults for each environment and accepts HTTPS-only overrides:

Sandbox:

- `VA_FORMS_SANDBOX_BASE_URL`
- `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL`

Production:

- `VA_FORMS_PRODUCTION_BASE_URL`
- `VA_BENEFITS_REFERENCE_PRODUCTION_BASE_URL`

`VA_API_TIMEOUT_MS` controls the per-attempt timeout. `VA_SANDBOX_TIMEOUT_MS` remains a backward-compatible sandbox-era fallback.

## Activation examples

Sandbox compatibility mode:

```text
VA_SANDBOX_ENABLED=true
VA_FORMS_SANDBOX_API_KEY=<server-only value>
VA_BENEFITS_REFERENCE_SANDBOX_API_KEY=<server-only value>
```

Environment-neutral sandbox mode:

```text
VA_API_ENV=sandbox
VA_API_ENABLED=true
VA_FORMS_SANDBOX_API_KEY=<server-only value>
VA_BENEFITS_REFERENCE_SANDBOX_API_KEY=<server-only value>
```

Production mode, only after VA production access is granted and the production credentials are installed in the server runtime:

```text
VA_API_ENV=production
VA_API_ENABLED=true
VA_FORMS_PRODUCTION_API_KEY=<server-only value>
VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY=<server-only value>
```

## Reference caching and status

Forms search, disability terminology, and service-branch reference loaders share a bounded five-minute in-process cache. User-facing reference pages expose only non-sensitive status: source label, environment, last successful retrieval time, and cache hit/miss state. Credentials, response payloads, and user workflow selections are never included in this status surface.

Local fallback responses are not retained as successful VA cache entries. This allows a later request to recover immediately when upstream access becomes available.

## Product boundaries

- Secondary recommendations are computed before and independently from VA terminology lookup.
- Per-result VA reference blocks are administrative annotations only.
- The service-branch field is optional encrypted workflow context; `matchPresumptives()` does not read it.
- No fuzzy VA terminology matching is used. Matches are normalized exact names or explicitly curated aliases.
- Issue #189 remains the separate credentialed sandbox connectivity gate and must not be closed without its required live evidence.
