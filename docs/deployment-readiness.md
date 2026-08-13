# Production deployment readiness

This runbook covers the production controls required after the Phase 2 privacy and VA sandbox integration work.

## Current host

Production is hosted on the Vercel Pro project `secondary-condition-finder` and deploys from GitHub `main` through the Vercel Git integration.

Canonical production URL:

- `https://secondary-condition-finder.vercel.app`

The normal production build is the repository's standard `npm run build` / `next build` path. Vercel provides the Next.js runtime directly; the repository does not force Next.js standalone output for normal builds.

The former Azure Static Web Apps workflow remains only as an explicitly manual legacy fallback. It no longer deploys automatically on pushes or pull requests.

## Verified Vercel production runtime checkpoint

Objective pre-finalization production evidence on `main`:

- Production commit: `6ed2da05f2ef7259acc5617968480f3ecbaf2ada`.
- Repository CI #712 completed successfully on that exact commit.
- Vercel production redeploy `dpl_CbkyoQKxbFaDbivGEv3jiSztsm2M` reached `READY` on that same commit.
- The canonical production alias serves that Vercel deployment.
- Production route matrix: `/=200`, `/about=200`, `/va-forms=200`, `/runtime-readiness=200`.
- `/runtime-readiness` rendered `data-runtime-readiness="ready"`.
- Vercel runtime logs for the verification window showed ordinary route/status metadata for the checked routes and did not expose the workflow-session secret or derivative key material.

This proves that the production Vercel runtime can access and use a valid primary `WORKFLOW_SESSION_SECRET` through the application's real AES-256-GCM workflow-session crypto path. It does not authorize disclosure of the secret and does not prove unrelated settings.

Issue #213 remains the exact-commit evidence record. The repository readiness workflow must re-verify the final `main` commit after this production-host finalization change before the issue is treated as complete.

## Required Vercel runtime setting

Configure production runtime settings in the Vercel project's **Production** environment. Do not place these values in source control or expose them through `NEXT_PUBLIC_*` variables.

| Setting | Required | Value / behavior |
|---|---:|---|
| `WORKFLOW_SESSION_SECRET` | Yes | Server-only cryptographically random value of at least 32 characters. It encrypts and authenticates secondary and presumptive workflow cookies. Production workflow state fails closed if this value is absent or too short. |
| `VA_SANDBOX_ENABLED` | No | Leave unset or `false` for the default local-reference behavior. Set to `true` only when intentionally testing the public-reference VA sandbox integration. |
| `VA_SANDBOX_API_KEY` | Only when sandbox is enabled | Server-only VA sandbox API key. Never expose through a `NEXT_PUBLIC_*` variable. |
| `VA_SANDBOX_TIMEOUT_MS` | No | Optional per-attempt timeout. Defaults to 4000 ms. |
| `VA_FORMS_SANDBOX_BASE_URL` | No | Optional HTTPS override for the VA Forms sandbox endpoint root. |
| `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL` | No | Optional HTTPS override for the Benefits Reference Data sandbox endpoint root. |

`SECONDARY_WORKFLOW_SESSION_SECRET` remains a backward-compatible fallback only. New deployments must configure `WORKFLOW_SESSION_SECRET`.

Vercel environment-variable changes apply to newly created deployments. After adding or rotating `WORKFLOW_SESSION_SECRET`, create a new production deployment before expecting `/runtime-readiness` to change.

## Objective runtime-secret verification

Issue #213 tracks the production runtime gate for `WORKFLOW_SESSION_SECRET`.

The application exposes a deliberately non-sensitive force-dynamic server-rendered page at `/runtime-readiness`. The page does **not** return the secret, its length, a hash, key material, cookie content, or environment-variable values.

At request time, the page calls the real workflow-session crypto self-test and renders exactly one high-level marker: `data-runtime-readiness="ready"` or `data-runtime-readiness="not_ready"`. It reports `ready` only when all of the following are true:

1. the server is running with `NODE_ENV=production`;
2. the primary `WORKFLOW_SESSION_SECRET` variable is present with at least 32 characters;
3. the real AES-256-GCM workflow-session implementation can seal and reopen an in-memory probe successfully.

The page is configured with `dynamic = "force-dynamic"` and `revalidate = 0`. The legacy `SECONDARY_WORKFLOW_SESSION_SECRET` fallback is intentionally insufficient to produce the `ready` marker.

### Automated evidence contract

`.github/workflows/production-runtime-readiness.yml` is triggered after a successful repository `CI` workflow on `main`. It:

1. resolves the exact successful CI commit;
2. waits for the GitHub commit status context `Vercel` to report `success` for that same SHA;
3. derives the Vercel deployment identifier from that exact-commit status;
4. waits for the canonical production alias to serve that same Vercel deployment before probing readiness;
5. records HTTP status only for `/`, `/about`, and `/va-forms`;
6. requests `/runtime-readiness` into a temporary private file and requires HTTP 200 plus `data-runtime-readiness="ready"`;
7. deletes temporary response bodies and never prints or attaches them;
8. records only non-sensitive evidence in issue #213 and closes the issue only on a successful ready result.

The workflow also supports a manual `workflow_dispatch` verification when an exact commit needs to be rechecked deliberately.

### Evidence that may be recorded

- UTC timestamp;
- exact deployed commit;
- canonical production URL;
- Vercel deployment identifier and high-level commit-status result;
- route HTTP status codes;
- high-level runtime readiness result.

Never paste, print, log, attach, or otherwise record the secret value, secret length, hashes, derived key material, cookie payloads, or environment-variable values.

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

The Next.js application emits the following headers on all routes:

- `Content-Security-Policy` restricting objects, base URI, framing, and form targets
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, and USB APIs
- `Strict-Transport-Security` for HTTPS downgrade resistance

The CSP is deliberately conservative for the first enforcement pass: it protects the highest-risk embedding/object/form surfaces without constraining Next.js script/style loading in a way that could break hydration. Expand script/style/connect directives only with browser-level validation.

## Runtime and pipeline reproducibility

- `package.json` declares Node `22.x`; Vercel honors the repository engine declaration for builds.
- Normal `npm run build` is Vercel-native and does not force `output: "standalone"`.
- The legacy `npm run build:azure` command explicitly sets `AZURE_STATIC_WEB_APPS_BUILD=1` and retains standalone packaging only for manual Azure fallback use.
- The legacy Azure deployment action remains pinned to its reviewed commit SHA but is no longer an automatic production path.
- Repository CI remains the code-quality gate before the automated Vercel production-readiness check.

## Legacy Azure manual fallback

`.github/workflows/azure-static-web-apps-gentle-tree-04b340f0f.yml` is retained for historical/manual fallback only.

- It has no `push` or `pull_request` trigger.
- A manual operator must explicitly set `deploy_legacy_azure=true` to attempt a legacy deployment.
- The Azure-specific `build:azure` packaging path remains isolated from the standard Vercel build.
- Azure deployment success or failure is no longer used as the production readiness signal for Phase 3.

Do not switch this application to static HTML export merely to simplify hosting: the product uses dynamic/server-rendered routes and server-side workflow-session crypto.

## Production verification checklist

After every production deployment:

1. Confirm the normal repository CI workflow succeeded on the exact `main` commit.
2. Confirm the Vercel `success` commit status corresponds to that same commit.
3. Confirm the canonical production alias serves the Vercel deployment associated with that exact commit.
4. Request `/runtime-readiness` and require HTTP 200 plus `data-runtime-readiness="ready"` before treating the workflow-session runtime as configured.
5. Open `/` and verify the home page renders.
6. Open `/about` and verify the product-scope page renders.
7. Open `/va-forms` with sandbox disabled and verify it renders `Local reference` without an error.
8. Start the secondary workflow and verify advancing from the diagnosed-condition step succeeds.
9. Start the presumptive workflow and verify submitting service history reaches `/presumptive/results` without placing locations or dates in the URL.
10. Inspect response headers and confirm the browser security baseline is present.
11. If sandbox mode is intentionally enabled, confirm `/va-forms` either shows `VA sandbox reference` or safely falls back to `Local reference`; never treat sandbox data as current production VA data.

## Known external verification boundary

Repository CI and the automated production-readiness workflow verify implementation, fail-closed behavior, the exact-commit Vercel deployment status, production alias convergence, route availability, and the non-sensitive workflow-session crypto self-test. They do not prove credentialed VA sandbox access or Section 508 conformance.

Credentialed VA sandbox smoke testing remains separately governed by issue #189. Manual deployed-build accessibility/Section 508 evidence remains separately governed by issue #195. Neither gate may be inferred from successful Vercel deployment or runtime-secret readiness.
