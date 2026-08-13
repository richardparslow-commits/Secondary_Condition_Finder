# Security Operations

## Purpose

This document defines the repository-level security operations expected for the current Secondary Condition Finder production architecture. It complements `SECURITY.md`, the Privacy Policy, Terms of Use, and `docs/deployment-readiness.md`.

It is an engineering operations checklist, not a certification or claim of compliance with a particular external framework.

## Current production boundary

The supported baseline is the current reviewed `main` commit deployed through Vercel and verified by the repository CI and Production Runtime Readiness workflows.

Current boundaries include:

- Vercel is the production host;
- Azure is a manual legacy fallback only;
- workflow state uses short-lived encrypted/authenticated first-party cookies;
- optional evidence parsing is browser-local and bounded by file, batch, page, and extracted-text limits;
- VA sandbox integration is disabled by default;
- the current application does not connect to an individual Veteran's VA account or submit a disability claim;
- production browser connectivity is constrained by the deployed Content Security Policy;
- the legacy event-logger abstraction has no application caller and is not relied on as a production audit or Veteran-data store.

A material change to these boundaries requires corresponding privacy/security review.

## Preventive controls

The current engineering baseline includes:

- server-only production secrets;
- source-restrictive Content Security Policy and route-wide security headers;
- encrypted/authenticated workflow cookies;
- browser-local evidence resource ceilings;
- read-only active CI permissions;
- immutable commit pins for active CI marketplace actions;
- `npm run audit:high` on gated changes;
- citation audit and knowledge-base validation;
- lint, typecheck, tests, and production build;
- real Chrome/ChromeDriver end-to-end validation;
- exact-commit Vercel deployment and production-alias verification;
- non-sensitive Production Runtime Readiness verification after successful `main` CI.

## Vulnerability reporting and triage

Use the private reporting process in `SECURITY.md`. Reports should use synthetic or sanitized data and should not place credentials, cookies, medical records, Veteran-specific information, or other sensitive material in public repository surfaces.

Triage should consider exploitability and potential impact to confidentiality, integrity, availability, credentials, deployment controls, and user data. Severity labels guide prioritization but do not establish a legal conclusion or guaranteed response deadline.

## Incident handling checklist

When a suspected security incident occurs:

1. Record only the minimum sanitized facts needed to identify the affected feature, commit/deployment, time window, and high-level impact.
2. Contain the affected feature, integration, deployment, or credential through the responsible provider/operator when continued operation would increase risk.
3. Preserve non-sensitive operational evidence such as commit SHAs, PR numbers, workflow run IDs, deployment IDs, timestamps, status codes, and sanitized error categories.
4. Implement the permanent remediation through a reviewed branch/PR and the full CI gate.
5. Recover only after the expected `main` commit, Vercel deployment, production alias, real-browser gate, and Production Runtime Readiness result agree on the repaired production state.
6. Record a concise post-incident review covering root cause, remediation, recovery evidence, and any additional control or regression coverage.

Do not copy real medical-record text, credentials, cookies, or other sensitive payloads into issues, PRs, CI logs, or incident notes merely for debugging.

## Credential handling during an incident

Credentials remain provider-managed server-side values. When exposure is suspected, the responsible operator should follow the issuing provider's revocation/rotation process and then require a fresh reviewed deployment and readiness verification before treating the affected integration as recovered.

Sandbox and production VA credentials, when they eventually exist, must remain separated. The current credentialed VA sandbox gate is intentionally deferred and must not be represented as complete.

## Sensitive-data incident boundary

If an incident may involve personal, medical, disability, service-history, or other sensitive Veteran information:

- stop unnecessary further data movement;
- do not reproduce the issue with additional real user data;
- determine the affected systems and data classes using sanitized evidence where possible;
- escalate any notification, contractual, or legal questions to the responsible project owner and the applicable provider/VA process rather than inventing a universal notification rule;
- document only supportable facts.

## Vulnerability and patch management

- High-severity dependency auditing is part of every gated CI run.
- Active CI actions are immutable-pinned.
- Security fixes use reviewed PRs and exact-head validation.
- Production recovery is verified against the exact merged commit, not a preview deployment or stale historical checkpoint.
- Regression coverage should be added when it is safe and does not require changing protected high-stakes semantics.

Perform a focused security/data-flow review before VA production-access submission, before enabling a new external API or credentialed integration, before introducing persistent sensitive-data storage, after a material hosting/authentication/telemetry change, and after a security incident.

## Safe evidence records

Appropriate operational evidence includes commit SHAs, PR numbers, workflow/run IDs, deployment identifiers and high-level status, UTC timestamps, route status codes, advisory/package identifiers, and high-level runtime-readiness results.

Do not record secret values or hashes, API keys/tokens, encrypted-cookie payloads, raw browser-local evidence text, Veteran PII/PHI, environment dumps, or unnecessary sensitive response bodies.

## External gates

This document does not complete either external readiness gate:

- issue #189 remains the deferred credentialed VA sandbox verification gate;
- issue #195 remains the manual Section 508 evidence gate.

Green CI, Vercel deployment, or this runbook must not be used as a substitute for those separate evidence requirements.
