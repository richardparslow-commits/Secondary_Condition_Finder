# VA public-reference runtime configuration

This document defines the runtime configuration contract for the app's low-sensitivity VA Forms and Benefits Reference Data integrations. These integrations provide administrative reference information only. They do not participate in medical evidence scoring, secondary-condition recommendation logic, or presumptive matching.

## Safe default

VA API access is disabled by default. With no VA runtime variables configured, the app serves local fallback references and makes no VA public-reference request.

The current request budget and successful-response cache are process-local controls. They are permitted only in single-process, non-production execution. Production and known distributed/serverless runtimes fail closed before a credentialed VA request and do not use the process-local reference cache. A shared rate-limit/cache coordinator must be implemented and objectively validated before live VA traffic is enabled from the horizontally scaled production runtime.

## Runtime mode

Issue #287 requires a deliberate runtime mode rather than an implicit combination of flags. `resolveVaReferenceMode()` in `src/lib/va/runtime-state.ts` is the single decision point and resolves exactly one of three modes:

| Mode | Meaning | Requirements |
|---|---|---|
| `disabled` | No outbound VA request is made; local fallback references are served. **Fail-closed default.** | None — this is what an unconfigured or ambiguous environment resolves to. |
| `sandbox` | Requests target the VA sandbox endpoints. | `VA_API_ENABLED=true` (or the Phase 2 compatible `VA_SANDBOX_ENABLED=true`) and `VA_API_ENV` unset or `sandbox`. |
| `production` | Requests target the VA production endpoints and results may be labelled production-sourced. | `VA_API_ENV=production` **and** `VA_API_ENABLED=true` **and** `VA_PRODUCTION_ACCESS_GRANTED=true` **and** both service-specific production credentials present. |

Every resolution carries a non-sensitive `modeReason` explaining the outcome for operator diagnostics. Reasons never echo credential values.

The resolver fails closed to `disabled` — never silently downgrades to `sandbox` — on any of:

- an unrecognised or falsy enable value (`VA_API_ENABLED=maybe`, `=0`, `=no`);
- `VA_API_ENV=production` without `VA_PRODUCTION_ACCESS_GRANTED=true`;
- `VA_PRODUCTION_ACCESS_GRANTED=true` without `VA_API_ENABLED=true` (acknowledgement is not enablement);
- an acknowledged production selection missing any service-specific production credential.

When production fails closed, the loaded configuration deliberately carries **sandbox** endpoints and **no** production keys, so a caller that neglected to check `enabled` still cannot reach production. The `environment` field continues to report the *requested* environment (`production`) so a refused production selection is visible rather than being mistaken for a sandbox configuration.

## `VA_PRODUCTION_ACCESS_GRANTED` (issue #287 gate rule)

```text
VA_PRODUCTION_ACCESS_GRANTED=true
```

An explicit operator acknowledgement that **VA has granted production API access**. It is separate from `VA_API_ENABLED`, which expresses only the intent to make requests. Requiring both means no single mis-set variable can repoint the public reference surfaces at production endpoints or cause data to be labelled production-sourced.

Per the #287 gate rule, set this only after VA grants production access **and** live production connectivity has been objectively verified. It is intentionally unset in every current environment.

## Environment selection

`VA_API_ENV` selects the intended upstream environment:

- `sandbox` (default)
- `production`

`VA_API_ENABLED=true` is the explicit environment-neutral enable flag. Production configuration still requires this flag, but the current production/distributed runtime boundary will refuse live adapter traffic until shared state coordination exists. This prevents merely setting `VA_API_ENV=production` from activating production traffic and prevents process-local safeguards from being misrepresented as deployment-wide controls.

For backward compatibility with the Phase 2 sandbox gate, `VA_SANDBOX_ENABLED=true` still enables sandbox mode when `VA_API_ENABLED` is not set. The dedicated #189 sandbox smoke-test workflow calls the sandbox endpoints directly from one GitHub Actions job and remains separate from the application runtime boundary.

## Service-specific credentials

Keep every API credential server-only. Never use `NEXT_PUBLIC_*` for VA credentials.

Sandbox:

- `VA_FORMS_SANDBOX_API_KEY`
- `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`
- `VA_ACCREDITED_REP_SANDBOX_API_KEY` (Phase 3.1 locator; optional)

Production:

- `VA_FORMS_PRODUCTION_API_KEY`
- `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`
- `VA_ACCREDITED_REP_PRODUCTION_API_KEY` (Phase 3.1 locator; optional)

The Forms adapter sends only the Forms key. Benefits Reference Data requests send only the Benefits Reference Data key. The accredited-representative locator sends only its own key and is additionally gated by `VA_ACCREDITED_REP_ENABLED=true`; when that flag is `false` no directory request is made even if `VA_API_ENABLED=true`.

## Optional endpoint overrides

The adapter has VA defaults for each environment and accepts overrides only on the exact matching VA API origin:

Sandbox:

- `VA_FORMS_SANDBOX_BASE_URL`
- `VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL`
- `VA_ACCREDITED_REP_SANDBOX_BASE_URL` (Phase 3.1 locator; optional)

Production:

- `VA_FORMS_PRODUCTION_BASE_URL`
- `VA_BENEFITS_REFERENCE_PRODUCTION_BASE_URL`
- `VA_ACCREDITED_REP_PRODUCTION_BASE_URL` (Phase 3.1 locator; optional)

`VA_API_TIMEOUT_MS` controls the per-attempt timeout. `VA_SANDBOX_TIMEOUT_MS` remains a backward-compatible sandbox-era fallback.

## Activation examples

Single-process sandbox compatibility mode:

```text
VA_SANDBOX_ENABLED=true
VA_FORMS_SANDBOX_API_KEY=<server-only value>
VA_BENEFITS_REFERENCE_SANDBOX_API_KEY=<server-only value>
```

Single-process environment-neutral sandbox mode:

```text
VA_API_ENV=sandbox
VA_API_ENABLED=true
VA_FORMS_SANDBOX_API_KEY=<server-only value>
VA_BENEFITS_REFERENCE_SANDBOX_API_KEY=<server-only value>
```

Production credentials may be staged only after VA production access is granted, but the current application runtime intentionally remains local-fallback-only in production/distributed execution until a shared state coordinator is implemented and verified:

```text
VA_API_ENV=production
VA_API_ENABLED=true
VA_PRODUCTION_ACCESS_GRANTED=true
VA_FORMS_PRODUCTION_API_KEY=<server-only value>
VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY=<server-only value>
```

Without `VA_PRODUCTION_ACCESS_GRANTED=true` this exact configuration resolves to `disabled` and serves sandbox endpoints with no production key loaded.


Those variables alone do **not** authorize a production request under the current architecture. Issue #287 remains the production-transition gate.

## Reference caching and status

Forms search, disability terminology, service-branch, and accredited-representative reference loaders share a bounded five-minute cache. There are two tiers (all best-effort, non-authoritative):

- **Tier 1 — process-local LRU-32 / 5-min** (`src/lib/va/reference-cache.ts`): always checked first; `write` on every live fetch; disabled in production/distributed so a warm instance cannot be mistaken for a deployment-wide cache (unless tier 2 is configured, see below).
- **Tier 2 — optional shared KV / edge cache** (`src/lib/va/reference-shared-cache.ts`): checked second on a `process-local miss`, and populated (best-effort `SET … EX 300`) on every live fetch. Uses a Redis-compatible **REST** API (Upstash Redis REST / Vercel KV) so it works from Node and edge/serverless runtimes without a TCP connection. Disabled when not configured — then behavior is unchanged from the process-local-only baseline.

When the shared KV is **configured**, the `requestVaJson` distributed-runtime gate in `src/lib/va/sandbox.ts` no longer blocks live VA fetches in production/Vercel — the shared cache provides the cross-instance coordination that the production fail-closed required. The per-process outbound budget (`60/min`) and circuit breaker (`5 → open 60s → half-open`) still apply per-instance. Without a shared KV, production/distributed still fails closed to local fallback, and the shared cache is simply not consulted.

The shared KV is wired into every reference loader (`forms-finder`, `form-reference`, `disability-reference`, `service-branches`, `accredited-representatives`) as `process-local hit` → `shared hit (rehydrate process-local, return)` → `live fetch` → `write both`. Shared reads/writes are best-effort with a `750ms` timeout, `256 KiB` value guard, and never throw — a KV hiccup just degrades to the next tier or to the local fallback.

The shared tier is bounded and revocable by policy, not just by TTL:

- **Key policy** — only the allowlisted namespaces `forms:`, `accredited-rep:`, `disabilities:`, and `service-branches:` are read or written (lowercase `[a-z0-9:_-]`, ≤256 chars); user-supplied segments are SHA-256-hashed, never raw.
- **Finite cardinality** — writes are admitted against a per-namespace window budget (`VA_SHARED_KEY_WRITE_WINDOW_SECONDS=300`, `VA_SHARED_KEY_WRITE_MAX_PER_WINDOW=240`), bounding residency at ≤480 keys per namespace and ≤1,920 across the allowlist. An exhausted budget or an unreachable counter skips the write (colder cache, never incorrect).
- **Global invalidation** — entries are stored as `{envelopeVersion:2, epoch, value}` and a read is a single atomic `MGET [cache-epoch, value]` that accepts the value only under the epoch it observes. `POST /api/admin/cache-clear` (Bearer `CRON_SECRET` / `REGULATORY_SYNC_SECRET`) advances the epoch, so every instance drops previously cached shared entries immediately without a delete sweep; an unreadable epoch marker fails closed (reads miss, writes are skipped).
- **Single-flight per key** — on a cold or expired key one instance claims a `SET … NX PX` lease (120 s, covering the longest legal logical fetch) and contenders wait a bounded 600 ms for the published value before falling back to their own fetch, so a fleet-wide TTL expiry or invalidation does not multiply upstream requests; the lease fails open (an unreachable coordinator simply means the normal fetch path, gated by the consumer budget).
- **Read-side trust guard** — a shared hit is served only if it still matches this deployment's provenance (`source`/`environment` for the configured mode), carries bounded label metadata, and holds only credential-free HTTPS links; otherwise it counts as a miss and the loader refetches. VA-provided `url`/`website` values are additionally approved at the payload boundary (`trusted-link.ts`), so `javascript:`/`data:`/`http:`/credential-bearing links never reach a rendered `<a href>`.

Configuration — configure **one** URL+token pair (all aliases are equivalent; use whichever your provider sets):

```text
VA_REFERENCE_SHARED_CACHE_URL=https://<id>.upstash.io
VA_REFERENCE_SHARED_CACHE_TOKEN=<server-only REST token>
VA_REFERENCE_SHARED_CACHE_PREFIX=va:ref:   # optional, default "va:ref:"
# Aliases: VA_REFERENCE_KV_REST_URL / VA_REFERENCE_KV_REST_TOKEN
#          UPSTASH_REDIS_REST_URL   / UPSTASH_REDIS_REST_TOKEN  (Vercel Upstash integration)
#          KV_REST_API_URL          / KV_REST_API_TOKEN         (legacy Vercel KV)
```

The token must stay **server-only** (never `NEXT_PUBLIC_*`). `loadVaSharedCacheConfig()` validates the URL is `https:` and the key prefix defaults to `va:ref:`; `isVaSharedCacheConfigured()` is the gate used by both the loader fallback and the sandbox's production bypass. No adapter, schema, or page contract changed — only where a hit can be served from.

User-facing reference pages expose only non-sensitive status: source label, environment, last successful retrieval time, and cache hit/miss state. Credentials, response payloads, and user workflow selections are never included in this status surface.

Local fallback responses are not retained as successful VA cache entries in either tier. This allows a later request to recover immediately when upstream access becomes available.

## Product boundaries

- Secondary recommendations are computed before and independently from VA terminology lookup.
- Per-result VA reference blocks are administrative annotations only.
- The service-branch field is optional encrypted workflow context; `matchPresumptives()` does not read it.
- No fuzzy VA terminology matching is used. Matches are normalized exact names or explicitly curated aliases.
- Issue #189 remains the separate credentialed sandbox connectivity gate and must not be closed without its required live evidence.
- Issue #287 remains the production-access gate and must not be closed until production access plus shared-state coordination are objectively verified.
