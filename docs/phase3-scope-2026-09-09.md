# Phase 3 Scope — Secondary Condition Finder

**Date:** 2026-09-09
**Status:** Scoping (gated — not yet branched)
**Context:** Ideas #8 (Accredited Representative & VSO Locator) and #9 (DD-214 Auto-Parser for Service History) from `secondary-feature-ideas-2026-09-09.md`. Both deferred from Phase 1/2 for privacy and VA-integration gating. Specs are at v1.2 (`0881598` → `a6bed87` + Phase 1 `01ac471` + Phase 2 `a6bed87`, docs bump in this branch).

Phase 1+2 left the product at 6-step secondary, presumptive exposure matcher, browser-local evidence (`sessionStorage` tab-only, `connect-src 'self'`, `audit:evidence-architecture` enforced), regulatory snapshot-locking, VA Forms/Benefits reference behind `VA_API_ENABLED=false` local fallback, and five new research aids (`medical-record-checklist`, `condition-comparison`, `combination-insights`, `rating-guide`, `action-plan`) projecting authored KB/catalog only.

---

## Recommendation

**Ship #8 first. Gate #9 behind a dedicated PII/SSN privacy review.**

| Dimension | #8 VSO / Accredited Rep Locator | #9 DD-214 Auto-Parser |
|---|---|---|
| Value | Unblocks the most common drop-off: "review with a qualified provider or accredited representative" has no next step today. | Removes manual service-history entry for presumptive flow; high friction for multi-deployment histories. |
| Privacy/PII risk | **Low** — Zip → public directory lookup; no Veteran PII persisted. Key risk is location inference stored in logs. | **High** — DD-214 contains SSN (full or last-4), service number, character of discharge, separation authority. Browser-local OCR still needs SSN masking before any rendering, retention cap, and an explicit verification gate that the extracted dates/locations are not auto-trusted. |
| Architecture fit | Extends `src/lib/va/` adapter you already gate (`VA_API_ENABLED`, 5-min LRU-32, `60/min` outbound budget, `circuit-breaker 5→open 60s→half-open`, `vaProcessLocalStateAllowed` fail-closed in prod/distributed, `reference-cache`, `sandbox` https-origin `apikey` validation). Same pattern as `disability-reference`/`forms-finder`. | Extends browser-local evidence stack (`document-extract.ts` `assertSafeDocxArchive`/`pdfjs-dist` `Tesseract.js` scale 2 + `page.cleanup()` in `finally` + `limits.ts` Standard/Extended). Must **not** send bytes to a server/LLM — enforce with `audit:evidence-architecture` + `ingestion-privacy` the way `LocalEvidenceAnalyzer` is enforced today. |
| External dependency | VA OGC Accreditation API (public) or `api.va.gov` equivalent must be endorsed by VA compliance before keys are issued. Until endorsed, keep `localFallback` parity tested (`source:"local-fallback"` contract). | None if browser-local; Tesseract language data already ships under `/public/tesseract/`. If you later consider server OCR/LLM, that's a new PII scope and retention policy and violates current `connect-src 'self'` — reject that variant. |
| Effort | **M** (~1 week) | **M–L** (~1–2 weeks) with privacy review overhead |
| Compliance prereq | `security-operations` review for `VA_*_BASE_URL` allowlist + outbound budget bump, but no new PII handling. | `security-operations` + `evidence-architecture` audit update + manual test plan for SSN redaction and failure modes. |

Bottom line: #8 is shippable inside the existing VA adapter contract; #9 is valuable but demands a redaction-and-review discipline before it touches a branch.

---

## Idea #8 — Accredited Representative & VSO Locator (ship first)

### User story

"On Steps 5 or 6 (or presumptive results), the research report says to talk to a VSO/accredited rep — let me find one near me without leaving the app."

### UX (gated behind existing workflow state, not on the homepage cold start)

- Entry points: `SuggestionsStepPage` and `EvidenceReviewStepPage` after `buildNonServiceConnectedConditionResults`, plus `/presumptive/results` (when `matchPresumptives` produced results). A `Find Help Near You` card with zip-code input. Not a new numbered step; it's an optional aid like `RatingGuide`/`ActionPlan` — page still renders without it and without blocking `recommend()`.
- Input: US zip (5 digits, `^[0-9]{5}$`), optional distance/filter chips (`VSO` | `Accredited Agent` | `Attorney`). Submit via Server Action `searchRepresentatives(FormData)` isomorphic to `saveServiceHistory` — validated before any fetch.
- Output: List cards `Name | Org (VSO) | Distance | Phone | Website | Accreditation badge + `sourceLabel`/`environment`/`cacheStatus` (`hit`/`miss`/`local-fallback`) + freshness notice mirroring `DisabilityReferenceExplorer`. Empty state: "No accredited representatives found within X miles — try a larger radius or search `va.gov/ogc/apps/accreditation`."
- Privacy copy: "Search is a public directory lookup; your workflow selections and evidence are not sent with this request." Zip is used only for the lookup; result is not persisted to the workflow cookie.

### Data & service design

Reuse `src/lib/va/` contract; do not invent a second VA integration.

- New module `src/lib/va/accredited-representatives.ts` mirroring `disability-reference.ts`:
  - Zod `AccreditedRepresentative { id, name, organization?, accreditationType: "VSO"|"agent"|"attorney", phone?, website?, address?, zip, distanceMiles? }` + `SearchParams { zip, radiusMiles?, type? }` (bounds: `radiusMiles` 25/50/100, `APPROVED_RADIUS_MILES` set).
  - Adapter `fetchAccreditedRepresentatives(params, config)` in `sandbox.ts` family: `loadVaApiConfig` → `VA_API_ENABLED` gate → `vaProcessLocalStateAllowed()` distributed fail-closed → `isCircuitOpen("accredited-representatives")` → key/baseUrl validation (new env pair `VA_ACCREDITED_REP_*_API_KEY` + `*_BASE_URL` bound to `https://sandbox-api.va.gov` / `https://api.va.gov` origin check reused from `loadVaApiConfig`) → `claimOutboundRequestSlot(service)` (`60/min` window, same `VA_API_OUTBOUND_*` budget) → `fetch` with `apikey`+`X-Request-ID`+`AbortController` (`VA_API_TIMEOUT_MS=4000`) → one delayed retry only for `503/504`/`timeout`/`network-error` (`VA_API_RETRY_DELAY_MS=100`) → `recordVaApiLatency`/`recordVaApiError` + `recordCircuit*`.
  - Cache `src/lib/va/reference-cache.ts` reuse: key `accredited-rep:{env}:{zip}:{radius}:{type}`, TTL `VA_REFERENCE_CACHE_TTL_MS=300000` (5 min), LRU-32 cap, `MAX_KEY_LENGTH=256`, fail-closed when `vaProcessLocalStateAllowed()==false`.
  - Local fallback `localFallbackAccreditedReps()` mirroring `localFallback()` — empty result set with `live:false`, `source:"local-fallback"`, and copy "Directory is unavailable in local fallback. Search VA's OGC directory on `va.gov`."
- Feature flag: introduce `VA_ACCREDITED_REP_ENABLED` in addition to generic `VA_API_ENABLED` so the locator can be enabled independently of `va-forms`/`benefits-reference-data` during rollout.

### Integration points

- Server Action `src/lib/actions/accredited-representatives.ts` `searchRepresentatives(FormData)` — zip/radius/type via Zod + `redirectValidation` style codes `invalid-zip`/`invalid-radius`/`rate-limited`/`circuit-open` → `?error=` consumed by `SecondaryValidationQueryAlert`-style alert with `role=alert`.
- Component `src/components/va/AccreditedRepresentativeFinder.tsx` (`use client` search form + results; mirrors `DisabilityReferenceExplorer` but with distance/type filters).
- Route placement: `src/app/secondary/suggestions/page.tsx` and `src/app/secondary/evidence/page.tsx` import + render below `ActionPlan` (so prints include it); `src/app/presumptive/results/page.tsx` imports for presumptive cohort. All three read the cached-across-requests server helper `loadAccreditedRepresentatives` (server-only) the way `loadDisabilityReference` is called today.
- Health: extend `src/app/api/health/route.ts` `circuitBreaker` snapshot to include `accredited-representatives: {state}`.

### Compliance & gates

- `src/lib/va/sandbox.ts` outbound budget verbiage is already `vaProcessLocalStateAllowed` fail-closed; extend the error constant message if VA requires distinct allowlisting.
- Add `npm run test:composition` rule: any `"use client"` component must not import `accredited-representatives.ts` parse/fetch internals directly — go through the server action boundary.
- Extend `privacy` page with a locator-specific retention note: zip is not persisted, cached directory results are public directory data, not Veteran PII.

### Tests

- Unit: `tests/accredited-representative-lookup.test.ts` — schema, `localFallback` shape, cache key & LRU eviction contract, origin-https validation, retry budget.
- Integration: `tests/va-circuit-breaker.test.ts` extended with `accredited-representatives` service key; `tests/reference-cache.test.ts` with new prefix.
- Accessibility: `SecondaryValidationQueryAlert` path for `invalid-zip` etc.

### Rollout

Disabled by default (`VA_ACCREDITED_REP_ENABLED=false`). Preview uses sandbox keys + 5-min cache; production waits on the same shared-coordinator gate as `#287` for distributed runtimes.

---

## Idea #9 — DD-214 Auto-Parser for Service History (gated, browser-local only)

### User story

"In `/presumptive` intake, let me upload my DD-214 so the service dates, branch, and locations prefill — I fix any mistakes before it touches the matcher."

### UX (presumptive intake only — never in secondary history)

- Intake `src/app/presumptive/page.tsx` gains an upload card next to `ServiceHistoryForm` + `ServiceHistoryTemplateLibrary`: `Upload DD-214 (PDF or image)` with helper copy "DD-214 data is extracted by OCR; verify dates and locations for accuracy before proceeding. SSN is masked and never sent to a server."
- After extraction, a `Verify your service history` review form pre-populated with extracted fields (editable). Explicit `Confirm and continue` button posts to existing `saveServiceHistory(FormData)` — the parser never writes the workflow cookie directly. Failure path falls back to manual entry without blocking the route.
- Privacy affordances: SSN field shown as `XXX-XX-1234` masked preview with a secondary `Show` toggle that reads from the in-memory extraction only (never into `sessionStorage`/`cookie`/`audit log`). A `Clear uploaded DD-214 from this tab` button wipes the in-memory bytes, fabric canvas, and the `sessionStorage` preview key if one was staged.

### Data & service design — strictly browser-local

- New module `src/lib/evidence/dd214-extract.ts` in the `evidence/` boundary (`browser-local only`, `audit:evidence-architecture` must pass):
  - Types `Dd214Extraction { rawText, fields: { serviceBranchCodes?: string[], serviceStart?: string|null (ISO), serviceEnd?: string|null (ISO), locations: string[], maskedSsn?: string }, warnings: string[], locator: { page, bbox? } }`. No `fullSsn` field — extraction masks before returning.
  - Pipeline mirrors `LocalEvidenceAnalyzer`'s `pending[]` + `busyRef||busy` + `runLocalOcr` contract:
    1. File guard via existing `assertFileSize`/`assertExtractedTextSize` + `limits.ts` Standard/Extended toggle already on Step 4 (reuse `EVIDENCE_DEPTH_LIMITS` selector on presumptive intake for parity).
    2. PDF path: `pdfjs-dist` → per-page `getViewport({scale: 2})` render to canvas → `Tesseract.js` `worker.recognize(canvas)` → `page.cleanup()` in `finally`, `worker.terminate()`/`loadingTask.destroy()` in outer `finally` (identical to `LocalEvidenceAnalyzer`).
    3. Image path: direct `worker.recognize(file)` (same WASM)
    4. Field extraction: deterministic regexes (not LLM) for `Branch` (`Army/Navy/Marine…` → `serviceBranchCodes` normalized), `Service dates` (`YYYY-MM-DD` and `MM/DD/YYYY` variants in boxes 12a/12b), `Locations/stations` (deployments block), and `SSN` (`XXX-XX-####` pattern → `maskedSsn` derived, full value never returned). Each regex is bounded and tested against redacted DD-214 fixture variants (typed, scanned, handwritten threshold).
  - Limits: same `STANDARD_LIMITS` (20 MB file, 300 pages, 500k chars) / `EXTENDED_LIMITS` guard as `extractPdfEvidence`; DOCX path is not needed (DD-214 is PDF/image only; `.docx` is rejected with a help tip).
  - Warnings: empty page → warning, SSN-not-found → "No SSN detected — manual entry preserved," low-confidence OCR pages → "Handwritten section on page {n} — verify dates/locations."
- Field-to-workflow adapter `src/lib/presumptive/dd214-adapter.ts` — `dd214ToServiceHistoryFields(extraction)` → partial `ServiceHistory` (`locations`, `serviceStart`/`serviceEnd` ISO, `serviceBranchCodes`) with validation via `serviceHistorySchema` (`select-location` / `date-order` / `invalid-date`) before any `writePresumptiveSession`. Do not auto-normalize locations to the `presumptives` catalog — keep as user-editable strings; `matchPresumptives`'s exact-location logic remains the matcher.
- Verification gate: `Dd214VerificationReview` component renders extracted fields with inline edit + a mandatory "I verified these dates/locations" checkbox before `Confirm` is enabled. The checklist is checked by the Veteran, not auto-satisfied.
- Retention: evidence bytes, fabric canvas, and parsed preview live in-memory in `Dd214LocalAnalyzer` (`useState` + `useRef` canvas) and, if needed, a short-lived `sessionStorage` key `secondary-condition-finder:dd214-draft:v1` capped by `serializeStoredEvidenceWithInfo` byte budget; cleared on `Confirm`, `Clear`, tab close, or `clearPresumptiveSession`. Never written to cookies, `auditLog`, or telemetry (`src/lib/observability/logger.ts` redact list already covers `rawText`/`payload`/`secret`/`apiKey`; extend redaction with `ssn`/`fullSsn`).

### Compliance & gates

- `audit:evidence-architecture`: extend to assert `dd214-extract.ts` is never imported from a server route and never reaches `writePresumptiveSession` as raw bytes — only through the adapter's validated `ServiceHistory` after user confirmation.
- `ingestion-privacy`: extend to assert `dd214:draft` key if used does not leak to server logs/cookies and that `maskedSsn` rendering never shows the full value.
- `security-operations` review for the new `limits`/OCR paths that touch SSN-bearing documents (even browser-local).
- Manual test plan: redacted DD-214 fixtures (typed, poor-scan, handwritten) + SSN masking matrix + verification-gate audit + failure→manual-entry fallback E2E in Chrome/ChromeDriver (expected 60–90s on scanned fixtures).

### Tests

- Unit: `tests/dd214-extract.test.ts` — regex extraction on redacted fixtures, SSN masking never returns full SSN, `dd214ToServiceHistoryFields` validation mapping (`invalid-date` passthrough), `Standard/Extended` limit contract parity, `busyRef||busy` helper contract.
- Architecture: `tests/evidence-architecture.test.ts` extension for `dd214-extract.ts`.
- E2E: `e2e/presumptive-dd214.mjs` — upload fixture, review form prefills, checkbox blocks submit, `Confirm` lands on `/presumptive/results` with `matchPresumptives` exposure, `Clear` purges in-memory + `sessionStorage`.

### Rollout

Ships disabled behind `DD214_PARSER_ENABLED` server flag that only gates rendering of the upload card (parsing stays browser-local either way). Flip the flag after privacy review; no new server env for WASM location (`/public/tesseract/` already same-origin).

### What #9 is not

No server-transmitted OCR, no LLM field extraction, no SSN persistence. Any LLM variant is rejected under the same rationale as Phase 1 Ideas #6/#7 (violates browser-local `sessionStorage` tab-only boundary + `connect-src 'self'` + `audit:evidence-architecture`). If you ever need server LLM parsing, that's a distinct proposal with a new PII scope, retention policy, and `connect-src` change — out of scope for this gate.

---

## Phased plan (gated commits, not one branch)

| Milestone | Scope | Gate before merge |
|---|---|---|
| **Phase 3.0** (this doc) | `docs/phase3-scope-2026-09-09.md` + v1.2 spec bumps + duplicate hygiene | `verify` workflow green on the docs branch (pure doc, no VA integration change) |
| **Phase 3.1** | Idea #8 VSO locator (`src/lib/va/accredited-representatives.ts` + server action + cache + component + wiring + health) | VA sandbox key issuance + `security-operations` sign-off on allowlist/budget + `npm run evidence:architecture` + E2E |
| **Phase 3.2** | Idea #9 DD-214 parser (`src/lib/evidence/dd214-extract.ts` + `dd214-adapter.ts` + `Dd214LocalAnalyzer` + review gate) | PII/SSN privacy review + `audit:evidence-architecture` extension + fixture tests + manual verification-gate audit |

## Deferred

- #6 AI Symptom Reverse Matcher and #7 Medical Evidence Pathway Analyzer — LLM variants remain rejected for the same privacy boundary; the rule-based `symptom-bridge.ts` and `gap-coverage.ts` remain the path.

## Open questions for the Phase 3.1 branch

1. Which VA endpoint will be the accredited-rep directory (OGC public API vs. `api.va.gov` service path)? Determines the `VA_ACCREDITED_REP_*_BASE_URL` allowlist.
2. Should the locator live only on Steps 5/6 + `/presumptive/results`, or also on `/presumptive` intake prior to matching? Leans to the former — keeps it as a post-research aid so directory changes don't shift the matcher.
3. Radius UX: single radius selector vs. expand-on-empty-results ("no results within 25 mi — search 50/100 mi").

End of scope.
