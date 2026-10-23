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
- `npm run audit:high` (production/runtime dependencies) on gated changes; `npm run audit:high:all` inventories the full tree, and every advisory it reports must be classified in `dependency-advisory-disposition.json`, which records what the advisory affects, whether it ships, whether an upstream fix exists, how hostile input would have to reach it, and when it was last reviewed. `npm run audit:disposition` (a `ci.yml` gate) fails on an unclassified advisory, on a record that no longer matches the tree (severity, affected packages, installed version, dev/runtime classification), on an upstream fix published since, on an entry marked `upgrade-required`, on an expired 180-day review window, and on an advisory recorded as withdrawn upstream that the audit reports again; `.github/workflows/dependency-scheduled-audit.yml` re-checks the advisory database weekly with `npm run audit:disposition:registry`, so a fix published with no commit in between still fails visibly rather than waiting for the next unrelated change. The same re-check reads each live entry's withdrawal state: OSV keeps serving a withdrawn advisory's document with `withdrawn` set rather than returning 404, while `npm audit` stops reporting it, so a withdrawal is named as `advisory-withdrawn-upstream` with its timestamp and the reclassification it needs instead of passing as "no patch" and breaking the next gated run as unnamed drift. The live classification is `GHSA-vfj7-8cjw-p6xm` (high, dev tooling only: `braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`), which has no published fix. The second entry, `GHSA-hp3w-g68c-fv3c` (moderate, runtime, reached only through `mammoth`'s CLI entry `bin/mammoth`, which this application never executes because `src/` spawns no child process), was withdrawn upstream on 2026-10-22 and is kept as a dated `withdrawn-upstream` record with the withdrawal evidence: it is not live debt, the gate requires the audit not to report it, and the weekly registry re-check skips it. `npm audit fix --force` stays forbidden: for the live advisory it would downgrade `eslint-config-next` two major lines;
- fail-closed VA outbound coordination in distributed runtimes: a shared consumer budget (`VA_SHARED_CONSUMER_BUDGET=true`) reserves every attempt, an unreachable coordinator blocks live requests instead of granting a per-process budget, and a shared absolute cooldown deadline plus a single probe lease (`SET … NX PX`) admits at most one half-open probe across the fleet; cooldown publication is extend-only (a later, longer deadline is never shortened by an older request's failure) and recovery is fenced — only the admitted probe may clear the exact cooldown generation it observed, so a late ordinary success cannot erase a newer backoff;
- upstream 429 responses are never retried and open the circuit for the clamped `Retry-After` window (1s–15min, default 30s; a long value is honored exactly as the fleet deadline rather than truncated), so consumer pressure is reduced fleet-wide rather than per request;
- shared VA reference cache is bounded and revocable: only allowlisted key namespaces are read or written, entries are `{envelopeVersion:2, epoch, value}` envelopes accepted only under the currently observed epoch, every write is admitted against a finite per-namespace window budget whose counter must be a non-negative safe integer and whose lifetime the store must confirm — an unconfirmed lifetime refuses the write and removes the counter instead of leaving one permanent key per window — and `POST /api/admin/cache-clear` advances the store-wide invalidation epoch so stale shared values are discarded fleet-wide without a delete sweep — an expired or invalidated popular key is fetched once, not once per instance, via a per-key 120 s single-flight lease with a bounded 600 ms contender wait (the lease covers the longest legal logical fetch: three 30 s attempts plus backoff and the shared write) (the lease fails open; the consumer budget remains the safety control); a shared-store outage fails the fleet closed rather than open — cached values stop being served, the decision is reported as a coordination outage, and no upstream request or quota reservation is attempted; a split network is simulated as well: the partitioned half serves only labelled local fallbacks while the reachable half keeps operating, and after healing it refetches under the reachable half's epoch bump instead of resurrecting pre-bump values (`tests/va-fleet-simulation.test.ts`, wired into CI as the named `fleet` gate under a ratcheted wall-clock budget — the enforced limit is the tighter of the committed environment cap and a budget derived from recent measured runs (`.github/fleet-budget-ratchet.json`), so the gate tightens automatically as timing stabilizes and cannot silently drift looser, every coordination path is additionally held to its own committed per-scenario real-time bound, and an unbounded coordination regression fails the build instead of only running longer);
- cached reference values are re-checked on read (`src/lib/va/cached-view-guard.ts`): a hit must carry this deployment's live source/environment, bounded label metadata, and credential-free HTTPS links, or it is treated as a miss and refetched — a poisoned or stale-shaped cache entry cannot set the UI's source labels or links;
- VA-provided links are approved at the payload boundary (`src/lib/va/trusted-link.ts`): only credential-free HTTPS URLs pass the Forms/directory schemas; `javascript:`, `data:`, `http:`, and credential-bearing URLs fail validation and the loader degrades to its explicit local fallback;
- credential-bearing outbound requests refuse redirects (`redirect: "error"`): the VA JSON transport, the shared-store KV transport, and the regulatory preflight source fetch treat any redirect as a failed exchange, so an API key or Bearer token is never replayed to a redirected origin (`tests/va-account-sandbox.test.ts`, `tests/va-shared-reference-cache.test.ts`, `tests/regulatory-preflight.test.ts`);
- a secret scan over the full commit history on every push to `main`, every pull request, and on manual dispatch after a scanner upgrade (`.github/workflows/secret-scan.yml`): gitleaks `8.30.1`, downloaded from the upstream release and verified against the project's published SHA-256 before it runs, scanning every reachable commit rather than the newest diff — a key is committed once and then lives in every clone, so a diff-only scan reports a repository clean while its history already carries the value. The rule set is the scanner's own (`.gitleaks.toml` only extends it), the report is redacted so no finding reaches the job log or the uploaded artifact, and reviewed historical findings are entries in `.gitleaksignore` keyed to the exact commit, file, rule, and line with a recorded reason — never a path exemption, so the same shape in a new commit still fails;
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

## Secret scanning and the LangSmith key exposure (2026-10-22)

The first full-history scan found six `generic-api-key` findings. Five were not credentials and one was:

- **Exposed: a LangSmith project key.** `docs/langsmith-correctness-audit-2026-09-13.md` pasted the full 51-character project key (`lsv2_pt_…`) into a committed audit record whose own text says the key is live. The value has been removed from that document and the line now states that the value was removed. **The key was treated as compromised and rotated on 2026-10-22:** the replacement was verified first, then the exposed key was revoked with `403` confirmed, and the record is below. The hosted environment carries no `LANGSMITH_API_KEY`, so no deployment held the exposed value. History is immutable, so the finding at that commit remains in `.gitleaksignore`; the entry suppresses a repeat report, and the recorded revocation is what makes it a reviewed finding rather than an open exposure.
- **Not credentials, each recorded with its reason.** The citation-verification dashboard's localStorage key name (`citation-verification-decisions-v1`) trips the entropy heuristic in the generator and the generated HTML. It names a storage slot, so it stays — annotated on its own line with `gitleaks:allow` in the generator (the annotation is emitted into the generated HTML) instead of being allowlisted by regex: a gitleaks allowlist entry is evaluated field by field, so a regex-only entry suppressed that literal everywhere in the scan, which a seeded copy outside those two files proved. The annotation is line-scoped, and the gate's test fails if one appears anywhere else. Two test fixtures carried placeholder values shaped like API keys and no longer do. The health endpoint's session-crypto probe used a fixed non-secret string; it now generates a random value per call, so the source carries no credential-shaped literal and the finding cannot recur.

A scan is not a claim that no credential was ever exposed, and a green run does not clear the history entry above: it means nothing in the scanned history still matches a rule without a reviewed disposition.

### Rotation procedure and record

The exposed value is the *live* project key, so rotation means issuing a replacement and then revoking the exposed one — in that order, so tracing is never verified against a key that is already dead. Nothing below writes the key or any part of it to a file, a terminal that records scrollback, a workflow log, an issue, or this document.

1. In LangSmith → **Settings → API Keys**, create a replacement project-scoped key restricted to `secondary-condition-finder`. Give it a label with the rotation date, so the record below can name it without quoting the value.
2. If a local process will use it, write it to `.env.local` as `LANGSMITH_API_KEY`, leaving `LANGSMITH_TRACING` and `LANGSMITH_PROJECT` unchanged. Run `git check-ignore -v .env.local` before writing: it must print a rule; if it does not, stop — that file is tracked and the new key would be committed. If nothing local consumes the key, do not copy it there and record that in the table: a live key in a file with no reader is exposure without a benefit.
3. Verify the replacement before revoking the exposed key: the two checks in [the LangSmith setup guide](langsmith-engine-setup.md) §3 — the sessions request returns `200` (valid and correctly scoped) and an explicit `smoke-hello` run is accepted by ingestion. A deploy plus a Step 1 → Step 5 walk is **not** a valid check: nothing under `src/app` calls the traced wrapper, so the deployed app emits no `recommend` run either way.
4. Check the hosted environment rather than assuming it: the Vercel deployment checklist records that `LANGSMITH_API_KEY` was not yet configured there. If the variable is present in **Vercel → Project Settings → Environment Variables**, replace it, redeploy (Vercel does not apply a changed variable to an existing deployment), and repeat the §3 checks against the deployment's own key. If it is absent, record that and skip the redeploy — creating an unused secret is a new surface, not part of rotation.
5. Revoke the exposed key in **Settings → API Keys**. A revoked key answers `403` on every endpoint; that is the confirmation to record, and it is what makes the history entry above a reviewed finding rather than an open exposure.
6. Remove the value from any copy that still carries it (the shared PDF/screenshot pair, a password manager entry, a saved terminal transcript). Rotation ends the key's usefulness; it does not unshare what was shared.

A rotation is recorded only when every row is filled. Write the date in UTC, name the replacement by its LangSmith label, and never record the key or any prefix of it — the audit document already shows that a truncated prefix in a committed file is enough to make a reviewer ask whether the rest was there too. A row that was deliberately not done is recorded as not done with its reason, never as a pass: "no" with an explanation is an outcome a reviewer can check, while a fabricated "yes" is the failure this record exists to prevent.

| Field | Value |
| --- | --- |
| Date rotated (UTC) | **2026-10-22** |
| Replacement key label in LangSmith | `rotation-2026-10-22`, project-scoped to `secondary-condition-finder` |
| Replacement verified (`200`, smoke trace accepted) | **Yes** — the §3 sessions request returned `200` and an explicit `smoke-hello` run was accepted by ingestion, both before the exposed key was revoked |
| Exposed key revoked (`403` confirmed) | **Yes** — the exposed key answers `403` on every endpoint |
| `.env.local` updated and confirmed gitignored | **No — not updated as part of the rotation.** `.env.local` is gitignored (`.gitignore:26` `.env*`); the replacement was deliberately not written locally because nothing under `src/app` calls the traced wrapper, so a local copy has no consumer. Any LangSmith value it still holds predates the rotation, so it is not the replacement — and the exposed key it may contain is revoked. |
| Hosted environment checked (updated and redeployed, or recorded absent) | **Checked — recorded absent.** `LANGSMITH_API_KEY` is not present in Vercel → Project Settings → Environment Variables, so no deployment held the exposed value. No variable was created and no redeploy was run: an unused secret would be a new surface, not part of the rotation. |
| Copies outside the repository cleared | **No copies existed** — no copy outside the repository ever held the value. |

The record is the closure condition, and the exposure is closed by the revocation above: the exposed key is dead, so the history entry below is a reviewed finding rather than a live credential. The one row that is not a pass is the local copy, recorded as a deliberate omission rather than an unfinished step; if local tracing is ever configured again, write the replacement to `.env.local` at that point and update this row. `.gitleaksignore` keeps the fingerprint either way: deleting it would only make the scan fail again, and suppressing a finding has never been evidence that the credential was handled.

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
