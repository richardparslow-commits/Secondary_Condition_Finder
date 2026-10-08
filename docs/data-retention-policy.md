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
| Presumptive workflow cookie (`presumptive-workflow-v1`) | Selected locations + optional service dates + optional service-branch context (bounded) | `HttpOnly`, `SameSite=Strict`, AES-256-GCM authenticated, `path=/presumptive` | Same 30-minute window; not read by `matchPresumptives()` for eligibility. |

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
| Vercel build/runtime logs, function logs | Commit SHA, deployment ID, route, status code, timestamps | Secrets, raw evidence/medical free text, workflow payloads, cookie values | Vercel platform default (operator-configured). Treat as **30 days hot** unless extended. |
| OpenTelemetry traces/spans | **Disabled by policy** — no SDK provider/exporter is registered, so the application produces no span data (`src/lib/observability/telemetry-policy.ts`); the `@vercel/otel` dependency is removed. Re-enabling requires span/URL/exception sanitization plus collector retention/access review first. | — | — |
| VA reference cache keys (process-local + shared KV) | SHA-256-hashed user-supplied segments (Forms query, locator ZIP/radius/type); cached values may echo the lookup parameters for display | Raw query/ZIP used as key material | **5 minutes** per entry (`VA_REFERENCE_CACHE_TTL_MS`). Shared entries are additionally stamped with an invalidation epoch, so an operator cache-clear (`POST /api/admin/cache-clear`) discards them fleet-wide before TTL; only allowlisted key namespaces are stored, and a finite write budget bounds residency to ≤480 keys per namespace. Short-lived coordination keys live under the same prefix with no lookup values of their own: invalidation epoch, write-budget counter, per-key fetch lease (`inflight:{cacheKey}`, ≤45 s), consumer-budget window, and circuit cooldown/probe keys. |
| Structured app logs (`src/lib/observability/logger.ts`) | `recommendation executed` (counts only), `va request success/error` (requestId/service/status/durationMs/environment), health checks | Raw evidence, condition contents beyond counts, secrets | Same pipeline as above; no separate long-term vault in this baseline. |
| Audit log (`src/lib/observability/audit.ts`) | `workflow-*-selected`, `presumptive-service-history-saved`, `regulatory-preflight-triggered/unauthorized` with `status` + safe counters | Same exclusions | Same pipeline. |

If an external log aggregator (e.g., Axiom, Datadog) is added, its retention replaces the default above and must be documented here.

There is **no** application event-persistence backend for workflow or recommendation history in the current baseline.

---

## Deletion requests

### Current single-tenant baseline (no user accounts)

There is no central user table to delete. A user can delete their own transient data immediately by:

1. Using **Finish Review** or **Start a new review** on `/secondary/*` (clears workflow cookie + browser-local evidence/checklist stores).
2. Clearing site cookies + `sessionStorage` in the browser, or closing the tab (evidence is `sessionStorage`-scoped).
3. Removing `serviceHistory` via the presumptive clear action.

For logs/metrics that may contain sanitized operational traces, file a request through the channel in `SECURITY.md` with the time window and route — the operator will confirm provider-side retention handling. Do not include sensitive payloads in the request.

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

- Product scope: `docs/product-spec.md`, `docs/master-specification.md`
- Production runbook: `docs/deployment-readiness.md`
- VA runtime contract: `docs/va-api-runtime-configuration.md`
- Security operations: `docs/security-operations.md`
- Implementation: `src/lib/workflow-session-crypto.ts`, `src/lib/evidence/storage.ts`, `src/lib/observability/logger.ts`, `src/app/api/health/route.ts`
