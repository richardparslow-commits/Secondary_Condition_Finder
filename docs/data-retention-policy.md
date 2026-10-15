# Data Retention and Lifecycle Policy

## Scope

Applies to the current single-tenant, browser-first Secondary Condition Finder baseline described in `docs/product-spec.md`, `docs/deployment-readiness.md`, and `docs/security-operations.md`.

This policy covers: workflow sessions, optional evidence review, service-history context, logs/metrics, and VA reference cache. It does not expand the product scope — the app remains a research aid, not a system of record.

---

## Principles

- **Minimize collection:** the app stores no persistent user account, no central database of Veteran records, and no server-side file upload endpoint.
- **Minimize retention:** workflow state is short-lived; evidence stays in the browser tab.
- **Minimize exposure:** credentials are server-only; structured logs/metrics exclude raw evidence, medical free text, and secrets.

---

## What is stored, where, and for how long

### 1. Workflow session (secondary + presumptive)

| Store | Content | Where | Lifetime |
|---|---|---|---|
| Secondary browser-local workflow record (`secondary-condition-finder:secondary-workflow:v1`) | Selected diagnosed ids, service-connected answers/ratings (bounded), optional medication/treatment/history context, symptom ids and chronology (bounded) | Browser `sessionStorage` only (tab-scoped; never sent to the server) | Ends with the tab session; cleared by **Finish Review** / **Start a new review** via `clearSecondaryWorkflowLocalState` (`src/lib/secondary-workflow/local-state.ts`). The retired `secondary-workflow-v2` cookie is deleted and tombstoned by the edge proxy if a stale copy is presented (PRIV-01 stage 3). |
| Presumptive browser-local service-history record (`presumptive-condition-finder:service-history:v1`) | Confirmed locations + optional service dates + branch context (schema-bounded) | Browser `sessionStorage` only (tab-scoped; never sent to the server) | Ends with the tab session; cleared by the presumptive workflow's clear control / clear-all registry. The retired `presumptive-workflow-v1` cookie is deleted and tombstoned by the edge proxy if a stale copy is presented. |
| VA account session store (sandbox-only, optional) | Encrypted token pair and identity subject binding | Isolated server-side session store; browser has an opaque HttpOnly handle | 30-minute absolute session expiry; OAuth transaction bindings expire after five minutes. Production account access is not enabled. |

No workflow payload is serialized into URLs. `tests/secondary-workflow-privacy.test.ts` enforces this.

### 2. Optional evidence review

| Store | Content | Where | Lifetime |
|---|---|---|---|
| `sessionStorage` — `secondary-condition-finder:evidence-analysis:v1` | Extracted excerpts with provenance (source name, locator) from Step 4 | Current browser tab only | Tab session; cleared by **Finish Review** / **Start a new review** and by the evidence UI's **Clear local evidence**. Oversized analyses are bounded per `src/lib/evidence/limits.ts` (Standard/Extended) — excess is rejected, not silently truncated. |
| Raw document bytes / raw pasted text | PDF/DOCX/text parsed in the tab | Never submitted to the application server | Ephemeral in tab memory for the extraction pass only. |

The application server never receives raw document bytes/text via this feature (enforced by `tests/ingestion-privacy.test.ts` and evidence-architecture audit).

### 3. VA public-reference cache

| Store | Content | Where | Lifetime |
|---|---|---|---|
| Process-local reference cache (`src/lib/va/reference-cache.ts`) | Successful VA Forms / Benefits Reference Data responses | Single-process memory (disabled in production/distributed runtimes until shared coordinator exists) | **5 minutes** per entry (`VA_REFERENCE_CACHE_TTL_MS`); LRU-capped at 32 entries. Cleared on failed deployment lineage. |

See `src/lib/va/runtime-state.ts` for the production boundary: live VA traffic is fail-closed without a shared rate-limit/cache coordinator.

### 4. Logs and metrics

| System | What is logged | What is **never** logged | Default retention (managed by provider) |
|---|---|---|---|
| Vercel runtime logs, function logs | Commit SHA, deployment ID, route, status code, timestamps; content-free client error-boundary events | Secrets, raw evidence/medical free text, workflow payloads, exception messages/stacks/digests from client error boundaries, cookie values | **Not established for this deployment.** The platform's published retention is plan-specific — 1 hour (Hobby), 1 day (Pro), 3 days (Enterprise), or 30 days with Observability Plus — so the value in force is a hosting-account fact. The published schedule, the access roles, and the account facts that remain unread are recorded per sink in the [gate A review record](external-manual-gates-status.md#issue-537--hosting-log-retention-and-access-control-review-h-02-gate-a). |
| Vercel build logs | Build output for each deployment | Same exclusions | **Indefinite per deployment** — the platform documents no retention period for build logs ([build logs](https://vercel.com/docs/deployments/logs)). |
| OpenTelemetry traces/spans | **Disabled by policy** — no SDK provider/exporter is registered, so the application produces no span data (`src/lib/observability/telemetry-policy.ts`); the `@vercel/otel` dependency is removed. Re-enabling requires span/URL/exception sanitization plus collector retention/access review first. | — | — |
| VA reference cache keys (process-local + shared KV) | SHA-256-hashed user-supplied segments (Forms query, locator ZIP/radius/type); cached values may echo the lookup parameters for display | Raw query/ZIP used as key material | **5 minutes** per entry (`VA_REFERENCE_CACHE_TTL_MS`). Shared entries are additionally stamped with an invalidation epoch, so an operator cache-clear (`POST /api/admin/cache-clear`) discards them fleet-wide before TTL; only allowlisted key namespaces are stored, and a finite write budget bounds residency to ≤480 keys per namespace. Short-lived coordination keys live under the same prefix with no lookup values of their own: invalidation epoch, write-budget counter, per-key fetch lease (`inflight:{cacheKey}`, ≤120 s), consumer-budget window, and circuit cooldown/probe keys. |
| Structured app logs (`src/lib/observability/logger.ts`) | `recommendation executed` (counts only), `va request success/error` (requestId/service/status/durationMs/environment), health checks, content-free error-boundary events | Raw evidence, condition contents beyond counts, secrets, exception messages/stacks/digests from client error boundaries | Same pipeline as above; no separate long-term vault in this baseline. |
| Audit log (`src/lib/observability/audit.ts`) | `workflow-*-selected`, `presumptive-service-history-saved`, `regulatory-preflight-triggered/unauthorized` with `status` + safe counters | Same exclusions; these are operational events, not a per-user workflow history | Same pipeline. |

If an external log aggregator or log drain (e.g., Axiom, Datadog) is configured in the hosting account, its retention replaces the platform figures above and must be documented here. A drain is configured in the hosting account, not in this repository, so a drain's existence cannot be ruled out from the file tree — the gate A review record names that as one of the unread account facts.

The platform documents **no** query-parameter redaction for runtime logs or for a drain on any documented plan, so a logged or drained request path carries its query string as sent; its only documented drain privacy control hides IP addresses. No record on this page therefore claims that a URL is scrubbed before it is logged. For the OAuth callback request line — the one path that can carry a temporary authorization code — the accepted residual and the reachability bound that stands in for scrubbing are recorded per sink in the [gate B record](external-manual-gates-status.md#issue-538--oauth-callback-url-log-scrubbing-review-h-02-gate-b).

There is **no** application event-persistence backend for workflow or recommendation history in the current baseline. Allowlisted workflow and recommendation events are nevertheless written to the structured platform-log sink above; these are operational event logs, not a per-user history database.

---

## Deletion requests

### Current single-tenant baseline (no user accounts)

There is no central user table to delete. A user can delete their own transient data immediately by:

1. Using **Finish Review** or **Start a new review** on `/secondary/*` (clears the browser-local workflow record and evidence/checklist stores).
2. Clearing site cookies + `sessionStorage` in the browser, or closing the tab (evidence and workflow records are `sessionStorage`-scoped).
3. Clearing the presumptive browser-local service-history record via the presumptive clear action.

Self-service clearing covers everything this application stores in the browser. For the server-side records a request can reach — the sealed read-only account session described in the privacy policy's section 6, and operational records that identify the requester — use the published channel of record: requests are accepted at **`privacy@secondaryconditionfinder.org`**, and the `/privacy/request` intake page pre-composes a deletion, access, correction, or question message in the requester's own mail client (nothing is submitted to this application). **That address is not deliverable today**: a dated check on 2026-10-15 found `secondaryconditionfinder.org` absent from DNS — `MX`/`NS` return NXDOMAIN with the `.org` registry's own SOA as authority, from two independent DNS-over-HTTPS resolvers — so a message sent to it arrives nowhere until the operator registers the domain and operates the mailbox. The finding, its readings, and the fulfilment procedure are recorded in the [gate C record](external-manual-gates-status.md#issue-539--privacy-policy-deletion-right-language-operator-sign-off-r-01-9) and the [privacy request fulfilment procedure](privacy-request-fulfilment-procedure.md); the 45-day commitment remains the published promise, and no request has been received under it. The workflow's own completion controls — Finish Review / Start a new review on `/secondary/*` — link that intake, so a visitor who has just cleared the browser-side record can start a request from where the question arises rather than only from the policy.

A verified request is completed **within 45 days** of receipt, including any constituent partial request. Where a record must be retained under the narrow statutory exceptions — records kept under 36 CFR Chapter XII (National Archives and Records Administration recordkeeping) and VA recordkeeping obligations under Title 38, United States Code — or where a request is completed only in part or refused, the completion confirmation states what was retained and why.

Hosting-platform request and operational logs are addressed by the [operator log-retention review](external-manual-gates-status.md) rather than by host-independent deletion; when a request needs provider-side handling, the operator confirms that outcome in the same completion confirmation. Security vulnerabilities are reported through `SECURITY.md`, which is not the privacy-request channel. Do not include sensitive payloads — medical records, a claim number, or a Social Security number — in a request.

### Future multi-user basis (not yet applicable)

If multi-user / admin / persistence features are added, this policy must be updated to cover: per-tenant deletion APIs, backup retention, and credential rotation evidence. Any such expansion requires a privacy/security review per `docs/security-operations.md`.

---

## Provider-held artifacts

- **Git history:** version-controlled catalog/KB/presumptive data — no user sessions or evidence.
- **Vercel deployments:** immutable build artifacts per commit; old deployments age out per Vercel project settings.
- **CI artifacts / E2E screenshots:** ephemeral; do not retain sensitive payloads.

---

## Review cadence

Review this policy whenever workflow state shape, evidence handling, VA integration, or log aggregation changes — and at least annually before the production-access annual review.

---

## Links

- Published rights and channel: [privacy policy](https://secondary-condition-finder.vercel.app/privacy) section 8 and the `/privacy/request` intake page (`src/app/privacy/page.tsx`, `src/app/privacy/request/page.tsx`)
- Product scope: `docs/product-spec.md`, `docs/master-specification.md`
- Production runbook: `docs/deployment-readiness.md`
- VA runtime contract: `docs/va-api-runtime-configuration.md`
- Security operations: `docs/security-operations.md`
- Implementation: `src/lib/workflow-session-crypto.ts`, `src/lib/evidence/storage.ts`, `src/lib/observability/logger.ts`, `src/app/api/health/route.ts`
