# Changelog

All notable changes to Secondary Condition Finder. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); merges are grouped by date, newest first.

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
