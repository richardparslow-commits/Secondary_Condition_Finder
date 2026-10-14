# Operations Guide

Operational procedures for monitoring, debugging, and maintaining the Secondary Condition Finder.

## VA Reference Cache

The application uses a two-tier cache for VA public reference data (forms, disability ratings, service branches, accredited representatives).

### Cache Architecture

| Tier | Scope | TTL | Max Entries | State on Cold Start |
|------|-------|-----|-------------|---------------------|
| Process-local (LRU) | Single serverless instance | 5 minutes | 32 | Reset |
| Shared (KV/Redis, optional) | Cross-instance | 5 minutes | ≤480 resident keys per namespace (finite write budget: 240 writes/namespace/5-min window; see below) | Persistent until TTL |

**Process-local cache** (`src/lib/va/reference-cache.ts`):
- In-memory `Map` with LRU eviction (32 entries max)
- 5-minute TTL per entry
- Resets on every cold start (serverless function restart)
- Keyed by API source + query parameters

**Shared cache** (`src/lib/va/reference-shared-cache.ts`):
- Optional Upstash Redis / Vercel KV layer
- Enabled when `VA_REFERENCE_SHARED_CACHE_URL` + `TOKEN` (or Upstash aliases) are set
- 750ms best-effort timeout — never blocks a page render
- On shared hit, rehydrates the process-local entry so subsequent same-process hits are instant
- Key policy: only the namespaced roots `forms-finder:` / `forms-reference:` / `accredited-rep:` / `disabilities:` / `service-branches:` (plus legacy `forms:`) are read or written (lowercase `[a-z0-9:_-]`, ≤256 chars)
- Entries are versioned envelopes stamped with the store-wide invalidation epoch; a value written under a previous epoch is a miss, not a hit
- Finite cardinality: at most `VA_SHARED_KEY_WRITE_MAX_PER_WINDOW=240` admitted writes per namespace per `VA_SHARED_KEY_WRITE_WINDOW_SECONDS=300` window, so ≤480 resident keys per namespace (≤1,920 across the allowlist). A refused or failed budget check skips the write — the cache is colder, never wrong
- Single-flight per key: one instance claims a 120 s `SET … NX PX` lease (`VA_SHARED_FETCH_LEASE_MS`) for a cold/expired key, sized to cover the longest legal logical fetch (three 30 s attempts plus inter-attempt backoff and the shared write), and other instances wait up to 600 ms for that value to be published instead of issuing their own upstream request. The lease fails open (an unreachable coordinator just means the normal path) and expires on its own if the holder dies
- Degraded store: every KV exchange is capped by the 750 ms deadline, so a store that is slow (rather than unreachable) costs a fail-closed render at most three deadlines (~2.25 s: cache read, lease claim, circuit gate) and never waits for the store's real latency; nothing is cached, no quota is reserved, and no upstream request is made while the coordinator is unusable
- Consumer budget: in a distributed runtime every upstream attempt reserves a shared slot first, and the reservation is a **rolling** window — the current bucket's atomic count is charged together with the weighted share of the previous bucket the current instant still overlaps, so the fleet cannot admit `VA_SHARED_CONSUMER_MAX_REQUESTS=60` at the end of one bucket and another 60 at the start of the next (that boundary burst was audit A03), and it refills gradually as the overlap decays. Counters must be non-negative safe integers and each window's counter lifetime is validated, so a fractional, erroring, or un-expirable counter fails closed instead of authorising a slot; a refused attempt still consumes its slot, which makes the budget more conservative, never looser

### Monitoring Cache Effectiveness

The health endpoint exposes cache-hit/miss counters and the cache scope:

```
GET /api/health
```

Response includes:

```json
{
  "components": {
    "vaReferenceCache": {
      "scope": "process-local",
      "detail": "process-local LRU on this instance only; entries reset on cold start and are not shared with other instances",
      "hits": 42,
      "misses": 8,
      "hitRate": 84
    }
  }
}
```

- **scope**: `process-local` when the cache is available, otherwise `disabled`
- **hits**: cache lookups that returned a valid entry
- **misses**: cache lookups that returned `null`; when `scope` is `disabled`, the counters are structurally frozen
- **hitRate**: percentage (0–100), `null` when there have been no lookups or the cache is disabled

Counters are **process-local** and reset on cold start. Longitudinal metric/trace export is not currently available: automatic OpenTelemetry export is disabled by policy and no SDK provider is registered (`src/lib/observability/telemetry-policy.ts`), so the in-process counters above are the monitoring source today.

### When to Clear the Cache

Clear the cache when:

1. **VA API outage recovery** — upstream data was stale/unavailable during an outage and the cache retained old values
2. **Reference data update** — VA published new form numbers, benefit types, or accredited representative data and you need to force a refresh before the 5-minute TTL
3. **Debugging stale data** — operator suspects the cache is serving outdated reference information

### Clearing the Cache

#### Via API (production)

```bash
# Clear all cached VA reference entries
curl -X POST https://secondary-condition-finder.vercel.app/api/admin/cache-clear \
  -H "Authorization: Bearer $CRON_SECRET"

# Clear only entries with a specific prefix
curl -X POST "https://secondary-condition-finder.vercel.app/api/admin/cache-clear?prefix=forms-finder:" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response:

```json
{
  "ok": true,
  "cleared": 5,
  "prefix": null,
  "sharedInvalidation": "applied",
  "sharedEpoch": "1",
  "message": "Cleared all 5 cache entries. Advanced shared-cache invalidation epoch to 1."
}
```

`sharedInvalidation` is `applied` (epoch advanced), `not-configured` (no shared KV), or `failed` (the coordinator was unreachable — the shared tier may serve stale entries until their 5-minute TTL expires).

**Authentication**: Bearer token using `CRON_SECRET` or `REGULATORY_SYNC_SECRET` (same credentials as the regulatory preflight endpoint).

**Important**: The process-local clear applies only to the instance that handles the request. Other instances retain their own in-memory entries until their TTL expires, but they will **not** serve shared entries written before the request: when a shared KV is configured the endpoint atomically advances the store-wide invalidation epoch (`INCR va:ref:cache-epoch`), which invalidates every cached entry fleet-wide immediately. The bump is store-wide even for a `prefix`-scoped request — over-invalidation is deliberate, because under-invalidation is the failure mode that matters. If no shared KV is configured, clearing other instances' memory still requires per-instance calls or TTL expiry.

**In production this endpoint has nothing to clear.** Because process-local state is
refused in production and distributed runtimes, the cache never stores anything there,
so the response reports `"scope": "disabled"` alongside `"cleared": 0` — that means
"cleared nothing because the cache cannot hold anything here", which is different from
the `"cleared": 0` a working-but-cold cache returns. It still answers `200` and still
writes an audit entry, now tagged `cacheScope`, so a flush job can tell the two apart
without guessing from the outcome.

#### Via Shared Cache (if configured)

When a shared KV cache is configured, the epoch bump invalidates every shared entry fleet-wide without deleting anything: instances stop serving values stamped with the previous epoch on their next read, and the orphaned values expire on their TTL. A store-wide delete sweep is deliberately avoided because it would race concurrent writers — over-invalidation is safe, under-invalidation is not.

### Cache Key Conventions

Keys are prefixed in the shared store (`va:ref:` by default). User-supplied segments (Forms query, locator ZIP/radius/type) are SHA-256-hashed — the raw text is never key material:

| Source | Key pattern | Example key (shared-store name) |
|--------|-------------|--------------------------------|
| VA Forms Finder | `forms-finder:{env}:q:{hash}` | `va:ref:forms-finder:sandbox:q:9f2c…` |
| VA Form reference | `forms-reference:{env}` | `va:ref:forms-reference:sandbox` |
| Disability reference | `disabilities:{env}` | `va:ref:disabilities:sandbox` |
| Service branches | `service-branches:{env}` | `va:ref:service-branches:sandbox` |
| Accredited representatives | `accredited-rep:{env}:{hash}` | `va:ref:accredited-rep:sandbox:41ab…` |

Coordination keys live under the same prefix but never carry lookup values: `cache-epoch` (invalidation marker), `cardinality:{namespace}:{window}` (write budget), `budget:{bucket}` (consumer quota — one counter per rolling window, read together with its predecessor), and `circuit:{service}` / `circuit-probe:{service}` (fleet cooldown and probe lease).

The `prefix` query parameter filters **process-local** keys only (e.g. `?prefix=forms-finder:`); the shared-tier invalidation epoch is always advanced store-wide:

```bash
curl -X POST "https://secondary-condition-finder.vercel.app/api/admin/cache-clear?prefix=forms-finder:" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Health Endpoint

```
GET /api/health
```

Returns component-level status for:

| Component | What it checks |
|-----------|---------------|
| `catalog` | Condition catalog loads and parses correctly (count of conditions) |
| `sessionCrypto` | AES-256-GCM seal/open primitives pass an ephemeral self-test |
| `workflowSession` | Production configured-secret readiness for the legacy crypto marker; not research-workflow or VA-account store readiness |
| `vaConfig` | VA API configuration is valid (enabled/disabled, environment) |
| `circuitBreaker` | VA API circuit breaker state (closed/open/half-open per source) |
| `vaReferenceCache` | Cache `scope` (`process-local` or `disabled`) plus hit/miss counters |
| `rateLimit` | Identity policy, enforced shared ceiling, and whether counters are per-instance or deployment-wide |
| `runtime` | Aggregate: which process-local capabilities are below full strength, and every capability's regime |

`sessionCrypto` tests the AES-256-GCM primitives with an ephemeral probe secret. `workflowSession` separately checks the configured primary `WORKFLOW_SESSION_SECRET` in production and makes health degraded if that readiness probe fails. This is a legacy runtime marker: it does not verify browser-local research-workflow state or the separate optional VA-account store, which uses `VA_ACCOUNT_SESSION_SECRET`.

### What this deployment gives up

Several controls depend on process-local state, and each behaves differently once more
than one instance serves traffic. Two **refuse** to run (live VA access, the VA reference
cache) and two keep running **weaker** than written (rate limiting, the VA circuit
breaker — the latter was never surfaced anywhere before).

`components.runtime` is the single answer to that question:

| Field | Meaning |
|-------|---------|
| `distributed` | Whether this process is one of several |
| `reduced` | Ids below full strength here: `vaLiveIntegration`, `vaReferenceCache`, `rateLimit`, `circuitBreaker` |
| `capabilities` | Every id → its regime, including controls with no component of their own |
| `detail` | One sentence naming each reduced capability and its consequence |

In production **all four are reduced**, which is expected rather than a fault — so an
empty `runtime.reduced` on a production instance would itself be the surprising reading.
The per-control components (`vaReferenceCache`, `rateLimit`) carry the same scopes plus
their own data, and both are generated from the same capabilities report, so they cannot
disagree with it. `vaReferenceCache.scope: "disabled"` is why `hits`/`misses` stay frozen
at zero and `hitRate` is `null` there — the counters should never be read without the
scope. Adding a control that depends on process-local state requires registering it;
the suite fails if a module consults the runtime classification without a scope.

**HTTP 200** = healthy (catalog, crypto primitives, configured primary-secret readiness, and knowledge-base graph checks pass)
**HTTP 503** = degraded (one or more of those required checks fails)

### Example Response

```json
{
  "status": "healthy",
  "components": {
    "catalog": { "status": "ok", "latencyMs": 2, "count": 186 },
    "sessionCrypto": { "status": "ok", "latencyMs": 1 },
    "workflowSession": { "status": "ok", "latencyMs": 1, "detail": "Workflow session crypto readiness probe passed" },
    "kbGraph": { "status": "ok", "latencyMs": 1, "nodes": 4, "edges": 3 },
    "vaConfig": { "status": "ok", "latencyMs": 0, "enabled": true, "environment": "production" },
    "circuitBreaker": {
      "status": "ok",
      "latencyMs": 0,
      "detail": "va-forms:closed benefits-reference-data:closed accredited-representatives:closed",
      "snapshot": {
        "va-forms": { "state": "closed", "failures": 0, "lastFailureAt": null },
        "benefits-reference-data": { "state": "closed", "failures": 0, "lastFailureAt": null },
        "accredited-representatives": { "state": "closed", "failures": 0, "lastFailureAt": null }
      }
    },
    "vaReferenceCache": {
      "scope": "process-local",
      "detail": "process-local LRU on this instance only; entries reset on cold start and are not shared with other instances",
      "hits": 42,
      "misses": 8,
      "hitRate": 84
    },
    "rateLimit": {
      "status": "ok",
      "latencyMs": 0,
      "scope": "per-instance",
      "detail": "per-client limits apply per instance; all requests also charge the shared admission ceiling, and counters are not shared across instances",
      "identity": { "trustedIngress": false, "identity": "self-declared", "variable": "RATE_LIMIT_TRUSTED_INGRESS", "detail": "forwarding headers are not asserted by this runtime" },
      "ceiling": { "max": 6000, "windowMs": 60000, "variable": "RATE_LIMIT_UNATTRIBUTED_MAX", "key": "unattributed:shared", "detail": "shared admission budget for unattributed and aggregate traffic" },
      "store": { "mode": "process-local", "distributed": false, "blockedBy": "no-store-provisioned", "detail": "counters are per instance; no deployment-wide quota is claimed" }
    },
    "runtime": {
      "status": "ok",
      "latencyMs": 0,
      "distributed": true,
      "reduced": ["vaLiveIntegration", "vaReferenceCache", "rateLimit", "circuitBreaker"],
      "capabilities": {
        "vaLiveIntegration": "disabled",
        "vaReferenceCache": "disabled",
        "rateLimit": "per-instance",
        "circuitBreaker": "per-instance"
      },
      "detail": "4 of 4 process-local capabilities are below full strength here: Live VA API access (refuses, disabled); VA reference cache (refuses, disabled); Application rate limiting (degrades, per-instance); VA API circuit breaker (degrades, per-instance)"
    }
  },
  "latencyMs": 5,
  "timestamp": "2026-09-14T00:00:00.000Z"
}
```

## PRIV-01 acceptance on a loaded host

In CI the walk is job `priv01_sentinel` in `.github/workflows/ci.yml`, with its
own wall-clock ceiling and a smaller budget for the walk inside it. It is required — the `verify` job needs it
and fails when it fails — and path-filtered for pull requests by the
`priv01_scope` job, which answers from the change set and fails closed. When it
fails, the run's job summary carries the walk's phase lines, its heartbeats and
any `STALLED` verdict, and the walk log, server log and evidence JSON ride that
job's artifact.

Run `npm run acceptance:sentinel` for a foreground, fail-closed acceptance walk.
Chrome/Chromium and the installed same-origin OCR assets are required. The
harness pairs the app with its own server log and checks both the runner exit
status and the evidence report. A failed assertion or missing result is never a
pass.

A dev server already running for this project is **reused** rather than treated
as a failure, because Next's per-project dev lock makes a second `next dev`
refuse to start: the entrypoint reads `.next/dev/lock`, drives the server named
there, and scans that server's own log at
`.next/dev/logs/next-development.log`. A server this process did not start is
left running. Reuse happens only when that log exists — the walk's log scan is
part of the evidence, so a missing log is refused rather than made vacuous. Pass
`--no-reuse` (or `SENTINEL_NO_REUSE=1`) to always start a fresh dev server.

For a client with short command timeouts, start once and resume **waiting**, not
the walk (the same browser, sentinels and capture inventory stay alive):

```bash
npm run acceptance:sentinel -- --background
npm run acceptance:sentinel -- --wait --wait-timeout 30000
# Repeat the wait command until the run finishes.
```

`--state <path>` selects an isolated status/log pair; pass the same path to both
commands. A client wait timeout exits **2 (pending)** and does not stop the
worker, browser or server. Completion returns the acceptance exit code; a dead
runner without a result exits 1. Starting a second run against an active state
file is refused. This is not recovery after a browser/host crash: restart the
entire walk to rebuild complete privacy evidence in that case.

OCR canvas inputs are transferred as bitmaps to the direct same-origin worker.
PNG encoding uses `OffscreenCanvas` there; model loading and WASM inference also
stay off the page's main thread. No blob-script exception or third-party asset
host is enabled. The sentinel uses bounded page probes and retains a fixed OCR
deadline (default 240000 ms, configurable with `SENTINEL_OCR_TIMEOUT_MS` for
slower hosts); a longer client wait does not renew that deadline or weaken
privacy assertions.

While a wait is outstanding the walk prints a heartbeat line every 15s, so a run
that has wedged can be told from one that is merely slow without attaching a
debugger. What distinguishes them is whether the thing being polled is still
answering:

```
progress 15s | phase "preconditions (health, schema inventory)" for 15s | waiting 15s on "app health" (50 probes) | last event 15s ago (phase "preconditions (health, schema inventory)") | STALLED:unresponsive: "app health" stopped answering: 50 consecutive probe errors (last: fetch failed)
progress 15s | phase "Pass B — seeded browser record" for 5s | waiting 1s on "post-Finish Review route" (1 probes) | last event 1s ago (assertion "no sentinel remains in localStorage or cookies after Finish Review" passed) | OK: still answering (last probe returned false)
```

`OK` means the polled target answered — `false` is still an answer, so the run is
slow rather than wedged. `STALLED:unresponsive` means consecutive probes threw:
for a page condition that is the browser wedge, while for `app health` it is
usually nothing listening on the app port. The verdict names the wait instead of
assuming a browser, so a missing dev server does not send the reader after
Chrome. `STALLED:no-progress` means no event of any kind landed for 30s, which
points at a step outside the polling loop rather than a slow page. A timed-out
wait repeats the same sentence in its error (`... this is a wedge, not a slow
run`), and both the passing and the runner-error JSON reports carry it as
`progress` — phase, wait label, probe count, consecutive errors, heartbeat count
— so a run that had to be killed still says where it stopped and why.

## Rate Limiting

Application-level rate limiting is enforced in the proxy middleware (`src/proxy.ts`) as defense-in-depth behind Vercel's edge WAF.

| Route | Window | Max Requests | Key |
|-------|--------|-------------|-----|
| Server Action POSTs (and every other POST) | 60s | 30 | IP (`X-Forwarded-For`, then `X-Real-IP`) |
| `/api/regulatory/preflight` | 60s | 5 | IP |
| `/api/admin/cache-clear` | 60s | 5 | IP |
| `/api/health` | 60s | 30 | IP |
| Public reference page reads (`/va-forms`, `/va-forms/finder`, `/va-reference`, `/secondary/evidence`, …) — GET/HEAD, plus the reference Server Action POSTs that replaced the finder's GET search | 60s | 30 | IP |
| **All limited surfaces combined** (shared ceiling, attributed or not) | 60s | `RATE_LIMIT_UNATTRIBUTED_MAX`, default 6000 | one shared budget |

**Client identity.** The key is the first usable hop of `X-Forwarded-For`, falling
back to `X-Real-IP`; *usable* means a syntactically valid IP literal, so a
hostname, path fragment, or fresh random token cannot mint a private bucket.

**Shared admission ceiling.** Every request on a limited surface is also charged
to one shared, named ceiling (`RATE_LIMIT_UNATTRIBUTED_MAX`, default 6000 per
60s), reported as `components.rateLimit.ceiling`. The value is derived rather
than picked — 30 charges/minute per client × 200 concurrent clients on one
instance — and its failure directions, its unmeasured upper bound and the
triggers that force a re-derivation are in
[the ceiling-default decision](sec-02-admission-ceiling-default-2026-10-09.md).
Two things depend on it:

- A request with no usable identity is **bounded** rather than skipped. It used to
  pass through unthrottled, which made the limiter optional on demand, since the
  headers are client-supplied: send a junk or rotating value and nothing applied.
- A client that presents a *different valid IP* on every request is bounded too.
  Each fresh key gets a fresh per-client allowance, so only an aggregate ceiling
  can price that. The ceiling is therefore also the per-instance throughput floor
  for limited surfaces, which is why the default sits far above plausible honest
  traffic for one instance. Fairness stays with the per-client buckets above.

The ceiling is deliberately its own reported number rather than a relabelled
per-client limit, because a single bucket shared under the *per-IP* name would
silently become a global cap nobody could see. Set
`RATE_LIMIT_TRUSTED_INGRESS=true` only after checking that your ingress **sets**
(rather than passes through) the forwarding headers; `components.rateLimit.identity`
records whether that assertion has been made, so a deployment can be audited for
the claim instead of trusting this page.

**Scope.** Buckets are process-local and reset on cold start, so the effective
limit is roughly the configured limit × instance count. That is an intentional
trade: it makes the guard weaker than written, never wrong. This differs from the VA
reference cache, which refuses to use process-local state in production at all —
because a per-instance cache can serve a wrong answer, whereas a per-instance
limiter can only permit more traffic than intended. `/api/health` reports the
current regime as `components.rateLimit.scope` (`per-instance` or `single-process`),
and the ceiling and identity policy beside it as `components.rateLimit.ceiling` and
`components.rateLimit.identity`. A deployment-wide quota would need a shared counter
store; none is provisioned or wired today, and `components.rateLimit.store` says so
(`mode: "process-local"`, `blockedBy: "no-store-provisioned"`).

**Hosted acceptance.** What this page describes is the code. The evidence a
deployment still owes before SEC-02's remaining half can be closed — spoofed and
missing forwarding headers at the real edge, direct-origin refusal, two instances
and a cold start — is the operator procedure in
[the SEC-02 hosted acceptance runbook](sec-02-hosted-acceptance-runbook-2026-10-09.md),
with [an evidence template](sec-02-hosted-acceptance-evidence.template.json) to
fill in. A green deployment or a green `/api/health` is not that evidence.

## Circuit Breaker

VA API calls are protected by a per-source circuit breaker (`src/lib/va/circuit-breaker.ts`):

- **Closed** (normal): requests pass through
- **Open** (failure threshold exceeded): requests fail fast for 60 seconds
- **Half-open**: exactly one probe request allowed to test recovery

An upstream `429` opens the breaker immediately for the clamped `Retry-After` window
(1 s–15 min; 30 s when the header is unusable), and the caller returns its labelled
local fallback rather than holding the request open for that window — the retry is
served later, once, as the single admitted probe.

The one exception is an upstream that explicitly authorizes retrying at once
(`Retry-After: 0`, or an HTTP-date already in the past). That is retried in-request
once, after the minimum backoff delay, because the breaker's one-second floor would
otherwise turn an explicit "retry now" into a one-second outage for every caller.
Every whole-second instruction exceeds the in-request budget by design
(`VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS` in `src/lib/va/api.ts`), so a normal rate
limit takes the deferred path above.

In distributed runtimes the breaker still tracks this instance, but fleet admission additionally requires the explicit shared consumer-budget opt-in (`VA_SHARED_CONSUMER_BUDGET=true`) and a configured shared KV. An instance that opens its breaker publishes a shared cooldown marker, and recovery admits a single fleet-wide probe via an atomic lease (`SET … NX PX`); an unreachable coordinator fails closed instead of granting a per-process budget.

The health endpoint exposes the current state of each circuit breaker. If you see `open` in production, check the VA API status page and wait for the half-open window.

## Environment Variables

See `.env.example` for the full list. Key operational variables:

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer auth for admin endpoints (cache-clear, regulatory preflight) |
| `REGULATORY_SYNC_SECRET` | Alternative auth for regulatory preflight (falls back to CRON_SECRET) |
| `VA_REFERENCE_SHARED_CACHE_URL` | Upstash Redis / Vercel KV URL for shared cache tier |
| `VA_REFERENCE_SHARED_CACHE_TOKEN` | Corresponding auth token |
| `LANGSMITH_API_KEY` | LangSmith tracing (optional) |
| `REGULATIONS_GOV_API_KEY` | Regulations.gov enrichment (optional) |
