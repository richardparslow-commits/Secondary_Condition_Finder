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

Before application activation, use the manual [controlled production check](va-api-runtime-configuration.md#controlled-production-connectivity-check-issue-287) with application VA access disabled. It requires a real VA grant, checks Forms/disabilities/service branches and emits bounded sanitized evidence. A successful check does not activate the app; #287 is closed as not pursued (2026-10-15), and exact-build deployed-runtime, source-status and coordination verification would still be required before any activation.

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

The baseline has **one owner per response**. `next.config.ts` supplies it for every framework-rendered response; the edge proxy supplies it only on the responses it constructs itself (429 refusals and the private-context 400), which never pass through the config pipeline. A successful proxy pass deliberately does not set the baseline: on the Cloudflare/OpenNext runtime the two sources are concatenated rather than replaced, and a Worker response was observed carrying `Strict-Transport-Security: max-age=…, max-age=…` and `X-Frame-Options: DENY, DENY` — a repeated HSTS directive is discarded by browsers (RFC 6797) and the XFO value is invalid. `npm run smoke:worker` is the repeatable form of that check: it builds with OpenNext, serves the artifact under `wrangler dev`, and fails if any document or API response repeats a baseline header, carries a merged value, or presents a CSP with two policies. It reads `rawHeaders` rather than `fetch`, because `fetch` folds a repeated header into one comma-joined string. The same run checks the assets binding's `public/_headers` rule on an unversioned worker asset and asserts that the catalog and knowledge-base graph still load from the Worker bundle; `npm run smoke:worker -- --skip-build` reuses an existing `.open-next` build. The same single set was verified on a Node `next start`.

The current production CSP uses `connect-src 'self'`. Do not describe third-party browser telemetry as active production network egress unless CSP and deployment configuration are deliberately changed in a separately reviewed privacy/security change. `script-src` carries one narrow addition beyond the strict-dynamic nonce contract: `'wasm-unsafe-eval'`, which permits WebAssembly compilation only (used by the browser-local OCR core). It does not enable general `eval` and does not open any external egress.

Styles follow the same nonce contract rather than a blanket allowance: production is `style-src 'self' 'nonce-<per-request>'` plus `style-src-attr 'none'` (audit SEC-03), and `'unsafe-inline'` survives only on the development branch. A deployment check should therefore expect **no** `'unsafe-inline'` in either `script-src` or `style-src`, and should find no style attribute in any served page — the app writes its two computed values through the CSSOM instead.

Browser-local OCR assets are copied verbatim from pinned `node_modules` packages during postinstall, following the same convention as the PDF.js worker: the tesseract.js worker and its WASM core land in `public/tesseract/`. The English traineddata is the exception. At 10.4 MiB it cannot live in `public/` without breaking the Sites upload budget (32 MiB for the whole deployment), so postinstall writes it to `.data-bundle/ocr/` and `/api/ocr-model` serves it at the canonical `/tesseract/eng.traineddata.gz` path. On Node the route reads that copy; on Cloudflare Workers it fetches the digest-pinned `@tesseract.js-data/eng@1.0.0` file from the pinned CDN URL (`OCR_MODEL_URL` may name an https mirror), verifies its SHA-256 and memoizes the verified bytes per isolate. The Workers Cache API is not available to a Sites Worker (`This Worker is not permitted to access the default cache`), so the `immutable` response header — not a `cache.put` — is what keeps repeat loads cheap.

The Node deployments carry that copy with the route that reads it: `/api/ocr-model`'s trace contains `.data-bundle/ocr/eng.traineddata.gz`, so Vercel and Azure serve the model from their own artifact instead of fetching the pinned CDN file at runtime. `npm run audit:traces` allows that single directory under `.data-bundle/` and still rejects the generated embedded-data files beside it, which are compiled into the bundle and must not ship as raw bytes.

The rest of the browser-local asset set is compressed on purpose. The tesseract core ships as the single-file `tesseract-core-simd.wasm.js`, whose emscripten glue carries the WebAssembly module inline; the sibling `tesseract-core-simd.wasm` is never requested and is therefore not provisioned (it cost 3.3 MiB of the upload budget on its own). With the model off the upload path and that redundant binary gone, the whole deployment measures about 28 MiB against the 32 MiB Sites budget. The browser still loads every OCR asset from the application's own origin — `connect-src` remains `'self'` — and no request carries user data.

**Worker-asset caching and compression.** `/tesseract/*` and `/pdf.worker.min.mjs` are unversioned — the URLs stay fixed while the copied `node_modules` bytes change on an upgrade — so they are served `Cache-Control: public,max-age=3600,must-revalidate`, never `immutable`. A year-long immutable entry, which is correct for the content-hashed `/_next/static/*` chunks, would outlive a deploy here and let a browser pair a stale tesseract worker or WASM core with the new page bundle that requests it. The policy is declared twice because two hosts answer these paths and only one runs Next.js: `next.config.ts` `headers()` for Vercel, Docker and Azure, and `public/_headers` for the Sites assets binding, which responds before the Worker and never executes `headers()`. Both are pinned to the same value by `tests/static-asset-delivery.test.ts`, which also refuses `immutable` or a TTL beyond a day on these paths.

Compression is negotiated by the host rather than declared: `compress: true` pins Next.js gzip on Node (measured 4.75 MiB → 1.77 MiB for the OCR core), and Cloudflare's assets binding serves Brotli/gzip for the same JavaScript (measured 1.64 MiB). `public/_headers` therefore must not set `Content-Encoding` (which would suppress host compression or describe bytes that are not encoded) or `no-transform` (which forbids it). A binary added to `public/tesseract/` would fail the delivery test, forcing an explicit encoding and cache decision instead of inheriting the script policy.

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

**Read which hop is trusted.** `components.rateLimit.identity` reports the *ingress model* as well as the boolean claim: `model` (`unasserted` | `set` | `append`), `header`, `hop` (`leftmost` | `nth-from-right`), `hopsFromRight`, `fallback` and `detail`. A per-client key is only worth something if the hop it is read from is one the client cannot write, so `RATE_LIMIT_TRUSTED_INGRESS` selects that hop instead of assuming it. Unset — or any value it cannot read, which falls back rather than guessing — is `unasserted`: the key is the leftmost `X-Forwarded-For` hop, falling back to a usable `X-Real-IP`. That is correct for an ingress that *sets* the header and client-controlled for one that *appends* to it. `true`, `set`, `overwrite` or `platform` declares the setting ingress and keeps that rule. `append` / `append:N` declares an ingress that appends the peer it observed to whatever the client sent, so the key is hop `N` from the right and the client's own hops in front of it are never read, and an existing `X-Real-IP` is not used at all — an appending ingress does not set that header, so a value there is client-supplied. A request carrying fewer than `N` hops did not traverse every declared appender and is unattributed, charged to the surface's shared bucket for identity-less requests and bounded by the ceiling as well. Declare the exact number of appenders in the path: with more declared than present, a client that pads the header with an extra value becomes the hop that is read.

**Verify the model, not only the flag.** The claim is falsifiable at exactly this field: compare `components.rateLimit.identity` against what your ingress actually writes. A deployment whose edge passes a client's header through must not read `set`, and one fronted by an appending proxy that reads `unasserted` is keying on a value the client chose. Nothing in this repository makes that comparison for you — `RATE_LIMIT_TRUSTED_INGRESS` selects the hop, it does not prove the ingress wrote it — and the behavioural check at a real edge is Group A of [the SEC-02 hosted acceptance runbook](sec-02-hosted-acceptance-runbook-2026-10-09.md).

**Read what an identity-less request gets.** `components.rateLimit.identity.unidentified` reports `policy` — `ceiling` or `shared-per-client-bucket` — with the class bucket's `keyTemplate` and a `detail`. Where `RATE_LIMIT_TRUSTED_INGRESS` declares a model, a request that arrives without a usable identity did not traverse that ingress and is not one of its clients, so the class shares **one bucket per surface at that surface's own per-client limit** (`unidentified:<limiter>`): the class gets exactly what one client gets, instead of the whole ceiling, which had made hiding or junking the identity the cheapest strategy available to a caller. Where no model is declared, `policy` is `ceiling` and nothing changed — without a declared ingress an identity-less request cannot be told apart from an honest client of a deployment whose forwarding headers never arrive, and charging that whole population to one bucket at a client's own limit would cap it at one client's allowance. Two consequences worth knowing: an `unidentified` refusal is the signature of a **wrong declaration** (the model says the identity always arrives, and it did not), and this closes the *allowance inversion* only — every attempt still charges the aggregate ceiling, so an attacker can still draw that budget down until the window turns over, which is why the edge WAF remains the capacity layer.

**Verify it after every deployment.** The reported `ceiling.max` must equal the value you intended. Only plain decimal digits parse: `1e9`, `0x10`, `5.0`, `5x` or an empty value **silently fall back to the default**, so such a typo shows up as the number you did not set rather than as an error. After changing `RATE_LIMIT_UNATTRIBUTED_MAX`, re-read `/api/health` and confirm the new value took effect.

**Read it per instance.** The counter is per process, so a fleet-wide reading needs a request to each instance (or a platform that pins them). `components.rateLimit.scope` reports the *classification* — `per-instance` whenever `NODE_ENV=production` or a distributed-runtime marker is set — not a measured instance count.

**Read a refusal.** Every limiter answers `429` with `Retry-After` and the same body, so a single response does not say which budget refused — that uniformity is deliberate, so one probe cannot tell the shared ceiling from its own bucket. Distinguish by breadth: many *different* client identities refused within the same minute indicates the shared ceiling is saturated; the same identity refused repeatedly is its own per-client bucket. The reason is now counted rather than returned: the `refusedBy` that `chargeAdmission` already computed is recorded per instance by `src/proxy.ts` into a bounded 15-minute window and reported as `components.rateLimit.refusals`, so ceiling saturation is alertable instead of inferred from a refusal count.

**Alert on the reason, not the count.** `components.rateLimit.refusals` reports `received`, `byBudget` (`ceiling`, `perClient`, `unidentified` — the shared bucket for requests that presented no identity), `ceilingShare` (0–100, or `null` when nothing was retained), the busiest `surfaces` with their counts and last refusal — `method-post` for the method-scoped POST bucket, `reference-read` for the shared reference-read budget, or a policed route path — plus `evicted` at the retention bound (256 events), `since`, `lastRefusedAt` and `detail`. A rising `byBudget.ceiling` with a rising `ceilingShare` is **aggregate** pressure: many different clients refused inside one window means the ceiling is being spent, which is the reading that says the aggregate bound is doing the work rather than a per-client bucket. A non-zero `byBudget.unidentified` is a different signal entirely: requests that carry none of the identity this deployment's model promises are reaching the application, so check the declaration against the ingress before reading anything else into the number. Two caveats stay with the number: the window is per instance and forgets rows on cold start, and a refusal the edge WAF answered itself never reaches the application at all, so `received: 0` means this instance refused nothing in this window, not that nothing was refused anywhere. The window stores the surface and the reason only — never the client key, because this payload is public.

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

Repository CI, Vercel deployment status, browser E2E, and Production Runtime Readiness do **not** prove completion of external/manual gates. The [R-04 ownership register](external-manual-gates-status.md) is the canonical record for dates, targets/triggers, completion criteria, and pending dependencies. Every gate below has a named accountable owner; the two open trackers (#195/#539) are assigned to Richard Parslow in GitHub. #287 was closed as not pursued on 2026-10-15, and #537 and #538 were closed the same day on recorded reviews — of the hosting platform's published log terms and of its documented absence of query-parameter scrubbing respectively, each with its unread account facts or retained request line named and accepted. None of those is a completed external verification.

| External/manual gate | Tracking issue | Status | Named accountable owner | Owner responsibility |
| --- | --- | --- | --- | --- |
| Credentialed VA sandbox smoke test | [issue #189](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/189) | COMPLETE / CLOSED | Richard Parslow (`richardparslow-commits`) | Preserve historical credentialed success evidence; no new assignment |
| Manual Section 508 accessibility review | [issue #195](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/195) | OPEN / HUMAN-ONLY | Richard Parslow (`richardparslow-commits`) | Commission independent tester, schedule exact-build session, coordinate evidence/retests/sign-off |
| Production workflow-session secret | [issue #213](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/213) | COMPLETE / CLOSED | Richard Parslow (`richardparslow-commits`) | Preserve historical runtime-verification evidence; require fresh lineage after later deployments |
| VA public-reference production transition | [issue #287](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/287) | CLOSED / NOT PURSUED | Richard Parslow (`richardparslow-commits`) | Closed 2026-10-15 as a scope decision: VA production activation is not pursued and the labelled local catalog fallback is the intended steady state. No VA grant, credential, controlled check or live production evidence is claimed; the fail-closed production path stays implemented and inert |
| Hosting log retention and access-control review | [issue #537](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/537) | CLOSED / RECORDED WITH RESIDUAL ACCEPTED | Richard Parslow (`richardparslow-commits`) | Closed 2026-10-15: the [ownership register](external-manual-gates-status.md) records the platform's published retention/access/redaction terms per sink, names the four account facts that were not read (plan tier, Observability Plus, drain existence, 2FA/SSO state), and carries the owner's dated acceptance of that residual. It is not a read of the hosting account. Reopen under the original criterion if credentialed hosted use is pursued |
| OAuth callback-URL log scrubbing review | [issue #538](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/538) | CLOSED / RECORDED WITH RESIDUAL ACCEPTED | Richard Parslow (`richardparslow-commits`) | Closed 2026-10-15 on the register's per-sink record of the platform's *documented* behaviour: a callback request line reaches runtime logs and any account-configured drain with its query string, and no documented setting removes `code`/`state` or query parameters, so the retained line is an accepted residual rather than a configured scrub. It is not a read of the hosting account and establishes no retention value; the shipped callback surfaces and the code-side no-sink conclusion are in the [hosting log and callback inventory](hosting-log-and-callback-inventory.md) |
| Privacy-policy approval and monitored contact | [issue #539](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539) | OPEN / CHANNEL UNVERIFIED | Richard Parslow (`richardparslow-commits`) | Approval recorded 2026-10-15 (accept as published) with the named handler and the [fulfilment procedure](privacy-request-fulfilment-procedure.md). The gate stays open because the only published privacy-request address is at a domain that does not resolve (NXDOMAIN from the `.org` registry, 2026-10-15), so no request can arrive and no send/receive test can run: register the domain, operate the mailbox, then record the sanitized test outcome |

Ownership was verified against GitHub on **2026-10-12**. Accountability is not a human test result, VA grant, legal approval, or completed operator review. The independent tester, any separate legal approver, and the VA reviewer must be identified from actual engagement; do not invent them. If a gate's accountable owner changes or becomes unavailable, record the named successor in its issue and the register, update this table, and escalate any gap rather than leaving a role-only or unassigned owner. Never close a gate merely because ownership is recorded.
