# Security Operations

## Purpose

This document defines the repository-level security operations expected for the current Secondary Condition Finder production architecture. It complements `SECURITY.md`, the Privacy Policy, Terms of Use, and `docs/deployment-readiness.md`.

It is an engineering operations checklist, not a certification or claim of compliance with a particular external framework.

## Current production boundary

The supported baseline is the current reviewed `main` commit deployed through Vercel and verified by the repository CI and Production Runtime Readiness workflows.

Current boundaries include:

- Vercel is the production host;
- Azure is a manual legacy fallback only;
- secondary and presumptive workflow state uses versioned, schema-bounded, tab-scoped browser records; retired workflow cookies are tombstoned if stale copies are presented;
- optional evidence parsing is browser-local and bounded by file, batch, page, and extracted-text limits;
- VA sandbox integration is disabled by default;
- the current application does not connect to an individual Veteran's VA account or submit a disability claim;
- production browser connectivity is constrained by the deployed Content Security Policy;
- no per-user event-persistence backend is used for workflow or recommendation history; allowlisted operational events are emitted to platform logs, so host retention/access settings require operator review;

A material change to these boundaries requires corresponding privacy/security review.

## Preventive controls

The current engineering baseline includes:

- server-only production secrets;
- source-restrictive Content Security Policy and route-wide security headers, with the violations browsers report counted content-free and reported on `/api/health` as `components.cspReports` — so a policy regression (a newly blocked inline style, script sink, or asset origin) is an operator-readable fact in the deployed application rather than only a line in a visitor's browser console. The stored fact is a directive name, a disposition, an oversized flag, and a timestamp: no document URL, blocked URL, source file, or report sample can reach that payload, retention is bounded by a short rolling window and a fixed event cap, and a violation never changes the health verdict;
- schema-bounded browser-local workflow records with explicit clearing; opaque HttpOnly VA-account handles only for the separate sandbox experiment;
- browser-local evidence resource ceilings;
- read-only active CI permissions;
- immutable commit pins for active CI marketplace actions;
- `npm run audit:high` (production/runtime dependencies) on gated changes; `npm run audit:high:all` inventories the full tree, and every advisory it reports must be classified in `dependency-advisory-disposition.json`, which records what the advisory affects, whether it ships, whether an upstream fix exists, how hostile input would have to reach it, and when it was last reviewed. `npm run audit:disposition` (a `ci.yml` gate) fails on an unclassified advisory, on a record that no longer matches the tree (severity, affected packages, installed version, dev/runtime classification), on an upstream fix published since, on an entry marked `upgrade-required`, and on an expired 180-day review window; `.github/workflows/dependency-scheduled-audit.yml` re-checks the advisory database weekly with `npm run audit:disposition:registry`, so a fix published with no commit in between still fails visibly rather than waiting for the next unrelated change. The recorded entries are `GHSA-vfj7-8cjw-p6xm` (high, dev tooling only: `braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`) and `GHSA-hp3w-g68c-fv3c` (moderate, runtime, reached only through `mammoth`'s CLI entry `bin/mammoth`, which this application never executes because `src/` spawns no child process). Neither has a published fix, and `npm audit fix --force` stays forbidden: for these advisories it would downgrade `eslint-config-next` two major lines;
- fail-closed VA outbound coordination in distributed runtimes: a shared consumer budget (`VA_SHARED_CONSUMER_BUDGET=true`) reserves every attempt, an unreachable coordinator blocks live requests instead of granting a per-process budget, and a shared absolute cooldown deadline plus a single probe lease (`SET … NX PX`) admits at most one half-open probe across the fleet; cooldown publication is extend-only (a later, longer deadline is never shortened by an older request's failure) and recovery is fenced — only the admitted probe may clear the exact cooldown generation it observed, so a late ordinary success cannot erase a newer backoff;
- upstream 429 responses are never retried and open the circuit for the clamped `Retry-After` window (1s–15min, default 30s; a long value is honored exactly as the fleet deadline rather than truncated), so consumer pressure is reduced fleet-wide rather than per request;
- shared VA reference cache is bounded and revocable: only allowlisted key namespaces are read or written, entries are `{envelopeVersion:2, epoch, value}` envelopes accepted only under the currently observed epoch, every write is admitted against a finite per-namespace window budget whose counter must be a non-negative safe integer and whose lifetime the store must confirm — an unconfirmed lifetime refuses the write and removes the counter instead of leaving one permanent key per window — and `POST /api/admin/cache-clear` advances the store-wide invalidation epoch so stale shared values are discarded fleet-wide without a delete sweep — an expired or invalidated popular key is fetched once, not once per instance, via a per-key 120 s single-flight lease with a bounded 600 ms contender wait (the lease covers the longest legal logical fetch: three 30 s attempts plus backoff and the shared write) (the lease fails open; the consumer budget remains the safety control); a shared-store outage fails the fleet closed rather than open — cached values stop being served, the decision is reported as a coordination outage, and no upstream request or quota reservation is attempted; a split network is simulated as well: the partitioned half serves only labelled local fallbacks while the reachable half keeps operating, and after healing it refetches under the reachable half's epoch bump instead of resurrecting pre-bump values (`tests/va-fleet-simulation.test.ts`, wired into CI as the named `fleet` gate under a ratcheted wall-clock budget — the enforced limit is the tighter of the committed environment cap and a budget derived from recent measured runs (`.github/fleet-budget-ratchet.json`), so the gate tightens automatically as timing stabilizes and cannot silently drift looser, every coordination path is additionally held to its own committed per-scenario real-time bound, and an unbounded coordination regression fails the build instead of only running longer);
- cached reference values are re-checked on read (`src/lib/va/cached-view-guard.ts`): a hit must carry this deployment's live source/environment, bounded label metadata, and credential-free HTTPS links, or it is treated as a miss and refetched — a poisoned or stale-shaped cache entry cannot set the UI's source labels or links;
- VA-provided links are approved at the payload boundary (`src/lib/va/trusted-link.ts`): only credential-free HTTPS URLs pass the Forms/directory schemas; `javascript:`, `data:`, `http:`, and credential-bearing URLs fail validation and the loader degrades to its explicit local fallback;
- credential-bearing outbound requests refuse redirects (`redirect: "error"`): the VA JSON transport, the shared-store KV transport, and the regulatory preflight source fetch treat any redirect as a failed exchange, so an API key or Bearer token is never replayed to a redirected origin (`tests/va-account-sandbox.test.ts`, `tests/va-shared-reference-cache.test.ts`, `tests/regulatory-preflight.test.ts`);
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

Sandbox and production VA credentials must remain separated. The credentialed public-reference sandbox gate #189 is complete with historical sanitized success evidence; that record does not establish VA production access or current deployment connectivity. Richard Parslow (`richardparslow-commits`) is the accountable evidence owner; see the [external/manual gates register](external-manual-gates-status.md).

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
2. Reproduce locally: `npm run audit:crg:graph` (hard gate: no cycles **and** the ARCH-01 evidence join — every edge backed by an authored suggestion with citations and a matching nexus classification) and `npx vitest run tests/kb-graph-loader.test.ts`.
3. Fix forward in a new deployment: correct or remove the file. Do not hand-edit data to silence validation, and do not add an edge to an identity that is not yet in the catalog — land the identity first.
4. Re-verify: data files ship with the deployment and the loader caches per process, so redeploy and confirm `/api/health` returns `200` with `kbGraph.status: "ok"` before closing the incident.
5. If the graph validated at build time and degrades at runtime, treat it as a data-integrity incident and inspect what the deployed commit contains under `data/knowledge-base/graph/`.

A vacuous `audit:crg:graph` warning (no graph files found) is abnormal now that the first node has migrated: it means the graph directory is missing or empty in that checkout and migration state was lost.

This section is the operational contract for `kbGraph` degradation; keep it current whenever the health or readiness surfaces change.

## External gates

The [R-04 ownership register](external-manual-gates-status.md) records every external/manual gate's dates, targets/triggers, completion criteria, and pending dependencies. The [production runbook owner table](deployment-readiness.md) mirrors all seven named owners.

**Named accountable owner for every gate: Richard Parslow (`richardparslow-commits`).** Responsibilities remain gate-specific:

- **#189 — credentialed VA sandbox smoke test:** CLOSED; Richard Parslow preserves historical sanitized success evidence. No new work assignment or current production-connectivity claim.
- **#195 — manual Section 508 review:** OPEN; Richard Parslow commissions the independent tester and coordinates exact-build evidence, remediation/retests, and sign-off.
- **#213 — production workflow-session secret:** CLOSED; Richard Parslow preserves historical runtime-verification evidence. Later deployments still require fresh exact-build lineage.
- **#287 — VA public-reference production transition:** CLOSED; Richard Parslow recorded the closure decision on 2026-10-15 — VA production activation is not pursued and the labelled local catalog fallback is the intended steady state. No VA grant, credential, controlled check or live production evidence is claimed; the fail-closed production path stays implemented and inert.
- **#537 — hosting log retention/access:** CLOSED; Richard Parslow recorded the gate A review on 2026-10-15 — the [ownership register](external-manual-gates-status.md) carries the per-sink record of the hosting platform's published retention, access-role and redaction terms for every sink this application can reach, names the account-level facts that were not read (plan tier, Observability Plus, drain existence, 2FA/SSO state), and records his dated acceptance of that residual. This is a terms review, not a read of the hosting account: the retention period actually in force is still unestablished, and the code-side sink inventory is in the [hosting log and callback inventory](hosting-log-and-callback-inventory.md). Reopen under the original criterion if credentialed hosted use is pursued.
- **#538 — callback-URL scrubbing:** CLOSED; Richard Parslow recorded the gate B review on 2026-10-15 — the [ownership register](external-manual-gates-status.md) carries a per-sink record of the platform's *documented* behaviour: the callback request line reaches runtime logs and any account-configured drain **with its query string**, and no documented setting removes `code`, `state`, or query parameters on any plan. The retained request line is named as his accepted residual, with *credentialed hosted use* kept as the trigger that reopens it. This is not a read of the hosting account: nothing here claims scrubbing was configured, tested or observed, no retention value is established, and what bounds the exposure is reachability — both callback handlers return a fixed 503 before reading any parameter while the sandbox config is absent. The shipped callback surfaces and the code-side no-sink conclusion remain in the [hosting log and callback inventory](hosting-log-and-callback-inventory.md). Reopen under the original criterion if credentialed hosted use is pursued.
- **#539 — privacy approval/monitored contact:** OPEN / CHANNEL UNVERIFIED; Richard Parslow recorded the **approval** on 2026-10-15 (sole operator, *accept the published deletion right and 45-day commitment as published*), together with the named handler and a published [fulfilment procedure](privacy-request-fulfilment-procedure.md). The gate stays open on a dated negative finding rather than on a pending review: the only published privacy-request address, `privacy@secondaryconditionfinder.org`, is at a domain that does not resolve (`MX`/`NS` NXDOMAIN with the `.org` registry's own SOA as authority, from two independent DNS-over-HTTPS resolvers; `RDAP`/`whois` return no domain record — checked 2026-10-15), so a request sent there arrives nowhere and no send/receive test can run. The register's gate C record carries the full finding; the gate closes when the domain and mailbox exist and a sanitized send/receive outcome is recorded.

All four issues open at the **2026-10-12** ownership recheck (#195/#537/#538/#539) are assigned to Richard Parslow; #287 was closed as not pursued on **2026-10-15**, and #537 and #538 were closed the same day on their recorded reviews. If ownership changes or the owner is unavailable, record a named successor in the issue/register and production runbook, escalating any unowned dependency. An independent tester, any separate legal approver, and the VA grant reviewer are evidence providers, not fabricated substitutes for the accountable owner.

Green CI, Vercel deployment, ownership assignment, or this runbook must not be used as a substitute for those separate evidence requirements. This ownership update closes no human/operator gate.
