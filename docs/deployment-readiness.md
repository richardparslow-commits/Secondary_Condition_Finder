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

### Runtime crypto-readiness marker

The secondary and presumptive research workflows keep state in browser `sessionStorage`; they do not require a server-side workflow cookie or workflow-session encryption secret. The legacy runtime marker below remains a production health/readiness gate, but it is not proof of research-workflow persistence or optional VA-account readiness.

| Setting | Required for readiness marker | Behavior |
|---|---:|---|
| `WORKFLOW_SESSION_SECRET` | Yes | Server-only value, at least 32 characters. Production `/api/health` and `/runtime-readiness` fail readiness when absent/too short; this marker does not encrypt research workflow context. |
| `SECONDARY_WORKFLOW_SESSION_SECRET` | Retired | Retired 2026-10-10 (REL-04 follow-up): no longer read; the crypto helper and the readiness probe both require primary `WORKFLOW_SESSION_SECRET`. |

Vercel environment-variable changes apply to newly created deployments. After adding or rotating the primary readiness-marker secret, create a new production deployment and require a fresh successful Production Runtime Readiness result.

### Separate VA-account sandbox session store

The optional VA-account sandbox is disabled by default and uses its own encryption key and store configuration. To configure that feature, see [VA account sandbox](va-account-sandbox.md): `VA_ACCOUNT_SESSION_SECRET` (at least 32 characters), `VA_ACCOUNT_STORE_URL` / `VA_ACCOUNT_STORE_TOKEN` for a hosted store, exact `APP_URL`, and issued client registration settings. The generic runtime readiness marker does not confirm this feature is configured.

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
- `VA_ACCREDITED_REP_SANDBOX_API_KEY` (Phase 3.1 locator; optional, additionally gated by `VA_ACCREDITED_REP_ENABLED=true`)
- optional HTTPS overrides `VA_FORMS_SANDBOX_BASE_URL`, `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL`, `VA_ACCREDITED_REP_SANDBOX_BASE_URL`

### Production service credentials

Do **not** configure/enable these as an active production path until VA grants production access and the transition is deliberately reviewed:

- `VA_FORMS_PRODUCTION_API_KEY`
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`
- `VA_ACCREDITED_REP_PRODUCTION_API_KEY` (Phase 3.1 locator; optional, additionally gated by `VA_ACCREDITED_REP_ENABLED=true`)
- optional HTTPS overrides `VA_FORMS_PRODUCTION_BASE_URL`, `VA_BENEFITS_REFERENCE_PRODUCTION_BASE_URL`, `VA_ACCREDITED_REP_PRODUCTION_BASE_URL`

Merely setting `VA_API_ENV=production` must not activate production traffic. Production resolution also requires `VA_API_ENABLED=true`, `VA_PRODUCTION_ACCESS_GRANTED=true` and both service-specific production credentials. Forms requests use only the Forms credential; Benefits Reference Data requests use only the Benefits Reference Data credential. Distributed requests additionally require `VA_SHARED_CONSUMER_BUDGET=true` and successful shared circuit/budget admission; configuring a shared cache alone is insufficient.

Before application activation, use the manual [controlled production check](va-api-runtime-configuration.md#controlled-production-connectivity-check-issue-287) with application VA access disabled. It requires a real VA grant, checks Forms/disabilities/service branches and emits bounded sanitized evidence. A successful check does not activate the app or close #287; exact-build deployed-runtime, source-status and coordination verification remain required.

## Objective workflow-session runtime verification

`/runtime-readiness` is force-dynamic and deliberately non-sensitive. It does not return the secret, its length, a hash, derived key material, cookie content, or environment-variable values.

The route reports `data-runtime-readiness="ready"` only when the deployed runtime is production, the primary `WORKFLOW_SESSION_SECRET` satisfies the production requirement, and the AES-256-GCM helper can seal and reopen an in-memory probe. This verifies the legacy crypto-readiness marker only; it does not inspect browser-local research workflow state or the independent VA-account session store.

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
- optional service-branch context is stored in the browser-local presumptive service-history record and is not read by `matchPresumptives()`.

## Browser security baseline

`next.config.ts` applies route-wide security headers, including:

- source-restrictive production CSP;
- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- restrictive `Permissions-Policy`;
- HSTS with subdomains.

The current production CSP uses `connect-src 'self'`. Do not describe third-party browser telemetry as active production network egress unless CSP and deployment configuration are deliberately changed in a separately reviewed privacy/security change. `script-src` carries one narrow addition beyond the strict-dynamic nonce contract: `'wasm-unsafe-eval'`, which permits WebAssembly compilation only (used by the browser-local OCR core). It does not enable general `eval` and does not open any external egress.

Browser-local OCR assets (the tesseract.js worker, its WASM core, and the English traineddata) are copied verbatim from pinned `node_modules` packages during postinstall into `public/tesseract/`, following the same convention as the PDF.js worker. OCR therefore loads every asset from the application's own origin and makes no external request.

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

Sources over the active depth's limits are rejected rather than silently truncated. Each selected document is assigned its own author type (clinician vs. lay, defaulting to a per-batch default), so a mixed batch classifies every document under the authorship the user selected for it. Raw selected document bytes/text are not sent to the application server by this feature in either depth.

## Runtime and pipeline reproducibility

- `package.json` declares Node `22.x`;
- normal production build is Vercel-native `next build`;
- active CI is read-only and includes dependency audit, citation audit, KB validation, lint, typecheck, tests, production build, and real-browser E2E;
- exact-commit production readiness is verified after successful `main` CI.

## Legacy Azure manual fallback

The former Azure Static Web Apps path remains **manual legacy fallback only**. It has no `push` or `pull_request` trigger and is not a production readiness signal. The normal production host is Vercel.

## Shared admission ceiling (SEC-02)

`src/lib/rate-limiter.ts` charges one **shared admission ceiling** on every limited surface, in addition to the per-client bucket. It bounds traffic that presents no usable identity and traffic that rotates identities so no bucket ever accumulates; it is also the per-instance throughput floor for limited surfaces, because honest requests pay into it too. The default is **6000 charges per 60-second window per instance** (`RATE_LIMIT_UNATTRIBUTED_MAX`); the derivation, its failure directions and the triggers that force a re-derivation are recorded in [the ceiling-default decision](sec-02-admission-ceiling-default-2026-10-09.md).

**Read it.** `GET /api/health` reports the ceiling as `components.rateLimit.ceiling` (`max`, `windowMs`, `variable`, `key`), beside `components.rateLimit.identity`, `.scope` (`single-process` | `per-instance`) and `.store` (`mode`, `distributed`, `blockedBy`). `max` is read off the limiter that actually enforces it, so the reported value and the applied value cannot drift apart.

**Verify it after every deployment.** The reported `ceiling.max` must equal the value you intended. Only plain decimal digits parse: `1e9`, `0x10`, `5.0`, `5x` or an empty value **silently fall back to the default**, so such a typo shows up as the number you did not set rather than as an error. After changing `RATE_LIMIT_UNATTRIBUTED_MAX`, re-read `/api/health` and confirm the new value took effect.

**Read it per instance.** The counter is per process, so a fleet-wide reading needs a request to each instance (or a platform that pins them). `components.rateLimit.scope` reports the *classification* — `per-instance` whenever `NODE_ENV=production` or a distributed-runtime marker is set — not a measured instance count.

**Read a refusal.** Every limiter answers `429` with `Retry-After` and the same body, so a single response does not say which budget refused. Distinguish by breadth: many *different* client identities refused within the same minute indicates the shared ceiling is saturated; the same identity refused repeatedly is its own per-client bucket. The refusal reason (`refusedBy`) is computed inside `chargeAdmission` but is not currently logged or returned, so ceiling saturation is not directly alertable today — close that gap before treating a 429 count as a capacity signal.

**When it trips.** The ceiling is a last-resort aggregate bound, not a target. If honest traffic can reach it, raise the value and record the new derivation; if it trips only under abuse, reduce pressure at the edge instead of raising the number, which would trade the abuse bound for nothing.

**What it is not.** The counter is process-local, so the fleet aggregate is roughly the ceiling × instance count, and `components.rateLimit.store` says so (`mode: "process-local"`, `blockedBy: "no-store-provisioned"`). This is **not** a deployment-wide quota; the evidence required before it may be described as one is the operator procedure in [the SEC-02 hosted acceptance runbook](sec-02-hosted-acceptance-runbook-2026-10-09.md).

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
