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
- Single-flight per key: one instance claims a 45 s `SET … NX PX` lease for a cold/expired key, and other instances wait up to 600 ms for that value to be published instead of issuing their own upstream request. The lease fails open (an unreachable coordinator just means the normal path) and expires on its own if the holder dies
- Degraded store: every KV exchange is capped by the 750 ms deadline, so a store that is slow (rather than unreachable) costs a fail-closed render at most three deadlines (~2.25 s: cache read, lease claim, circuit gate) and never waits for the store's real latency; nothing is cached, no quota is reserved, and no upstream request is made while the coordinator is unusable

### Monitoring Cache Effectiveness

The health endpoint exposes cache-hit/miss counters:

```
GET /api/health
```

Response includes:

```json
{
  "components": {
    "vaReferenceCache": {
      "hits": 42,
      "misses": 8,
      "hitRate": 84
    }
  }
}
```

- **hits**: cache lookups that returned a valid entry
- **misses**: cache lookups that returned `null` (expired, not found, or process-local disabled)
- **hitRate**: percentage (0–100), `null` if no requests yet

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

Coordination keys live under the same prefix but never carry lookup values: `cache-epoch` (invalidation marker), `cardinality:{namespace}:{window}` (write budget), `budget:{window}` (consumer quota), and `circuit:{service}` / `circuit-probe:{service}` (fleet cooldown and probe lease).

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
| `sessionCrypto` | Workflow session seal/open round-trip succeeds |
| `vaConfig` | VA API configuration is valid (enabled/disabled, environment) |
| `circuitBreaker` | VA API circuit breaker state (closed/open/half-open per source) |
| `vaReferenceCache` | Cache `scope` (`process-local` or `disabled`) plus hit/miss counters |
| `rateLimit` | Whether application-level rate limiting is per-instance or deployment-wide |
| `runtime` | Aggregate: which process-local capabilities are below full strength, and every capability's regime |

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

**HTTP 200** = healthy (catalog + session crypto OK)
**HTTP 503** = degraded (one or more critical components failing)

### Example Response

```json
{
  "status": "healthy",
  "components": {
    "catalog": { "status": "ok", "latencyMs": 2, "count": 186 },
    "sessionCrypto": { "status": "ok", "latencyMs": 1 },
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
      "detail": "per-IP limits apply per instance, so the aggregate is roughly the configured limit x instance count; the edge WAF remains the capacity layer"
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

## Rate Limiting

Application-level rate limiting is enforced in the proxy middleware (`src/proxy.ts`) as defense-in-depth behind Vercel's edge WAF.

| Route | Window | Max Requests | Key |
|-------|--------|-------------|-----|
| Server Action POSTs (and every other POST) | 60s | 30 | IP (`X-Forwarded-For`, then `X-Real-IP`) |
| `/api/regulatory/preflight` | 60s | 5 | IP |
| `/api/admin/cache-clear` | 60s | 5 | IP |
| `/api/health` | 60s | 30 | IP |

**Client identity.** The key is the first hop of `X-Forwarded-For`, falling back to
`X-Real-IP`. A request carrying neither is **not charged to any bucket** and passes
through unthrottled. That is deliberate: a single fallback bucket shared by every
such request is not a per-client limit but a *global* cap, so one client's traffic
would reject everyone else's — and no response, log line, or metric would say so.
Capacity remains the edge WAF's job, which is why an absent limiter is preferred
over a mislabelled one. If a deployment's proxy does set these headers (Vercel and
Azure Front Door both do), the limits above apply per client as written.

**Scope.** Buckets are process-local and reset on cold start, so the effective
limit is roughly the configured limit × instance count. That is an intentional
trade: it makes the guard weaker than written, never wrong. This differs from the VA
reference cache, which refuses to use process-local state in production at all —
because a per-instance cache can serve a wrong answer, whereas a per-instance
limiter can only permit more traffic than intended. `/api/health` reports the
current regime as `components.rateLimit.scope` (`per-instance` or `single-process`).

## Circuit Breaker

VA API calls are protected by a per-source circuit breaker (`src/lib/va/circuit-breaker.ts`):

- **Closed** (normal): requests pass through
- **Open** (failure threshold exceeded): requests fail fast for 60 seconds
- **Half-open**: exactly one probe request allowed to test recovery

An upstream `429` is never retried and opens the breaker immediately for the clamped `Retry-After` window (1–60 s; 30 s when the header is unusable).

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
