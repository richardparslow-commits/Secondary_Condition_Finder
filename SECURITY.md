# Security Policy

## Read-only VA sandbox account boundary

The separate `/va-account` phase is disabled by default and uses only fixed sandbox ACG endpoints for veteran self-service rating summaries and existing claim statuses. It cannot select production, submit claims, upload documents, or act for representatives. See [sandbox setup and evidence gates](docs/va-account-sandbox.md). S256 PKCE, one-use browser-bound state, signed OIDC identity validation, encrypted server-held tokens, opaque HttpOnly handles, absolute expiry, atomic refresh ownership and explicit disconnect outcomes are implemented. Real registered-client connectivity, isolated store operations, hosting callback/query/body log sanitation and manual accessibility remain unverified external gates. No local test substitutes for VA approval.

## Supported Code

Security fixes are evaluated against the current `main` branch and the current production deployment. Historical commits, preview deployments, and the legacy manual Azure fallback are not independently supported security baselines.

Dependencies are supported based on the locked versions in `package-lock.json`. Supply chain vulnerabilities (e.g., compromised npm packages or transitive dependencies) are treated as critical severity regardless of the application code's direct implementation.

The enforced CI dependency gate, `npm run audit:high`, audits **production (runtime) dependencies** with `npm audit --audit-level=high --omit=dev` and must report zero high/critical advisories. Dev-only tooling is inventoried by the non-blocking `npm run audit:high:all` step: advisories there are not silently waived — a dev-only advisory with an upstream patch must be upgraded, and one without a patched release (e.g. `braces <= 3.0.3`, advisory `GHSA-vfj7-8cjw-p6xm`, "Patched versions: None") stays visible in CI logs until the toolchain can move off it. Never resolve an audit failure by running `npm audit fix --force` into an older major line.

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

### Style source (unsafe-inline retained — React constraint)

```
style-src 'self' 'unsafe-inline'
```

`'unsafe-inline'` is required in `style-src` because React's `style={{}}` prop writes `style=""` HTML attributes directly on DOM elements. React 19 server components inject the CSP nonce into `<style>` tags, but not into `style=""` attributes. There is no React framework mechanism to attach a nonce to the HTML `style` attribute.

This is **not** an XSS-critical boundary: the nonce-based `script-src` prevents JavaScript execution, which is the actual attack vector for XSS. The `style-src` constraint only limits CSS injection (which is not exploitable in this codebase because no user-controlled input flows into `style` attributes — all style values are hardcoded or computed from internal state).

Converting every React `style` prop to CSS classes would eliminate `unsafe-inline` but would require replacing dynamic computed values (tooltip positioning, SVG interaction state, zoom-dependent layout) with imperative DOM manipulation for no security gain. This is documented as a known React/Next.js limitation in `docs/technical-specification.md`, `docs/secondary-technical-2026-09-09.md`, and `docs/technical-specification-v2.md`.

**Do not weaken `script-src` nonce boundaries.** If a future React release supports nonce propagation to `style` attributes, this section should be revisited.

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

In addition to edge WAF controls, the application implements server-side rate limiting via `src/lib/rate-limiter.ts` (fixed-window, in-memory, per-process, hard-capped key map). Fixed windows can admit up to 2× the nominal rate across a window boundary; that is accepted for this secondary layer behind the edge. A per-client key is used only when `X-Forwarded-For` (then `X-Real-IP`) carries a syntactically valid IP literal; a hostname, path fragment or random token is not an identity. Those headers are client-supplied until an ingress overwrites them, so the deployed proxy/WAF must strip client-supplied values — the deployment records whether it asserts that (`RATE_LIMIT_TRUSTED_INGRESS=true`, reported as `components.rateLimit.identity` on `/api/health`) rather than assuming it here.

| Route / Operation | Limiter | Window | Max | Key |
|---|---|---|---|---|
| Server Action POSTs (workflow session writes) | `workflowSessionLimiter` | 60 s | 30 | IP (`X-Forwarded-For`) |
| `/api/regulatory/preflight` (authenticated, expensive) | `regulatoryPreflightLimiter` | 60 s | 5 | IP |
| `/api/admin/cache-clear` (authenticated, destructive) | `adminCacheClearLimiter` | 60 s | 5 | IP |
| `/api/health` (public, lightweight) | `healthLimiter` | 60 s | 30 | IP |
| Public reference page reads (`/va-forms`, `/va-forms/finder`, `/va-reference`, `/secondary/evidence`, …) | `referenceReadLimiter` | 60 s | 30 | IP |
| **All limited surfaces combined** (shared admission ceiling) | `unattributedAdmissionLimiter` | 60 s | 6000 (`RATE_LIMIT_UNATTRIBUTED_MAX`) | one shared budget |

Rate limiting is enforced in `src/proxy.ts` (Next.js middleware/proxy). Every limited surface charges that shared ceiling as well as its own bucket, so a request with no usable identity is bounded rather than skipped, and a client presenting a different valid IP on every request cannot draw an unbounded series of fresh allowances. Exceeded limits return `429 Too Many Requests` with a `Retry-After` header. All limiters are process-local and reset on cold start — intentional for serverless, and reported as such (`components.rateLimit.store`).

Researchers should not attempt Denial of Service (DoS) testing, brute-force attacks, credential stuffing, or edge-payload flooding. These will be automatically blocked by edge controls and may result in IP bans. Report rate-limiting or edge-configuration concerns through the private reporting channels above instead.
