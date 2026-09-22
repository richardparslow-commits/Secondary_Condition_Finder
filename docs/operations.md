# Operations Guide

Operational procedures for monitoring, debugging, and maintaining the Secondary Condition Finder.

## VA Reference Cache

The application uses a two-tier cache for VA public reference data (forms, disability ratings, service branches, accredited representatives).

### Cache Architecture

| Tier | Scope | TTL | Max Entries | State on Cold Start |
|------|-------|-----|-------------|---------------------|
| Process-local (LRU) | Single serverless instance | 5 minutes | 32 | Reset |
| Shared (KV/Redis) | Cross-instance | 5 minutes | Unlimited (KV) | Persistent |

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

Counters are **process-local** and reset on cold start. For longitudinal monitoring, export these via OTEL metrics to your observability platform.

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
curl -X POST "https://secondary-condition-finder.vercel.app/api/admin/cache-clear?prefix=va:forms:" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response:

```json
{
  "ok": true,
  "cleared": 5,
  "prefix": null,
  "message": "Cleared all 5 cache entries."
}
```

**Authentication**: Bearer token using `CRON_SECRET` or `REGULATORY_SYNC_SECRET` (same credentials as the regulatory preflight endpoint).

**Important**: This only clears the **process-local** cache on the specific instance that handles the request. In a serverless environment with multiple concurrent instances, other instances retain their cache until their own TTL expires. For a full flush, you would need to call the endpoint multiple times (one per instance) or rely on the natural TTL expiry.

#### Via Shared Cache (if configured)

When the shared KV cache is configured, clearing the process-local cache on one instance also triggers a shared-cache rehydration on the next request. To fully clear the shared cache, you would need to flush the KV store directly (e.g., via the Upstash console or Vercel KV dashboard).

### Cache Key Conventions

Cache keys follow the pattern `{source}:{query-hash}`:

| Source | Example Keys |
|--------|-------------|
| `va-forms` | `va-forms:disability-compensation` |
| `benefits-reference-data` | `benefits-reference-data:compensation` |
| `service-branches` | `service-branches:all` |
| `accredited-representatives` | `accredited-representatives:zip-90210-radius-50` |

Use the `prefix` query parameter to clear all entries for a specific source:

```bash
curl -X POST "https://secondary-condition-finder.vercel.app/api/admin/cache-clear?prefix=va-forms:" \
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
| `vaReferenceCache` | Process-local cache hit/miss counters |

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
    "vaReferenceCache": { "hits": 42, "misses": 8, "hitRate": 84 }
  },
  "latencyMs": 5,
  "timestamp": "2026-09-14T00:00:00.000Z"
}
```

## Rate Limiting

Application-level rate limiting is enforced in the proxy middleware (`src/proxy.ts`) as defense-in-depth behind Vercel's edge WAF.

| Route | Window | Max Requests | Key |
|-------|--------|-------------|-----|
| Server Action POSTs | 60s | 30 | IP (X-Forwarded-For) |
| `/api/regulatory/preflight` | 60s | 5 | IP |
| `/api/admin/cache-clear` | 60s | 5 | IP |
| `/api/health` | 60s | 30 | IP |

Rate-limit state is process-local and resets on cold start (intentional for serverless).

## Circuit Breaker

VA API calls are protected by a per-source circuit breaker (`src/lib/va/circuit-breaker.ts`):

- **Closed** (normal): requests pass through
- **Open** (failure threshold exceeded): requests fail fast for 60 seconds
- **Half-open**: one probe request allowed to test recovery

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
