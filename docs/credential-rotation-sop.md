# Credential Rotation SOP — VA API Keys

## Scope

Rotation procedure for VA public-reference service credentials used by the Secondary Condition Finder:

- `VA_FORMS_SANDBOX_API_KEY`, `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY`
- `VA_FORMS_PRODUCTION_API_KEY`, `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY`

And related environment settings described in `docs/va-api-runtime-configuration.md` and `docs/deployment-readiness.md`.

Credentials are **provider-managed, server-only** values stored in Vercel's Production environment. They are never exposed through `NEXT_PUBLIC_*` variables, logs, or client payloads. See `docs/security-operations.md`.

---

## When to rotate

| Trigger | Action |
|---|---|
| **Quarterly** (routine hygiene) | Rotate sandbox keys; production keys when enabled (issue #287). |
| Suspected exposure (log leak, repo history, third-party compromise) | Rotate immediately; treat as incident per `security-operations.md`. |
| VA or provider mandates a new key format/endpoint | Rotate as part of that change; keep rollback window open. |
| Operator/staff turnover with known access | Rotate affected environment(s). |

Rotation is intentionally **small-blast-radius**: Forms and Benefits Reference Data use separate keys — a Forms rotation must not touch the Benefits Reference Data key.

---

## Preconditions

1. You have Vercel project access to `secondary-condition-finder` (Production environment).
2. You have the **new** credential from the issuing provider (VA developer portal) — do not reuse or derive the old value.
3. You can create a new Vercel deployment and observe `Production Runtime Readiness`.
4. No unrelated production change is mid-flight (avoid mixing rotation with a feature deploy).

---

## Procedure (Vercel)

### 1. Stage the new secret

1. In Vercel → Project → **Settings → Environment Variables**, select the **Production** environment.
2. Add or update the single key being rotated (e.g., `VA_FORMS_PRODUCTION_API_KEY`) with the new value. **Do not delete the old key until the new deployment is verified** if your provider supports dual-validity; Vercel will use the newly saved value for the next deployment only.
3. If the base URL is also changing, update `VA_FORMS_PRODUCTION_BASE_URL` / `VA_BENEFITS_REFERENCE_PRODUCTION_BASE_URL` in the same step (must remain `https://api.va.gov/...`; see `src/lib/va/sandbox.ts` trusted-origin check). Production base-URL overrides are additionally gated on `VA_PRODUCTION_ACCESS_GRANTED=true` in the mode resolver (`resolveVaReferenceMode`), so a partial activation cannot happen.

### 2. Create a new production deployment

Vercel environment-variable changes only apply to **new deployments**:

1. Trigger a deployment of the current `main` commit (empty commit or re-deploy the same SHA from Vercel).
2. Wait for the build to reach **READY** and for the canonical alias `https://secondary-condition-finder.vercel.app` to converge to the new deployment.

### 3. Verify

1. Confirm CI succeeded on the commit being deployed.
2. Confirm **Production Runtime Readiness** succeeds (`.github/workflows/production-runtime-readiness.yml`) — it checks exact-commit lineage, deployment status, alias convergence, the production route matrix (`/`, `/about`, `/va-forms`, `/va-reference`, `/runtime-readiness`), and `data-runtime-readiness="ready"`.
3. Smoke the affected VA surface:
   - Sandbox rotation → `VA_API_ENV=sandbox` + the rotated sandbox key → visit `/va-forms` and `/va-reference` → expect source label to show the sandbox source (or local fallback with a clear notice if the key is intentionally disabled).
   - Production rotation → `VA_API_ENV=production` + `VA_API_ENABLED=true` + the rotated production key → visit the same routes → expect live production source label; confirm no credential appears in the response and `/api/health` stays `healthy`/`degraded` (never exposes the key).

### 4. Observe

- Watch Vercel logs / OpenTelemetry `va-api` structured logs (`va request success / http error / timeout / circuit-open`) for the rotated service.
- Confirm the per-service **circuit breaker** (`src/lib/va/circuit-breaker.ts`) is `closed` (visible at `/api/health` → `circuitBreaker.snapshot`). A freshly rotated valid key should not trip the breaker; if it does, check the key value/origin.

### 5. Clean up

- Remove any temporary dual-validity provider-side old key once the new deployment is confirmed.
- Rotate any local `.env` copies or developer-held copies out of band — do not leave the old production value in a shell profile.

---

## Rollback

If the new credential is bad (5xx/invalid-payload/timeout spike, circuit opens):

1. Restore the **previous** known-good value in Vercel Production.
2. Re-deploy the same commit again.
3. Re-run the verification in §3. The breaker opens for the clamped `Retry-After` window when the upstream returns 429, and for the stale-failure window after repeated 5xx/timeouts (`open 60 s` by default at `FAILURE_THRESHOLD=5`, see `src/lib/va/circuit-breaker.ts`); after the window it half-opens and admits a single probe — allow that probe to resolve before concluding the rollback succeeded.
4. Record the incident: commit SHA, deployment ID, timestamps, status codes, sanitized error category — no secret values in the record (`docs/security-operations.md`).

---

## Evidence to retain

- Commit SHA and Vercel deployment ID before/after rotation.
- Production Runtime Readiness run ID + result.
- `/api/health` snapshot (not the secret).
- Sanitized `va-api` log excerpt (requestId, service, outcome, status — no `apikey` header).

Do **not** record the secret, its length, hash, or derived key material.

---

## Links

- Runtime contract: `docs/va-api-runtime-configuration.md`
- Production runbook: `docs/deployment-readiness.md`
- Security operations: `docs/security-operations.md`
- Health endpoint: `src/app/api/health/route.ts`
- Rotation-affected code: `src/lib/va/sandbox.ts`, `src/lib/va/circuit-breaker.ts`

---

## Checklist

- [ ] New credential obtained from provider (not derived from old)
- [ ] Single service rotated (Forms vs Benefits Reference Data isolated)
- [ ] Vercel Production env var updated
- [ ] New deployment created and alias converged
- [ ] Production Runtime Readiness: success
- [ ] VA surface smoke: source label correct, no credential leakage
- [ ] `/api/health` healthy; circuit `closed`
- [ ] Old provider-side key revoked (if dual-validity was used)
- [ ] Sanitized evidence recorded (SHA, deployment, run ID, health)
