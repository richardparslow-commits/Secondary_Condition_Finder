# Security Policy

## Supported Code

Security fixes are evaluated against the current `main` branch and the current production deployment. Historical commits, preview deployments, and the legacy manual Azure fallback are not independently supported security baselines.

Dependencies are supported based on the locked versions in `package-lock.json`. Supply chain vulnerabilities (e.g., compromised npm packages or transitive dependencies) are treated as critical severity regardless of the application code's direct implementation.

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

- The affected route, component, dependency, workflow, or configuration. Explicitly note if the issue involves Next.js Server Actions (`src/lib/actions/`), the edge proxy/middleware (`src/proxy.ts`), CSP nonce handling, the encrypted/authenticated workflow cookie, or a Content Security Policy bypass.
- The affected commit SHA or deployment identifier when known.
- A concise description of the security impact (e.g., State Tampering, XSS, SSRF, Information Disclosure, Supply Chain).
- Reproducible steps using **synthetic/non-sensitive data**.
- Expected versus observed behavior.
- Sanitized logs or screenshots **only** when necessary, with all PII/PHI redacted.

**Strict Prohibition:** Do not use real Veteran records, real VA credentials, real claim payloads, or other third-party sensitive data to demonstrate a vulnerability.

## Handling Expectations

The project will triage reports based on exploitability and potential impact to confidentiality, integrity, availability, credentials, deployment controls, and user data. This policy does not promise a fixed remediation or disclosure timeline, though critical vulnerabilities affecting the encrypted workflow session cookie, the edge proxy/CSP layer, or Server Action payload handling will be prioritized.

Security fixes should follow the normal reviewed-PR path and pass the repository's full CI gate (including `npm run kb:validate`, `npm run citations:audit`, `npm run test:composition`, strict Zod schema checks, lint, typecheck, and the full test suite) before production deployment, unless immediate containment requires disabling or rolling back an affected feature first.

The operational response process, credential-rotation rules, evidence-handling rules, recovery checks, and vulnerability-management controls are documented in [`docs/security-operations.md`](docs/security-operations.md).

## Current Data Boundary & Attack Surface

The current production scope is strictly limited to a client-side claim-preparation research accelerator. **The application does not:**

1. Connect to an individual Veteran's VA account (no VA API integration, no credentialed VA access).
2. Submit disability claims or communicate with VA adjudication systems.
3. Upload, transmit, or persistently store browser-local evidence-review source documents (PDFs/images) to the application server. Documents and extracted text remain in the browser; only sanitized, bounded extracted-text summaries are surfaced in the workflow.
4. Store full workflow state in client-visible cookies, or persist workflow history server-side. Workflow state is held in short-lived, encrypted/authenticated first-party cookies; no application event-persistence backend records workflow or recommendation history.
5. Initialize client-side analytics or third-party telemetry SDKs. Browser connectivity is constrained by the deployed Content Security Policy (`connect-src 'self'`).

VA sandbox integration is disabled by default, and credentialed sandbox verification remains a separately governed future gate.

**Future Boundary Changes:** A future change that introduces Veteran-specific external API transmission, authenticated VA access, persistent sensitive-data storage, server-side workflow state, or alters the Next.js Server Action payload limits must update this privacy/security documentation and receive separate architectural review before it is treated as production-ready.

## Infrastructure and Edge Security

Production deployments (Vercel primary; Azure static web apps as the legacy manual fallback only) are protected by edge-level security controls — WAF, DDoS protection, and rate limiting on Server Action routes and dynamic data routes. The edge also applies route-wide security headers and a per-request, nonce-based Content Security Policy generated by the edge proxy (`src/proxy.ts`, Next.js `proxy`/middleware convention).

Researchers should not attempt Denial of Service (DoS) testing, brute-force attacks, credential stuffing, or edge-payload flooding. These will be automatically blocked by edge controls and may result in IP bans. Report rate-limiting or edge-configuration concerns through the private reporting channels above instead.