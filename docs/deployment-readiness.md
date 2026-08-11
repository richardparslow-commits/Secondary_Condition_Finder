# Production deployment readiness

This runbook covers the production controls required after the Phase 2 privacy and VA sandbox integration work.

## Current host

The repository deploys `main` to Azure Static Web Apps as a hybrid Next.js application. The deployment pipeline builds the standalone Next.js backend and Azure hosts dynamic routes on its managed backend runtime.

## Required Azure runtime setting

Configure the following in the **production environment variables / application settings** for the Azure Static Web Apps resource:

| Setting | Required | Value / behavior |
|---|---:|---|
| `WORKFLOW_SESSION_SECRET` | Yes | Server-only cryptographically random value of at least 32 characters. It encrypts and authenticates secondary and presumptive workflow cookies. Production workflow state fails closed if this value is absent or too short. |
| `VA_SANDBOX_ENABLED` | No | Leave unset or `false` for the default local-reference behavior. Set to `true` only when intentionally testing the public-reference VA sandbox integration. |
| `VA_SANDBOX_API_KEY` | Only when sandbox is enabled | Server-only VA sandbox API key. Never expose through a `NEXT_PUBLIC_*` variable. |
| `VA_SANDBOX_TIMEOUT_MS` | No | Optional per-attempt timeout. Defaults to 4000 ms. |
| `VA_FORMS_SANDBOX_BASE_URL` | No | Optional HTTPS override for VA Forms sandbox endpoint root. |
| `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL` | No | Optional HTTPS override for Benefits Reference Data sandbox endpoint root. |

`SECONDARY_WORKFLOW_SESSION_SECRET` remains a backward-compatible fallback only. New deployments should configure `WORKFLOW_SESSION_SECRET`.

Azure Static Web Apps request-time environment variables are resource settings, not GitHub Actions repository secrets. The deployment-token secret in the workflow does not prove that `WORKFLOW_SESSION_SECRET` is configured in the Azure runtime.

## Build-time public telemetry setting

`NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` is optional. Because it uses the `NEXT_PUBLIC_*` prefix, Next.js can inline it into browser code at build time. If it is not supplied during the production build, Application Insights browser telemetry remains disabled.

Do not place health, disability, service-history, VA API credentials, or workflow-session secrets in `NEXT_PUBLIC_*` variables.

## VA Forms production behavior

`/va-forms` is intentionally safe when sandbox access is unavailable:

1. Sandbox integration is disabled by default.
2. When disabled, missing a key, timing out, receiving an invalid payload, or receiving an HTTP failure, the adapter returns a local fallback rather than breaking the page.
3. The local reference links to VA.gov and tells the user to confirm the current form before filing.
4. When sandbox mode is enabled and a valid 21-526EZ record is returned, the UI labels the source as `VA sandbox reference` and warns that sandbox data is test data.
5. No Veteran account, diagnosis, disability rating, claim payload, or service-history state is sent to these public-reference adapters.

## Browser security baseline

The Next.js application now emits the following headers on all routes:

- `Content-Security-Policy` restricting objects, base URI, framing, and form targets
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, and USB APIs
- `Strict-Transport-Security` for HTTPS downgrade resistance

The CSP is deliberately conservative for the first enforcement pass: it protects the highest-risk embedding/object/form surfaces without constraining Next.js script/style loading in a way that could break hydration. Expand script/style/connect directives only with browser-level validation.

## Runtime and pipeline reproducibility

- `package.json` declares Node `22.x`, matching the CI and Azure hybrid runtime currently used by this repository.
- The Azure deploy action is pinned to its exact reviewed commit SHA.
- `actions/checkout@v6` avoids the deprecated Node runtime warning emitted by the prior checkout version.
- Next.js anonymous build telemetry is disabled in the Azure deployment build.

## Production verification checklist

After every production deployment:

1. Confirm the Azure deployment workflow succeeded.
2. Confirm the normal repository CI workflow succeeded on the same `main` commit.
3. Open `/` and verify the home page renders.
4. Open `/va-forms` with sandbox disabled and verify it renders `Local reference` without an error.
5. Start the secondary workflow and verify advancing from the diagnosed-condition step succeeds. A production error at this point can indicate a missing/short `WORKFLOW_SESSION_SECRET`.
6. Start the presumptive workflow and verify submitting service history reaches `/presumptive/results` without placing locations or dates in the URL.
7. Inspect response headers and confirm the browser security baseline is present.
8. If sandbox mode is intentionally enabled, confirm `/va-forms` either shows `VA sandbox reference` or safely falls back to `Local reference`; never treat sandbox data as current production VA data.

## Known external verification boundary

Repository CI can verify implementation, fail-closed behavior, configuration parsing, and deployment workflow structure. It cannot prove the current value of Azure resource application settings. `WORKFLOW_SESSION_SECRET` and any intentionally enabled VA sandbox credentials must therefore be checked in the Azure Static Web Apps production environment settings before treating the deployment as fully runtime-ready.
