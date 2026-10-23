# Security Policy

## Read-only VA sandbox account boundary

The separate `/va-account` phase is disabled by default and uses only fixed sandbox ACG endpoints for veteran self-service rating summaries and existing claim statuses. It cannot select production, submit claims, upload documents, or act for representatives. See [sandbox setup and evidence gates](docs/va-account-sandbox.md). S256 PKCE, one-use browser-bound state, signed OIDC identity validation, encrypted server-held tokens, opaque HttpOnly handles, absolute expiry, atomic refresh ownership and explicit disconnect outcomes are implemented. Real registered-client connectivity, isolated store operations, hosting callback/query/body log sanitation and manual accessibility remain unverified external gates. No local test substitutes for VA approval.

## Supported Code

Security fixes are evaluated against the current `main` branch and the current production deployment. Historical commits, preview deployments, and the legacy manual Azure fallback are not independently supported security baselines.

Dependencies are supported based on the locked versions in `package-lock.json`. Supply chain vulnerabilities (e.g., compromised npm packages or transitive dependencies) are treated as critical severity regardless of the application code's direct implementation.

The enforced CI dependency gate, `npm run audit:high`, audits **production (runtime) dependencies** with `npm audit --audit-level=high --omit=dev` and must report zero high/critical advisories. Dev-only tooling is inventoried by `npm run audit:high:all`, and advisories there are not silently waived: every advisory the full-tree audit reports must be classified in [`docs/dependency-advisory-disposition.json`](docs/dependency-advisory-disposition.json), which records what it affects, whether it ships, whether a patched release exists, how hostile input would have to reach it, and when it was last reviewed. `npm run audit:disposition` is an enforced `ci.yml` gate that fails on an advisory the register does not classify, on a record that no longer matches the tree (severity, affected packages, installed version, dev/runtime classification), on a patched release that exists but has not been taken, on an expired review window, and on an advisory the database withdrew that is reported again; [`.github/workflows/dependency-scheduled-audit.yml`](.github/workflows/dependency-scheduled-audit.yml) additionally re-checks the advisory database weekly with `npm run audit:disposition:registry`, so a patched release published while no commit is pushed still fails visibly, and a live entry the database has withdrawn is reported as `advisory-withdrawn-upstream` with the withdrawal timestamp instead of passing as "no patch" and surfacing later as drift. Open Dependabot alerts are reconciled against that register with `npm run audit:dependabot`; an alert is dismissed only when the installed version is outside its vulnerable range, the advisory was withdrawn, or the package is not installed, and an unregistered live alert fails the reconciliation. A dev-only advisory with an upstream patch must be upgraded; one without a patched release is tracked with its reachability evidence instead of being waived — currently `braces <= 3.0.3` (`GHSA-vfj7-8cjw-p6xm`, "Patched versions: None", the dev-tooling `braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next` chain, absent from the runtime tree). An advisory the advisory database **withdraws** stays recorded as `withdrawn-upstream` with the date and evidence of the withdrawal, and the gate then requires it to be absent from the audit: `sprintf-js <= 1.1.3` (`GHSA-hp3w-g68c-fv3c`, reachable only through `mammoth`'s CLI entry `bin/mammoth`, which this application never executes) was withdrawn upstream on 2026-10-22 and is kept as that dated record — it is not counted as live debt, and if it is reported again the gate fails as un-disposed. Never resolve an audit failure by running `npm audit fix --force` into an older major line — for these advisories that means downgrading `eslint-config-next` two major lines.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately. **Do not place exploit details, credentials, medical information, Veteran-specific data, cookies, tokens, or other sensitive material in a public GitHub issue, pull request, CI log, or screenshot.**

For repository collaborators, use GitHub's private security-advisory/reporting mechanism when it is available for this repository. If that mechanism is unavailable, contact the repository owner through an established private project channel and include only the minimum information needed to reproduce the issue safely.

### Safe Harbor

We consider security research conducted in accordance with this policy to be "authorized" conduct. We will not pursue legal action against researchers who discover and report vulnerabilities in good faith, provided they:

- do not intentionally degrade the service or disrupt availability for other users;
- do not access, modify, exfiltrate, or persist Veteran/PII data or other third-party sensitive data;
- do not disclose the vulnerability publicly before a fix is deployed or the issue is otherwise resolved; and
- do not perform testing against other parties' systems or accounts.

If you are unsure whether an activity falls inside this policy, ask us first through a private channel.

### A Useful Report Includes

- The affected route, component, dependency, workflow, or configuration. Explicitly note if the issue involves Next.js Server Actions (`src/lib/actions/`), the edge proxy/middleware (`src/proxy.ts`), CSP nonce handling, the VA account session cookie/store, or a Content Security Policy bypass.
- The affected commit SHA or deployment identifier when known.
- A concise description of the security impact (e.g., State Tampering, XSS, SSRF, Information Disclosure, Supply Chain).
- Reproducible steps using **synthetic/non-sensitive data**.
- Expected versus observed behavior.
- Sanitized logs or screenshots **only** when necessary, with all PII/PHI redacted.

**Strict Prohibition:** Do not use real Veteran records, real VA credentials, real claim payloads, or other third-party sensitive data to demonstrate a vulnerability.

## Handling Expectations

The project will triage reports based on exploitability and potential impact to confidentiality, integrity, availability, credentials, deployment controls, and user data. This policy does not promise a fixed remediation or disclosure timeline, though critical vulnerabilities affecting the VA-account sandbox session store/cookies, retired-workflow-cookie cleanup, the edge proxy/CSP layer, or Server Action payload handling will be prioritized.

Security fixes should follow the normal reviewed-PR path and pass the repository's full CI gate (including `npm run kb:validate`, `npm run citations:audit`, `npm run test:composition`, strict Zod schema checks, lint, typecheck, and the full test suite) before production deployment, unless immediate containment requires disabling or rolling back an affected feature first.

The operational response process, credential-rotation rules, evidence-handling rules, recovery checks, and vulnerability-management controls are documented in [`docs/security-operations.md`](docs/security-operations.md).

## Current Data Boundary & Attack Surface

The current production scope is a browser-local claim-preparation research accelerator, with a separate, disabled-by-default sandbox-only account experiment. **The application does not:**

1. Connect to an individual Veteran's production VA account (production access is not configured or authorized).
2. Submit disability claims or communicate with VA adjudication systems.
3. Upload, transmit, or persistently store browser-local evidence-review source documents (PDFs/images) to the application server. Documents and extracted text remain in the browser; only sanitized, bounded extracted-text summaries are surfaced in the workflow.
4. Store full workflow state in cookies or persist per-user workflow history server-side. Secondary and presumptive workflow state is kept in versioned, schema-bounded, tab-scoped browser records; retired workflow cookies are tombstoned if a stale browser presents them. The separate optional VA sandbox account experiment stores an opaque handle cookie while encrypted tokens stay in its isolated server session store. Operational workflow/recommendation events emit allowlisted action/status/route/count/duration fields to platform logs; client error boundaries and traced recommendation failures withhold exception content. Verify host retention/access and deployed tracing configuration rather than describing event logging as absent.
5. Initialize client-side analytics or third-party telemetry SDKs. Browser connectivity is constrained by the deployed Content Security Policy (`connect-src 'self'`).

VA production account access remains unavailable; the separate sandbox account experiment is disabled by default, and credentialed sandbox verification remains a separately governed gate.

**Future Boundary Changes:** A future change that introduces Veteran-specific external API transmission beyond the separately gated VA sandbox experiment, production-account access, persistent sensitive-data storage, server-side research-workflow state, or alters the Next.js Server Action payload limits must update this privacy/security documentation and receive separate architectural review before it is treated as production-ready.

## Content Security Policy

### Script source (nonce-based, no unsafe-inline)

`src/proxy.ts` generates a per-request CSP with:

```
script-src 'self' 'nonce-<per-request>' 'strict-dynamic' 'wasm-unsafe-eval'
```

- Scripts execute only when they carry the matching per-request nonce or are loaded by a nonce-bearing script (`strict-dynamic`).
- `'unsafe-inline'` is explicitly excluded from `script-src` — this is tested in `tests/deployment-readiness.test.ts` and `tests/low-severity-remediation.test.ts`.
- `'wasm-unsafe-eval'` permits WebAssembly compilation only (browser-local tesseract.js OCR core); it does not enable general `eval`.
- In development only, `'unsafe-eval'` is added for Next.js HMR.

### Trusted Types (production enforcement)

Production adds:

```
require-trusted-types-for 'script'
trusted-types default 'allow-duplicates'
```

- `require-trusted-types-for 'script'` closes DOM-XSS sink injection (innerHTML/outerHTML/script src/worker construction) for the application. The repo contains no first-party DOM-sink writes (audited). Framework policies are intentionally **not** allowlisted: Next.js's lazy route loader tolerates `createPolicy('nextjs')` failing and its plain chunk URLs then ride the strict `default` policy (same-origin only) — verified with client-side navigation in the production build. Earlier revisions emitted `'nextjs' 'dompurify'` as quoted entries; Chrome reported both as invalid policy names on every page load and refused the policies anyway, so the entries were removed rather than left as misleading no-ops.
- `default` is the one first-party fallback policy, created by `src/components/security/TrustedTypesGate.tsx` at mount — after hydration, deliberately: the only first-party script-URL sink is the OCR worker spawn on an explicit user action long after mount, and the policy is intentionally not claimed to exist before hydration. The policy decision itself lives in `src/lib/security/trusted-types-policy.ts` and is executed by tests, not just pattern-matched. It is deliberately strict: script **URLs** must resolve to same-origin http(s) (no `blob:`/`data:`/`javascript:`, no cross-origin — framework `/_next/` chunks and the `/tesseract/` worker ride the same gate), and `createScript`/`createHTML` refuse unconditionally. This exists because the pinned tesseract.js v6 contains no `createPolicy` calls and constructs its OCR worker from a plain string — verified in the shipped bundle — so without a gated `default` policy the Local OCR action would fail in TT-enforcing browsers. All OCR entry points spawn the worker through `createLocalOcrWorker()` (`src/lib/evidence/ocr-session.ts`) with `workerBlobURL: false`; Tesseract's default wraps `workerPath` in a Blob, which this policy correctly refuses (the P1 browser-local-OCR defect below).
- Development is exempt: React's dev-mode eval and the Turbopack dev chunk loader violate enforcement (verified in headless Chrome), and dev already runs `'unsafe-eval'`. Violation reporting stays active in dev.
- Verified live against a production build in headless Chrome: pages hydrate with zero violations, the direct same-origin tesseract worker spawn succeeds through the gate, and cross-origin/blob worker payloads are blocked. The worker realm needs its own bootstrap: `/tesseract/*` responses carry this policy too and a dedicated worker does not inherit the document's policy object, so the worker is spawned through the generated `/tesseract/worker-guard.js` (`scripts/copy-pdf-worker.mjs`), which installs the same narrow policy — same-origin `/tesseract/*` script URLs only — before importing the pinned worker. Two benign console messages remain on the OCR path because the pinned libraries catch their own failed probes (webpack's `new Function("return this")` global detection and Emscripten's embedded `data:` wasm fallback refused by `connect-src 'self'`); neither is a successful sink assignment and OCR completes. An earlier version of this line claimed worker success while the library's default blob wrapper was in fact being refused — see the B04 remediation note in `docs/security-va-production-audit-2026-10-04.md`; the blob mode is now excluded by `worker-src 'self'` and by the executed `workerBlobURL: false` contract in tests.
- Policy names in `trusted-types` are unquoted token-list entries; only keyword-form entries (`'allow-duplicates'`, `'report-sample'`) may carry quotes. Quoted policy names are invalid and are ignored with a console error on every page load — pin this when adding names, and if a future Next.js release requires its own policy, add `nextjs` unquoted and re-verify client navigation.

### CSP / Trusted-Types violation reporting

Violations POST to `/api/csp-report` (`report-uri` plus `Reporting-Endpoints`/`Report-To`). The endpoint:

- redacts every report to a bounded, content-free event **before** logging or counting (`src/lib/observability/csp-report.ts`): URLs reduced to origin only (no path, no query), directive names charset/length-validated, `sample` dropped in favor of a hex-only correlation fingerprint;
- never persists raw report bodies; answers accepted reports with a content-free 204 (malformed, oversized, unreadable, and wrong-content-type bodies included) and sheds abusive rates with a content-free 429 — never an error oracle;
- emits the redacted event to the best-effort OTEL counter `csp.violation` (directive/disposition attributes only);
- is excluded from the proxy's security matcher so report delivery cannot loop into violations.

Pinned by `tests/csp-trusted-types.test.ts`.

### Style source (nonce in production — no unsafe-inline)

```
style-src 'self' 'nonce-<per-request>'
style-src-attr 'none'
```

Production authorizes `<style>` elements with the same per-request nonce as scripts and refuses the style **attribute** outright. The two forms are not interchangeable: a nonce authorizes an element, and an attribute has no nonce to match, so `style-src-attr 'none'` is the only directive that closes it. Development keeps `style-src 'self' 'unsafe-inline'` because the Next.js dev overlay and React's dev-mode tooling inject inline markup; that branch never runs in a deployment.

This policy previously retained `'unsafe-inline'` in production, on the argument that React's `style` prop writes an HTML style attribute that no nonce can reach. That was true of the code as it then stood, and it was a recorded deviation from the requested policy (audit SEC-03, P1/Medium policy gap). It is no longer necessary: every rendered style is declarative — Tailwind classes, SVG presentation attributes, and a drawn `<rect>` for the timeline's exported white card — and the only two genuinely computed values (the timeline's exported width and its pointer-relative tooltip position) are written through the CSSOM (`element.style`), which is a DOM API rather than the content attribute this policy governs.

No user-controlled value reaches any of them, so the previous CSS-injection argument still holds as well; the change is that production no longer has to trust it.

**Do not reintroduce an inline style.** `tests/low-severity-remediation.test.ts` walks `src/` and fails on the two JSX shapes that produce the attribute, and `tests/deployment-readiness.test.ts` pins the production/development split. Both gates are source-level, so a real-browser run against a production build remains the runtime evidence; see the SEC-03 remediation record in `docs/security-architecture-audit-2026-10-07.md`.

**Do not weaken `script-src` nonce boundaries.**

### Other CSP directives

| Directive | Value | Purpose |
|---|---|---|
| `default-src` | `'self'` | Strict same-origin default |
| `script-src-attr` | `'none'` | Blocks inline event handlers (`onclick`, etc.) |
| `img-src` | `'self' data: blob:` | Inline images, evidence thumbnails |
| `font-src` | `'self' data:` | Inline font data |
| `connect-src` | `'self'` (prod) / `'self' ws: wss:` (dev) | No third-party egress; dev HMR websocket |
| `worker-src` | `'self'` | Web workers (tesseract.js direct same-origin spawn, PDF.js) |
| `media-src` | `'self' blob:` | Media elements |
| `frame-src` | `'none'` | No iframes |
| `object-src` | `'none'` | No plugins |
| `base-uri` | `'self'` | No base tag injection |
| `form-action` | `'self'` | Forms only submit same-origin |
| `frame-ancestors` | `'none'` | No framing |
| `upgrade-insecure-requests` | (present) | HTTP→HTTPS upgrade |

## CSRF Protection

Server Actions (form submissions from `src/lib/actions/`) are POST-only entrypoints whose action identifiers appear in public render output — they are identifiers, not secrets. The protections that are actually active:

### Layer 1: Next.js built-in checks

Next.js validates the request Origin against Host/X-Forwarded-Host and relies on `SameSite=Strict` cookies. The CSP `script-src` nonce and `connect-src 'self'` policy keep injected script from extracting or replaying action identifiers from another origin.

### Layer 2: CSP form controls

- `form-action 'self'` restricts where `<form>` elements can submit
- `frame-ancestors 'none'` prevents the application from being framed (clickjacking)
- `script-src-attr 'none'` blocks inline event handlers that could trigger form submissions

### Reviewed helper (not wired)

`src/lib/security/csrf.ts` implements an additional Origin/Referer check with localhost dev allowlisting. It currently has **no production callers** and is retained as reviewed defense-in-depth — it is not an advertised active layer. Wiring it into a mutation boundary requires testing behind the deployed host/proxy configuration first; `tests/csrf-protection.test.ts` exercises the helper itself, not an active integration.

## Infrastructure and Edge Security

Production deployments (Vercel primary; Azure static web apps as the legacy manual fallback only) are protected by edge-level security controls — WAF, DDoS protection, and rate limiting on Server Action routes and dynamic data routes. The edge also applies route-wide security headers and a per-request, nonce-based Content Security Policy generated by the edge proxy (`src/proxy.ts`, Next.js `proxy`/middleware convention).

### Application-level rate limiting (defense-in-depth)

In addition to edge WAF controls, the application implements server-side rate limiting via `src/lib/rate-limiter.ts` (fixed-window, in-memory, per-process, hard-capped key map). Fixed windows can admit up to 2× the nominal rate across a window boundary; that is accepted for this secondary layer behind the edge. A per-client key is used only when the header it is read from carries a syntactically valid IP literal; a hostname, path fragment or random token is not an identity. Those headers are client-supplied, so **which hop is read is declared rather than assumed**: `RATE_LIMIT_TRUSTED_INGRESS` names the ingress model and the hop rule follows it — unset (the default) reads the leftmost `X-Forwarded-For` hop and falls back to `X-Real-IP`, treating both as client-supplied; `set` (aliases `true`, `overwrite`, `platform`) records an ingress that *sets* the header to the peer it observed, so the leftmost hop is that value and `X-Real-IP` remains the fallback; `append` or `append:N` records an ingress that *appends* the observed peer, so the key is hop N from the right, every hop the client wrote in front of it is ignored, `X-Real-IP` is never read (an appending ingress does not set it, so a value there is client-supplied), and a request carrying fewer than N hops is unattributed — charged to the surface's shared bucket for identity-less requests rather than to a value the client sent. A declared model changes **enforcement**, not only reporting, so it must match the real ingress — declaring more appenders than exist lets a client that pads the header with an extra value become the hop that is read, and no model substitutes for refusing direct origin access. `/api/health` reports the model and the hop in use as `components.rateLimit.identity` (`model`, `hop`, `hopsFromRight`, `fallback`, beside `trustedIngress`, `identity` and `detail`), so the claim can be checked against what the ingress actually writes instead of being taken on trust here.

| Route / Operation | Limiter | Window | Max | Key |
|---|---|---|---|---|
| Server Action POSTs (workflow session writes) | `workflowSessionLimiter` | 60 s | 30 | IP (`X-Forwarded-For`) |
| `/api/regulatory/preflight` (authenticated, expensive) | `regulatoryPreflightLimiter` | 60 s | 5 | IP |
| `/api/admin/cache-clear` (authenticated, destructive) | `adminCacheClearLimiter` | 60 s | 5 | IP |
| `/api/health` (public, lightweight) | `healthLimiter` | 60 s | 30 | IP |
| Public reference page reads (`/va-forms`, `/va-forms/finder`, `/va-reference`, `/secondary/evidence`, …) — GET/HEAD and the reference Server Action POSTs | `referenceReadLimiter` | 60 s | 30 | IP |
| **All limited surfaces combined** (shared admission ceiling) | `unattributedAdmissionLimiter` | 60 s | 6000 (`RATE_LIMIT_UNATTRIBUTED_MAX`) | one shared budget |

Rate limiting is enforced in `src/proxy.ts` (Next.js middleware/proxy). Every limited surface charges that shared ceiling as well as its own bucket, so a request with no usable identity is bounded rather than skipped, and a client presenting a different valid IP on every request cannot draw an unbounded series of fresh allowances. Where a model is declared, the bound on an identity-less request is the surface's own: such requests share one bucket per surface at that surface's per-client limit (key `unidentified:<limiter>`), so omitting or junking the identity is no longer cheaper than presenting one — `components.rateLimit.identity.unidentified` reports which policy is in force. Where no model is declared the ceiling remains the only bound, because an identity-less request cannot then be told apart from an honest client of a deployment whose forwarding headers never arrive. Exceeded limits return `429 Too Many Requests` with a `Retry-After` header. All limiters are process-local and reset on cold start — intentional for serverless, and reported as such (`components.rateLimit.store`). A refusal's reason — the shared ceiling or the client's own bucket — is counted per instance in `src/lib/observability/refusal-window.ts` (bounded to a 15-minute window, 256 retained events and 12 reported surface rows) and reported as `components.rateLimit.refusals` on `/api/health`, so ceiling saturation is alertable; the counters hold the surface and the budget only, never the client's address, because that payload is public, and the `429` body itself deliberately does not name the budget.

Researchers should not attempt Denial of Service (DoS) testing, brute-force attacks, credential stuffing, or edge-payload flooding. These will be automatically blocked by edge controls and may result in IP bans. Report rate-limiting or edge-configuration concerns through the private reporting channels above instead.
