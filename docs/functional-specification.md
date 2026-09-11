# Functional Specification: Secondary Condition Finder

## Executive Summary

Secondary Condition Finder is a web-based claim-preparation research aid for U.S. Veterans preparing disability claims with the Department of Veterans Affairs (VA). The application helps Veterans and their representatives organize research into potential secondary service-connected disabilities and presumptive conditions by providing a curated knowledge base, guided workflows, and evidence-evaluation tools. The application is not a diagnostic or eligibility determination system—it is an informational research accelerator that surfaces possible claim pathways for qualified medical and legal professionals to evaluate.

## Business Objectives

- Provide accessible, evidence-based research support for Veterans preparing secondary disability claims
- Organize research into two distinct legal frameworks: secondary conditions (38 CFR § 3.310) and presumptive conditions (38 CFR §§ 3.307, 3.309)
- Maintain a high-fidelity, auditable knowledge base of condition relationships backed by clinical evidence and legal authority
- Protect Veteran privacy by processing evidence documents entirely in the browser without server transmission
- Support regulatory compliance and professional accountability through structured citation verification and periodic link-rot auditing

## Primary User Personas

- **Service-Connected Veterans**: Veterans with existing VA disability ratings seeking to research whether other conditions may have been caused by or aggravated by their service-connected disabilities
- **Accredited VA Representatives**: VSO staff, attorneys, and accredited agents assisting Veterans in claim preparation
- **Healthcare Providers**: Physicians and mental-health professionals writing nexus opinions or reviewing claim files
- **VA Adjudicators and C&P Examiners**: VA personnel reviewing claims and making eligibility determinations (indirect users; application provides research reference material)

## Key Functional Requirements

### 1. Secondary Condition Research Workflow

The application guides users through a structured, multi-step workflow to research secondary conditions caused by or aggravated by service-connected disabilities. The implemented workflow is **six steps** (FR-1 in `docs/product-spec.md`). Educational legal content lives on standalone routes outside the numbered steps.

**Implemented six-step secondary workflow (canonical):**

| Step | Route | Purpose | What is collected / shown |
|------|-------|---------|---------------------------|
| **1** | `/secondary/diagnosed` | Diagnosed conditions | User selects diagnosed conditions from the 813-condition catalog (checkbox list, “database mapped” badge). Stored in encrypted session cookie. |
| **2** | `/secondary/service-connected` | Service-connected status | For each Step 1 diagnosis, user marks Yes/No “already service-connected.” Yes-set = comparison primaries; No-set = Step 5 targets. Requires explicit answer per diagnosis. |
| **3** | `/secondary/ratings` | Current ratings | For each Yes condition, user selects 0–100% (via `VALID_RATINGS`) or “I prefer not to answer” (stored as `null`). Research context only. |
| **4** | `/secondary/upload` | Supporting documents & optional bounded context | Browser-local PDF / DOCX / text excerpt analysis (no bytes sent to server). Optional bounded inputs: medications (≤20 × 160 chars), treatments/procedures/devices (≤20 × 160), relevant history/risk factors (≤20 × 160), symptom research prompts (bridge entries), approximate onset/diagnosis year per diagnosed condition (`MIN_TIMELINE_YEAR`–`MAX_TIMELINE_YEAR`), and a yes/no “documents available” flag. Raw bytes/text stay in tab `sessionStorage` (`secondary-condition-finder:evidence-analysis:v1`); only the bounded context + flag enters the encrypted cookie. |
| **5** | `/secondary/suggestions` | Diagnosis-centered connection review | Every Step 1→No condition appears as a top-level card. Under each, only Yes conditions with an authored **published** relationship to that target are listed with rationale, evidence gaps, source references (verified/unverified, role-labeled), optional literal medication/treatment overlap cues, conservative VA reference terminology, and optional authored `pathwayIntelligence` (pathways / causal chain / questions to develop / issues to resolve) where authored for that exact primary→secondary edge. Conditions with no published relationship remain visible with “no supported mapping found — not a medical conclusion” messaging. No condition the user did not select is introduced. Recommendations are ranked via `recommend()` (consensus-tier → `1/rank` weight → multi-primary accumulation → intermediate-chain 2-edge paths) but displayed grouped by non-service-connected target. **Phase 1+2 research aids on this step:** `ConditionComparisonTool` (pick 2–3 diagnosed conditions with a published relationship; side-by-side nexus / consensus / citations / gaps / rating framework + download) + `CombinationInsightsPanel` (pairwise synergistic / independent / conflicting analysis over top-5 with `recommendation`, capped 10 pairs + download) + `RatingGuide` (per-diagnosis `ratingSchedule` + generic 0–100 scale + 8-prompt symptom matcher, informational only) + `ActionPlan` (consensus→score→gaps prioritized `#1…n`, 4-step checklist + timeline + `va.gov/find-forms`/`21-526EZ`/`OGC`/`/vso` links + download) + `PathwayRecordChecklist` (per-pathway records checklist: one card per contributing primary → this diagnosis with nexus theory / causal mechanism / pathway badges, concrete “Obtain: …” record items with why text, user checkmarks persisted in tab-scoped `sessionStorage` (`secondary-condition-finder:pathway-record-checklist:v1`), standalone + combined-with-summary browser downloads). |
| **6** | `/secondary/evidence` | Evidence & research checklist | Same non-service-connected set as Step 5. For each supported connection, shows authored evidence-gap checklist (user-controlled browser-local checkmarks, not auto-satisfied), intermediate-chain / alternative-etiology / chronology warnings, gap-coverage chips against local Step 4 excerpts, and a browser-generated consultation-summary export (supported relationships only, no raw excerpts or match context). Conditions with no published connection show “no checklist available — not a medical finding.” `Finish Review` / `Start a new review` clear the encrypted cookie + all three browser-local `sessionStorage` stores (evidence excerpts, evidence-gap review checkmarks, pathway-record-checklist selections). **Phase 1+2 research aids on this step:** `MedicalRecordChecklist` (pathway-typed checklist per gap → `diagnosis`/`imaging`/`nexus-opinion`/`specialist`/`treatment`/`chronology`/`other` with why-text + per-gap checkbox + download, not `sessionStorage`-backed) + `RatingGuide` + `ActionPlan` + `PathwayRecordChecklist` (same module as Step 5; the stripped-recommendations prop enables the combined checklist + consultation-summary export so the printable report captures them regardless of entry). **Pathway Evidence Mapping:** browser-local Step 4 excerpts quoted exactly and grouped under each authored contributing-primary pathway (claim theory + mechanism), with honest status chips (theory-matched nexus excerpts / supporting only / related causal language / none) and a text download — grouping and labeling only, never interpretation, competency, probative weight, or sufficiency determinations; no text leaves the browser tab. |

**Educational routes (outside the numbered workflow):**

- `/secondary` — track overview with cards for “caused by” vs. “aggravated by”
- `/secondary/condition-caused-by` — 38 CFR § 3.310(a) “but for” causation explainer
- `/secondary/condition-aggravation` — 38 CFR § 3.310(b) aggravation / treatment-interference (Spicer May 2026) explainer
- `/secondary/legal` — canonical legal & policy reference list (`CANONICAL_REFERENCES`, `DISCLAIMERS`)

**Legacy 8-step narrative → implemented 6-step mapping:**

| Legacy functional-spec 8-step label | Where it lives now |
|-------------------------------------|--------------------|
| Step 1: Causation Pathway Selection | `/secondary` landing (choose advisory cards, not a gated workflow answer) |
| Step 2: Legal Framework Review | `/secondary/legal`, `/secondary/condition-caused-by`, `/secondary/condition-aggravation` (informational, not a numbered step) |
| Step 3: Service-Connected Condition Selection | **Step 2** (`/secondary/service-connected`) — scoped to Step 1 selections |
| Step 4: Diagnosed Conditions | **Step 1** (`/secondary/diagnosed`) — catalog-only intake |
| Step 5: Service/Disability History | Split: secondary’s **Step 4 optional bounded history/timeline/symptom bridge** (relevant history entries, `conditionTimeline`, `symptomIds`) is secondary-workflow research context only. Military **service locations / date ranges / branch** for exposure matching belong exclusively to the **presumptive track** (`/presumptive`); the secondary track does not collect service dates/locations for presumptive matching. |
| Step 6: Supporting Documents (Optional) | **Step 4** (`/secondary/upload`) — same route as bounded context; browser-local evidence (`LocalEvidenceAnalyzer` → `sessionStorage`) |
| Step 7: Evidence Gaps Checklist | **Step 6** (`/secondary/evidence`) — checklist + gap-coverage + warnings |
| Step 8: Suggestions & Rationale | **Step 5** (`/secondary/suggestions`) — ordered before Step 6 so the checklist reviews the same connections |

Step counts in older narrative drafts counted the two educational gates as numbered steps. The product baseline (implemented, CI-enforced) is six numbered steps as defined in `docs/product-spec.md` FR-1–FR-2 / FR-10.

### 2. Presumptive Condition Research Workflow

A parallel workflow for researching presumptive service-connection eligibility:

- **Route:** `/presumptive` (intake) → `/presumptive/results` (results)
- User selects military service location(s), date range(s), and optionally service branch (stored in encrypted `presumptive-workflow-v1` cookie; `matchPresumptives()` does not read branch — display context only)
- Application matches against authored exposure categories (PACT Act burn-pit, Agent Orange) with exact-location + inclusive-date logic; omitted dates produce a location-only match flagged in the UI
- Unmatched locations are reported with a note that a claim is still possible with supporting evidence; out-of-scope categories are named so results do not read as exhaustive
- Results display applicable presumptive conditions by location and date window; presumptive claims remove the need to prove causation — the application clarifies eligibility criteria without determining final adjudication
- Presumptive service-history state is isolated from the secondary workflow session; the two tracks do not share condition selections, history entries, or evidence stores

### 3. Knowledge Base & Condition Catalog

- **Catalog:** 813 recognized medical conditions grouped by body system across 33 catalog files (`data/conditions/*.json`), each with stable `id`, display `name`, `aliases`, `bodySystem`, and VA rating-schedule citations where applicable (joint/nerve/spine/neoplasm/laryngeal/ocular/digestive/genitourinary/mental-disorder/hematologic/skin/infectious/oncological/dental-or residual framework with explicit review notes when a single diagnosis-specific DC does not exist)
- **Knowledge Base:** 813 mapping files (`data/knowledge-base/*.json`, one per catalog id). Current repository counts (product-spec baseline): **363 authored relationships**, **140 published / 673 draft**, **379 live source references** (verified after the all-94 citation-verification approval and ME-36/ME-37/ME-38 PTSD expansions plus ME-39 `rem-sleep-disorder → parkinsons-disease`). Each published suggestion is authored with:
  - Causal Relational Graph (CRG) classification `nexusClassification`: `DIRECT_CAUSATION`, `AGGRAVATION`, or `ASSOCIATION_ONLY` (Zod discriminated union in `src/lib/kb/schema.ts`)
  - Causal mechanism (`causalMechanism`, 16-category controlled vocabulary — e.g., microvascular, neuroendocrine, inflammatory)
  - Etiological consensus tier (`etiologicalConsensus`: `WELL_ESTABLISHED` → `NOT_ESTABLISHED`, ordered via `CONSENSUS_ORDER`; guards enforce honesty vs. citation discipline)
  - Conservative `rationale` explaining the evidence basis
  - `evidenceGaps` identifying missing information (surfaced as Step 6 checklist)
  - Ranked suggestions (higher `rank` = weaker; `1/rank` weight, higher weight = stronger; multi-primary summation in `src/lib/engine/recommend.ts`)
  - `sourceReferences` with `citation`, `verificationScope` (legal / clinical / procedural), `sourceUrl`/`sourceLocator`/`sourceCheckedOn`, and `verified` status (automated tooling may set canonical URL metadata but never `verified: true` — qualified-human verification per `docs/citation-verification-sop.md`)
  - Optional bounded `pathwayIntelligence` (pathways, causal chain, development questions, issues to resolve) authored only for that exact primary→secondary edge; never inferred from medications/treatments/evidence

- **Authoring Control:** All catalog/KB JSON is validated at parse time via strict Zod schemas (unknown keys rejected). Additional gates: `npm run kb:validate` (structural + referential integrity), `npm run citations:audit` (citation provenance + debt ratchet — current automated ceilings: 130 total refs / 14 verified / 116 unverified / 114 published-unverified; floor: 49 clinical-evidence-with-canonical-URL), `npm run audit:me-compliance` (CRG/consensus/guard-disclaimer/citation discipline across all mappings), and `npm run evidence:architecture` (browser-local evidence boundary)

### 4. In-Browser Evidence Analysis

The application processes user-uploaded documents entirely within the browser (verified by `tests/ingestion-privacy.test.ts` and `audit:evidence-architecture`):

- **Document Types Supported:** PDF files (including scanned PDFs via local OCR), DOCX archives (Mammoth), plain text / pasted text
- **Extraction & Analysis:** `src/lib/evidence/document-extract.ts` + `src/components/evidence/LocalEvidenceAnalyzer.tsx` extract text, segment by page/locator, join `content.items`, enforce `assertExtractedTextSize` / `assertSafeDocxArchive` guards, and surface per-page warnings (empty page → warning, size-limit → thrown then caught per page)
- **OCR Support:** Local Tesseract.js (`tesseract.js` + `pdfjs-dist` render at `scale: 2`) runs in the browser against same-origin `/public/tesseract/*` assets; `worker.recognize(canvas)` per page with `page.cleanup()` in `finally`; no image bytes leave the browser
- **Author Classification:** Classifies document authors as physician, psychologist, NP/PA, or non-clinician so VA decision letters are not miscounted as clinician-authored opinions (gap-coverage layer)
- **Evidence Normalization:** Normalizes clinical shorthand (e.g., “dx”, “2/2” = secondary to), handles hyphen and spelling variants for `buildEvidenceConditionTerms` / `EvidenceGapCoverage`
- **Boundaries & Limits:** Enforces file size, batch size, page count, character count, and retention limits published on `/privacy` and enforced via `src/lib/evidence/limits.ts` Standard/Extended profiles and `pending[]` batch queue (sequential `runAllAnalysis()` with `busyRef || busy` guard, `numPages` positive-integer validation, DOCX 2000-entry ceiling in `assertSafeDocxArchive`). Oversized sources are rejected with a warning, not truncated. Retention: excerpts and provenance persist only in the current tab’s `sessionStorage` until cleared or the tab is closed.
- **Non-goals:** No raw document bytes or extracted text are submitted to the application server, included in workflow cookies, or written to server logs/telemetry

### 5. Session Management & Privacy

- **Encrypted Sessions:** Workflow state is stored in short-lived, encrypted/authenticated `HttpOnly`, `SameSite=Strict`, `path`-scoped cookies: `secondary-workflow-v1` and `presumptive-workflow-v1` (AES-256-GCM + HMAC, `WORKFLOW_SESSION_SECRET` ≥32 chars in production, `workflow-session-crypto.ts`). `Max-Age` = 30 minutes (`WORKFLOW_SESSION_MAX_AGE_SECONDS = 1800`); server validates both HMAC and embedded expiry timestamp (`fail-closed` on tamper/expiry)
- **No Server Persistence:** Workflow history is not recorded in server-side logs, databases, or analytics. Recommendation-event logging (`src/lib/observability/logger.ts` / `audit.ts`) is constrained to approved non-free-text fields; raw evidence, medication/treatment entries, checklist selections, and claim identifiers are redacted
- **URL Privacy:** Back-navigation reads the encrypted cookie (`readSecondaryWorkflowSession` → `workflowSessionToQueryParams` → `parseWorkflowState`) so users can revise earlier choices without putting workflow context into the URL; workflow state does not appear in browser history, referrer headers, or copied URLs
- **Evidence Document Privacy:** Uploaded documents and extracted text remain in the browser tab only (`sessionStorage`); no bytes are transmitted to the server. `Finish Review` and `Start a new review` explicitly clear the encrypted workflow cookie plus `sessionStorage` evidence/checklist stores
- **Scope & Clearing:** Session cookies are scoped to the appropriate workflow path and cleared on logout, expiry, or explicit completion. Optional Step 4 bounded entries (medications/treatments/history/symptomIds/timeline) are stored only in the same encrypted short-lived cookie, not in URLs

### 6. Reference Data Integration

- **VA Forms Finder** (`/va-forms`): Users can search public VA form metadata by form number, keyword, or title through a configured VA reference adapter (`src/lib/va/sandbox.ts`) or a clearly labeled local fallback. Bounded public-form search with validated metadata, five-minute successful-response cache, status/provenance reporting
- **Benefits Reference Data** (`/va-reference`): Users can explore public VA disability reference terms; filtering stays local to the browser. Conservative per-result VA administrative terminology blocks on Step 5 are display-only and never fed into `recommend()`
- **VA Public Reference Cache** (`src/lib/va/reference-cache.ts` + `src/lib/va/runtime-state.ts`): Process-local, best-effort five-minute TTL cache with LRU-32 bounds; `loadDisabilityReference()` fails closed to local fallback when VA config is disabled. Separate `VA_FORMS_*` / `VA_BENEFITS_REFERENCE_*` sandbox and production keys; disabled by default (`VA_API_ENABLED=false`, `VA_SANDBOX_ENABLED` legacy)
- **Circuit breaking & observability:** `src/lib/va/circuit-breaker.ts` (per-service 5-failures/60s-open), structured `vaApiLogger` + `recordVaApiLatency`/`recordVaApiError` (see readiness hardening `6967979`)

### 7. Regulatory Intelligence & Monitoring

- **Regulatory Preflight:** Monitors Federal Register, OIRA, and Regulations.gov for rulemaking activity that could affect the knowledge base or catalog citations (`src/lib/regulatory/preflight.ts` — per-source 8000 ms timeout, request-count limits, `REGULATORY_PREFLIGHT_*` env)
- **Snapshot locking:** `prepareRegulatoryReview()` establishes a `RegulatorySnapshot` (with `snapshotId`) before recommendation output. Step 5 locks that id in the `regSnapshot` query param and Step 6 reuses the locked snapshot via `loadLockedRegulatorySnapshot()`; a missing lock `fail-closed`s to `missingLockedRegulatorySnapshot()` rather than substituting a newer legal basis mid-review. Displayed via `RegulatoryPreflightStatus`
- **Scheduled Refresh Endpoint:** Bearer-protected `/api/regulatory/preflight` (`REGULATORY_SYNC_SECRET` or `CRON_SECRET`) for scheduled regulatory data refresh
- **Provenanced Seed Records:** `data/regulatory-actions/` holds seed regulatory action records with traceable lineage (validated by `audit:regulatory-intelligence`)
- **Cache Management:** Optional server-local cache (configurable `REGULATORY_PREFLIGHT_CACHE_DIR`, `REGULATORY_PREFLIGHT_MAX_AGE_HOURS` default 24) for regulatory source checks

### 8. Audit & Compliance Features

- **Citation Verification Audit** (`npm run citations:audit`): Enforces citation provenance rules, verifies that all sources are traceable, and maintains a non-regression ratchet so verification debt cannot silently increase
- **Knowledge Base Validation** (`npm run kb:validate`): Structural and referential-integrity checks for all condition catalogs and knowledge-base mappings
- **Mapping Compliance Audit** (`npm run audit:me-compliance`): Audits all mappings (including historical ME-1 through ME-39 relationships) against CRG schema validity, nexus-arm consistency, consensus alignment, guard-disclaimer honesty, and citation discipline
- **Regulatory Intelligence Audit** (`npm run regulatory:audit`): Validates provenanced regulatory action seed data
- **Link-Rot Probe** (`npm run citations:decay`): Maintainer-run active link verification for citations (deliberate maintainer gate, not per-PR CI)
- **Evidence Architecture Audit** (`npm run evidence:architecture`): Verifies browser-local evidence parser architecture and security boundaries
- **Test Composition Audit** (`npm run test:composition`): 100% of critical-module manifest has executable-test imports; enforces server-action placement, client-boundary, track-separation, and evidence-parser architecture rules

### 9. Scenario Demos & Education

- **Repeatable Demo Scenarios:** `/scenarios` route provides sample walkthroughs with pre-populated service history and condition selections to help users understand the workflow without using their own sensitive data
- **Scenario contract:** `data/demo-scenarios.json` — ≥3 explicitly synthetic scenarios (single-primary + multiple-primary overlap), represented in current secondary-workflow terms (`diagnosedIds`, `serviceConnectedIds`, `ratings/decline`, `documentsShared`, bounded `medications`/`treatments`/`history`). Launch submits only a bounded `scenarioId` to a server action, validates through the current workflow parser/catalog, writes the same encrypted short-lived secondary-workflow session, redirects to current Step 5, and clears prior `sessionStorage` evidence/checklist state. Enforced by `tests/demo-scenarios.test.ts`
- **Educational Content:** Embedded legal disclaimers, CFR references, and explanations of secondary vs. presumptive pathways

### 10. Research Aids (Phase 1 + Phase 2 — Steps 5 & 6)

Informational projections of authored KB/catalog data via `recommend()` — no new data collection, no LLM, no `connect-src` change. All six are read-only triage helpers surfaced on diagnosis-centered Step 5 and on Step 6 so the Step 6 printed report is self-contained. **Pathway Evidence Mapping** extends Step 6 with browser-local excerpt-to-pathway grouping (research cues only; see the Step 6 row above)

- **Medical Record Checklist Generator (Idea #1, Step 6):** `src/lib/secondary-workflow/medical-record-checklist.ts` — `categorizeGap(gap: string)` (keyword conservative: `diagnosis` → `imaging` → `nexus-opinion` → `specialist` → `treatment` → `chronology` → `other`, diagnosis-first so "Independent documentation…" wins) + `explainGap` (`WHY_BY_CATEGORY` per-category) + `buildMedicalRecordChecklist(results)` + `formatMedicalRecordChecklist` + `CHECKLIST_CATEGORY_LABEL`. UI `src/components/secondary/MedicalRecordChecklist.tsx` — per-gap checkbox + category badge + why-text, live count, `Download checklist` (`Blob` `text/plain` bearer, browser-only). Intentionally in-memory only (`useState<Set<string>>`), not `sessionStorage`, to avoid conflating with `EvidenceGapReview` store; reload resets it.
- **Condition Comparison Tool (Idea #2, Step 5):** `src/lib/secondary-workflow/condition-comparison.ts` — `buildComparisonRows(results, selectedIds, catalogById)` (up to 3 selected, filters `recommendation !== null`, projects `nexusClassifications` / `etiologicalConsensus` / `citationCount` / `evidenceGapCount` / `contributingPrimaryNames` / `ratingFramework` from catalog `ratingSchedule[0]` citation+note) + `formatConditionComparison` + `consensusBadgeTone`. UI `src/components/secondary/ConditionComparisonTool.tsx` — picker (2–3, filters `<2` → null render), 7-column table with consensus tones (`strong`/`moderate`/`contested`/`not-established`) + `Download comparison` + print disclosure.
- **Condition Combination Insights (Idea #10, Step 5):** `src/lib/secondary-workflow/combination-insights.ts` — `analyzeCombinationInsights(results, limit=5)` (pairwise over top-5 with `recommendation`; **synergistic** if any shared `contributingPrimary.id`, else **conflicting** if `same bodySystem` + risk note about pyramiding/overlap, else **independent**; capped 10 pairs) + `formatCombinationInsights` / `combinationRelationLabel`. UI `src/components/secondary/CombinationInsightsPanel.tsx` — pairwise cards with relation badge + why/evidence/strategy + risk note + `Download insights`.
- **Interactive VA Rating Schedule Guide (Idea #3, Steps 5+6):** `src/lib/secondary-workflow/rating-guide.ts` — `buildRatingGuide(results, catalogById)` (per diagnosed+published condition → `ratingSchedule` + `reviewNotes` + consensus/score/gaps/citations) + `formatRatingGuide(entries, selections?)` (renders per-condition marked notes when selections supplied) + `symptomNoteId(conditionId, prompt)` (`${conditionId}:${prompt}` selection ids) + `collectSymptomNotes(entries, selections)` + `GENERIC_RATING_SCALE` (`0–100%` ticks) + `GENERIC_FUNCTIONAL_PROMPTS` (8 neutral prompts) + `RATING_SCALE_NOTE`. UI `src/components/secondary/RatingGuide.tsx` — **condition selector** (pick one diagnosed condition at a time), focused per-condition framework card (citation + note + `VERIFIED`/`UNVERIFIED` badge + review-notes details), generic scale, and a per-condition 8-checkbox symptom-note matcher (selections scoped `${conditionId}:${prompt}` in browser-only state, live counts per condition and total, "does not assign or suggest a rating category or percentage" copy), `Download rating guide`. Notes only — never infers a percentage; no per-level criteria data is authored or asserted.
- **Personalized Claim Action Plan (Idea #5, Steps 5+6):** `src/lib/secondary-workflow/action-plan.ts` — `buildActionPlan(results)` (ranks by `CONSENSUS_ORDER` `WELL_ESTABLISHED(0) → IATROGENIC → PROBABLE → CONTESTED → NOT_ESTABLISHED`, then `score desc`, then `fewer gaps`, then `name`; 1-based `rank`) + `actionPlanSteps(entry)` (gather checklist → clinician nexus → choose VA form with rep → file/track, 4 steps) + `formatActionPlan` (timeline Weeks 1–2 / 2–4 / 4+ / Months 3–5 + `va.gov/find-forms` + `Form 21-526EZ` + `OGC` + `/vso` links and research-not-guidance disclaimer). UI `src/components/secondary/ActionPlan.tsx` — prioritized numbered cards + static timeline + form links + `Download action plan` + `Print action card` (scoped print: `PrintReportButton printScopeClass` + `print-action-plan-scope` section; `@media print` body-class rules in `globals.css` hide everything outside the card and swap the print header/footer to "research-generated, not VA guidance").
- **Pathway-Specific Record Checklist (Steps 5+6, 2026-09-10):** `src/lib/secondary-workflow/pathway-record-checklist.ts` — `buildPathwayRecordChecklist(results)` (per condition, one pathway per `contributingPrimary`: base diagnosis/chronology/competing-cause items from `alternativeEtiologiesToRuleOut` + theory items (`AGGRAVATION` → baseline severity / escalation / § 3.310(b) treatment-interference; `DIRECT_CAUSATION` → primary treatment records; `ASSOCIATION_ONLY` → association-capable specialist) + mechanism-directed items keyed off the 16-category `mechanismCategory` enum + always-present nexus-opinion item; deduped by record text) + `NEXUS_THEORY_LABEL` / `MECHANISM_CATEGORY_LABEL` / `PATHWAY_TYPE_LABEL` / `PATHWAY_RECORD_CATEGORY_LABEL` + `formatPathwayRecordChecklist` + `combineChecklistWithSummary`. UI `src/components/secondary/PathwayRecordChecklist.tsx` — per-pathway `primary → secondary` cards with badges + “Obtain: …” items with why text, user checkmarks in tab-scoped `sessionStorage` (`useSyncExternalStore`, same boundary as `EvidenceGapReview`, stale keys ignored, `Clear checkmarks` control), `Download pathway checklist` + `Download checklist with consultation summary` (`Blob` `text/plain`, browser-only). Authored-KB projection only; checkmarks never sent to the server.
- **Already-shipped strength signal (Idea #4, harmonized 2026-09-10):** `etiologicalConsensus` badges (`WELL_ESTABLISHED→NOT_ESTABLISHED` via `CONSENSUS_ORDER` + `1/rank` weight) rendered on every suggestion surface via the shared primitives in `src/lib/recommendation-prevalence.ts` — `consensusTone` (qualitative `strong`/`moderate`/`contested`/`not-established` tone, ordinal-free, never a probability or VA outcome) + `CONSENSUS_BADGE_CLASS` (green/amber/orange/gray palette, distinguishable without color alone via label + tooltip) + `consensusLiteratureSentence` (per-primary one-sentence literature implication on the diagnosis-centered card). Consumers: `NonServiceConnectedConditionResult` (header badge + per-primary literature sentence), `SuggestionCard`, `SecondarySuggestionItem`, and `ConditionComparisonTool` (typed `consensusBadgeTone` delegation). `CONSENSUS_EXPLANATION` tooltips unchanged (Spicer test pins).
- **Accredited Representative & VSO Locator (Idea #8, shipped via #391; fee note + specializations 2026-09-10):** `src/lib/va/accredited-representatives.ts` (`loadAccreditedRepresentatives` — VA OGC accredited-representative directory via the existing sandbox adapter, 5-min process-local cache keyed `zip:radius:type`, distance-sorted results, `local-fallback` view pointing at `va.gov/ogc/apps/accreditation` when the directory is unavailable or disabled by feature flag) + `src/lib/actions/accredited-representatives.ts` (validated server action) + `AccreditedRepresentativeFinder.tsx` on Steps 5/6 and `/presumptive/results`. Search: 5-digit ZIP + radius (25/50/100 mi) + type filter (`VSO representative` | `Accredited agent` | `Attorney`). Results list name, accreditation status badge, organization, address, distance, phone (`tel:`), website link, and optional directory-supplied `specializations` (rendered only when present, never fabricated). Fee note: accredited representatives may help prepare and submit a claim at no upfront cost; fees are allowed only after VA issues the decision and approves a fee agreement (38 U.S.C. § 5904). Provenance line mirrors `DisabilityReferenceExplorer` (`sourceLabel`/`live`/`cacheStatus`/`retrievedAt` + freshness notice); the ZIP is not persisted.
- **Deferred (privacy boundary):** Ideas #6/#7 LLM variants rejected — would violate browser-local `sessionStorage` tab-only boundary + `connect-src 'self'` + `audit:evidence-architecture`; rule-based `symptom-bridge.ts` + `gap-coverage.ts` retained. Idea #8 locator shipped (see above); #9 DD-214 auto-parser remains gated for Phase 3 (see `docs/phase3-scope-2026-09-09.md`).

## Non-Functional Requirements

### Performance

- Application is a Next.js static-generation and server-side-rendered site deployed to Vercel with edge acceleration
- Knowledge base is loaded from disk at runtime and included in Vercel tracing for fast cache hits
- OCR processing in the browser does not block the UI for scanned documents (per-page `try/finally` cleanup, `busyRef || busy` guard, `ocrProgress` signal)
- Session state is validated and authenticated server-side with minimal request latency

### Security

- Content Security Policy (CSP) with per-request nonce injection at the edge (`src/proxy.ts`); `script-src` does not use `'unsafe-inline'`
- No client-side analytics or third-party telemetry SDKs initialized; `connect-src` constrained to first-party only (`'self'`)
- Workflow session cookies are encrypted with AES-256-GCM and authenticated; server verifies both expiry and token integrity
- Edge WAF, DDoS protection, and rate limiting on Server Action routes and dynamic data routes
- Server-side OpenTelemetry instrumentation through `@vercel/otel` / `src/instrumentation.ts` and structured JSON logging (`src/lib/observability/logger.ts`) for production observability without client-side tracking

### Privacy

- Uploaded documents and extracted text remain entirely in the browser; no medical records or evidence bytes are transmitted to the server
- Workflow state is not persisted server-side; no event history, recommendations, or decision logs are recorded per session
- Session cookies are scoped to the appropriate workflow path and cleared on logout or expiry
- Configuration secrets (VA API credentials, regulatory-sync tokens) are not exposed through `NEXT_PUBLIC_*` variables
- Evidence excerpts are capped by `src/lib/evidence/limits.ts` and `src/lib/evidence/storage.ts` byte budgets (`serializeStoredEvidenceWithInfo` → `queueMicrotask` warning when truncation would occur); oversized items are rejected, not silently truncated

### Accessibility

- Application is built with semantic HTML and follows WCAG 2.1 AA standards
- Color contrast ratios meet accessibility guidelines
- Form labels, error messages, and navigation landmarks are properly structured
- Keyboard navigation is supported throughout

### Reliability & Observability

- Deployment includes a runtime-readiness check (`/runtime-readiness`) that confirms Vercel deployment, canonical alias, public route matrix availability, and session-readiness marker
- Health check endpoint (`/api/health`, `force-dynamic`) checks catalog load, session-crypto round-trip, VA config, and circuit-breaker snapshot; returns `200 healthy` / `503 degraded` with per-component `latencyMs`
- OpenTelemetry instrumentation provides production traces; `src/app/error.tsx` + `src/app/secondary/error.tsx` + `src/app/presumptive/error.tsx` + `src/app/api/error.tsx` error boundaries provide `Try again / Go home` recovery with structured `console.error` (digest only, no PII)
- CI pipeline runs integration tests, e2e tests with Chrome/ChromeDriver, type checking, linting, and full knowledge-base validation before deployment

### Compliance & Regulatory

- All mappings and citations must satisfy strict Zod schemas enforced at parse time
- Citation verification is a qualified-human decision; automated tools may record verification metadata but cannot authorize `verified: true`
- Knowledge base authoring follows established SOPs for citation verification, evidence grading, and draft/published status management
- Regulatory intelligence integrates with Federal Register and OIRA monitoring per `docs/regulatory-intelligence-v3.md` and snapshot-locking per `src/lib/regulatory/preflight.ts`

## Core User Workflows

### Workflow A: Research a Secondary Condition (Caused By)

1. User visits `/secondary` → reviews track distinction and `/secondary/condition-caused-by` explainer (38 CFR § 3.310(a), Spicer “but for” standard)
2. Proceeds to **Step 1** `/secondary/diagnosed` — selects diagnosed conditions (e.g., PTSD, erectile dysfunction, sleep apnea) from the catalog
3. **Step 2** `/secondary/service-connected` — marks Yes (service-connected) vs. No (not service-connected) for each diagnosis
4. **Step 3** `/secondary/ratings` — enters current VA evaluation per Yes condition or declines
5. **Step 4** `/secondary/upload` — optionally uploads supporting medical documents (PDFs, DOCX) for browser-local excerpt review and optionally enters bounded medication/treatment/history/timeline context
6. **Step 5** `/secondary/suggestions` — reviews every No diagnosis; under each, only Yes conditions with an authored published relationship appear with rationale, evidence gaps, citations, and optional pathway intelligence
7. **Step 6** `/secondary/evidence` — reviews evidence-gap checklist for those same No diagnoses, compares gap-coverage chips against local excerpts, and downloads a consultation-summary export for provider/representative review

### Workflow B: Research a Secondary Condition (Aggravation)

1. Similar to Workflow A but framed via `/secondary/condition-aggravation` (38 CFR § 3.310(b) — “would be less severe today but for the service-connected disability,” including Spicer treatment-interference pathway where the SC disability delayed/prevented/impeded treatment for the NSC condition)
2. Application presents pathways for direct aggravation, treatment interference, and medication side-effects where authored for that edge
3. Ranked suggestions emphasize natural baseline progression, aggravating factors, and alternative etiologies — with `clinicalFrictionWarnings` and `chronologyWarnings` surfaced in both Step 5 and Step 6

### Workflow C: Check Presumptive Eligibility

1. User visits `/presumptive` — enters military service location(s), date range(s), and optionally service branch
2. Application matches against authored PACT Act, Agent Orange, and other presumptive categories (exact location, inclusive dates; location-only flagged when dates omitted)
3. Results display applicable presumptive conditions by exposure category and date window (`/presumptive/results`)
4. Unmatched locations and out-of-scope categories are explicitly reported
5. User can cross-reference with VA Form 21-0960D and VA Forms Finder (`/va-forms`)

### Workflow D: Review Evidence Gaps with Uploaded Documents

1. User completes Steps 1–4 and uploads PDFs/DOCX files in Step 4
2. In-browser parser (`LocalEvidenceAnalyzer`) extracts diagnoses, medications, and treatment summaries with per-page provenance and `EvidenceGapCoverage` chips
3. Application shows which evidence-gap questions (from Step 5’s published relationships) are addressed by extracted content — chips are research cues, not sufficiency determinations
4. User can compare coverage across documents and use the browser-local `EvidenceGapReview` checklist (checkmarks = “I found material to review,” not auto-satisfaction)

## Data Requirements

### Main Entities

- **Condition:** ID, name, aliases, body system, rating-schedule references
- **Suggestion:** Source condition, target condition, rank, `nexusClassification`, `causalMechanism`, `etiologicalConsensus`, `rationale`, `evidenceGaps`, `sourceReferences`, `pathwayIntelligence`, `published`/`draft` status
- **SourceReference:** Citation text, `verificationScope` (legal/clinical/procedural), `sourceUrl`/`sourceLocator`/`sourceCheckedOn`, `verified` status (qualified-human gated)
- **SourceEntity:** Source registry lineage record (`data/evidence/master-sources.json`) with active/historical status
- **RatingSchedule:** CFR citation, note, verified status
- **WorkflowSession:** Encrypted/authenticated state (`secondary-workflow-v1` / `presumptive-workflow-v1`) holding diagnoses, service-history selections, document-metadata flag, bounded context entries, `ratingsByConditionId`, `conditionTimeline`, `symptomIds` — not document bytes
- **EvidenceDocument:** Metadata (author type, document type, page count, extracted-text summary with locator) retained in `sessionStorage`; raw bytes not persisted
- **RegulatoryAction:** Provenanced seed records from Federal Register/OIRA activity (`data/regulatory-actions/*.json`) with `RegulatorySnapshot` lineage
- **Demo Scenario:** Bounded synthetic payload in `data/demo-scenarios.json` (ids, ratings, `documentsShared`, `medications`/`treatments`/`history`)

## Integration Points

### External APIs

- **VA Forms API** (optional, sandbox and production): Public VA form metadata lookup — disabled by default, `VA_API_ENV=sandbox|production`, `VA_API_ENABLED=true` gate
- **VA Benefits Reference API** (optional, sandbox and production): Public disability reference terms
- **Federal Register API** (regulatory preflight): Docket and comment data
- **Regulations.gov API** (optional, regulatory preflight): Comment retrieval and docket enrichment
- **Vercel OpenTelemetry** (`@vercel/otel`): Production observability

### Third-Party Libraries

- **PDF.js** (pdfjs-dist): Client-side PDF parsing and rendering
- **Tesseract.js**: Client-side OCR for scanned PDFs (same-origin WASM + language data under `/public/tesseract/`)
- **Mammoth**: Client-side DOCX archive parsing (with `assertSafeDocxArchive` 2000-entry ceiling)
- **Zod**: Runtime schema validation for JSON data
- **TailwindCSS**: Utility-first CSS styling
- **Next.js Server Actions**: Form-based state mutations with CSRF protection and `secondaryValidationMessage` redirects

## Constraints and Assumptions

### Constraints

- Knowledge base must remain human-verified; no fully automated mapping generation or source retrieval (`verified: true` requires `docs/citation-verification-sop.md` qualified-human review)
- Workflow state cannot exceed per-request Next.js Server Action payload limits (default ~1 MB) — bounded context entries and catalog-only ids keep the cookie small
- Evidence-document processing must complete in-browser without server transmission (enforced by `src/lib/evidence/storage.ts`, `audit:evidence-architecture`, and `ingestion-privacy` tests)
- VA API integration is disabled by default; sandbox/production access is a separately governed future gate (issue #189, `docs/va-api-runtime-configuration.md`)
- Session tokens must include server-authenticated expiry; browser `Max-Age` alone is not sufficient
- All deployments to production must pass the full CI gate including `npm run kb:validate`, `npm run citations:audit`, `npm run audit:me-compliance`, `npm run test:composition`, `typecheck`, `lint`, `test`, and `npm audit --audit-level=high`
- Rating context is condition identity/rating information only and must not be presented as clinical nexus evidence

### Assumptions

- Users have modern browsers with JavaScript, DOM, and local storage enabled
- Users have access to their own medical records, C-files, or other supporting documents to upload (documents are not retrieved from VA systems)
- Legal framework definitions (38 CFR § 3.310, presumptive pathways) are accurate as of the specified authoring date and will be audited periodically via regulatory preflight
- VA rating schedule citations are provided by the VA and do not require independent interpretation
- Users understand that suggestions are research starting points requiring further evaluation with qualified providers or representatives
- The application is informational only and does not constitute medical, legal, or benefits-eligibility advice

---

**Version:** 1.5 — v1.3 adds Phase 1+2 research aids (Ideas #1 Medical Record Checklist on Step 6 + #2 Comparison + #10 Combination Insights on Step 5 + #3 Rating Guide + #5 Action Plan on Steps 5&6) as informational projections of authored KB/catalog via `recommend()`, upgrades the Rating Guide to a condition-selector explorer with per-condition symptom notes, adds the pathway-specific record checklist on Steps 5/6, adds rule-based Pathway Evidence Mapping on Step 6, and adds a printable action card for the Action Plan; v1.4 harmonizes the Idea #4 evidence-strength signal onto shared color-coded consensus badge primitives with tooltips and a condition-specific literature sentence across all suggestion surfaces; v1.5 documents the shipped Idea #8 Accredited Representative & VSO locator (Steps 5/6 + `/presumptive/results`) with the 38 U.S.C. § 5904 fee note (no upfront cost; fees only after decision + approved fee agreement) and optional directory specializations (no new data collection, LLM, or `connect-src` change)  
**Last Updated:** September 10, 2026  
**Status:** Production (Vercel deployment) — `main` @ `ec95321` + Phase 1+2  
**Change note (v1.1→v1.2):** Documented Phase 1 (`01ac471`) + Phase 2 (`a6bed87`) research aids as §10 and extended the Step 5/6 table rows: #1 `medical-record-checklist.ts` / `MedicalRecordChecklist.tsx` (7-category `categorizeGap`, `WHY_BY_CATEGORY`, in-memory checklist + download), #2 `condition-comparison.ts` / `ConditionComparisonTool.tsx` (≤3, 7-col table + `consensusBadgeTone`), #10 `combination-insights.ts` / `CombinationInsightsPanel.tsx` (pairwise synergistic/independent/conflicting over top-5, capped 10), #3 `rating-guide.ts` / `RatingGuide.tsx` (`GENERIC_RATING_SCALE` + 8 prompts, no percentage inference), #5 `action-plan.ts` / `ActionPlan.tsx` (`CONSENSUS_ORDER` ranking + 4-step plan + timeline + `va.gov`/`OGC` links). No new data collection, LLM, or `connect-src` change. Prior v1.1 change note retained for 6-step / cookie / cache / regulatory provenance.

*Prior — v1.0→v1.1:* Corrected 8-step narrative to implemented 6-step workflow with explicit step-mapping table; split secondary’s optional bounded history/timeline/symptom context from the presumptive track’s service-location/date matching; synchronized catalog/KB counts and CRG/audit details to `docs/product-spec.md` baseline (813 / 363 / 140 / 673 / 379) and `npm run citations:audit` ceilings; clarified browser-local evidence, session-cookie (30-min, `HttpOnly`/`SameSite=Strict`/AES-256-GCM), cache (5-min LRU-32), and regulatory snapshot-locking (Step 5→Step 6 `regSnapshot` reuse / `missingLockedRegulatorySnapshot` fail-closed) against `src/lib` implementation.
