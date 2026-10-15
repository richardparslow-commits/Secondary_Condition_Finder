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
- Consumer budget: in a distributed runtime every upstream attempt reserves a shared slot first, and the reservation is **one atomic server-side operation** — a single `EVAL` (`SHARED_CONSUMER_WINDOW_SCRIPT`) that reads the previous bucket, increments the current one, charges that count together with the weighted share of the previous bucket the current instant still overlaps, gives the counter its lifetime, and returns the decision. The fleet cannot admit `VA_SHARED_CONSUMER_MAX_REQUESTS=60` at the end of one bucket and another 60 at the start of the next (that boundary burst was audit A03), refills gradually as the overlap decays, and cannot be decided against a predecessor other callers are still writing; a reservation whose window the store has already moved past is refused before it writes (a straggler cannot release a second budget by arriving late), and the decision reply must be a named code (`VA_SHARED_CONSUMER_DECISION`) or the attempt fails closed — an erroring, unknown, or unreadable reply never authorises a slot, and neither does an invalid predecessor. A refused attempt still consumes its slot, which makes the budget more conservative, never looser. The upstream's own `ratelimit-remaining`/`reset` guidance is charged into the same window counter, so a response that reports a short quota tightens the fleet's pacing immediately; the correction is one-way (it can only add reservations), and guidance that is missing or unreadable — including a `reset` in epoch seconds rather than delay-seconds — changes nothing rather than being guessed at. Every reservation decision and every guidance charge is also recorded in process-local counters (`src/lib/va/consumer-budget-pressure.ts`) and reported as `components.vaConsumerBudget.pressure` on `/api/health`, so the fleet's throttling is readable **before** VA answers `429`: `refused` and `refusals` by reason, `refusedInLastWindow`, `lastRefusalAt`/`lastRefusalReason`, and `pacing.chargedReservations` — the upstream's own short-quota statement, which is the earliest warning of all. Those counters are this instance's decisions since it started and do not add up to a fleet total on their own, but a refusal is an event rather than a rate, so any non-zero count is true of the fleet

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

### Monitoring Consumer-Budget Pressure

In a distributed runtime every upstream attempt reserves a slot in the fleet's one shared
consumer window first, so the budget — not the upstream — is what usually refuses traffic.
That pressure is reported in the same response:

```json
{
  "components": {
    "vaConsumerBudget": {
      "status": "ok",
      "latencyMs": 0,
      "scope": "fleet-shared",
      "detail": "every upstream attempt on this instance, including retries, reserves a slot in the fleet's one shared window (60 per 60000 ms) before it reaches VA, so the budget bounds the whole fleet rather than this process; components.vaConsumerBudget.pressure reports this instance's share of the resulting refusals",
      "budget": { "maxRequests": 60, "windowMs": 60000, "optIn": true, "variable": "VA_SHARED_CONSUMER_BUDGET" },
      "store": { "mode": "shared-coordinator", "distributed": true, "blockedBy": null },
      "pressure": {
        "scope": "per-instance",
        "since": "2026-09-14T00:00:00.000Z",
        "admitted": 1240,
        "refused": 37,
        "refusals": { "exhausted": 34, "superseded-window": 1, "predecessor-invalid": 0, "counter-lifetime-refused": 0, "unreadable-decision": 0, "store-unconfigured": 0, "store-unreachable": 2, "clock-unusable": 0 },
        "refusedInLastWindow": 12,
        "lastRefusalAt": "2026-09-14T00:03:00.000Z",
        "lastRefusalReason": "exhausted",
        "pacing": { "charges": 6, "chargedReservations": 280, "refusedCharges": 0, "lastChargedAt": "2026-09-14T00:02:00.000Z" },
        "detail": "37 of 1277 reservation decisions on this instance were refused the shared consumer budget; the most recent reason was exhausted"
      }
    }
  }
}
```

- **Any non-zero `refused` means the fleet was throttled.** A refusal is an event, not a
  rate, so the count is a lower bound that is true as stated: the budget refused upstream
  traffic somewhere in the fleet. VA's own `429` would arrive later, after the fleet has
  already been refusing itself — that is the whole point of reading this field.
- **`refusals.exhausted` is the budget working**; the attempt was refused because the
  window's budget is spent. The other reasons are the budget failing closed rather than
  pacing: `superseded-window` (a stalled or clock-lagging caller arrived after the store
  moved on), `predecessor-invalid`, `counter-lifetime-refused`, `unreadable-decision`,
  `store-unconfigured`, `store-unreachable`, and `clock-unusable`. A non-zero value in any
  of those is a coordinator problem, not ordinary pacing.
- **`refusedInLastWindow` plus `lastRefusalAt` say whether it is happening now or was.**
  The windowed figure covers the window containing the request and the one before it (the
  two the rolling rule overlaps); the timestamp says how stale it is.
- **`pacing.chargedReservations` is the earliest warning of all.** A charge is applied only
  when an upstream response itself reported less quota remaining than the fleet's window
  believed, so a non-zero value means VA has already said the fleet is short.
- **These counters are per instance and reset on cold start** (`pressure.scope` says so).
  Two instances' counters do not add up to a fleet total on their own, and `since` is when
  this instance recorded its first decision — read it before treating a low count as
  headroom.
- **`scope` on the component, not the counters, says whether the budget is in force here.**
  `fleet-shared` means it is; `unenforced` means the opt-in or the coordinator is missing
  and live VA access is refused outright (so a zero pressure count means no traffic, not no
  pressure); `not-required` means one process is the whole fleet and the per-instance
  outbound budget applies instead.

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

Coordination keys live under the same prefix but never carry lookup values: `cache-epoch` (invalidation marker), `cardinality:{namespace}:{window}` (write budget — the window counter must be a non-negative safe integer and its lifetime must be confirmed by the store, otherwise the write is refused and the counter removed), `budget:{bucket}` (consumer quota — one counter per rolling window, read together with its predecessor inside a single atomic decision), and `circuit:{service}` / `circuit-probe:{service}` (fleet cooldown and probe lease).

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
| `rateLimit` | Declared ingress model (which hop of the forwarding header is a client key), enforced shared ceiling, whether counters are per-instance or deployment-wide, and this instance's refusals split by the budget that refused them |
| `vaConsumerBudget` | Whether the fleet's upstream traffic is bounded by one shared window here (`fleet-shared` / `unenforced` / `not-required`), the budget's own bounds and gate, and this instance's admit/refuse pressure |
| `runtime` | Aggregate: which process-local capabilities are below full strength, and every capability's regime |

`sessionCrypto` tests the AES-256-GCM primitives with an ephemeral probe secret. `workflowSession` separately checks the configured primary `WORKFLOW_SESSION_SECRET` in production and makes health degraded if that readiness probe fails. This is a legacy runtime marker: it does not verify browser-local research-workflow state or the separate optional VA-account store, which uses `VA_ACCOUNT_SESSION_SECRET`.

### What this deployment gives up

Several controls depend on process-local state, and each behaves differently once more
than one instance serves traffic. Three **refuse** to run (live VA access, the VA reference
cache, the shared consumer budget) and two keep running **weaker** than written (rate
limiting, the VA circuit breaker — the latter was never surfaced anywhere before).

`components.runtime` is the single answer to that question:

| Field | Meaning |
|-------|---------|
| `distributed` | Whether this process is one of several |
| `reduced` | Ids below full strength here: `vaLiveIntegration`, `vaReferenceCache`, `vaConsumerBudget`, `rateLimit`, `circuitBreaker` |
| `capabilities` | Every id → its regime, including controls with no component of their own |
| `detail` | One sentence naming each reduced capability and its consequence |

In production **all five are reduced unless the consumer budget is actually in force**,
which is expected rather than a fault — so an empty `runtime.reduced` on a production
instance would itself be the surprising reading.

The consumer budget is the one capability in this report that can be at **full strength
while distributed**. Without the explicit `VA_SHARED_CONSUMER_BUDGET=true` opt-in, or
without a configured coordinator, it reports `unenforced` and is reduced — and live VA
access is refused outright in that state, so nothing is unbounded, nothing is simply not
sent. With both present it reports `fleet-shared` and stays full strength, because a
shared atomic window *is* the fleet-wide form of that budget rather than a weaker version
of it: that deployment reads `4 of 5` below full strength, with the budget deliberately
absent from `reduced`.

The per-control components (`vaReferenceCache`, `rateLimit`, `vaConsumerBudget`) carry the
same scopes plus their own data, and all are generated from the same capabilities report,
so they cannot disagree with it. `vaReferenceCache.scope: "disabled"` is why `hits`/`misses`
stay frozen at zero and `hitRate` is `null` there — the counters should never be read
without the scope. Adding a control that depends on process-local state requires
registering it; the suite fails if a module consults the runtime classification without a
scope.

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
      "detail": "per-client (key only as trustworthy as the forwarding header) limits apply per instance, so the aggregate is roughly the configured limit x instance count; the edge WAF remains the capacity layer",
      "identity": { "trustedIngress": false, "identity": "self-declared", "model": "unasserted", "header": "x-forwarded-for", "hop": "leftmost", "hopsFromRight": null, "fallback": "x-real-ip", "unidentified": { "policy": "ceiling", "keyTemplate": null, "detail": "no ingress model is declared, so a request with no usable identity cannot be told apart from an honest client whose headers never arrive; it stays bounded by the shared admission ceiling" }, "variable": "RATE_LIMIT_TRUSTED_INGRESS", "detail": "no ingress is asserted, so a per-client key is only as trustworthy as the header that carried it; the shared admission ceiling caps abuse that rotates keys either way" },
      "ceiling": { "max": 6000, "windowMs": 60000, "variable": "RATE_LIMIT_UNATTRIBUTED_MAX", "key": "unattributed:shared", "detail": "shared admission budget for unattributed and aggregate traffic" },
      "store": { "mode": "process-local", "distributed": false, "blockedBy": "no-store-provisioned", "detail": "counters are per instance; no deployment-wide quota is claimed" },
      "refusals": {
        "scope": "process-local",
        "windowMs": 900000,
        "maxEvents": 256,
        "received": 3,
        "unknownBudget": 0,
        "byBudget": { "ceiling": 3, "perClient": 0, "unidentified": 0 },
        "ceilingShare": 100,
        "evicted": 0,
        "since": "2026-10-15T12:41:08.000Z",
        "lastRefusedAt": "2026-10-15T12:52:47.000Z",
        "surfaces": [
          { "surface": "reference-read", "budget": "ceiling", "count": 2, "lastRefusedAt": "2026-10-15T12:52:47.000Z" },
          { "surface": "/api/health", "budget": "ceiling", "count": 1, "lastRefusedAt": "2026-10-15T12:48:19.000Z" }
        ],
        "surfacesOmitted": 0,
        "detail": "3 inbound admission refusal(s) in the last 15m: 3 by the shared ceiling (100% of them), 0 by a client's own bucket and 0 by the shared bucket for requests that presented no identity; a rising ceiling share is aggregate pressure — many different clients refused in one window — while per-client refusals are individual clients at their own limit; this window is per instance, forgets rows on cold start, and never sees a refusal the edge WAF answered itself"
      }
    },
    "vaConsumerBudget": {
      "status": "ok",
      "latencyMs": 0,
      "scope": "unenforced",
      "detail": "a distributed runtime requires the explicit VA_SHARED_CONSUMER_BUDGET=true opt-in before any upstream attempt is made, so no reservation is decided and the pressure counters stay structurally zero — live VA access itself is refused in this state, which is what the zero refusal count means here",
      "budget": { "maxRequests": 60, "windowMs": 60000, "optIn": false, "variable": "VA_SHARED_CONSUMER_BUDGET" },
      "store": { "mode": "no-coordinator", "distributed": true, "blockedBy": "no-shared-budget-opt-in" },
      "pressure": {
        "scope": "per-instance",
        "since": null,
        "admitted": 0,
        "refused": 0,
        "refusals": { "exhausted": 0, "superseded-window": 0, "predecessor-invalid": 0, "counter-lifetime-refused": 0, "unreadable-decision": 0, "store-unconfigured": 0, "store-unreachable": 0, "clock-unusable": 0 },
        "refusedInLastWindow": 0,
        "lastRefusalAt": null,
        "lastRefusalReason": null,
        "pacing": { "charges": 0, "chargedReservations": 0, "refusedCharges": 0, "lastChargedAt": null },
        "detail": "no reservation has been decided on this instance since it started"
      }
    },
    "runtime": {
      "status": "ok",
      "latencyMs": 0,
      "distributed": true,
      "reduced": ["vaLiveIntegration", "vaReferenceCache", "vaConsumerBudget", "rateLimit", "circuitBreaker"],
      "capabilities": {
        "vaLiveIntegration": "disabled",
        "vaReferenceCache": "disabled",
        "vaConsumerBudget": "unenforced",
        "rateLimit": "per-instance",
        "circuitBreaker": "per-instance"
      },
      "detail": "5 of 5 process-local capabilities are below full strength here: Live VA API access (refuses, disabled); VA reference cache (refuses, disabled); Shared VA consumer budget (refuses, unenforced); Application rate limiting (degrades, per-instance); VA API circuit breaker (degrades, per-instance)"
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

**Client identity.** The key is one hop of `X-Forwarded-For` (or `X-Real-IP`), and
*which* hop is decided by the deployment's declared ingress model
(`RATE_LIMIT_TRUSTED_INGRESS`). *Usable* means a syntactically valid IP literal, so
a hostname, path fragment, or fresh random token cannot mint a private bucket.

| `RATE_LIMIT_TRUSTED_INGRESS` | Model | Hop that becomes the key |
|---|---|---|
| unset, `false`, or anything unreadable | unasserted | leftmost `X-Forwarded-For` hop, then leftmost `X-Real-IP` hop |
| `true`, `set`, `overwrite`, `platform` | set — the ingress **sets** the header to the peer it observed | leftmost `X-Forwarded-For` hop, `X-Real-IP` as fallback |
| `append`, `append:N` (N = 1–8) | append — the ingress **appends** the peer it observed | hop **N from the right** of `X-Forwarded-For`; `X-Real-IP` is never read |

The model exists because "trusted ingress" is two different deployments with two
different correct hop rules. Reading the leftmost hop is right for an ingress that
overwrites the header, and wrong for one that appends: there the leftmost hop is
the value the *client* chose, so rotating it mints a fresh allowance per request —
the behaviour the SEC-02 runbook's A2 probe is designed to catch — and a client
that pre-seeds `X-Real-IP` can pick the bucket it is charged against, including
someone else's. Under the append model those hops are never read: the appended
peer is written *after* whatever the client sent, so hop N from the right is the
Nth appender's value however much padding precedes it.

**No identity at all.** Where a model is declared, a request that still carries no
usable identity shares **one class bucket per surface, at that surface's own
per-client limit** (`unidentified:<limiter>`, the same limiter object that enforces
the per-client limit, so the bound and the reported number cannot drift). Without
it, such a request was bounded only by the shared ceiling (6000 by default) while
the same request with a valid key was capped at 5–30, which made hiding the
cheapest strategy available to a caller and spent the aggregate budget honest
requests also pay into. With **no model declared** this does not apply: an
identity-less request cannot then be told apart from an honest client of a
deployment whose forwarding headers never arrive, so it stays bounded by the
ceiling alone rather than by one bucket that would cap that whole population at a
single client's allowance. The policy is reported as
`components.rateLimit.identity.unidentified` (`policy`, `keyTemplate`, `detail`),
and a refusal it causes is counted as the `unidentified` budget. The ceiling is
still charged for every attempt: this bounds the allowance an identity-less request
receives, it does not stop an attacker drawing the aggregate budget down, and the
edge WAF remains the capacity layer.

Declare the **exact** number of appenders in the path. With more declared than
present, a client that pads the header with an extra value becomes the hop that is
read; a request carrying fewer than N hops means it did not traverse every declared
appender, so it is unattributed: charged to the surface's shared identity-less
bucket above rather than to a hop the client sent, and to the ceiling as well. The
append model does not replace origin protection: a client that can reach the origin
directly (no appender at all) can still present its own single hop, which is what
runbook Group B tests.

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
silently become a global cap nobody could see. Set `RATE_LIMIT_TRUSTED_INGRESS`
only after checking what your ingress **does** with the forwarding headers, and set
it to the model that matches: `set` if it overwrites them, `append:N` if it appends
the observed peer. The variable is not a label — it selects the hop that enforcement
reads — so the claim can be checked rather than trusted:
`components.rateLimit.identity` reports `model`, `header`, `hop` and
`hopsFromRight`, and an operator audits it by sending one request and comparing the
reported hop with what the ingress actually wrote. Unreadable values (`1`, `yes`,
`append:0`, `append:99`, a misspelling) fall back to the unasserted model and are
reported as such, so a mistyped claim is visible on `/api/health` instead of reading
as a verified ingress.

**Scope.** Buckets are process-local and reset on cold start, so the effective
limit is roughly the configured limit × instance count. That is an intentional
trade: it makes the guard weaker than written, never wrong. This differs from the VA
reference cache, which refuses to use process-local state in production at all —
because a per-instance cache can serve a wrong answer, whereas a per-instance
limiter can only permit more traffic than intended. `/api/health` reports the
current regime as `components.rateLimit.scope` (`per-instance` or `single-process`),
the declared ingress model as `components.rateLimit.identity` (`model`, `header`,
`hop`, `hopsFromRight`, `fallback`), and the ceiling beside them as
`components.rateLimit.ceiling`. `scope.detail` names what the keys are worth in the
model's own terms — `per-validated-client` (set), `per-ingress-observed-client`
(append) or `per-client (key only as trustworthy as the forwarding header)`
(unasserted). A deployment-wide quota would need a shared counter
store; none is provisioned or wired today, and `components.rateLimit.store` says so
(`mode: "process-local"`, `blockedBy: "no-store-provisioned"`).

**Read a refusal.** Every limiter answers `429` with `Retry-After` and the same
body, so one response does not say which budget refused — deliberately, because a
single probe must not be able to tell the shared ceiling from its own bucket. The
reason is reported instead, as `components.rateLimit.refusals`: the last 15 minutes
of refusals this instance made, capped at 256 retained events and 12 reported
surfaces, with `received`, `byBudget` (`ceiling`, `perClient`, `unidentified`),
`ceilingShare` (0–100, or `null` when nothing was retained), the busiest `surfaces`
(the method-scoped POST bucket, the shared reference-read budget, or a policed
route path) and `detail`. Alert on `byBudget.ceiling` and `ceilingShare` rather
than on a total `429` count: a rising ceiling share is **aggregate** pressure —
many different clients refused inside one window — while `byBudget.perClient` is
individual clients at their own limit. `byBudget.unidentified` is a disagreement
between the declaration and reality: this deployment declared an ingress model
whose requests always carry an identity, and a request without one arrived — which
also means the ingress model was declared for the wrong edge. The window is per instance and forgets rows
on cold start, and a refusal the edge WAF answered itself never reaches the
application, so `received: 0` reads as "this instance refused nothing in this
window", not "nothing was refused". It stores the surface and the reason only,
never the client key, because this payload is public.

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
