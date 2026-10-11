# VA public-reference runtime configuration

This contract covers low-sensitivity VA Forms and Benefits Reference Data only. These administrative references do not participate in medical evidence scoring, secondary recommendations, or presumptive matching. Veteran-account OAuth and the optional accredited-representative locator have separate approval boundaries.

## Safe default and mode resolution

Access is **disabled by default**. Unconfigured, ambiguous, or incomplete configurations serve explicitly labelled local fallback references, not VA data.

[The resolver](../src/lib/va/runtime-state.ts) is the single tri-state decision point:

| Mode | Requirements |
|---|---|
| `disabled` | Default, explicit disable, invalid environment/enable value, or incomplete production configuration. No upstream request. |
| `sandbox` | `VA_API_ENABLED=true` and `VA_API_ENV` unset/blank or `sandbox`. Only when `VA_API_ENABLED` is entirely absent can legacy `VA_SANDBOX_ENABLED=true` enable sandbox. |
| `production` | `VA_API_ENV=production`, `VA_API_ENABLED=true`, `VA_PRODUCTION_ACCESS_GRANTED=true`, and both service-specific production keys. |

The runtime accepts trimmed, case-insensitive `true`/`1`/`yes` and `false`/`0`/`no` flags. An explicitly blank or invalid `VA_API_ENABLED` never falls back to the legacy flag. Unknown nonblank `VA_API_ENV` values fail closed rather than silently choosing sandbox. Every resolution carries a non-sensitive reason that never echoes raw configuration or credentials.

A refused production selection still reports the requested `environment=production` for diagnostics, but loads sandbox endpoints and no production keys. It never silently downgrades into enabled sandbox traffic.

## Production grant is not connectivity evidence

`VA_PRODUCTION_ACCESS_GRANTED=true` acknowledges an actual VA grant for the requested services; it does not prove connectivity. Keep the application's `VA_API_ENABLED=false` until a controlled check succeeds. Issue #287 remains open through grant, controlled check, deliberate activation, exact-build deployment verification and live source-status checks. A fallback page returning HTTP 200 is not production API evidence.

## Service-specific, server-only configuration

Never use `NEXT_PUBLIC_*` credentials or paste keys into issues, chat, command arguments, logs, or committed files.

| Service | Sandbox key | Production key |
|---|---|---|
| Forms | `VA_FORMS_SANDBOX_API_KEY` | `VA_FORMS_PRODUCTION_API_KEY` |
| Benefits Reference Data | `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` | `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY` |
| Optional locator | `VA_ACCREDITED_REP_SANDBOX_API_KEY` | `VA_ACCREDITED_REP_PRODUCTION_API_KEY` |

Each service sends only its own key. The optional locator additionally requires `VA_ACCREDITED_REP_ENABLED=true` and its own service approval; this runbook does not activate or verify it.

Optional base URL overrides follow `VA_FORMS_{SANDBOX,PRODUCTION}_BASE_URL`, `VA_BENEFITS_REFERENCE_{SANDBOX,PRODUCTION}_BASE_URL`, and `VA_ACCREDITED_REP_{SANDBOX,PRODUCTION}_BASE_URL`. The adapter accepts credential-free HTTPS only on the matching exact VA origin (`sandbox-api.va.gov` or `api.va.gov`), refuses redirects, validates response schemas and approved HTTPS links, and caps response bodies at 2 MiB. `VA_API_TIMEOUT_MS` defaults to 4 seconds and is capped at 30 seconds; legacy `VA_SANDBOX_TIMEOUT_MS` remains a fallback. Existing bounded retry/circuit policies remain in effect in the app.

## Shared state is a separate activation prerequisite

Production and known distributed/serverless runtimes refuse process-local reference cache reads/writes. A shared cache alone does **not** authorize live requests. Distributed live requests require:

1. `VA_SHARED_CONSUMER_BUDGET=true`;
2. a configured HTTPS Redis-compatible REST URL and server-only token;
3. a reachable shared circuit coordinator and successful consumer-budget reservation before **each** upstream attempt, including retries.

A missing opt-in, unreachable coordinator, invalid reply or exhausted budget fails closed to local fallback. The process-local circuit still protects each instance; shared markers enforce fleet cooldown and probe admission. The synchronous runtime capability report remains a conservative report of process-local support, not a liveness test or proof that a configured shared coordinator works. Verify the actual deployed request path, not just that report or configuration presence.

Configure one URL/token pair:

```text
VA_REFERENCE_SHARED_CACHE_URL=https://<operator-provisioned-rest-endpoint>
VA_REFERENCE_SHARED_CACHE_TOKEN=<server-only value>
VA_REFERENCE_SHARED_CACHE_PREFIX=va:ref:
VA_SHARED_CONSUMER_BUDGET=true
```

Aliases are `VA_REFERENCE_KV_REST_URL` / `VA_REFERENCE_KV_REST_TOKEN`, `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Use one complete matching pair, not a mixture of providers. All instances for a VA consumer must use the same store/prefix for its shared budget and circuit. Separate unrelated consumers to avoid unintended sharing. Before activation, verify atomic counter/circuit semantics and failure behavior on the actual deployment; configuration is not verification.

All five loaders use [shared cache access](../src/lib/va/reference-cache-access.ts): allowed process-local hit → shared hit → coordinated live fetch → best-effort shared write. The single-process cache is a 32-entry LRU with a five-minute TTL. It stays disabled in distributed execution even when shared KV is configured. The shared tier has five-minute TTL, a 750 ms whole-exchange deadline, size guards, allowlisted namespaces and per-namespace write admission. Cache keys hash user input; shared envelope epochs support fleet invalidation through authenticated `POST /api/admin/cache-clear`. Single-flight leases reduce duplicate cold fetches; consumer budget admission still gates every outbound attempt if a lease fails open.

Cache trust guards require matching source/environment and safe links. Fallback results are never retained as successful VA data. Reference pages show source label, environment, retrieval time and hit/miss status only, never credentials or raw upstream payloads.

## Controlled production connectivity check (issue #287)

This is the missing transition step, not an application bypass. It keeps public application access disabled and makes at most **three sequential requests, once each, with no retry**:

- Forms: fixed public form query `21-526EZ`;
- Benefits Reference Data: disabilities;
- Benefits Reference Data: service branches.

The [operator CLI](../scripts/verify-va-production-reference.mts) uses the application's [exact payload schemas](../src/lib/va/public-reference-schemas.mjs), fixed production endpoints, service-specific keys, redirect refusal, a 4-second whole-exchange timeout and 2 MiB per-response cap. It refuses before network access unless the grant is acknowledged, both production keys exist, application access remains off, and the confirmation argument is explicit. It stops on the first failure, including empty/invalid payloads, 401, 429, timeout or oversized body. It never uses sandbox keys, changes app configuration, writes caches or closes issues.

### Operator procedure

1. Record the real VA grant for **both** services and its approved scope. Do not invent approval evidence. #189 is already complete with credentialed sandbox evidence recorded in [gate status](external-manual-gates-status.md).
2. Configure the GitHub environment `va-production-reference` with required human reviewers and main-only deployment protection **before** adding credentials. The workflow names this environment but does not create or configure its protection. Set environment variable `VA_PRODUCTION_ACCESS_GRANTED=true` only after the grant. Add environment secrets `VA_FORMS_PRODUCTION_API_KEY` and `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY` through GitHub's secure settings. Keep application VA access disabled.
3. From merged `main`, manually dispatch [VA Production Reference Check](../.github/workflows/va-production-reference-check.yml) with `confirm_va_grant=true`. A false/unconfirmed or non-main dispatch skips the job: **skipped is not a pass**. Missing grant/credentials refuses and fails. The workflow records exact checkout SHA, run URL, timestamp, generated request IDs, HTTP status, validation outcome and counts only. No raw payload or key artifact is uploaded, and the workflow has no issue-write permission.
4. Alternatively, in a controlled operator environment with server-only production keys already configured and application flags absent or false, run on Node 22.18+:

   ```bash
   node scripts/verify-va-production-reference.mts --confirm-va-production-access
   ```

   Do not put secrets on the command line. The command prints sanitized JSON and returns nonzero for refusal/failure. Local test fixtures are code evidence only, never live production evidence.
5. Review and attach the successful sanitized workflow evidence to #287. This establishes controlled service connectivity **only**. It does not establish the deployed application's budget/circuit/cache behavior or approve user-facing activation.
6. With explicit operator approval, configure the application's server-only production keys and shared coordinator, then deliberately select `VA_API_ENV=production`, `VA_PRODUCTION_ACCESS_GRANTED=true`, `VA_API_ENABLED=true`, and `VA_SHARED_CONSUMER_BUDGET=true`. Never activate the unrelated account or locator services by implication.
7. Run full CI and Production Runtime Readiness on the exact deployed SHA. Check `/va-forms/finder` with public query `21-526EZ`, `/va-reference`, and `/va-reference/service-branches` in a real browser. Require actual `va-production-api` provenance, expected production labels, valid data, retrieval timestamp and shared hit behavior across instances. Verify disabled/missing-coordinator/outage/429 behavior and rollback; a local fallback 200 does not pass this step. Do not claim distributed correctness based on the one-process CLI.
8. Close #287 only after the grant, controlled evidence, deployed-runtime verification, full CI and deployment readiness all have objective recorded evidence. No workflow here closes it automatically.

### Rollback

Immediately set application `VA_API_ENABLED=false` (do not rely on the legacy sandbox flag), apply through the normal deployment path, invalidate the shared reference cache through the authenticated admin endpoint, and confirm the public surfaces show local fallback rather than production data. Remove the grant acknowledgement if approval is withdrawn and rotate/revoke compromised credentials through the owning service. Retain sanitized failure evidence; do not copy upstream error bodies or credential-bearing details.

## Product boundaries

- Secondary recommendations are computed independently of administrative VA terminology.
- Service-branch context does not change presumptive matching.
- Exact normalized names or curated aliases are used, not fuzzy terminology matching.
- #189 sandbox evidence, #195 human accessibility evidence and #287 production-transition evidence are distinct gates. Passing one cannot close another.
