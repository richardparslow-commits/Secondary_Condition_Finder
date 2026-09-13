# Code Health Assessment

**Project:** Secondary

_Generated: 9/9/2026, 10:54:22 AM_

_Produced by [Agiloop](https://agiloop.ai)_

---

## Bugs

### 1. PDF page resource leak in OCR processing on error

**Category:** RESOURCE LEAK | **Severity:** High | **Confidence:** high

In runLocalOcr() (line 383-396 of LocalEvidenceAnalyzer.tsx), if any operation between getPage() and recognize() throws (e.g., getViewport, render, or recognize), the page.cleanup() call is never reached, leaking page resources. This includes exceptions from worker.recognize() or during canvas operations.

**Impact**

OCR failures leave page resources allocated in the browser memory. With large PDFs or repeated OCR attempts, this leads to memory accumulation, potential out-of-memory errors, browser tab crash, or denial of service.

**Location**

/workspace/repo/src/components/evidence/LocalEvidenceAnalyzer.tsx:383-396

**Recommendation: Wrap page operations in try-finally for OCR**

OCR is an expensive operation that should not leave resources allocated on failure. Browser memory is limited, and leaks compound across multiple OCR attempts.

Wrap the page operations (lines 383-395) in a try-finally block to ensure page.cleanup() executes unconditionally after all page processing, regardless of success or exception. The finally block should contain page.cleanup(), ensuring it runs even if getPage, getViewport, render, or worker.recognize fail.

### 2. Silent data loss when evidence storage exceeds size limit

**Category:** DATA INTEGRITY | **Severity:** High | **Confidence:** high

In storage.ts, serializeStoredEvidence() silently drops oldest analyses when the serialized JSON exceeds storedBytes limit (lines 104-113). The UI component commits the analysis and updates state with all items, but only a subset is persisted. On page reload, lost items don't reappear, and the user isn't notified.

**Impact**

Users add evidence that appears to be stored in the UI, but silently loses data on reload if the total size exceeds limits. With multiple large documents (e.g., OCR text), older evidence is discarded without warning, leading to data loss and user confusion about what evidence was analyzed.

**Location**

/workspace/repo/src/lib/evidence/storage.ts:96-113 and /workspace/repo/src/components/evidence/LocalEvidenceAnalyzer.tsx:174-179

**Recommendation: Notify user of storage limit hit and return discarded count**

Data loss should never be silent. Users must be informed when evidence cannot be stored due to size constraints so they can decide to delete older analyses or split documents.

Modify serializeStoredEvidence() to return both the serialized string and a count of dropped analyses. Update commitAnalysis() to check if analyses were dropped and set an error message to notify the user. Display a warning like 'Storage full: older evidence was removed. Consider clearing old analyses to make room.' This gives users visibility into what was lost and why.

### 3. Missing page cleanup in PDF text extraction on size limit breach

**Category:** RESOURCE LEAK | **Severity:** Medium | **Confidence:** medium

In extractPdfEvidence() at line 205, if assertExtractedTextSize() throws an error (text exceeds limit), the loop continues and page.cleanup() at line 210 is still called, which is correct. However, the error pathway breaks out of the loop, and the logic is fragile. If the extracted text size check throws while processing a page, that page remains processed but not explicitly cleaned before the error exits.

**Impact**

When a PDF exceeds character limits mid-extraction, page resources may not be properly cleaned before exiting the extraction loop, though the finally block does destroy the loadingTask. This is a secondary issue compared to uncaught exceptions, but indicates incomplete error handling in page lifecycle.

**Location**

/workspace/repo/src/lib/evidence/document-extract.ts:199-221

**Recommendation: Ensure all page cleanup on size limit errors**

Size limit checks happen after text extraction and could fail. All page resources should be released immediately when detected.

Wrap the page extraction loop (lines 199-211) to guarantee that if assertExtractedTextSize() throws, page.cleanup() runs before the exception propagates. This ensures page resources are freed even when size limits are exceeded. Consider calling page.cleanup() before the assertion check, or adding explicit cleanup in the error handler.

### 4. Form data loss if session write fails silently

**Category:** DATA INTEGRITY | **Severity:** Medium | **Confidence:** medium

In secondary.ts, functions like saveServiceConnectedSelection() and saveRatingsSelection() call writeSecondaryWorkflowSession() without checking return value or error handling. If session persistence fails (e.g., due to secret misconfiguration), the data is discarded and user is redirected to next step, leaving workflow incomplete or corrupted.

**Impact**

If WORKFLOW_SESSION_SECRET is missing or misconfigured in production, session writes fail, and users proceed through the workflow without their choices being persisted. On return to the workflow or page reload, all data is lost.

**Location**

/workspace/repo/src/lib/actions/secondary.ts:85-88, 140-144, 176-180, 199

**Recommendation: Add error handling for session persistence**

Session write failures must not silently lose data. If persistence fails, the user should be informed and the redirect prevented.

Wrap writeSecondaryWorkflowSession() calls in try-catch. On error, set an error message in the response or throw to prevent redirect. Alternatively, ensure workflowSessionSecret() throws early during app startup (not at request time) if required secret is missing, preventing silent failures. Consider adding observability logging when session writes fail.

### 5. Race condition between busyRef and state updates in evidence analyzer

**Category:** CONCURRENCY | **Severity:** Medium | **Confidence:** medium

In LocalEvidenceAnalyzer.tsx, busyRef.current is checked and set (lines 292, 314, 352, 434), but setBusy(true/false) is set asynchronously. Between lines 292-293, another async operation could start because busyRef is true but setBusy hasn't rendered yet. This allows multiple concurrent analysis operations if the user interacts with the UI during state updates.

**Impact**

Two or more analysis operations could run concurrently, causing race conditions in evidence analysis, incorrect state merges in commitAnalysis(), and unpredictable UI state. Multiple OCR workers could be created, exhausting browser memory.

**Location**

/workspace/repo/src/components/evidence/LocalEvidenceAnalyzer.tsx:285-316, 344-438

**Recommendation: Use React state for busy flag instead of ref**

busyRef.current doesn't prevent re-renders or concurrent operations. React state is synchronous within an event handler and prevents UI updates until state is consistent.

Replace busyRef with a useState(false) for busy state. Remove the ref declaration at line 137. Use the state value in conditional checks instead of busyRef.current. This ensures React synchronously prevents UI interactions and state updates until the async operation completes.

### 6. Missing validation of PDF page count in OCR

**Category:** INPUT VALIDATION | **Severity:** Medium | **Confidence:** low

In runLocalOcr() line 379, readLimit is set to Math.min(pdfDocument.numPages, limits.pdfPages), but pdfDocument.numPages is not validated. A malformed PDF could return a negative or extremely large value before Math.min() clamps it, causing unexpected behavior or infinite loops if not handled.

**Impact**

A malicious or corrupted PDF file with invalid metadata could trigger unexpected behavior in the OCR loop, potentially causing browser hang or memory exhaustion if the actual page count doesn't match the declared value.

**Location**

/workspace/repo/src/components/evidence/LocalEvidenceAnalyzer.tsx:379

**Recommendation: Validate PDF page count**

Untrusted PDF metadata should be validated before use in loop bounds.

Add a check after line 377 (await loadingTask.promise) to validate pdfDocument.numPages is a positive integer within expected bounds. Throw an error if numPages is invalid, null, or undefined. For example: if (!Number.isInteger(pdfDocument.numPages) || pdfDocument.numPages <= 0) { throw new Error('Invalid PDF page count'); }'

### 7. Unhandled promise rejection in image rendering

**Category:** ERROR HANDLING | **Severity:** Medium | **Confidence:** low

In runLocalOcr() at line 393, page.render() returns a promise that must be awaited with .promise. If the render operation fails or the canvas context is unavailable (line 388-392 check is insufficient), the error could propagate uncaught, causing the OCR worker to remain in use and potentially leak.

**Impact**

If PDF page rendering fails (e.g., corrupt page, unsupported format, canvas context unavailable), the promise rejection could propagate and terminate the OCR operation ungracefully, leaving the worker in an invalid state.

**Location**

/workspace/repo/src/components/evidence/LocalEvidenceAnalyzer.tsx:388-396

**Recommendation: Add error handling for render failures**

Canvas rendering can fail for various reasons (unsupported formats, memory pressure, corrupt pages). Failures must be caught and handled.

Wrap the page.render() call (line 393) in a try-catch block. If rendering fails, skip the page and add a warning to nextWarnings (similar to lines 208-209 in extractPdfEvidence). Ensure page.cleanup() is still called even if render fails.

### 8. Development secret fallback enabled in production paths

**Category:** CONFIGURATION | **Severity:** High | **Confidence:** high

In workflow-session-crypto.ts line 49, if WORKFLOW_SESSION_SECRET and SECONDARY_WORKFLOW_SESSION_SECRET environment variables are not configured, the function returns DEVELOPMENT_ONLY_SECRET instead of throwing an error. While there's a production check at line 43-46, the development secret is 47 characters and passes the 32-character minimum check, so it could be silently used in production if env vars are missing.

**Impact**

If environment variables are accidentally omitted in production deployment, the hardcoded development secret is used for session encryption, completely defeating security. Sessions become predictable and forgeable since the secret is in source code and known to attackers.

**Location**

/workspace/repo/src/lib/workflow-session-crypto.ts:31-50

**Recommendation: Fail fast on missing production secret**

Production sessions must never fall back to development secrets. Missing configuration should cause immediate, obvious startup failure.

Move the production check outside the configuration check. Change line 43 to check NODE_ENV first: if (process.env.NODE_ENV === 'production' && !configured) throw new Error(...). Then remove the fallback to DEVELOPMENT_ONLY_SECRET when NODE_ENV is production. Add explicit logging when development secret is used (non-production only). Ensure CI/deployment pipelines treat missing WORKFLOW_SESSION_SECRET as a configuration error that blocks deployment.

### 9. Missing timeout on large DOCX parsing

**Category:** RELIABILITY | **Severity:** Medium | **Confidence:** medium

In assertSafeDocxArchive() (lines 79-150), the ZIP central directory parsing has no timeout or operation limit beyond entry count and size checks. A maliciously crafted DOCX with many valid-looking entries could cause the parsing loop (lines 121-145) to run for an extended time, blocking the browser thread.

**Impact**

A user uploading a specially crafted DOCX file with thousands of entries could cause the browser tab to hang during validation, denying service to the application.

**Location**

/workspace/repo/src/lib/evidence/document-extract.ts:121-145

**Recommendation: Add operation timeout for ZIP parsing**

ZIP archives can be adversarially crafted to cause DoS. Parsing should have time limits on browser threads.

Add a maximum entry iteration limit (e.g., 10,000 entries) and reject files that declare more than this. Alternatively, implement async parsing with progress callbacks if the browser supports it. Consider breaking the loop into chunks with yield points to prevent thread blocking on very large archives.

### 10. Incomplete error message on malformed evidence JSON

**Category:** ERROR HANDLING | **Severity:** Low | **Confidence:** low

In storage.ts at line 124, if JSON.parse() throws, the error is caught and an empty array is returned (line 128). The original error is silently discarded, making debugging difficult if stored evidence becomes corrupted or malformed.

**Impact**

If browser session storage becomes corrupted (e.g., due to a bug in serialization or manual modification), users lose all evidence without any error indication, and developers cannot diagnose the issue.

**Location**

/workspace/repo/src/lib/evidence/storage.ts:121-129

**Recommendation: Log parsing errors for observability**

Silently returning empty results hides storage corruption. Errors should be logged for debugging.

In the catch block, add a console.warn() or logging call (if app-wide logging is configured) to log the parse error and the raw storage string (truncated to prevent log spam). For example: console.warn('Failed to parse stored evidence:', error.message). This provides visibility into storage issues without affecting user experience.

## Technical Debt

No technical debt identified.

---

_Generated with [Agiloop](https://agiloop.ai) — AI-native software development._---

## Addendum — 2026-09-13: All 10 findings resolved on `main @ e8f0692`

This addendum was appended on the `main` branch on 2026-09-13 after full verification against live `HEAD`. The Agiloop assessment was generated 9/9 against an older workspace; all findings had been remediated across PRs #407–#423 before PR #426/#427 and were confirmed on `e8f0692`.

### Overall

- **Verification commit:** `e8f0692` `feat(va): exponential backoff retry … (#427)` — `main` post-merge.
- **Gates on `HEAD`:** `tsc --noEmit` `0` · `next build` `14 routes` ✓ · `eslint` `0 errors` (3 pre-existing warnings, `TC:0`/`BUILD:0` re-run 2026-09-13) · `vitest` `220/220` · GH `CI success 3m48s` + `Regulatory Intelligence 29s` + `Production Runtime Readiness 18s` on the exact merge commit.
- **Production:** `https://secondary-condition-finder.vercel.app` `200` (verified live).

### Finding-by-finding

| # | Title | Severity | Resolution | Commits / Tests | Code anchor (`main`) |
|---|-------|----------|------------|-----------------|----------------------|
| 1 | PDF `page.cleanup()` leak in OCR (`runLocalOcr` 383-396) | High | Wrapped OCR page cycle `let page=null` → `try{getPage→getViewport→render→recognize}` → `catch` → `finally{if(page) page.cleanup()}` + outer `finally{worker.terminate()}` + `loadingTask.destroy()`. | `471def9`, `628b393` (`tests/runLocalOcr resource-cleanup contract`) | `src/components/evidence/LocalEvidenceAnalyzer.tsx:469-479,494-497` |
| 2 | Silent data loss when storage exceeds byte limit | High | `serializeStoredEvidenceWithInfo→{serialized,dropped}` trims oldest sources; `commitAnalysis` surfaces `queueMicrotask(setWarnings("Storage limit reached … N older … dropped…"))` + `saveStored`. Legacy `serializeStoredEvidence` retained as alias. | `e202aa1`, `d4a8da0` (`tests/evidence-storage-drop-notice.test.ts`) | `src/lib/evidence/storage.ts:101,113` · `src/components/evidence/LocalEvidenceAnalyzer.tsx:199-204` |
| 3 | `extractPdfEvidence` cleanup on size-limit breach (199-221) | Medium | Per-page `try{ getTextContent→assertExtractedTextSize } finally{ page.cleanup() }` — a `throw` inside `try` cannot skip `finally`; outer `finally{ loadingTask.destroy() }`. | `5b46bf0`, `0bce585` (`tests/*pdf-page-cleanup*`) | `src/lib/evidence/document-extract.ts:206-224` |
| 4 | Unchecked `writeSecondaryWorkflowSession` in Server Actions (85-88, 140-144, 176-180, 199) | Medium | Every forward-advance write now `try{await write…}catch{console.error + auditLog(failure) + redirectValidation(step, code)}` — the validation redirect throws `NEXT_REDIRECT` and never advances. | `9efee8b` (`tests/session-write-failure-contract.test.ts`) + `#386` fail-fast | `src/lib/actions/secondary.ts:85-93,122-136,158-165,201-208` |
| 5 | `busyRef`/`setBusy` race (285-316, 344-438) | Medium | Dual guard is intentional — `busyRef` is the synchronous guard across `await` gaps; `busy` drives the UI. Every entry `stageFiles/clear/remove/runAll/reprocess/runLocalOcr` checks `if(busyRef.current \|\| busy) return` and sets `busyRef=true; setBusy(true)` before any `await`, resetting in `finally`. The report's "replace ref with state" would *re-introduce* the gap; current design is the fix. | `796ff96`, `evidence-storage-parse-warning.test.ts:171` (`busyRef guard at every entry point`) | `src/components/evidence/LocalEvidenceAnalyzer.tsx:140,233,260,267,318,351,377` |
| 6 | Unvalidated `numPages` in OCR (line 379) | Medium | Validated before use as loop bound: `if(!Number.isInteger(totalPages)\|\|totalPages<=0) throw "Invalid PDF page count"`. | `796ff96` | `src/components/evidence/LocalEvidenceAnalyzer.tsx:414` |
| 7 | Unhandled `page.render().promise` rejection (388-396) | Medium | `try{await page.render().promise} catch{ warn("page N render failed…skipped") continue }` and `try{await worker.recognize} catch{ warn("OCR recognition failed…skipped") continue }`; page still hits `finally cleanup`. | `471def9` → `628b393` | `src/components/evidence/LocalEvidenceAnalyzer.tsx:435-443` |
| 8 | Production fallback to `DEVELOPMENT_ONLY_SECRET` (31-50) | High | `workflowSessionSecret()` → `if(configured≥32) return; if(NODE_ENV===production) throw (must be ≥32 in production); if(NODE_ENV!==test) warn; return DEVELOPMENT_ONLY_SECRET`. `seal/open` also reject `<32`. `workflowSessionRuntimeReady()` is prod-only. | `471def9`, `5caaff4` (`tests/secret-fallback-contract`, `deployment-readiness`) | `src/lib/workflow-session-crypto.ts:31-54,80-129` |
| 9 | `assertSafeDocxArchive` no iteration/time bound (121-145) | Medium | `maxIterations=Math.min(totalEntries, limits.docxEntries, 2000)` hard ceiling + early `totalEntries>docxEntries` reject + ZIP64/multi-disk + `declaredUncompressedBytes` cap; fails *before* `mammoth` decompression. | `471def9` (`tests/docx/text extractor failure paths`) | `src/lib/evidence/document-extract.ts:107,122-124` |
| 10 | Silent `JSON.parse` catch in `storage.ts:121-129` | Low | Added `loadStoredEvidenceWithWarning` → `console.warn("[evidence-storage] …", message, raw.slice(0,500))` + `{analyses:[],parseError}`. Restores via `WithWarning` and surfaces `STORAGE_CORRUPTED_WARNING` in `warnings` state. Legacy `loadStoredEvidence` kept fail-closed `catch{return[]}` for compat. | `796ff96` + `tests/evidence-storage-parse-warning.test.ts` | `src/lib/evidence/storage.ts:145,167` · `src/components/evidence/LocalEvidenceAnalyzer.tsx:87,142-172` |

### Remediation timeline (#407–#423)

`471def9` readiness hardening (breaker/limits) → `5b46bf0` (PDF cleanup) → `628b393` (OCR cleanup) → `d4a8da0` (drop notice) → `796ff96` (storage corruption + busy/page-count observability) → `5caaff4`/`0bce585`/`9efee8b` contract pins → #426 (port consistency) → #427 (VA exponential backoff + Regulations.gov retry + docs parity).

### Backlog

No technical-debt item was filed by the assessment. The document is archived under `docs/secondary-code-health-assessment-2026-09-13.md` (version-controlled copy); the Desktop original remains at `~/Desktop/secondary-code-health-assessment-2026-09-13.md` with this addendum to be copied to it.

---

## Addendum — 2026-09-13 (Performance findings #4–#5): Formal close-out on `main @ 77bd34e`

This addendum formally closes the separate performance assessment findings **#4** and **#5**, which were tracked outside the 10 Agiloop code-health findings above. Both were remediated before this verification and confirmed on live `HEAD`. No further code change is required — this addendum only documents verification.

### Overall

- **Verification commit:** `77bd34e` `fix(performance): parse evidence session payload once per Step 6 via context provider (#434)` — `main` post-merge (includes `fbe5a9d` `perf: reduce Step 1/5 request overhead and cache VA form reference (#433)`).
- **Gates re-verified 2026-09-13 on `77bd34e`:** `tsc --noEmit` `0` · `vitest` `va-form-reference`+`va-reference-product-surface`+`medium-runtime-hardening` `16/16` (full suite `220/220` on the `e8f0692` baseline, unchanged on `77bd34e` — no regressions) · `next build` `14 routes` on prior baseline.
- **Production:** `https://secondary-condition-finder.vercel.app` `200` (verified via first addendum; no route/config change in this window).
- **Assessment issue line numbers are pre-fix:** the citations (`/src/app/va-forms/page.tsx:11,18-20`, `/src/lib/va/form-reference.ts:38-43`, `/src/lib/va/forms-finder.ts:48-51,95`) pointed at the pre-`fbe5a9d` state; the same paths now contain the cache preamble below.

### Finding-by-finding

| # | Title | Severity | Resolution | Commits / Tests | Code anchor (`main @ 77bd34e`) |
|---|-------|----------|------------|-----------------|-------------------------------|
| 4 | Repeated `JSON.parse` of same `sessionStorage` payload across many gap chips — Step 6 renders one chip per evidence gap; extended mode can retain ~3 MB | Medium | Added client `EvidenceAnalysesProvider` that reads `evidenceAnalysisStorageKey` once via `useSyncExternalStore` and parses once with memoized `parseStoredEvidenceAnalyses`; `EvidenceGapCoverage` chips consume the shared array via `useEvidenceAnalyses()` (fallback: local `snapshot`+`parseStoredEvidenceAnalyses(snapshot)` when rendered standalone without a provider so the chip still fails-closed). The `Evidence by Non-Service-Connected Diagnosis` card in `src/app/secondary/evidence/page.tsx` is now wrapped with `<EvidenceAnalysesProvider>` so `M = recommendations × avg gaps` chips share the single parse. Matches remediation: "parse once in parent and pass structured analyses/context to children (or via context/provider)." | `77bd34e` (#434) · `EvidenceGapCoverage` + pathway-mapper suites | `src/components/evidence/EvidenceAnalysesProvider.tsx` (new, 92 lines, `server-only` cache-consumer is not needed — client `sessionStorage` path) · `src/components/evidence/EvidenceGapCoverage.tsx` (now context consumer, no per-chip `JSON.parse`) · `src/app/secondary/evidence/page.tsx` (provider wrap around diagnosis card) |
| 5 | `/va-forms` page does uncached upstream fetch on each request — `force-dynamic` loader called `fetchVaForms` directly, no shared cache | Medium | **Already remediated in `fbe5a9d` (#433) before #4.** `loadClaimFormReference` now reuses the shared bounded VA reference cache pattern cited in the remediation (`src/lib/va/forms-finder.ts:48-51,95`): per-environment singleton `forms:reference:${environment}`, `readVaReferenceCache`/`writeVaReferenceCache` with the same `5 * 60 * 1_000` TTL, `32`-entry LRU, `vaProcessLocalStateAllowed()` fail-closed and `fetcher === fetchVaForms` guard to keep test-injected fetchers uncached. Upstream VA Forms calls are bounded to **once per 5 min per env** regardless of page-hit rate, retries, or timeouts. `export const dynamic = "force-dynamic"` is retained intentionally — it is consistent with every sibling VA public-reference surface (`/va-forms/finder`, `/va-reference`, `/va-reference/service-branches`) and with health/regulatory probes; the in-process cache already provides the requested revalidation semantics, so adding a Next `revalidate`/`unstable_cache` layer would be redundant. | `fbe5a9d` (#433) — verified still present on `77bd34e` · `tests/va-form-reference.test.ts`, `tests/va-reference-product-surface.test.ts` (`"uses one shared bounded cache"`), `tests/medium-runtime-hardening.test.ts` | `src/lib/va/form-reference.ts:45-60` (cache preamble + `useSharedCache` guard) · `src/lib/va/reference-cache.ts:14` (`VA_REFERENCE_CACHE_TTL_MS = 5 * 60 * 1_000`) · `src/app/va-forms/page.tsx:11` (`force-dynamic` — intentional) |

### Close-out

- Both performance findings are formally **CLOSED** — no code change in this commit beyond this documentation.
- The version-controlled copy is `docs/secondary-code-health-assessment-2026-09-13.md`; the Desktop original at `~/Desktop/secondary-code-health-assessment-2026-09-13.md` is to be synced with this version after merge, same as the first addendum.
- Any future VA reference change should keep `form-reference.ts` on the shared `reference-cache` path and should not move `/va-forms` away from `force-dynamic` without re-establishing the 5-min cache contract.

---

## Addendum — 2026-09-13 (Performance finding #6): Cold-start sync filesystem reads — remediation on `main`

This addendum closes performance finding **#6**"Synchronous filesystem reads on request path can block event loop during cold starts" (`src/lib/catalog/load.ts:21-31`, `src/lib/kb/load.ts:29-37`, `src/lib/presumptive/load.ts:25-33`, `src/lib/regulatory/load.ts:15-18`).

### Diagnosis

Each of the four loaders (`loadConditionCatalog`, `loadKnowledgeBase`, `loadExposureCatalog`, `loadRegulatoryActionRegistry`) did `readdirSync` + N × `readFileSync` + Zod + cross-catalog validation inside the first user's request handler (cold Lambda/Vercel start, cache reset, test reload). `data/knowledge-base` holds 800+ JSON files; blocking the entire Node worker for that wall-clock hurts first-request TTFB and couples cold-start latency to file count.

### Remediation (keeps existing sync contract; adds async startup preload)

- **Async variants with promise dedup** added to all four loaders: `loadConditionCatalogAsync`, `loadKnowledgeBaseAsync`, `loadExposureCatalogAsync`, `loadRegulatoryActionRegistryAsync` plus `loadPublishedMappingIdsAsync`. Each shares the same module-level `cached`/`inflight` as its sync sibling so the first writer wins. Concurrent calls while `inflight` is pending return the same promise (no `N × file-count` parallel-read fanout). Cached hits return via `Promise.resolve(cached)` so they are microtask-fast. Test seams now reset both `cached` and `inflight` (`resetConditionCatalogCache` etc.). The async path uses `fs/promises` (`readdir`/`readFile`/`access`) — no blocking work on the event loop.
- **New module `src/lib/data/preload.ts`** — `warmupDataCaches()` / `awaitDataWarmup()` / `resetDataWarmupState()`. Loads catalog first (KB cross-validates against it), then `Promise.all([KB, presumptives, regulatory])`. Best-effort: logs on failure but never throws, so the sync fallback remains. Idempotent via `warmupStarted` dedupe. `doWarmup` timing is logged as `[data-preload] warmup complete in Nms` for cold-start observability.
- **`src/instrumentation.ts` `register()`** — now fire-and-forgets `import("@/lib/data/preload").then(({warmupDataCaches}) => warmupDataCaches())`. `register()` is the Next.js server-startup hook that runs once per worker before any request, so a completed warmup turns the first `force-dynamic` request (Step 1/4/5, `/secondary/suggestions`, `/secondary/evidence`, `/presumptive/results`, etc.) into a pure memory hit. Dynamic import keeps the preload module out of the `next build` collection phase and avoids circular-eager loading; no `require()`.
- **No request-path migration required.** Pages still call the sync `loadConditionCatalog()` etc.; the async warmup is purely an optimization that fills the same caches.  `preserve` of sync path avoids a wide `await` refactor and keeps `kb:validate` / `regulatory:validate` scripts and `vitest` suites on their existing sync contracts.
- **Tests:** `tests/data-preload.test.ts` (6 cases) — all four caches populated after warmup, same cache object between async and sync paths, concurrent-warmup dedupe, `awaitDataWarmup` no-op before start, `instrumentation.ts` hook assertion (`import("@/lib/data/preload")`, no `require`), and per-loader `inflight` promise dedupe + reset.
- **Build note:** remediation follows the issue's second suggestion — "async startup preload; keep in-memory cache but reduce sync work in first user request." A full build-time artifact generation (pre-validated JSON blob) remains a compatible future step — the async warmup already isolates filesystem + parse + validation, so a future artifact can replace just `readCatalog()`/`readKnowledgeBase()` with a single `readFile` of the generated artifact without touching pages. The current fix delivers the cold-start win with minimal churn and zero spec risk.

### Verification

- `tsc --noEmit` `0` · `next build` `14 routes` (ƒ) + proxy · `vitest` `222/222` `1314/1314` including `data-preload` `6/6` — confirmed on `HEAD` before this commit via `npx vitest run --reporter=dot` (full suite) and `npx vitest run tests/data-preload.test.ts`.
- `warmup complete in ~1.5–4.8s` observed in `vitest` run — consistent with warm `fs/promises` on the runner; production cold-start savings scale with the prior sync blocking wall-clock it replaces.
- `Vercel` and `verify`/`verify-regulatory-intelligence` gates are unaffected — warmup runs only in the Node server runtime via `instrumentation.ts` (not in edge), and no page moves away from `force-dynamic` or changes its data contract.

### Code anchors (`main` after this PR)

- `src/lib/catalog/load.ts` — `loadConditionCatalogAsync`, shared `cached`/`inflight`, `fs/promises` in `readCatalog()`
- `src/lib/kb/load.ts` — `loadKnowledgeBaseAsync` + `loadPublishedMappingIdsAsync`, `readKnowledgeBase` awaits `loadConditionCatalogAsync()` for validation, shared caches
- `src/lib/presumptive/load.ts` — `loadExposureCatalogAsync`, `fs/promises` in `readExposureCatalog()`
- `src/lib/regulatory/load.ts` — `loadRegulatoryActionRegistryAsync`, `fsp.access` + `fsp.readdir`/`readFile` in `readRegulatoryActionRegistry()`
- `src/lib/data/preload.ts` — `warmupDataCaches` / `awaitDataWarmup` / `resetDataWarmupState`
- `src/instrumentation.ts` — `import("@/lib/data/preload")` in `register()`
- `tests/data-preload.test.ts` — contract for finding #6

### Close-out

- Finding **#6** is **CLOSED** — implemented via instrumentation warmup + async preload, verified by `typecheck` + `build` + `vitest` `222/222`.
- The sync loaders remain the request-path entry points; no page required an `await` migration.
- If a future build-time artifact is desired, it should replace the filesystem-scan helpers (`readCatalog` etc.) with a single artifact read while keeping `warmupDataCaches` and the `register()` hook unchanged.

---

## Addendum — 2026-09-13 (Performance finding #1): Timeline bundle eagerly included in list view — lazy-loaded on demand

This addendum closes performance finding **#1** "Timeline bundle loaded even when List view is active" (`src/components/secondary/SecondarySuggestionsTabs.tsx:5-9` statically importing `ConditionTimelineVisualization`, default tab `"list"` at `:24`).

### Diagnosis

Step 5 (`/secondary/suggestions`) defaults to `"list"` — the chronology view is an alternate. The prior `SecondarySuggestionsTabs` did a top-level `import { ConditionTimelineVisualization } from "./ConditionTimelineVisualization"`, so every `/secondary/suggestions` hit paid the client JS for the full interactive SVG timeline (zoom/pan state, tooltip/hit-area logic, PNG export via canvas `toBlob`, large inline SVG + tables) even for list-only users. No `next/dynamic` / `React.lazy` was in use on the project.

### Remediation — `next/dynamic` + on-demand mount

- `src/components/secondary/SecondarySuggestionsTabs.tsx` now uses `next/dynamic(() => import("./ConditionTimelineVisualization").then((m) => m.ConditionTimelineVisualization), { ssr: false, loading: () => <p>Loading timeline…</p> })`. The import is a type-only `import type` for the `Timeline*Input` props — no runtime dependency on the viz module. `ssr: false` wraps it in a CSR bail-out (also keeps any `window`/`canvas` usage — `devicePixelRatio`, `Blob`/`URL.createObjectURL`, `canvas.toBlob` — safely off the server/edge).
- The timeline is only mounted when the tab is active: `{active === "timeline" ? <ConditionTimelineVisualization … /> : null}` inside the `panel-timeline` (which retains the `hidden` + `className="hidden"` guard). So initial render of a list-view user carries no timeline bundle at all — the chunk is fetched on first "Timeline" click. Once loaded, it is cached by the browser for subsequent tab flips.
- The `loading` fallback is a plain `<p>` with `aria-live="polite"` + `aria-busy="true"` so the role/tab-panel a11y contract is preserved during the async tick and no extra design debt is added.
- No change to `src/app/secondary/suggestions/page.tsx` data plumbing — `timelineConditions` / `timelineConnections` / `datedCount` are still derived server-side before the tabs (same props), and the `Timeline` tab badge (`add years` vs. `"N conditions"`) stays synchronous so users still see at a glance whether the view is useful. `ConditionTimelineVisualization.tsx` itself is untouched (still `"use client"`, same SVG + zoom, `select-none`, `Download SVG/PNG`, `details` text alternative).
- Bundle evidence: before the change, `page_client-reference-manifest.js` listed `CitationDeepDiveExplorer`…`RatingGuide` but the viz was inlined with them (all sharing the single `2ngo8ifua99p_.js` page chunk). After: `SecondarySuggestionsTabs` renders via `next/dist/shared/lib/app-dynamic`'s `Loadable` (`BailoutToCSR` → `Suspense` with the loading fallback) and the manifest keeps `SecondarySuggestionsTabs` as a thin wrapper — the viz module's SVG/canvas/download code is now a separate lazy chunk that is not in the initial `entryJSFiles["/secondary/suggestions/page"]` set and is only `preload(..., { fetchPriority: "low" })` when the chunk is requested.

### Verification

- `tsc --noEmit` `0` · `eslint SecondarySuggestionsTabs.tsx` `0` · `next build` `14 routes` (ƒ) + proxy `0` — `grep -r ConditionTimelineVisualization .next/server` confirms the viz no longer appears in `page_client-reference-manifest.js` `clientModules` and appears only through the `app-dynamic` `Loadable`/`BailoutToCSR` path (CSS/JS `preload` via `low` priority).
- `vitest` `222/222` `1314/1314` (no new suite needed — behavior is identical; only bundle split changes). No `force-dynamic` / `revalidate` change; Step 5 remains `force-dynamic` and `SecondarySuggestionsTabs` stays `"use client"`.

### Code anchors (`main` after this PR)

- `src/components/secondary/SecondarySuggestionsTabs.tsx` — `dynamic(() => import("./ConditionTimelineVisualization"), { ssr:false, loading })` + `active === "timeline" ? <ConditionTimelineVisualization …/> : null` guard
- `src/components/secondary/ConditionTimelineVisualization.tsx` — unchanged (client viz, SVG + zoom + `devicePixelRatio`/`canvas`/`URL` usage kept in the lazy chunk)
- `src/app/secondary/suggestions/page.tsx:13-195` — unchanged props/data path, badge stays eager

### Close-out

- Finding **#1** is **CLOSED** — implemented via `next/dynamic` lazy-load, verified by `typecheck` + `build` + `vitest` `222/222`. Default list-view users no longer pay the timeline JS.
- A future refinement can add `dynamic(..., { ssr: false })` coverage to other heavy `"use client"` secondary panels if the same pattern recurs; keep the tab-badge props eager so users can decide before loading.

---

## Addendum — 2026-09-13 (Performance finding #2): Pathway evidence mapping pre-index — verified already remediated on `main`

This addendum formally closes performance finding **#2** "Pathway evidence mapping may get CPU-heavy at upper bounds" (nested loops `src/lib/evidence/pathway-mapper.ts:145-214` over every `analyses × excerpts × contributingPrimaries`, with extended retention up to `src/lib/evidence/limits.ts:61-73` `EXTENDED_LIMITS` 200 sources × 10 excerpts = 2,000 excerpts + 3 MB serialized).

### Diagnosis (pre-#432)

The pre-fix `mapEvidenceToPathways` did for every `(result, primary)` pair: `for (analysis of analyses) for (excerpt of analysis.excerpts) if (!excerptMatchesPrimary(excerpt.matchedTerms, primaryTerms)) continue` where `excerptMatchesPrimary` did `primaryTerms.map(normalizeTerm)` on each call and then `matchedTerms.some(normalizedCandidates.includes)`. That is `O(P × N)` with repeated `normalizeTerm` on the same strings (P = pathway rows, N = total excerpts). At the extended bound this is ~hundreds of primaries × 2,000 excerpts of redundant normalization + linear scans on the client main thread (Step 6 `PathwayEvidenceMapper` is `"use client"` + `useMemo` under `EvidenceAnalysesProvider`).

### Remediation — already on `main` via `4f2a521` (#432)

`src/lib/evidence/pathway-mapper.ts` on `HEAD` (`78bac56`) already implements exactly the remediation requested — "pre-index excerpts by matched term/category once, then map pathways against index":

- New once-per-call `indexExcerptsByMatchedTerm(analyses): Map<string, IndexedExcerpt[]>` — single linear pass over all `analyses × excerpts`, building `Map<normalizedMatchedTerm, IndexedExcerpt[]>` where each `IndexedExcerpt = { analysis, index, sequence }` preserves original document order via a monotonic `sequence`. Per-excerpt `matchedTerms` are deduped via `new Set(matchedTerms.map(normalizeTerm).filter(Boolean))` so each excerpt contributes at most one entry per distinct normalized term.
- Per-pathway `primaryTerms` are pre-normalized once into `Set<string>` (`new Set(buildPrimaryConditionTerms(primary).map(normalizeTerm).filter(Boolean))`) — matching the finding's "pre-index by matched term" verbatim. `buildPrimaryConditionTerms` itself is O(1) (name + hyphen-split id tokens ≥4).
- Candidates are collected by hash lookup, not scan: `for (term of primaryTerms) { excerpts = index.get(term); for (entry of excerpts) candidates.set(sequence, entry) }` — `O(sum per-primary distinct terms × posting-list length)` instead of `O(N)` per row. `Map<number, IndexedExcerpt>` on `sequence` dedupes an excerpt that was indexed under multiple terms, then `[...candidates.entries()].sort((a,b)=>a[0]-b[0])` recovers insertion order (identical to the original nested-loop order) without re-scanning.
- Downstream classification is unchanged (`theoryAllowsDirect` / `SUPPORTING_CATEGORIES` / `CAUSAL_CATEGORIES` + `seen` dedup on `category:quote:locator`) — the change is purely indexing, preserving research-cue semantics and the `"use client"` `PathwayEvidenceMapper` contract (`useMemo(() => mapEvidenceToPathways(results, analyses), [results, analyses])`).

This is equivalent to "pre-index excerpts by matched term/category once, then map pathways against index" with `category` partitioning deferred to the final tier classification (which is O(candidates), not O(N)). Adding a second-level `Map<category, Map<term, …>>` index would not materially reduce work because the per-row category check is a constant-time `Set.has`.

### Verification on `HEAD` (`78bac56`)

- `git log --all -- src/lib/evidence/pathway-mapper.ts` shows `4f2a521 Remediate high-severity performance hot paths … (#432)` is already on `main` — three releases before this addendum.
- `src/lib/evidence/pathway-mapper.ts:73-115` (`indexExcerptsByMatchedTerm` + `sequence`) + `145-214` (`excerptsByMatchedTerm` singleton → per-primary hash lookup → stable sort → tier) are verbatim the post-`4f2a521` structure. The prior `excerptMatchesPrimary` helper referenced in the ticket no longer exists.
- `tsc --noEmit` `0` · `next build` `14 routes` (ƒ) + proxy `0` on `78bac56` before this doc change (re-run at addendum authoring) · `vitest` `222/222` `1314/1314` (including `tests/pathway-evidence-mapper.test.ts` 7 suites + `tests/performance-high-remediation.test.ts` 3 suites that explicitly assert the index/single-pass contract: "indexes excerpts by normalized matched term and maps pathways against the index (single excerpt scan)"). No behavior change, no new suite needed.
- `src/components/evidence/PathwayEvidenceMapper.tsx:107` stays `useMemo(() => mapEvidenceToPathways…)` over the already-single-parse `analyses` from `EvidenceAnalysesProvider` (finding #4) — the two findings compose.

### Code anchors (`main` after this PR — unchanged code, only this doc)

- `src/lib/evidence/pathway-mapper.ts:86-115` — `IndexedExcerpt` + `indexExcerptsByMatchedTerm` (once-per-call `Map<string, IndexedExcerpt[]>`)
- `src/lib/evidence/pathway-mapper.ts:132-145` — `buildPrimaryConditionTerms` (name + id-token terms)
- `src/lib/evidence/pathway-mapper.ts:145-215` — `mapEvidenceToPathways` (shared index → `candidates Map<sequence, …>` → stable sort → `direct/supporting/related` tier)
- `src/components/evidence/PathwayEvidenceMapper.tsx:107` — `useMemo` consumer on Step 6
- `src/lib/evidence/limits.ts:61-73` — `EXTENDED_LIMITS` upper bound that motivates the index (unchanged bound)
- `tests/pathway-evidence-mapper.test.ts` + `tests/performance-high-remediation.test.ts` — index contract pins

### Close-out

- Finding **#2** is **CLOSED** — remediated in `4f2a521` (#432), verified still present on `78bac56` (no code change in this commit beyond this documentation; `vitest` 222/222 re-confirmed). The "nested loops at 145-214" evidence snippet now points at the indexed implementation, not the pre-#432 scan.
- Any future pathway-mapping change should keep `indexExcerptsByMatchedTerm` (or an equivalent `Map<term, …>` pre-index) at the top of `mapEvidenceToPathways`; removing it re-introduces the `O(P × N)` client cost that extended retention (200 sources) exposes.

