# Production deployment readiness

This runbook describes the production controls that are active for the Secondary Condition Finder and the external gates that remain deliberately separate.

## Current production host and deployment lineage

Production is hosted on the Vercel Pro project `secondary-condition-finder` and deploys from GitHub `main` through the Vercel Git integration.

Canonical production URL:

- `https://secondary-condition-finder.vercel.app`

The normal production build is `npm run build` / `next build`. The legacy Azure Static Web Apps workflow remains manual fallback infrastructure only and is not a production readiness signal.

Repository CI is read-only and is the code-quality gate. After a successful `CI` run on `main`, `.github/workflows/production-runtime-readiness.yml` automatically verifies the exact successful CI commit. The readiness workflow does not accept an arbitrary operator-supplied deployed SHA.

Current verified baseline at the time of this update:

- production commit `24d4c4f7534e12866d306920c2959213c81b970c`;
- main CI #740 succeeded on that exact commit, including the real-browser E2E gate;
- Vercel reported a successful production deployment for that exact commit;
- Production Runtime Readiness #102 succeeded from the successful CI lineage on that exact commit.

This baseline is historical evidence, not a permanent production identifier. Every later successful `main` deployment must establish a new exact-commit readiness result.

## Historical Verified Vercel production runtime checkpoint

Issue #213 is the historical evidence record for the first verified Vercel production runtime checkpoint. It was closed as completed after the following exact-commit evidence was established:

- production commit `c49fe2414d7a29c50935af91f3f3a08db933c417`;
- Repository CI #716 succeeded on that exact commit;
- Vercel deployment `dpl_2bMJZhr2cCCJnrGtVQeQ2NAcGebM` reported success for that commit and served `https://secondary-condition-finder.vercel.app`;
- Production Runtime Readiness #78 succeeded on that exact commit;
- the historical route matrix included `/runtime-readiness=200`;
- `/runtime-readiness` rendered `data-runtime-readiness="ready"` after the production workflow-session crypto round trip.

That checkpoint remains useful historical evidence, but it does not override the current trusted-lineage design and is not a substitute for a fresh exact-commit readiness result after later `main` deployments.

## Required production runtime setting

Configure production runtime settings in the Vercel project's **Production** environment. Do not place secret values in source control or expose them through `NEXT_PUBLIC_*` variables.

| Setting | Required | Value / behavior |
|---|---:|---|
| `WORKFLOW_SESSION_SECRET` | Yes | Server-only cryptographically random value of at least 32 characters. It encrypts and authenticates secondary and presumptive workflow cookies. Production fails closed when it is absent or too short. |
| `VA_SANDBOX_ENABLED` | No | Leave unset or `false` until VA sandbox integration is intentionally being exercised. |
| `VA_SANDBOX_API_KEY` | Only when sandbox is enabled | Server-only VA sandbox API key. Never expose through `NEXT_PUBLIC_*`. |
| `VA_SANDBOX_TIMEOUT_MS` | No | Optional per-attempt timeout. Defaults to 4000 ms. |
| `VA_FORMS_SANDBOX_BASE_URL` | No | Optional HTTPS override for the VA Forms sandbox endpoint root. |
| `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL` | No | Optional HTTPS override for the Benefits Reference Data sandbox endpoint root. |

`SECONDARY_WORKFLOW_SESSION_SECRET` remains a backward-compatible fallback only. New deployments must configure `WORKFLOW_SESSION_SECRET`.

Vercel environment-variable changes apply to newly created deployments. After adding or rotating the workflow-session secret, create a new production deployment and require a fresh successful runtime-readiness result.

## Objective runtime-secret verification

The application exposes a deliberately non-sensitive, force-dynamic server-rendered route at `/runtime-readiness`. It does **not** return the secret, its length, a hash, key material, cookie content, or environment-variable values.

At request time the route calls the real workflow-session crypto self-test and renders one high-level marker: `data-runtime-readiness="ready"` or `data-runtime-readiness="not_ready"`. It reports `ready` only when the server is in production, the primary `WORKFLOW_SESSION_SECRET` satisfies the production requirement, and the real AES-256-GCM workflow-session implementation can seal and reopen an in-memory probe.

### Automated evidence contract

`.github/workflows/production-runtime-readiness.yml` runs only after a successful repository `CI` workflow on `main`. It:

1. resolves the exact successful CI commit from the `workflow_run` event;
2. waits for the Vercel commit status to report success for that same SHA;
3. derives the matching deployment from that exact-commit status;
4. waits for the canonical production alias to converge to that deployment;
5. probes the production route matrix using status-only checks where appropriate;
6. requests `/runtime-readiness` into a temporary private file and requires HTTP 200 plus `data-runtime-readiness="ready"`;
7. deletes temporary response bodies and does not print or attach them;
8. records only non-sensitive runtime evidence.

There is no manual arbitrary-SHA readiness path. If a commit needs a fresh production readiness result, it must reach production through the reviewed `main`/CI lineage.

### Evidence that may be recorded

- UTC timestamp;
- exact deployed commit;
- canonical production URL;
- Vercel deployment identifier and high-level status;
- route HTTP status codes;
- high-level runtime readiness result.

Never paste, print, log, attach, or otherwise record the workflow-session secret, secret length, hashes, derived key material, cookie payloads, VA API credentials, or environment-variable values.

## Browser security baseline

`next.config.ts` applies the security header set to all routes.

Production Content Security Policy is source-restrictive rather than the earlier partial policy:

- `default-src 'self'`;
- production scripts restricted to self plus the inline allowance required by the current static Next.js header strategy; production does not include `unsafe-eval`;
- `script-src-attr 'none'`;
- styles restricted to self plus the inline style allowance required by the current app;
- images restricted to self, `data:`, and `blob:`;
- fonts restricted to self and `data:`;
- `connect-src 'self'` in production;
- workers restricted to self and `blob:`;
- frames and objects denied;
- base URLs and form submissions restricted to self;
- frame ancestors denied;
- insecure requests upgraded.

Development alone adds the WebSocket and eval allowances needed by Next.js development/HMR tooling.

The remaining route-wide headers are:

- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, and USB APIs;
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

Any future CSP relaxation must be narrowly justified and validated through the real-browser CI gate before merge.

## Browser telemetry posture

`NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` remains an optional build-time variable in application code. The client initializer, when present, disables automatic route/AJAX/fetch tracking and strips query strings and fragments from telemetry URLs.

However, the current **production CSP permits browser connections only to the same origin** (`connect-src 'self'`). Therefore the current production browser policy does not authorize third-party Application Insights network egress. Do not describe Application Insights as active production telemetry unless the CSP and deployment configuration are deliberately changed in a separately reviewed privacy/security change.

Never put health, disability, service-history, workflow-session secrets, or VA API credentials in any `NEXT_PUBLIC_*` variable.

## Browser-local evidence handling

Optional evidence review stays in the browser. The application enforces these local resource ceilings:

- 20 MB per file;
- 10 selected files per analysis batch;
- 50 MB accepted file bytes per batch;
- 300 pages per PDF source;
- 500,000 extracted or pasted characters per source;
- 10 retained source analyses per browser tab.

Raw selected document bytes and raw document text are not sent to the application server by this feature. Extracted evidence excerpts and evidence-gap review selections are tab-scoped browser session state and can be cleared by the user.

## VA sandbox behavior and credential gate

VA sandbox integration remains disabled by default. When disabled, public-reference pages use local fallback data and do not require VA credentials.

Credentialed VA sandbox verification is intentionally deferred until the application is demo-ready. Do not manufacture credentials, replace the real credentialed check with mocks, or treat local fallback behavior as proof of VA connectivity.

When sandbox access is eventually enabled, keep VA API keys server-only and run the separately governed credentialed smoke test before claiming sandbox connectivity.

## Runtime and pipeline reproducibility

- `package.json` declares Node `22.x`;
- normal `npm run build` is Vercel-native and does not force standalone output;
- legacy `npm run build:azure` retains standalone packaging only for the manual Azure fallback;
- CI marketplace actions in the active CI workflow are pinned to immutable commit SHAs;
- CI has `contents: read` only and does not create or mutate GitHub issues;
- the real Chrome/ChromeDriver secondary-workflow journey runs after the production build and is part of the final CI gate.

## Legacy Azure manual fallback

The legacy Azure deployment workflow remains historical/manual fallback infrastructure only. It has no `push` or `pull_request` trigger. An operator must explicitly use the manual workflow and opt into the legacy deployment path; Azure success or failure is not used as the production readiness signal.

## Production verification checklist

After every production deployment:

1. Confirm repository CI succeeded on the exact `main` commit.
2. Confirm the Vercel success status corresponds to that same commit.
3. Confirm the canonical production alias converged to that exact deployment.
4. Require Production Runtime Readiness to succeed from that CI lineage.
5. Confirm the real-browser E2E step succeeded in the corresponding CI run.
6. Confirm the production security headers remain present and the CSP remains source-restrictive.
7. Verify `/`, `/about`, and `/va-forms` are available and `/runtime-readiness` reports ready.
8. Keep VA sandbox mode disabled unless intentionally running the credentialed integration gate.

## Known external verification boundaries

Repository CI, Vercel deployment status, browser E2E, and Production Runtime Readiness verify application implementation and deployment behavior. They do **not** prove either of these external gates:

- credentialed VA sandbox access (tracked separately by issue #189 and intentionally deferred until demo-ready);
- Section 508 conformance evidence (tracked separately by issue #195 and requiring manual evidence).

Do not infer either external gate from a green production deployment.
