# Phase 2 VA Public-Reference Integration

## Scope

The app uses two low-sensitivity public/reference VA API services behind one server-only adapter layer:

- **VA Forms API** — public form search and metadata.
- **Benefits Reference Data API** — public disability terminology and service-branch reference values.

These integrations remain separate from authenticated Veteran-specific claims and health APIs. They are administrative reference features only and do not participate in recommendation scoring, medical-evidence evaluation, or presumptive matching.

## Runtime configuration

VA API access is disabled by default. The full environment contract is documented in `docs/va-api-runtime-configuration.md`.

### Sandbox compatibility mode

| Variable | Default | Purpose |
|---|---|---|
| `VA_SANDBOX_ENABLED` | `false` | Backward-compatible sandbox-only enable flag used by the Phase 2 gate. |
| `VA_FORMS_SANDBOX_API_KEY` | unset | Server-only key used only for VA Forms sandbox requests. |
| `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` | unset | Server-only key used only for Benefits Reference Data sandbox requests. |
| `VA_SANDBOX_TIMEOUT_MS` | `4000` | Backward-compatible timeout override. |
| `VA_FORMS_SANDBOX_BASE_URL` | VA sandbox default | Optional HTTPS-only VA Forms sandbox root override. |
| `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL` | VA sandbox default | Optional HTTPS-only Benefits Reference Data sandbox root override. |

### Environment-neutral mode

- `VA_API_ENV=sandbox|production`
- `VA_API_ENABLED=true`
- `VA_API_TIMEOUT_MS=<milliseconds>` (optional)

Production activation is a deliberate tri-state decision (`disabled` / `sandbox` / `production`) resolved by `resolveVaReferenceMode()` — see `docs/va-api-runtime-configuration.md`. It additionally requires an explicit acknowledgement that VA granted production access, the service-specific production keys, and must not occur until VA grants production access:

- `VA_PRODUCTION_ACCESS_GRANTED=true` (issue #287 gate rule acknowledgement; unset everywhere, and #287 was closed as not pursued on 2026-10-15)
- `VA_FORMS_PRODUCTION_API_KEY`
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`

Without the acknowledgement, a production selection fails closed to `disabled` and never carries production endpoints or production keys.

Never expose any VA key through `NEXT_PUBLIC_*` variables.

## Adapter behavior

`src/lib/va/sandbox.ts` provides the shared request adapter used by Forms and Benefits Reference Data. It:

1. Fails closed to local/reference behavior when disabled or missing the relevant service credential.
2. Requires HTTPS endpoint configuration.
3. Sends only the credential for the service being called.
4. Validates successful payloads before returning them to callers.
5. Retries at most once for HTTP 429, 503, or 504 and transient timeout/network failures.
6. Returns local fallback rather than breaking the core workflow.
7. Emits optional structured observations containing only request ID, service, path, attempt, status/outcome, and duration.

## Shared cache and status

Forms search, disability terminology, and service-branch reference loaders use a shared bounded five-minute successful-response cache.

User-facing status may expose only:

- source label;
- sandbox/production/local-fallback environment label;
- last successful retrieval timestamp;
- cache hit/miss/not-used state.

Credentials, raw payloads, query values, and workflow selections are not part of that status surface. Local fallback is not retained as a successful VA cache entry.

## User-facing demonstrations

### `/va-forms`

Provides the direct Form 21-526EZ reference surface and links to the searchable Finder.

### `/va-forms/finder`

- Accepts public form number/title/keyword search text.
- Uses validated VA Forms metadata when the configured environment is available.
- Filters deleted records from the current display.
- Shows revision/page/PDF-status metadata and official form links.
- Shows explicit source/retrieval/cache status.
- Falls back safely when VA access is disabled or unavailable.

The search text is a public-form lookup and contains no required Veteran-specific claim, diagnosis, rating, PII, PHI, or service-history value.

### `/va-reference`

- Loads Benefits Reference Data `/disabilities` without user condition/search parameters.
- User filtering happens only after the list is loaded and is not written into the URL or sent to VA.
- Retired/end-dated values are excluded from live API-backed display.
- Local fallback is explicitly labeled as the app's catalog and not an official VA list.

### Secondary result VA reference blocks

- The public disability list is loaded independently of recommendation inputs.
- Local condition names are matched conservatively by normalized exact name or explicitly curated alias only.
- A result may show VA/VBA administrative terminology and reference ID when an exact/curated mapping exists.
- The reference block explicitly states that it does not establish diagnosis, service connection, eligibility, rating, or recommendation strength.
- `recommend()` does not receive the VA reference object.

### `/va-reference/service-branches` and presumptive intake

- The public service-branch list is loaded as reference data with local fallback.
- Presumptive intake can store selected branch codes as optional encrypted workflow context.
- `matchPresumptives()` does not read branch codes, so they cannot change the presumptive result.

## Observability privacy contract

Observers must not receive:

- API keys or authorization credentials;
- request query values;
- response bodies;
- secondary-workflow condition selections;
- presumptive service-history selections;
- free text, PII, or PHI.

## Automated coverage

Current regression coverage verifies disabled-mode no-network behavior, environment parsing, service-specific credentials, request headers, payload validation, bounded retries, timeout/network fallback, HTTPS enforcement, observation privacy, shared caching/status, client-side disability filtering, per-result VA-reference isolation from recommendation scoring, and service-branch isolation from presumptive matching.

## Known limitations and external gate

- Sandbox data is test data and may not be current.
- No authenticated Veteran-specific API is part of the current scope.
- Production mode is configuration-ready but must remain disabled until VA grants production access and live production connectivity is objectively verified.
- Issue #189 remains open because the dedicated credentialed sandbox workflow has not yet recorded a successful run.
