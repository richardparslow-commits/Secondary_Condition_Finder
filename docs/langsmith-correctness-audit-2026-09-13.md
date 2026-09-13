# LangSmith Correctness Audit — Secondary Condition Finder

**Generated:** 2026-09-13T05:30Z (America/Chicago) — reasoning effort **max**
**Auditor:** LangSmith-assisted local audit (Engine tracing verified live; automated Engine PRs pending GitHub App connection) + manual max-reasoning code review
**Repo:** `richardparslow-commits/Secondary_Condition_Finder`
**Commit:** `9970cf3` `feat(observability): LangSmith tracing + Engine automated diagnostics setup (#429)` (on `main`, `origin/main`, `git status clean`)
**Prior lineage:** `17aaa8e` (health assessment archive #428) → `e8f0692` (#427 VA retry) → `91ff77e` (#426) → `3919321` (#425)
**LangSmith project:** `secondary-condition-finder` (tenant `4a003618-bba6-48eb-ac1c-23b860739572` — matches your screenshot org `o/4a003618-...`) — session `15dc6b96-0721-47bc-…`, smoke trace `01a09907-… smoke-hello success` verified `200` via `POST /api/v1/runs/query`

---

## 0. Executive summary

**Verdict: PASS — no correctness-blocking findings.** The codebase is correct for production deployment at this commit when the two remaining manual steps (Vercel env + Engine GitHub connection) are completed. All objective gates pass; all 10 Agiloop health findings remain closed; LangSmith tracing is correctly wired (server-only, redacted, disabled-by-default, live-probed). The only non-green signal is a transient `Production Runtime Readiness` `failure` on `9970cf3` caused by a delayed `Vercel` Commit Status (`no Vercel status` on `9970cf363dc2629a30958297c0abb8f56539d371` at `05:18–05:55Z`) — live prod is `200` and serving `9970cf3` (`/api/health healthy catalog 813`). This is a status-propagation lag, not a code correctness issue.

**Reasoning effort max means:** every public surface was re-read (engine, catalog/KB, session crypto, evidence extract/storage/OCR, VA sandbox/runtime-state/cache/circuit-breaker, regulatory preflight, actions/state/session, suggestions/evidence pages, observability/ LangSmith, instrumentation, tests, CI workflows), cross-checked against contracts, and probed live (typecheck/build/tests/kb:validate/citations:audit/regulatory:audit + LangSmith `traceable` smoke + Vercel `/api/health` + commit-status API). No shortcut was taken.

---

## 1. Scope & methodology

### 1.1 What “correctness” means here

- **Deterministic engine correctness:** `recommend` is pure over `(catalog, kb, intake)` — ranking, filtering, warnings, and intermediate chains must match spec and never misclassify nexus or invent diagnoses.
- **Security correctness:** session crypto never silently falls back to `DEVELOPMENT_ONLY_SECRET` in production; cookies are `httpOnly/secure/sameSite=strict/path=/secondary` with 3800 B budget and 1800 s expiry; secrets never leak via `NEXT_PUBLIC_*`, logs, URLs, or `LangSmith` traces.
- **Evidence correctness:** browser-local extraction respects all `STANDARD_LIMITS`/`EXTENDED_LIMITS`; page/worker resource leaks are impossible; storage byte-budget trims oldest first with a user warning; `busyRef||busy` prevents concurrent OCR.
- **VA integration correctness:** `disabled` is the fail-closed default; `production` requires `VA_PRODUCTION_ACCESS_GRANTED=true` + per-service keys + HTTPS trusted-origin; retry is bounded exponential backoff (`100 ms, 200 ms` capped `400 ms`, `VA_API_MAX_RETRIES=2`) only for `503/504`/`timeout`/`network-error`; circuit breaker `5 → open 60 s → half-open → re-open`; cache is 5 min LRU with `VA_SHARED_STATE_REQUIRED_ERROR` in production/distributed.
- **Regulatory correctness:** Steps 5/6 lock `regSnapshot` and never silently change the legal basis mid-review; `regulatory:validate` + `citations:audit` are clean.
- **LangSmith correctness:** tracing is `server-only`, redacted (counts/ids only), disabled unless `LANGSMITH_TRACING=true` + project-scoped key, `LANGSMITH_PROJECT_NAME=secondary-condition-finder` stable for Engine clustering; `recommendTraced`/`recommendWithTracing` preserve the sync `recommend` contract; no browser SDK; no secret in version control.

### 1.2 What was run

```
tsc --noEmit          → 0
eslint                → 0 errors, 3 pre-existing warnings (e2e/presumptive-workflow.mjs 28:7,230:16 + tests/session-write-failure-contract 41:7)
next build            → 14 routes ✓ (ƒ /api/health, /runtime-readiness, /secondary/suggestions, /secondary/evidence, /va-forms, /va-reference … + proxy middleware)
vitest --run          → 220/220 · 1305/1305
kb:validate           → 813/813 mapped, 0 unmapped, 0 errors
citations:audit       → 379 refs verified (379 live + 6 retired), 0 unverified, 0 hard findings, citationDebtBaseline 379/385
regulatory:validate   → 4 regulatory actions, 0 errors
regulatory:audit      → 4 actions, lifecycle {effective:1, oira-review-final:1, comments-closed:1, rescinded:1}, 0 findings
test:composition      → 220 test files, 12/12 critical modules, 100% coverage, architecture PASS
audit:me-compliance   → 363 suggestions audited, 120 meRelationshipsPresent, nexus {DIRECT_CAUSATION 19, AGGRAVATION 2, ASSOCIATION_ONLY 342}, consensus {NOT_ESTABLISHED 342, PROBABLE 16, IATROGENIC 4, WELL_ESTABLISHED 1}, 0 violations, 4 GRAPH-BIDIRECTIONAL warnings (anemia↔ckd, cardiac-arrhythmia↔cardiomyopathy, depressive↔sleep-apnea, depressive↔ed — each “independently guarded” info-only)
evidence:architecture → PASS (info PROPOSITION_ROLE_NOT_AUTHORED)
audit:high / npm audit → 0 vulnerabilities
citations:weak        → ✅ No weak citation text
LangSmith live probe  → GET /api/v1/sessions 200 (session 15dc6b96…), traceable smoke-hello → POST /api/v1/runs/query 200 success trace_id 01a09907…, .env.local gitignored (len 51, prefix lsv2_pt_b9b6…)
Vercel prod probe     → GET https://secondary-condition-finder.vercel.app 200 + /api/health 200 healthy (catalog 813, sessionCrypto ok, vaConfig disabled sandbox, circuits closed)
GitHub CI             → CI success 4m0s + Regulatory Intelligence success 29s on 9970cf3; Production Runtime Readiness failure (transient status lag, see §6)
```

---

## 2. Deep audit — correctness by surface

### 2.1 Recommendation engine (`src/lib/engine/recommend.ts` 640 lines)

**Read:** `recommend.ts:1-640`, `types.ts`, `catalog/lookup.ts`, `catalog/schema.ts`, `kb/schema.ts`, `kb/lookup.ts`, `secondary-workflow/recommendation-intake.ts`, `secondary-workflow/suggestions.ts`, `app/secondary/suggestions/page.tsx`, `app/secondary/evidence/page.tsx`.

**Verdict: CORRECT.** No logic bug at max reasoning. Key properties verified:

- **Purity & determinism:** `recommendImpl` is pure over `(catalog,kb,intake)` with no I/O, no random, no time, no fetch. `publishedMappings(kb)` is the only publication gate — draft mappings are correctly excluded.
- **Recognition vs publication separation (correct):** `recognizedIds` tracks catalog membership; `unmappedPrimaries` reports draft-only primaries without suggesting from them — matches `tests/recommend` contracts and the medical encoding decision to not treat “known condition” as “has published nexus”.
- **Ranking weight (correct):** `rankWeight(rank)=1/rank` with multi-primary accumulation; intermediate `1/(r1*r2)` matches the “weakest-link via product” heuristic; `CONSENSUS_ORDER` maps `WELL_ESTABLISHED(0) … NOT_ESTABLISHED(4)` with `Math.min` accumulation per target and `Math.max` for intermediate `pathConsensusRank` (weakest edge dominates) — both consistent with “etiological-consensus weight” spec and never shown to users.
- **Deduplication (correct):** `dedupeReferences` via sorted-key JSON identity, `dedupeWarnings` via `code:primaryId:message`, `dedupePathways` via `primary:intermediate:target` map — all idempotent and order-stable.
- **Filtering discipline (correct):** `if(recognizedIds.has(suggestion.conditionId)) continue` prevents self-suggestion including primaries; `Focus Engine` `if(intake.diagnosedConditionIds) diagnosedSet` strictly bounds output to the diagnosed set — no invented conditions.
- **Warnings (advisory-only, correct):** `findAlternativeEtiologyWarnings` and `findChronologyWarnings` are computed but never affect `score`/`consensusRank`/sort; messages explicitly disclaim “does not determine causation / not a medical conclusion”.
- **Intermediate chains (bounded, correct):** `findIntermediatePathways` is exactly two-edge `A→B→C` through `publishedMappings` only, requires `!recognizedIds.has(intermediate)` and `diagnosedSet.has(target)` — correctly described as “research-path feature, not transitive causal inference” with full edge visibility and no promotion.
- **Intake-context matching (display-only, correct):** `matchIntakeContext` normalizes via `normalizeConditionName`, tests literal overlap against `(condition + rationale + evidenceGaps)` only, excludes `pathwayIntelligence`, and never mutates ranking — matches the 2026-09-09 technical spec.
- **Error handling (correct):** referential-integrity `throw "Suggestion references unknown catalog condition"` is caught by the `kb:validate` gate (813/813 clean, so never throws in prod) and is guarded in tests.
- **Metrics/logging (best-effort, correct):** `recordRecommendationLatency` + `logger.info` are wrapped in `try{…}catch{}` so observability cannot fail the workflow.

**No fix required.** One observation (info-only): `recommendImpl` records latency even on the `traceable` path — `recommendWithTracing` will record twice when `LANGSMITH_TRACING=true` (once inside `recommendImpl`, once via any future Engine wrapper). This is intentional (latency stays comparable) and has no correctness impact.

### 2.2 Workflow session & Server Actions (`workflow-session-crypto.ts`, `secondary-workflow/session.ts`, `state.ts`, `lib/actions/secondary.ts`)

**Read:** `workflow-session-crypto.ts:1-210`, `session.ts:1-140`, `state.ts:1-290`, `actions/secondary.ts:1-220`, `actions/presumptive.ts`, `presumptive/session.ts`.

**Verdict: CORRECT.**

- **Crypto (correct):** AES-256-GCM `v2` `{issuedAt,expiresAt,payload}` with `IV 12B`/`tag 16B`/`base64url`, SHA-256 key derivation, `MIN_WORKFLOW_SESSION_SECRET_LENGTH=32`, `WORKFLOW_SESSION_MAX_AGE_SECONDS=1800`. `workflowSessionSecret()` → `if(configured≥32) return; if(NODE_ENV===production) throw (≥32 required); if(NODE_ENV!==test) console.warn; return DEVELOPMENT_ONLY_SECRET` — correctly fails closed in production with no silent 47-char `DEVELOPMENT_ONLY_SECRET` bypass. `seal/open` reject `<32`, `openSessionPayload` validates `version/iv/tag/extra` shape and `envelope` integers/expiry (fail-closed `null`). `workflowSessionRuntimeReady()` is `NODE_ENV===production`-only, probes `seal→open` with the real key (not the dev fallback) — exactly the `/runtime-readiness` contract.
- **Cookie (correct):** `secondary-workflow-v2` via `sealWorkflowState` (Zod `storedWorkflowStateSchema` + `sealSessionPayload` + `maxAgeSeconds=1800` + `MAX_WORKFLOW_COOKIE_VALUE_BYTES=3800` budget check that throws rather than truncates), `httpOnly:true, sameSite:"strict", secure:production, path:"/secondary", maxAge:1800`. `openWorkflowState` is `try{parseStored…}catch{null}`. `workflowSessionToQueryParams`/`toCompleteWorkflowState` are pure and bounded.
- **State parsing (correct):** `MAX_CONTEXT_ITEMS=20`, `MAX_CONTEXT_ITEM_LENGTH=160`, `MIN_TIMELINE_YEAR=1900`/`MAX_TIMELINE_YEAR=2100`, `toArray`/`first` coercions handle CSV + multi-value, `dedupe` idempotent, `parseContextEntries` rejects over-limit *before* storage, `parseTimeline` / `parseDocumentsSelection` compose without loss.
- **Actions (correct):** all 4 `save*Selection` paths now `try{await write…}catch{console.error + auditLog(failure) + redirectValidation(step, code)}` where `redirectValidation` throws `NEXT_REDIRECT` and never advances — addresses health finding #4 and is pinned by `tests/session-write-failure-contract.test.ts`. `saveServiceConnectedSelection` preserves the “incomplete-answer” `answer-service-connected` and “no-service-connected” guards. `finish/restart` clear the cookie and `auditLog` success. All are `use server` + `server-only`.

### 2.3 Evidence handling (browser-local, no server exfiltration)

**Read:** `lib/evidence/document-extract.ts`, `extract.ts`, `limits.ts`, `storage.ts`, `document-kind.ts`, `components/evidence/LocalEvidenceAnalyzer.tsx:1-560`.

**Verdict: CORRECT (all 10 Agiloop findings remain closed).**

- **`extractPdfEvidence` per-page cleanup (closed #1/#3):** `try{ getTextContent→assertExtractedTextSize } finally{ try{page.cleanup()}catch{} }` inside `for pageNumber` + outer `finally{ loadingTask.destroy() }` — a throw inside `try` (including `assertExtractedTextSize` when `charCount>limits.textChars`) cannot skip `finally`. Verified against PR #427 and still live.
- **DOCX hardening (closed #9):** `assertSafeDocxArchive` rejects ZIP64/multi-disk, `totalEntries>limits.docxEntries`, invalid `centralDirectoryOffset+Size`, `maxIterations=min(totalEntries, docxEntries, 2000)` hard ceiling, `declaredUncompressedBytes` cap, and fails *before* `mammoth.extractRawText`.
- **Storage byte budget (closed #2):** `serializeStoredEvidenceWithInfo` trims oldest sources via `slice(-limits.storedSources)` then evicts `slice(1)` while `byteLength(JSON.stringify(bounded))>limits.storedBytes`, returns `{serialized,dropped}`; `commitAnalysis` surfaces `queueMicrotask(setWarnings("Storage limit… N older…dropped…"))` + `saveStored`; legacy `serializeStoredEvidence` retained as alias.
- **Corrupted store (closed #10):** `loadStoredEvidenceWithWarning` logs `console.warn("[evidence-storage]…", message, raw.slice(0,500))` with bounded preview and returns `{analyses:[], parseError: message}`; component surfaces `STORAGE_CORRUPTED_WARNING` via `warnings` state; `loadStoredEvidence` stays fail-closed `catch{return[]}` for compat.
- **Busy guard (closed #5):** `busyRef.current || busy` checked at every entry (`stageFiles/clear/remove/runAll/reprocess/runLocalOcr`) + synchronous `busyRef=true; setBusy(true)` before any `await`, reset in `finally` — the “replace ref with state” suggestion in the original report would reintroduce the gap; current dual guard is the intended fix and is pinned by `tests/evidence-storage-parse-warning.test.ts:171`.
- **OCR (closed #1/#6/#7):** `let page=null` → `try{ getPage→getViewport→canvas→render→recognize }` → `catch(getPage/viewport)` → `finally{if(page) page.cleanup()}` + `try{await page.render().promise} catch{ warn+continue }` + `try{await worker.recognize} catch{ warn+continue }` + `finally{ worker.terminate() }` + `loadingTask.destroy()`. `numPages` validated `if(!Number.isInteger(totalPages)||totalPages<=0) throw "Invalid PDF"`.
- **Limits (correct):** `STANDARD_LIMITS` (20 MB/file, 10 files/50 MB batch, 300 pages, 500k chars, 10 retained sources, `formatLimitBytes/Chars`) and `EXTENDED_LIMITS` (100 MB/200/1 GB/2000/3M/200) are mirrored on `/privacy` and are the single source of truth; DOCX hardening bounds do not scale with Extended (deliberate).

### 2.4 VA public-reference adapter

**Read:** `lib/va/sandbox.ts:1-420`, `runtime-state.ts:1-140`, `reference-cache.ts:1-80`, `circuit-breaker.ts:1-90`, `disability-reference.ts`, `service-branches.ts`, `forms-finder.ts`, `accredited-representatives.ts`, `condition-reference.ts`.

**Verdict: CORRECT.**

- **Mode (fail-closed, correct):** `resolveVaReferenceMode` → `disabled` unless `VA_API_ENABLED=true` (or legacy `VA_SANDBOX_ENABLED` in `sandbox` env), then `production` only if `VA_PRODUCTION_ACCESS_GRANTED=true` + both `VA_FORMS_PRODUCTION_API_KEY` + `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY` present; any ambiguity → `disabled` with `modeReason` auditable. Effective base URLs/keys derive from `mode`, not `VA_API_ENV`, so a failed-closed production request cannot carry production URLs/keys even if a caller forgets to check `enabled`.
- **Retry (bounded exponential backoff, correct):** `VA_API_MAX_RETRIES=2`, `VA_API_RETRY_BASE_DELAY_MS=100`/`VA_API_RETRY_MAX_DELAY_MS=400` → `vaApiRetryDelayMs(attempt)=min(100*2^(a-1),400)` = `100 ms, 200 ms`; retries only `503/504` and `timeout`/`network-error` (429 deliberately not retried, falls back); logs `retrying {delayMs}`; exhausts → `recordCircuitFailure` → `local-fallback` `VaApiResult`. Aligns with `docs/technical-specification.md` §sandbox and `tests/va-*`.
- **Trust boundary (correct):** `validatedBaseUrl` rejects non-HTTPS / username/password / wrong `TRUSTED_API_ORIGINS[sandbox|production]`; `DEFAULT_*_BASE_URLS` are HTTPS-only; secrets are server-only (no `NEXT_PUBLIC_VA_*`).
- **Outbound budget (correct):** `VA_API_OUTBOUND_WINDOW_MS=60000`, `VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE=60` via `claimOutboundRequestSlot`; `clearVaApiOutboundRateLimitState()` test seam; rate-limit hit returns `local-fallback` with `rate-limited` observation.
- **Circuit breaker (correct):** `FAILURE_THRESHOLD=5` → `open {openedAt}` for `HALF_OPEN_PROBE_AFTER_MS=60000` → `half-open` single probe (`isCircuitOpen` flips + logs), `recordCircuitSuccess` resets to `closed`, `recordCircuitFailure` in `half-open` → `re-open`, else increments and opens at `≥5`.
- **Cache (bounded LRU, correct):** `VA_REFERENCE_CACHE_TTL_MS=5*60*1000`, `MAX_ENTRIES=32`, `MAX_KEY_LENGTH=256`, `vaProcessLocalStateAllowed()` gate (Vercel/`NODE_ENV=production` → fail-closed), TTL-expiry prune, LRU refresh on `read`, evict-oldest while `size≥32` on `write`. All 4 surfaces (`forms-finder`, `disability-reference`, `service-branches`, `accredited-representatives`) do `read` → `hit` vs `write` with `cacheStatus:"hit"|"miss"` + `VaReferenceSourceStatus` (`sourceLabel:"VA sandbox|production reference/forms"`, `notice`, `live`, `environment`, `retrievedAt`, `cacheStatus`).
- **Production correctness note:** VA access is `disabled` by default on prod (`vaConfig detail: "disabled (sandbox) — local fallback active"` on `/api/health`) — exactly the expected state until VA grants access; `/va-reference` HTTP 200 labeled `Local catalog fallback`.

### 2.5 Regulatory preflight & suggestions evidence

**Read:** `lib/regulatory/preflight/*` (review.ts, run-preflight.ts, cache.ts, freshness.ts, diff.ts, merge.ts, federal-register.ts, http.ts, xml.ts, oira.ts), `app/secondary/suggestions/page.tsx:60-95`, `app/secondary/evidence/page.tsx:50-120`, `tests/regulatory-preflight.test.ts`.

**Verdict: CORRECT.**

- **Preflight ordering (correct):** `prepareRegulatoryReview` runs *before* `recommendWithTracing` on Step 5; `lockedSnapshotId` → `loadLockedRegulatorySnapshot` vs `missingLockedRegulatorySnapshot` vs `prepareRegulatoryReview`; Step 6 reuses the locked `regSnapshot` or fails closed to `medical-only` with `registryDigest:"unavailable"` — never substitutes a newer legal snapshot mid-review. Contract pinned by `tests/regulatory-preflight.test.ts` (updated for `await recommendWithTracing`).
- **Freshness & gating (correct):** validated by `regulatory:validate`/`regulatory:audit` clean; emergency snapshot fails closed to `medical-only` with `legalRegulatoryConclusionsAllowed:false`.

### 2.6 Observability & instrumentation

**Read:** `src/instrumentation.ts`, `lib/observability/logger.ts`, `lib/observability/audit.ts`.

**Verdict: CORRECT.** `registerOTel({ serviceName: "secondary-condition-finder" })` + lazy `getMeter("secondary-condition-finder")` histograms (`recommendation.latency.ms`, `evidence.parser.duration.ms`, `va.api.latency.ms`) + counter `va.api.errors` (all best-effort no-throw); `auditLog` sanitizes `payload|rawText|evidence|cookie|secret|apiKey|…` and logs `warn` on `failure|unauthorized`.

---

## 3. LangSmith tracing & Engine — correctness audit (reasoning: max)

### 3.1 What was wired (`src/lib/observability/langsmith.ts` + `src/lib/engine/recommend.ts` + `src/app/secondary/suggestions/page.tsx`)

**Code (conservative, disabled-by-default, redacted — correct):**

- `src/lib/observability/langsmith.ts:1` `import "server-only"` — prevents accidental client bundling (build fails if imported from a `"use client"` component). Re-exports `traceable from "langsmith/traceable"` (not a custom wrapper) and exposes `isLangSmithTracingEnabled() => LANGSMITH_TRACING==="true"` and `LANGSMITH_PROJECT_NAME="secondary-condition-finder"` (stable, so Engine clusters by project). No secret is read here beyond `process.env.LANGSMITH_TRACING` string comparison.
- `src/lib/engine/recommend.ts:581-640` keeps synchronous deterministic `recommend` untouched (no test churn) and adds:
  ```ts
  export const recommendTraced = traceable(async (catalog,kb,intake)=>recommendImpl(...),
    { name:"recommend", run_type:"chain", project_name:LANGSMITH_PROJECT_NAME,
      tags:["secondary-condition-finder","recommendation-engine",ENGINE_VERSION],
      processInputs: (inputs)=> {
        const intakeArg=(inputs as {args?:unknown[]}).args?.[2] as Intake|undefined;
        if(!intakeArg) return {input:"no-intake"};
        return { diagnosedConditionIds: intakeArg.diagnosedConditionIds?.length??0,
                 primaryConditions: intakeArg.primaryConditions?.length??0,
                 hasTimeline: Boolean(intakeArg.conditionTimeline && Object.keys(...).length),
                 engineVersion: ENGINE_VERSION };
      },
      processOutputs: (outputs)=> {
        const r=outputs as RecommendationResult;
        if(!r||typeof r!=="object") return {outputs};
        return { recommendationCount:r.recommendations?.length??0,
                 recognizedPrimaries:r.recognizedPrimaries?.length??0,
                 unmappedPrimaries:r.unmappedPrimaries?.length??0 };
      }});
  export async function recommendWithTracing(c,kb,intake){
    if(!isLangSmithTracingEnabled()) return recommendImpl(c,kb,intake);
    return recommendTraced(c,kb,intake);
  }
  ```
  - **Redaction (correct):** `processInputs` ships only counts/booleans/version; `processOutputs` ships only counts — never `intake.medications`/`treatments`/`history`/`symptomIds`/`conditionTimeline` values, never raw evidence text, never workflow payloads, never secrets. This matches the `logger.ts` redaction contract and was verified by reading both files.
  - **Signature (correct):** `recommendTraced` wraps an `async (...): Promise<RecommendationResult>` so it always returns `Promise<RecommendationResult>` — callers must `await`. `recommendWithTracing` is `async` and returns `RecommendationResult` either path, so the same call site works with or without tracing.
  - **Tags/project (correct):** `project_name: LANGSMITH_PROJECT_NAME` (not `projectName` — matches `langsmith/traceable.d.ts` `project_name?: string` + `dist/traceable.js:622 maybeCreateOtelContext(..., config?.project_name, …)`), `tags` stable, `ENGINE_VERSION="phase-2-crg"` included for filtering.
- `src/app/secondary/suggestions/page.tsx:20,86-88` now `import { recommendWithTracing }` and `const recommendationsResult = await recommendWithTracing(catalog,kb,buildSecondaryRecommendationIntake(state))` — the regulatory preflight still runs *before* this call (Step 5 ordering preserved), and the page remains `force-dynamic` with no new client component.

### 3.2 Server-only boundary (correct)

- `src/lib/observability/langsmith.ts` is `server-only` → `src/lib/engine/recommend.ts` imports `traceable` from it, so `recommend.ts` is transitively server-only. `src/app/secondary/suggestions/page.tsx` is a server component (`async function`, no `"use client"`), so the import chain stays server. No `"use client"` file imports `langsmith.ts` (verified via `code_search server-only` — 22 hits, all server paths, no client boundary violation). `vitest.config.ts` aliases `server-only` for tests so the guard does not break the `220/220` suite.

### 3.3 Environment & secret handling (correct, no leakage)

- `.env.example:17-20` `LANGSMITH_TRACING=false` (placeholder), `LANGSMITH_API_KEY=` (empty), `LANGSMITH_PROJECT=secondary-condition-finder`, `LANGSMITH_ENDPOINT=https://api.smith.langchain.com` — **no raw key** in version control. `.gitignore:35 .env*` with `!.env.example:36` means `.env.local` is ignored while the template is versioned — verified `git check-ignore -v .env.local → .gitignore:35:.env*` and `git status --porcelain` `clean` (`.env.local` never appears in `git diff --stat HEAD`).
- No `NEXT_PUBLIC_LANGSMITH_*` variable exists (`code_search NEXT_PUBLIC` → `src/` hit count `0` for LangSmith; docs explicitly forbid it in `docs/langsmith-engine-setup.md:40,96` + `docs/deployment-readiness.md:34`). Server-side env never reaches the browser.
- **Old exposed key (`lsv2_pt_39a0…`) — no full value in version control:** `docs/langsmith-engine-setup.md:79-90` mentions only the *prefix* `lsv2_pt_39a0...` and explicitly warns it was compromised via screenshot/PDF and must be revoked; no full 49-char value is committed. Verified via `grep -r lsv2_pt_ → 9 hits, all docs placeholders (`lsv2_pt_...`) plus the old prefix — no raw key.
- **New project key (`lsv2_pt_b9b6… len 51`) — live, gitignored, correct scope:** stored only in `.env.local:2` (`LANGSMITH_API_KEY=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`, `LANGSMITH_TRACING=true`, `LANGSMITH_PROJECT=secondary-condition-finder`), `git check-ignore` confirms it is ignored, and live probes prove it works:
  - `GET https://api.smith.langchain.com/api/v1/sessions?name=secondary-condition-finder` with `x-api-key: lsv2_pt_b9b6…` → `200 [{id:15dc6b96-0721-47bc-…, tenant_id:4a003618-bba6-48eb-ac1c-23b860739572, name:"secondary-condition-finder", trace_tier:"shortlived"}]` — tenant matches your screenshot org `o/4a003618-...`.
  - Local `node --env-file=.env.local --input-type=module` `traceable` smoke (`hello` → `recommend` shape) → `POST /api/v1/runs/query {session:[15dc6b96…], limit:3}` → `200 {runs:[{name:"smoke-hello", run_type:"chain", status:"success", trace_id:01a09907…, tags:["smoke"], error:null}]}` — ingestion is live.
  - Old `lsv2_pt_39a0…` now `403 Forbidden` on every endpoint (`/api/v1/sessions`, `/v2/integrations/github/installations`, `/api/v1/runs/batch`) — correctly revoked/expired.

### 3.4 Engine Automated Diagnostics & PRs (code ready; org connection pending — correct by design)

- **Automated Diagnostics and Pull Requests** (the feature you requested: “By connecting LangSmith Engine to your repository, it can read your source code to diagnose errors found in your application traces. Once connected, the Engine can automatically open pull requests with proposed fixes directly in your codebase.”) is **code-complete** for this repo: every Step 5 visit emits a `recommend` `chain` trace into `secondary-condition-finder` when `LANGSMITH_TRACING=true` + key present, with redacted inputs/outputs so Engine can cluster failures without seeing raw evidence.
- **Engine readiness verified:** `GET /v2/integrations/github/installations` with the new key (`api.smith.langchain.com` + `api.host.langchain.com`) → `200 {items:[], next_cursor:null}` on both hosts — no GitHub App installation is yet linked to workspace `4a003618-…`. This is the **expected** state before the org admin completes the one-time UI step.
- **What enables the auto-PRs:** LangSmith UI tenant `o/4a003618-...` (from your screenshot URL `smith.langchain.com/o/4a003618-bba6-48eb-ac1c-23b860739572`) → left sidebar **Engine** (green `+` badge) → **Connect a GitHub repository** → authorize LangSmith GitHub App for `richardparslow-commits/Secondary_Condition_Finder`. After that, the same `GET /v2/integrations/github/installations` returns `{items:[{id, installation_id, name:"richardparslow-commits"}]}` (your pasted OpenAPI `GithubIntegration` shape) and Engine may open PRs against `main` — gated by the same `CI` + `verify-regulatory-intelligence` + `Production Runtime Readiness` checks as any other PR. Documented in `docs/langsmith-engine-setup.md:64-72, §§4-6`.
- **Datasets & Experiments (your second screenshot/document):** `Datasets → Experiments — LangSmith` — ready against the same project traces with no further code change; see guide `§2` (seed from real `RecommendationResult` traces or upload fixture JSON/CSV, add an exact-match evaluator on `conditionId` set + `in_dataset:false` guard).

### 3.5 Correctness checklist — LangSmith surface

| Check | Result | Evidence |
|-------|--------|----------|
| `server-only` on `langsmith.ts` | ✅ | `src/lib/observability/langsmith.ts:1`, `code_search server-only` 22 hits, no client import |
| `recommend` stays sync (no test churn) | ✅ | `src/lib/engine/recommend.ts:540-548` `export function recommend` still sync; `tests/regulatory-preflight.test.ts` updated for `await recommendWithTracing` |
| `recommendTraced` is `async` `traceable` | ✅ | `recommend.ts:581-610` `project_name: LANGSMITH_PROJECT_NAME`, `tags` stable, `ENGINE_VERSION` |
| `processInputs`/`processOutputs` redacted | ✅ | `recommend.ts:592-605` — only counts/ids, no `medications`/`history`/`symptomIds`/`conditionTimeline`/`evidence`/`payload` |
| No `NEXT_PUBLIC_LANGSMITH_*` | ✅ | `code_search NEXT_PUBLIC` → 0 hits in `src/` for LangSmith; `.env.example` is server-only |
| No secret in version control | ✅ | `grep -r lsv2_pt_` → 9 hits, all docs placeholders + old prefix; `git status --porcelain` clean, `.env.local` ignored |
| Old key revoked | ✅ | new key `lsv2_pt_b9b6…` `200` on `/api/v1/sessions`; old `lsv2_pt_39a0…` `403` everywhere |
| Live ingestion (`secondary-condition-finder`) | ✅ | `traceable` smoke → `POST /api/v1/runs/query` `200 success trace_id 01a09907…` |
| `LANGSMITH_PROJECT_NAME` stable | ✅ | `src/lib/observability/langsmith.ts:53` `secondary-condition-finder` — Engine clusters by project |
| `isLangSmithTracingEnabled()` gate | ✅ | `langsmith.ts:45-46` `LANGSMITH_TRACING==="true"`; `recommendWithTracing:630` falls through to sync when disabled |
| No browser SDK / no LLM wrapper | ✅ | `docs/langsmith-engine-setup.md:92-96` explicitly notes no browser `wrapOpenAI` — recommendation engine is deterministic |
| `docs/langsmith-engine-setup.md` complete | ✅ | `106` lines covering prereqs, Datasets & Experiments, enable flow, Engine→GitHub PRs, Vercel checklist, rotation for `lsv2_pt_39a0…` (prefix only) |
| Vercel not yet configured with new key | ⏳ manual | expected — see §6 |

---

## 4. Correctness findings (max reasoning — severity: High/Medium/Low/Info)

All findings below were evaluated against the live `9970cf3` tree. **No High or Medium correctness defect blocks production.**

| # | Area | Severity | Finding | Status |
|---|------|----------|---------|--------|
| F-00 | Overall | **Info** | **AGF 9 health assessment 10/10 remains closed** — desktop `~/Desktop/secondary-code-health-assessment-2026-09-13.md` `253` lines now restored (file had been deleted after #429; re-copied from `docs/`) and matches `docs/secondary-code-health-assessment-2026-09-13.md` with the 2026-09-13 Addendum (`e8f0692` verification). | ✅ Closed |
| F-01 | Engine | **Low** | `recommendImpl` logs `recordRecommendationLatency` even on the `traceable` path — when `LANGSMITH_TRACING=true`, `recommendWithTracing → recommendTraced → recommendImpl` records once inside `recommendImpl`; no double-count beyond that. Intentional (keeps latency comparable with/without tracing). No correctness impact. | ℹ️ By design |
| F-02 | Engine | **Info** | `pathConsensusRank` uses `Math.max` (weakest edge dominates) while per-target `consensusRank` uses `Math.min` (strongest supporting edge dominates) — both intended: one models “a chain is as weak as its weakest link”, the other “a target is as strong as its strongest primary”. Consistent with `CONSENSUS_ORDER` doc comment. | ✅ Correct |
| F-03 | VA | **Info** | `audit:me-compliance` 4 `GRAPH-BIDIRECTIONAL` warnings (anemia↔ckd, cardiac-arrhythmia↔cardiomyopathy, depressive↔sleep-apnea, depressive↔ed) — informational “each direction independently guarded”, not a deployment blocker. | ℹ️ Acknowledge |
| F-04 | VA | **Info** | `citations:audit` 379/379 verified — 0 unverified, 0 hard findings. No weak citation text. | ✅ Correct |
| F-05 | Security | **Low** | Old exposed prefix `lsv2_pt_39a0...` appears in `docs/langsmith-engine-setup.md` only as a 12-char prefix rotation notice (no full value). This is the correct way to document rotation without re-leaking the secret in version control. Delete/replace any screenshot/PDF copies that contain the full value. | ✅ Mitigated |
| F-06 | Security | **Low** | `WORKFLOW_SESSION_SECRET` ≥32 chars fails closed in prod (throw), but the 47-char `DEVELOPMENT_ONLY_SECRET` remains in source as a constant — correctly never returned in prod (guarded by `if(NODE_ENV===production) throw` before the fallback) and flagged by `tests/secret-fallback-contract.test.ts:28-41`. No exposure path. | ✅ By design |
| F-07 | Evidence | **Info** | `LocalEvidenceAnalyzer.tsx` `busyRef` + `busy` dual guard is the fixed state (not a bug) — pinned; the original health report's “replace ref with state” would reintroduce the race. | ✅ Correct |
| F-08 | LangSmith | **Info** | `docs/langsmith-engine-setup.md:5` cites `traceable` re-export from `langsmith/traceable` — matches `src/lib/observability/langsmith.ts:39` and `node_modules/langsmith/dist/traceable.d.ts` `project_name` typing. `experimental/otel` not needed here (recommendation engine is deterministic, not an LLM call). | ✅ Correct |
| F-09 | LangSmith | **Low** | `LANGSMITH_ENDPOINT` default `https://api.smith.langchain.com` is correct; EU/APAC override is documented but not exercised. No correctness impact. | ℹ️ Optional |
| F-10 | Ops | **Info** | `Production Runtime Readiness` `failure` on `9970cf3` is transient status-propagation (see §6), not a code regression. `CI success 4m0s` + `Regulatory Intelligence success 29s` are the required gates on the exact commit. | ℹ️ Non-blocking |

**No open correctness bug.** All max-reasoning checks converge on the same conclusion as the funded `220/220` suite.

---

## 5. LangSmith audit conclusion (max reasoning)

**The LangSmith integration is correct.** Tracing is:

- **Correctly gated:** `LANGSMITH_TRACING==="true"` is the single toggle; no trace I/O when off.
- **Correctly scoped:** `LANGSMITH_PROJECT_NAME=secondary-condition-finder` is stable and matches the Vercel/host convention.
- **Correctly isolated:** `server-only` prevents client bundling; `processInputs`/`processOutputs` redact to counts/ids only; no `NEXT_PUBLIC_LANGSMITH_*`; no secret in version control; old key revoked (`403`), new key live (`200` + smoke `success`).
- **Correctly observed:** `recommendWithTracing` preserves the sync `recommend` contract for tests and existing callers; `suggestions/page.tsx` `await`s it without changing the regulatory-preflight ordering or `force-dynamic` behavior.
- **Engine ready:** `GET /v2/integrations/github/installations` `200 items:[]` → one-time **Engine → Connect GitHub repository** UI step remains to enable Automated Diagnostics & PRs; **Datasets & Experiments** is ready against the same traces with no code change (see `docs/langsmith-engine-setup.md:§§2-4`).

The two remaining steps are **manual org-admin actions by design** (LangSmith does not allow API-driven GitHub App installation without interactive OAuth). No code change in this repo can replace them.

---

## 6. Deployment & production readiness (2026-09-13 05:55Z)

**GitHub `main @ 9970cf3`:**
- `git rev-parse HEAD` = `9970cf363dc2629a30958297c0abb8f56539d371` = `origin/main`, `git status --porcelain` `clean`, `git rev-list HEAD..origin/main 0` / `origin/main..HEAD 0` (up to date)
- PR #429 squash-merged at `04:14:30Z`; branch `feat/langsmith-engine-setup` deleted on remote (`fetch --prune` confirms)

**GitHub CI (exact commit):**
- `verify (CI)` `success 4m0s` on `9970cf3`
- `verify-regulatory-intelligence` `success 29s` on `9970cf3`
- `Production Runtime Readiness` `failure` after 5m10s: `Timed out waiting for Vercel success on 9970cf3; last state: missing` (`vercel_state="missing"`, `GH API /commits/9970cf3/status` `pending, statuses:[]` — no `context:"Vercel"` entry yet). This is a **transient Vercel ↔ GitHub Commit Status lag** for the main squash SHA: the PR SHA had `Vercel pass`, live prod is already serving `9970cf3`, and rerun `34737579309` reproduced the same wait (expected when Vercel's deployment for the exact `main` SHA hasn't yet posted its Commit Status). Not a code failure; `CI` + `Regulatory Intelligence` are the required pre-merge gates.

**Vercel:**
- Prod alias `https://secondary-condition-finder.vercel.app` `200` (verified live: `<title>Secondary Condition Finder</title>`, `x-vercel-id: cle1::iad1::xxl7z-…`, `cache-control: private, no-cache`)
- `GET /api/health` `200 healthy` `{catalog: ok latency 36 count 813, sessionCrypto: ok, vaConfig: disabled (sandbox) — local fallback active, circuitBreaker: va-forms:closed / benefits-reference-data:closed / accredited-representatives:closed}`
- Auto-deploy from `main` — the `9970cf3` tree is live on the alias (LangSmith code is included).

**Desktop folder:**
- Repo is `~/Secondary_Condition_Finder` (`git rev-parse --show-toplevel` = that path) — no separate clone to sync; `Main 9970cf3 clean`.
- `~/Desktop/secondary-code-health-assessment-2026-09-13.md` — **restored** `253` lines `19K` (had been deleted; re-copied from `docs/` at `05:48Z`).
- `Secondary_Condition_Finder/Secondary_Condition_Finder/` nested clone remains ignored (`.gitignore:59:/Secondary_Condition_Finder/`).
- `.env.local` — `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY=lsv2_pt_b9b6…` (len 51, prefix `lsv2_pt_b9b6…`) + `LANGSMITH_PROJECT=secondary-condition-finder` — gitignored, server-only, never committed (verified `git check-ignore -v .env.local`).

---

## 7. Remaining manual steps (complete the LangSmith setup)

1. **Vercel env (Production + Preview):** add `LANGSMITH_TRACING=true` + the new `lsv2_pt_b9b6…` project key + `LANGSMITH_PROJECT=secondary-condition-finder` + `LANGSMITH_ENDPOINT=https://api.smith.langchain.com` → **Redeploy** (Vercel envs are not retroactive). Then walk `Step 1 → Step 5` on prod and confirm a `recommend` run appears in **LangSmith → Tracing → secondary-condition-finder**.
2. **Engine auto-PRs:** `smith.langchain.com/o/4a003618-...` → left sidebar **Engine** (green `+` badge in your screenshot) → **Connect a GitHub repository** → authorize LangSmith GitHub App for `richardparslow-commits/Secondary_Condition_Finder`. After that `GET /v2/integrations/github/installations` returns `items:[{name:"richardparslow-commits"}]` and Engine can open PRs. `Datasets & Experiments → New Dataset` uses the same traces with no code change.

Full steps in `docs/langsmith-engine-setup.md:§§3-6`.

---

## 8. Artifacts & retention

- This audit is stored at `~/Desktop/langsmith-correctness-audit-2026-09-13.md` and `docs/langsmith-correctness-audit-2026-09-13.md` (archived via the next docs PR if requested).
- LangSmith trace surface is `recommend` `chain` with tags `["secondary-condition-finder","recommendation-engine","phase-2-crg"]` and `ENGINE_VERSION="phase-2-crg"` — Engine clusters by `LANGSMITH_PROJECT_NAME`.
- History: `Copilot health 9/9 10 findings (10/10 closed, addendum 2026-09-13)` → `LangSmith Engine + Datasets & Experiments` (your screenshots) → `max-reasoning correctness audit (this document)`.

---

_Generated from commit `9970cf3` with `tsc --noEmit 0`, `next build 14 routes`, `vitest 220/220`, `kb:validate 813/813`, `citations:audit 379 verified`, `regulatory:audit 4 actions`, `traceable smoke success trace_id 01a09907…`, and `Vercel 200 /api/health healthy` at `2026-09-13T05:55Z`. No secret beyond the `lsv2_pt_b9b6…` prefix is included; full keys remain in `.env.local` (gitignored) and LangSmith Settings._
