# Production deployment readiness

This runbook describes the production controls active for the Secondary Condition Finder and the external gates that remain deliberately separate.

## Current production host and trusted lineage

Production is hosted on the Vercel Pro project `secondary-condition-finder` and deploys from GitHub `main` through the Vercel Git integration.

Canonical production URL:

- `https://secondary-condition-finder.vercel.app`

The normal production build is `npm run build` / `next build`. Repository CI is read-only and is the code-quality gate. After a successful `CI` run on `main`, `.github/workflows/production-runtime-readiness.yml` verifies the exact successful CI commit rather than accepting an arbitrary operator-supplied SHA.

### Current verified checkpoint

At this runbook refresh:

- production commit: `193f26030b9b90b81c832c6a645f179717abf307`;
- main CI #797: success on that exact commit, including real-browser E2E;
- Vercel production deployment: `dpl_BwX77rhfw5Bank2oRe3zjgYaykR6` — READY on that exact commit;
- canonical production alias: converged to that deployment;
- Production Runtime Readiness #156: success on the same exact CI/deployment lineage;
- production `/va-reference`: HTTP 200 and explicitly labeled local fallback because VA access remains disabled.

This checkpoint is objective historical/current evidence, not a permanent production identifier. Every later production commit must establish its own successful lineage.

## Historical first Vercel runtime checkpoint

Issue #213 is the completed historical evidence record for the first verified Vercel workflow-session runtime checkpoint. It remains useful history but does not replace the fresh exact-commit check after later deployments.

## Required Vercel production settings

Configure server-only values in the Vercel project's **Production** environment. Never expose secrets through `NEXT_PUBLIC_*` variables.

### Workflow-session security

| Setting | Required | Behavior |
|---|---:|---|
| `WORKFLOW_SESSION_SECRET` | Yes | Cryptographically random server-only value of at least 32 characters. Production fails closed when absent/too short. |
| `SECONDARY_WORKFLOW_SESSION_SECRET` | Legacy only | Backward-compatible fallback; new deployments must use `WORKFLOW_SESSION_SECRET`. |

Vercel environment-variable changes apply to newly created deployments. After adding or rotating the workflow-session secret, create a new production deployment and require a fresh successful Production Runtime Readiness result.

### VA public-reference environment selection

The full contract is in `docs/va-api-runtime-configuration.md`.

| Setting | Default | Behavior |
|---|---|---|
| `VA_API_ENV` | `sandbox` | Selects intended upstream environment: `sandbox` or `production`. |
| `VA_API_ENABLED` | `false` | Explicit environment-neutral enable flag. Production mode requires `true`. |
| `VA_API_TIMEOUT_MS` | `4000` | Optional per-attempt timeout override. |
| `VA_SANDBOX_ENABLED` | `false` | Backward-compatible sandbox-only enable flag used by the Phase 2 smoke-test contract. |
| `VA_SANDBOX_TIMEOUT_MS` | unset | Backward-compatible sandbox-era timeout fallback. |

### Sandbox service credentials

Use only for intentional sandbox operation:

- `VA_FORMS_SANDBOX_API_KEY`
- `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`
- optional HTTPS overrides `VA_FORMS_SANDBOX_BASE_URL` and `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL`

### Production service credentials

Do **not** configure/enable these as an active production path until VA grants production access and the transition is deliberately reviewed:

- `VA_FORMS_PRODUCTION_API_KEY`
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`
- optional HTTPS overrides `VA_FORMS_PRODUCTION_BASE_URL` and `VA_BENEFITS_REFERENCE_PRODUCTION_BASE_URL`

Merely setting `VA_API_ENV=production` must not activate production traffic. `VA_API_ENABLED=true` and the relevant service credential are also required. Forms requests use only the Forms credential; Benefits Reference Data requests use only the Benefits Reference Data credential.

## Objective workflow-session runtime verification

`/runtime-readiness` is force-dynamic and deliberately non-sensitive. It does not return the secret, its length, a hash, derived key material, cookie content, or environment-variable values.

The route reports `data-runtime-readiness="ready"` only when the deployed runtime is production, the primary `WORKFLOW_SESSION_SECRET` satisfies the production requirement, and the real AES-256-GCM workflow-session implementation can seal and reopen an in-memory probe.

### Automated evidence contract

Production Runtime Readiness:

1. resolves the exact successful `main` CI commit from the `workflow_run` event;
2. waits for a Vercel success status for that same SHA;
3. derives the matching Vercel deployment;
4. waits for the canonical production alias to converge to that deployment;
5. probes the production route matrix;
6. requires `/runtime-readiness` HTTP 200 plus `data-runtime-readiness="ready"`;
7. deletes temporary response bodies;
8. records only non-sensitive commit/deployment/status evidence.

There is no trusted arbitrary-SHA manual readiness path.

## VA public-reference runtime behavior

VA access is disabled by default. With no enabling configuration, the app serves clearly labeled local fallback reference data and makes no VA public-reference request.

When enabled in an approved environment:

- the adapter requires HTTPS endpoints;
- sends only the credential for the service being called;
- validates successful payloads;
- uses at most two attempts with one bounded retry for supported transient failures;
- falls back locally on upstream failure;
- emits only privacy-safe operational observations;
- shares a bounded five-minute successful-response cache across Forms search, disability terminology, and service branches.

User-facing reference pages expose only source/environment/retrieval/cache state. Credentials, raw payloads, and workflow selections are never part of that status surface.

### Algorithm isolation

VA administrative reference data remains outside the decision logic:

- secondary recommendations are computed independently of VA terminology lookup;
- per-result VA reference blocks are annotations only;
- optional service-branch context is stored in the encrypted presumptive session but is not read by `matchPresumptives()`.

## Browser security baseline

`next.config.ts` applies route-wide security headers, including:

- source-restrictive production CSP;
- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- restrictive `Permissions-Policy`;
- HSTS with subdomains.

The current production CSP uses `connect-src 'self'`. Do not describe third-party browser telemetry as active production network egress unless CSP and deployment configuration are deliberately changed in a separately reviewed privacy/security change.

## Browser-local evidence handling

Optional evidence review remains browser-local and is bounded by an analysis depth chosen on the Supporting Documents step. The depth defaults to Standard on every visit; the numbers below are the single source of truth in `src/lib/evidence/limits.ts` and are mirrored on `/privacy`.

Standard (default):

- 20 MB per file;
- 10 selected files per batch;
- 50 MB accepted bytes per batch;
- 300 pages per PDF;
- 500,000 extracted/pasted characters per source;
- 10 retained source analyses per browser tab.

Extended (explicit opt-in):

- 100 MB per file;
- 200 selected files per batch;
- 1 GB accepted bytes per batch;
- 2,000 pages per PDF;
- 3,000,000 extracted/pasted characters per source;
- up to 200 retained source analyses per browser tab.

Sources over the active depth's limits are rejected rather than silently truncated. Raw selected document bytes/text are not sent to the application server by this feature in either depth.

## Runtime and pipeline reproducibility

- `package.json` declares Node `22.x`;
- normal production build is Vercel-native `next build`;
- active CI is read-only and includes dependency audit, citation audit, KB validation, lint, typecheck, tests, production build, and real-browser E2E;
- exact-commit production readiness is verified after successful `main` CI.

## Legacy Azure manual fallback

The former Azure Static Web Apps path remains **manual legacy fallback only**. It has no `push` or `pull_request` trigger and is not a production readiness signal. The normal production host is Vercel.

## Production verification checklist

After every production deployment:

1. Confirm CI succeeded on the exact `main` commit.
2. Confirm the Vercel success status corresponds to that SHA.
3. Confirm the canonical alias converged to that exact deployment.
4. Require Production Runtime Readiness success from that CI lineage.
5. Confirm real-browser E2E passed in the associated CI run.
6. Confirm production security headers/CSP remain intact.
7. Smoke `/`, `/about`, `/va-forms`, `/va-reference`, and `/runtime-readiness`.
8. Keep VA public-reference access disabled unless intentionally running an approved sandbox or production transition.
9. Never infer #189 sandbox proof or #195 Section 508 conformance from a green production deployment.

## Known external verification boundaries

Repository CI, Vercel deployment status, browser E2E, and Production Runtime Readiness do **not** prove:

- credentialed VA sandbox access — tracked by issue #189;
- Section 508 conformance — tracked by issue #195;
- VA production API access — tracked by issue #287 until granted and objectively verified.
