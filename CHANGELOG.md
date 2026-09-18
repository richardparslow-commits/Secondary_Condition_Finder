# Changelog

All notable changes to Secondary Condition Finder. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); merges are grouped by date, newest first.

## 2026-09-17

- **Single shared VA reference cache protocol** (`refactor`/`fix`): extracts
  `withVaReferenceCache` into `src/lib/va/reference-cache-access.ts` and migrates all five
  public-reference loaders (`service-branches`, `forms-finder`, `form-reference`,
  `disability-reference`, `accredited-representatives`) onto it, collapsing five hand-rolled
  copies of the process-local → shared → promote → write-both sequence into one. `cacheable` is
  now a required field on the loader result, so the previously unstated "never cache a local
  fallback" rule is enforced by the type system instead of by each copy remembering to return
  early before the write. Key namespaces move from string literals in each loader to one registry
  (`VA_REFERENCE_NAMESPACES`) with `clearVaReferenceNamespace(ns)`. This fixes a real collision:
  `clearVaFormsFinderCache()` cleared the `"forms:"` prefix, which also matched
  `form-reference`'s `forms:reference:` keys, so one module silently evicted another's cache — and
  `form-reference` had grown no clear function of its own because it appeared to work by accident.
  Keys are now `forms-finder:{env}:{query}` and `forms-reference:{env}`, and `form-reference.ts`
  gains `clearClaimFormReferenceCache()` for parity with its four siblings.
  `tests/va-reference-cache-namespace.test.ts` (10 tests) pins namespace disjointness, per-owner
  clearing in both directions, clear-function parity across all five modules, and the
  `withVaReferenceCache` contract (hit decoration, miss caching, fallback never cached, shared-hit
  promotion into the process-local tier, `enabled: false` bypass). The source-text pin in
  `tests/va-reference-product-surface.test.ts` that asserted each loader called
  `readVaReferenceCache<…View>` is replaced by an architecture pin asserting every loader goes
  through the shared entry point and none reaches into the cache tiers directly. Suite: 231 files /
  1385 tests.

## 2026-09-14 (later)

- **Standalone `/get-records` page + README screenshot** (`feat`/`docs`) Adds
  `/get-records`, a standalone route outside the numbered workflow that reuses the
  `VaGovRecordWalkthrough` component with its own explicit no-credential boundary copy and
  onward links into the secondary workflow and privacy policy; linked from the home page's
  utility nav and a new utility-section card. `tests/get-records-page.test.ts` (2 tests) pins
  the shared-component composition, boundary phrasing, no-fetch/no-password surfaces, and home
  wiring. Adds `scripts/capture-va-gov-walkthrough-screens.mjs` (maintainer-gate utility):
  starts a dev server + headless Chrome, seals a dev-only workflow cookie, and captures the
  walkthrough card over the DevTools Protocol (CDP clip coordinates are CSS px with
  independent `scale` — combining it with `deviceScaleFactor` double-scales); the regenerated
  `docs/assets/va-gov-walkthrough.png` is embedded in the README. Suite: 230 files / 1375
  tests.

## 2026-09-14

- **Guided VA.gov medical-records download walkthrough (Step 4)** (`feat`) Adds a
  `VaGovRecordWalkthrough` research aid at the top of the Step 4 documents page, mirroring the real
  VA.gov sign-in → ID.me (email, password, MFA, SMS code) → My VA → My Health → Medical records →
  Download (All time / Select all VA records / PDF / Download report) flow as a 14-step checklist
  with deep links that open VA.gov in a new tab. Authored steps live in
  `src/lib/secondary-workflow/va-gov-record-walkthrough.ts`; progress checkmarks persist in a new
  tab-scoped `sessionStorage` store (`secondary-condition-finder:va-gov-record-walkthrough:v1`)
  registered in `local-state.ts` so Finish Review / Start a new review clear it, with a
  browser-only text export. The aid never collects, transmits, or stores VA.gov/ID.me credentials,
  MFA codes, or session data — sign-in happens entirely on VA.gov, and ID.me steps are described
  without hard-coded links (their URLs carry session/event identifiers). Privacy policy, retention
  list, functional spec, and technical spec updated for the fourth store. Contract-pinned by
  `tests/va-gov-record-walkthrough.test.ts` (7 tests: step fidelity + URL fragments,
  no-credential/no-egress boundaries, registry registration, page wiring, text export, disclaimer);
  completion-privacy and research-aids registry pins updated to four stores. Follow-up: the MFA step
  now carries an alternate-method note (authenticator app / push / security key / passkey / PIV-CAC)
  and the download step a "can't find the file" note (browser Downloads/Desktop) — both rendered as
  small-print `note` fields, not new steps; SSR render of `/secondary/upload` with a sealed v2
  workflow cookie verified all 14 steps, 8 deep links, notes, counter, and the local analyzer below.
  Suite: 229 files / 1373 tests.

- **Walkthrough follow-ups — E2E journey, README, copy tune** (`test`/`docs`) Extends
  `e2e/secondary-workflow.mjs` to cover the aid on Step 4: heading + counter + boundary callout +
  alternate-MFA note assertions, a count of ≥8 `https://www.va.gov` deep links, step-1 progress
  written to `secondary-condition-finder:va-gov-record-walkthrough:v1` via hydrated onChange (same
  retry pattern as the pathway checklist), and Start-a-new-review clearing of the walkthrough store
  alongside the pathway store; final journey log names the aid. README adds the guided-download
  blurb (real-flow context, deep links, no-credential boundary, tab-scoped progress). Component
  copy split into two paragraphs with `space-y-4` step spacing. Suite: 229 files / 1373 tests
  (e2e journey itself runs in CI with Chrome/ChromeDriver).

## 2026-09-12 (later still)

- **Sixth audit report — session-write failure contracts pinned** (`test`) Adds
  `tests/session-write-failure-contract.test.ts` (4 tests): behavioral pins (mocked session
  module) that a rejected `writeSecondaryWorkflowSession` in `saveDiagnosedSelection` and
  `saveRatingsSelection` holds the user on the step via validation redirect (never resolves
  forward), emits a failure `auditLog`, and that a successful write advances with a success audit;
  plus a structural pin that all 6 write sites in `secondary.ts` remain guarded and the `#386`
  remediation comment (`#5 do not silently lose data`) stays in place. The report's headline
  scenario (missing production secret) throws at write time and lands in exactly these catch
  blocks — fail-fast secret handling was already pinned in `secret-fallback-contract` and
  `deployment-readiness`. Suite: 215 files / 1151 tests.

- **Fifth audit report — size-limit cleanup path pinned** (`test`) Adds
  `tests/evidence-pdf-size-limit-cleanup.test.ts` (3 tests): when `assertExtractedTextSize`
  throws mid-loop (PDF exceeds the `textChars` budget), the per-page `finally` releases the
  in-flight page **before** the error propagates, every earlier page cleaned in its own
  iteration (3 pages → 3 cleanups), and the outer `finally` destroys the loading task. The
  report's claim of "fragile" cleanup was already-structured-correct in `extractPdfEvidence`
  (the assertion sits inside the per-page try, so cleanup order is guaranteed by construction);
  the size-limit path was the one scenario the #407 contract didn't pin — now it is. Suite:
  214 files / 1147 tests.

- **#420 — Phase 4 item D closed + presumptive-track E2E journey** (`test`) Adds
  `e2e/presumptive-workflow.mjs`, the presumptive track's first real-browser journey:
  home → intake → Agent Orange quick-start template pre-fill (controlled-checkbox clicks + date
  fields) → submit → results (category, confirmed-date window, not-an-eligibility-decision
  notice) → the Phase 4 item C cross-link panel (heading, mapping sentence, secondary-track link)
  → cross-track navigation to the clean secondary entry route. Harness mirrors
  `secondary-workflow.mjs` (sessions via `POST /session`; uses `execute/sync` for input reads —
  local chromedriver does not implement the W3C `property` endpoint). Item D (DD-214 →
  presumptive prefill) verified one-click and pinned by `tests/dd214-presumptive-handoff.test.ts`
  (4 contracts: field extraction with SSN redaction, adapter draft validity, locations-override
  path, full match through to the Agent Orange category). `verify-checklist.sh --full` now runs
  all three journeys. Suite: 213 files / 1144 tests.

- **Phase 4 item C — Presumptive × secondary research-cue panel** (`feat`) On
  `/presumptive/results`, matched presumptive conditions that also appear as published KB
  secondary targets render a research-cue panel: the condition, the published primaries that map
  to it, and a link to the secondary track's clean entry route. Built entirely at the app layer
  (`src/app/presumptive/results/secondary-cross-link.ts` + page wiring) — the TRACK-SEPARATION
  composition rules bind only `src/lib/secondary-workflow/` and `src/lib/presumptive/`, so no rule
  changes were needed. New `secondaryTargetIndex` KB lookup (display-only, draft-excluded, never
  fed into `recommend()`); no session state crosses the track boundary. Real-data intersection:
  11 of 48 presumptive conditions carry secondary pathways (hypertension, asthma, COPD, CAD, …).
  Tests: `tests/secondary-cross-link.test.ts` (7) and
  `tests/track-separation-cross-link-contract.test.ts` (4) — the latter names the composition
  rules so a refactor cannot quietly weaken the boundary the panel depends on. Suite: 212 files /
  1140 tests.

- **Phase 4 item B — Unified consultation packet** (`feat`) Adds `ConsultationPacketDownload` on
  the Step 6 evidence page: one printable text download concatenating the existing privacy-stripped
  exports (claim summary, ranked suggestions, pathway record checklists, action plan, rating guide)
  behind a section table of contents — all `format*` helpers reused, no new content composition and
  no new data collection. Contract-pinned by `tests/consultation-packet.test.ts` (5 tests): packet
  composition, TOC ordering, and privacy exclusions (no condition selections, ratings, or evidence
  text beyond what the existing exports already carry). Suite: 210 files / 1129 tests.

## 2026-09-12

- **#417 — Symptom-bridge expansion (Phase 4 item A)** (`feat`) Adds 8 controlled symptom entries
  to `SYMPTOM_BRIDGE_ENTRIES` (8 → 16): chronic widespread pain (fibromyalgia), ringing in ears
  (tinnitus, hearing-loss), heartburn/reflux (gerd, esophagitis), stomach pain (gastritis), bowel
  changes (irritable-bowel-syndrome), low back pain (lumbar-strain, lumbar-spinal-stenosis,
  intervertebral-disc-syndrome), neck pain with arm numbness (cervical-strain,
  carpal-tunnel-syndrome), weight/temperature change (hyperthyroidism, hypothyroidism), pelvic
  pain (chronic-pelvic-pain-syndrome). Every `discussionConditionIds` entry verified to exist in
  the catalog (25 unique references, zero missing); all prompts keep the established
  non-determination voice. Data-only change: no schema, UI, or egress surface touched; the Step 4
  checkbox grid renders 16 entries within the existing layout. Suite: 209 files / 1124 tests.

## 2026-09-11 (later)

- **#416 — Secret-fallback contract completed** (`test`) Adds
  `tests/secret-fallback-contract.test.ts` (5 tests): a configured-but-short secret throws in
  production (length and production gates are independent), production can never return the
  dev-only secret (throw precedes fallback), the dev fallback warns outside test/prod (#386
  observability) and stays silent under test. Response to a fourth circulated audit report — the
  fail-fast claim was already implemented and pinned (`deployment-readiness.test.ts`), with the
  report's central "silently used in production" scenario unreachable by construction. Suite: 209
  files / 1124 tests.

- **#415 — Symptom-discussion-panel E2E + session round-trip contract** (`test`) The last backlog
  polish item: the real-browser journey now selects a controlled symptom at Step 4
  (`daytime-sleepiness-snoring`, matching the fixture sleep-apnea pathway) and asserts the vetted
  provider-discussion prompts render on Step 5 (label + prompt text) and follow to Step 6. Adds
  `tests/symptom-session-roundtrip.test.ts` pinning the server chain (seal → open →
  `workflowSessionToQueryParams`). Debugging note: WebDriver `innerText` returns CSS-transformed
  text, so the panel's `uppercase` heading must be matched case-insensitively — the first run
  failed on assertion case, not app behavior. Suite: 208 files / 1119 tests.

- **#414 — Evidence-storage drop-notice contract pinned** (`test`) Adds
  `tests/evidence-storage-drop-notice.test.ts`: behavioral coverage of `serializeStoredEvidenceWithInfo`
  (accurate `dropped` count under byte pressure, oldest-first, empty-store full-drop accounting,
  string/info API parity) + structural pins that `commitAnalysis` surfaces byte-budget eviction as a
  user warning before saving. Response to a third circulated audit report — the fix was already
  shipped in #386 as remediation #3 (HIGH) of the same audit series; only the untested contract
  was closed. Suite: 207 files / 1117 tests.

- **#413 — Backlog closure: #6 confirmed shipped, phase3 Deferred section corrected** (`docs`)
  Investigation for next-phase planning found Idea #6's compliant rule-based surface shipped
  2026-09-05 (`a9120bb`): `SymptomDiscussionReview` renders vetted provider-discussion prompts on
  Steps 5/6, pinned by `tests/symptom-bridge.test.ts`. The 2026-09-09 backlog is therefore fully
  shipped or compliant-shipped (10/10); the phase3-scope Deferred section now records the
  correction, and the only optional polish is E2E coverage of the symptom panel.

- **#411 — DD-214 analyzer cleanup contract + full-surface audit** (`test`) Adds
  `tests/dd214-local-analyzer-cleanup-contract.test.ts` (5 structural pins): both `page.cleanup()`
  sites, both `worker.terminate()` sites, and `task.destroy()` sit in `finally` blocks — the third
  and last browser-local PDF/OCR surface. Component-wide audit also verified all 9
  `createObjectURL` sites are paired with `revokeObjectURL` (timeline viz revokes early on
  failure, delays only post-download). Suite: 206 files / 1110 tests.

- **#410 — OCR cleanup contract pinned** (`test`) Adds
  `tests/local-ocr-cleanup-contract.test.ts`: structural pins for `runLocalOcr()`'s guaranteed
  teardown — per-page `finally` with best-effort `page.cleanup()` (handle pre-initialized to
  `null`), render/recognize failures exiting through the finally via `continue`, and
  `loadingTask.destroy()` + `worker.terminate()` each in their own `finally`. Response to a
  second circulated audit report — investigation found the fix already present (remediated
  against a prior audit finding, `#2` in source); no source change needed. Suite: 205 files /
  1105 tests.

- **#408 — DOCX/text extractor failure-path contracts** (`test`) Adds
  `tests/evidence-docx-text-failure-paths.test.ts`: a Mammoth parser failure after the ZIP
  preflight passes must propagate (no silent "no text"); Mammoth conversion messages surface as
  `DOCX parser:` warnings; an empty DOCX warns; an oversized text body fails closed on the
  character budget after preflight; valid text keeps its `document` locator. Suite: 204 files /
  1101 tests.
- **#407 — PDF page-cleanup regression contract** (`test`) Adds
  `tests/evidence-pdf-page-cleanup.test.ts`: behavioral pinning (mocked pdfjs) that
  `page.cleanup()` runs even when `getTextContent()` throws, `loadingTask.destroy()` runs even
  when `getPage()` fails, and the success path cleans up per page with provenance intact.
  Response to a circulated audit report claiming a leak at `document-extract.ts:199-211` —
  investigation found the finally-wrapped cleanup already in place since `99757d7` (hardened in
  #386), so no source change was needed; only the untested throw-path contract was closed.
  Suite: 203 files / 1096 tests.

## 2026-09-11

- **#400 — Locator E2E coverage + flag-on/missing-key contract + `VA_ACCREDITED_REP_*` env docs**
  (`chore`) Adds the Find Help accredited-representative locator segment to the real-browser E2E
  journey; pins the fail-closed contract (`tests/accredited-representative-locator.test.ts`, 7
  contracts: flag-on + missing key → graceful local fallback before any fetch, circuit breaker
  stays `closed`); documents the `VA_ACCREDITED_REP_*` environment variables in the tech-spec env
  table. Suite grows to 202 files / 1093 tests.
- **#401 — Spec Status pins refreshed** (`docs`) Both specification Status lines updated to the
  post-#400 `main` SHA.
- **#402 — Feature-ideas brainstorm** (`docs`) Adds the 2026-09-09 Agiloop brainstorm output
  (`docs/secondary-feature-ideas-2026-09-09.md`).
- **#403 — Corrected v2 executive specification + unit-clarified KB counts** (`docs`) Adds
  `docs/executive-specification-v2.md` (six-step workflow, Phase 3.1 features, verified constants);
  clarifies units in both spec docs: 363 authored relationships across 813 mapping files (140
  published / 673 draft counted by publication state).
- **#404 — Tech spec v1.6: `build:azure` documented, Status pin refreshed** (`docs`) Conformance
  audit found the `npm run build:azure` standalone-packaging script undocumented; names it on the
  Hosting & CDN line and refreshes the Status pin.
- **#405 — Corrected v2 technical specification** (`docs`) Adds
  `docs/technical-specification-v2.md`, regenerated from the 2026-09-11 conformance audit:
  `/secondary/` route group, verified Server Action inventory, real CSP directives, 33 data files
  across 14 body-system categories, engine result shape, research-aid module locations, CI's
  real-browser E2E gate. Living source of truth remains `docs/technical-specification.md` (v1.6).

### Verification (2026-09-11)

- Full suite: 202 files / 1093 tests green on merged `main`.
- Real-browser E2E journey passed on merged `main` (locator segment included).
- Post-merge prod: `/api/health` 200 healthy (catalog ok, session crypto ok, all three circuit
  breakers `closed`, `vaConfig` fail-closed sandbox); `/runtime-readiness` ready.

## 2026-09-10

- **#399 — Locator fee note + specializations + first locator tests** (`feat`) Completes Idea #8
  spec coverage: 38 U.S.C. § 5904 fee note (no upfront cost; fees only after decision + approved
  fee agreement), optional `specializations` directory field (never fabricated), first test
  coverage for the locator.
- **#398 — Shared evidence-strength badges** (`feat`) Harmonizes the Idea #4 consensus-badge
  signal onto shared color-coded primitives (`consensusTone`, `CONSENSUS_BADGE_CLASS`,
  `consensusLiteratureSentence`) across all suggestion surfaces.
- **#397 — Post-merge spec consistency fixes** (`chore`) Resolves four-way-merge spec drift;
  adds the research-aids integration test.
