# Security Policy

## Supported code

Security fixes are evaluated against the current `main` branch and the current production deployment. Historical commits, preview deployments, and the legacy manual Azure fallback are not independently supported security baselines.

## Reporting a vulnerability

Please report suspected vulnerabilities privately. Do **not** place exploit details, credentials, medical information, Veteran-specific data, cookies, tokens, or other sensitive material in a public GitHub issue, pull request, CI log, or screenshot.

For repository collaborators, use GitHub's private security-advisory/reporting mechanism when it is available for this repository. If that mechanism is unavailable, contact the repository owner through an established private project channel and include only the minimum information needed to reproduce the issue safely.

A useful report includes:

- the affected route, component, dependency, workflow, or configuration;
- the affected commit SHA or deployment identifier when known;
- a concise description of the security impact;
- reproducible steps using synthetic/non-sensitive data;
- expected versus observed behavior;
- sanitized logs or screenshots only when necessary.

Do not use real Veteran records, real VA credentials, real claim payloads, or other third-party sensitive data to demonstrate a vulnerability.

## Handling expectations

The project will triage reports based on exploitability and potential impact to confidentiality, integrity, availability, credentials, deployment controls, and user data. This policy does not promise a fixed remediation or disclosure timeline.

Security fixes should follow the normal reviewed-PR path and pass the repository's full CI gate before production deployment unless immediate containment requires disabling or rolling back an affected feature first.

The operational response process, credential-rotation rules, evidence-handling rules, recovery checks, and vulnerability-management controls are documented in [`docs/security-operations.md`](docs/security-operations.md).

## Current data boundary

The current production scope does not connect to an individual Veteran's VA account, submit disability claims, or upload the browser-local evidence-review source documents to the application server. VA sandbox integration is disabled by default and credentialed sandbox verification remains a separately governed future gate.

A future change that introduces Veteran-specific external API transmission, authenticated VA access, or new persistent sensitive-data storage must update the privacy/security documentation and receive separate review before it is treated as production-ready.
