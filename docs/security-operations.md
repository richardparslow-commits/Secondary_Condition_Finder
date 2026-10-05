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
- no application event-persistence backend is used for workflow or recommendation history.

A material change to these boundaries requires corresponding privacy/security review.

## Preventive controls

The current engineering baseline includes:

- server-only production secrets;
- source-restrictive Content Security Policy and route-wide security headers;
- encrypted/authenticated workflow cookies;
- browser-local evidence resource ceilings;
- read-only active CI permissions;
- immutable commit pins for active CI marketplace actions;
- `npm run audit:high` (production/runtime dependencies) on gated changes, plus the non-blocking `npm run audit:high:all` inventory for dev-tooling advisories that have no upstream patch yet;
- fail-closed VA outbound coordination in distributed runtimes: a shared consumer budget (`VA_SHARED_CONSUMER_BUDGET=true`) reserves every attempt, an unreachable coordinator blocks live requests instead of granting a per-process budget, and a shared absolute cooldown deadline plus a single probe lease (`SET … NX PX`) admits at most one half-open probe across the fleet; cooldown publication is extend-only (a later, longer deadline is never shortened by an older request's failure) and recovery is fenced — only the admitted probe may clear the exact cooldown generation it observed, so a late ordinary success cannot erase a newer backoff;
- upstream 429 responses are never retried and open the circuit for the clamped `Retry-After` window (1s–15min, default 30s; a long value is honored exactly as the fleet deadline rather than truncated), so consumer pressure is reduced fleet-wide rather than per request;
- shared VA reference cache is bounded and revocable: only allowlisted key namespaces are read or written, entries are `{envelopeVersion:2, epoch, value}` envelopes accepted only under the currently observed epoch, every write is admitted against a finite per-namespace window budget, and `POST /api/admin/cache-clear` advances the store-wide invalidation epoch so stale shared values are discarded fleet-wide without a delete sweep — an expired or invalidated popular key is fetched once, not once per instance, via a per-key 120 s single-flight lease with a bounded 600 ms contender wait (the lease covers the longest legal logical fetch: three 30 s attempts plus backoff and the shared write) (the lease fails open; the consumer budget remains the safety control); a shared-store outage fails the fleet closed rather than open — cached values stop being served, the decision is reported as a coordination outage, and no upstream request or quota reservation is attempted; a split network is simulated as well: the partitioned half serves only labelled local fallbacks while the reachable half keeps operating, and after healing it refetches under the reachable half's epoch bump instead of resurrecting pre-bump values (`tests/va-fleet-simulation.test.ts`, wired into CI as the named `fleet` gate under a ratcheted wall-clock budget — the enforced limit is the tighter of the committed environment cap and a budget derived from recent measured runs (`.github/fleet-budget-ratchet.json`), so the gate tightens automatically as timing stabilizes and cannot silently drift looser, every coordination path is additionally held to its own committed per-scenario real-time bound, and an unbounded coordination regression fails the build instead of only running longer);
- cached reference values are re-checked on read (`src/lib/va/cached-view-guard.ts`): a hit must carry this deployment's live source/environment, bounded label metadata, and credential-free HTTPS links, or it is treated as a miss and refetched — a poisoned or stale-shaped cache entry cannot set the UI's source labels or links;
- VA-provided links are approved at the payload boundary (`src/lib/va/trusted-link.ts`): only credential-free HTTPS URLs pass the Forms/directory schemas; `javascript:`, `data:`, `http:`, and credential-bearing URLs fail validation and the loader degrades to its explicit local fallback;
- credential-bearing outbound requests refuse redirects (`redirect: "error"`): the VA JSON transport, the shared-store KV transport, the legacy sandbox adapter, and the regulatory preflight source fetch treat any redirect as a failed exchange, so an API key or Bearer token is never replayed to a redirected origin (`tests/va-shared-reference-cache.test.ts`, `tests/va-adapter-resilience.test.ts`, `tests/regulatory-preflight.test.ts`);
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

## Adjacency-graph (CRG) migration operations

The graph loader (`src/lib/kb/graph.ts`) validates every adjacency file under `data/knowledge-base/graph/` (schema, filename ↔ nodeId, duplicate nodes, catalog membership). Its state is surfaced in two places:

- `GET /api/health` → `components.kbGraph`: `{ status, latencyMs, nodes, edges, detail? }`. Overall health is `healthy`/`200` only when `kbGraph.status` is `ok` — invalid graph data deliberately degrades health to `503`.
- The Production Runtime Readiness workflow summary section “Adjacency-graph migration state” (and the issue #213 evidence comment).

Reading the signal:

- `status: "ok"` means every graph file parsed and passed validation; `nodes` counts migrated root conditions and `edges` counts authored outgoing edges. Both grow only as migration proceeds, and `0`/`0` is the valid pre-migration state, not a fault.
- `status: "error"` carries `detail` naming the offending file and the failed invariant. Detail text contains file names and schema messages only — never Veteran data or secrets.

When `kbGraph` degrades:

1. Read `detail` and identify the named file.
2. Reproduce locally: `npm run audit:crg:graph` (hard cycle gate) and `npx vitest run tests/kb-graph-loader.test.ts`.
3. Fix forward in a new deployment: correct or remove the file. Do not hand-edit data to silence validation, and do not add an edge to an identity that is not yet in the catalog — land the identity first.
4. Re-verify: data files ship with the deployment and the loader caches per process, so redeploy and confirm `/api/health` returns `200` with `kbGraph.status: "ok"` before closing the incident.
5. If the graph validated at build time and degrades at runtime, treat it as a data-integrity incident and inspect what the deployed commit contains under `data/knowledge-base/graph/`.

A vacuous `audit:crg:graph` warning (no graph files found) is abnormal now that the first node has migrated: it means the graph directory is missing or empty in that checkout and migration state was lost.

This section is the operational contract for `kbGraph` degradation; keep it current whenever the health or readiness surfaces change.

## External gates

This document does not complete either external readiness gate:

- issue #189 remains the deferred credentialed VA sandbox verification gate;
- issue #195 remains the manual Section 508 evidence gate.

Green CI, Vercel deployment, or this runbook must not be used as a substitute for those separate evidence requirements.
