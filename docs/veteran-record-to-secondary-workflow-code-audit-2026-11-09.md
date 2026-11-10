# Veteran medical-records → possible secondary-claim workflow: code audit

**Audit date:** 2026-11-09 (America/Chicago)  
**Repository:** `richardparslow-commits/Secondary_Condition_Finder`  
**Inspected immutable baseline:** `6dc7eb2ec48a66654746e8cfe1a445e33ae831ec` (`main`)  
**Owner's target:** Existing VA service-connected/rated conditions + additional conditions and treatment findings in optional private VA/civilian medical records → candidate **causation, aggravation, or treatment-mediated** pathways → credible citations and limitations → clinician discussion summary and VSO direction. This is *research discovery*, not diagnosis, a nexus opinion, a probability of claim success or medical verification.

## Executive result

**Do not rebuild the existing six-step application.** It already has browser-local record extraction, bounded PDF/DOCX/text processing, browser-local OCR, service-connected selections and ratings, a directionally authored mapping engine, evidence excerpts, and text consultation downloads. The most consequential missing *end-to-end integration* is: **recognize additional condition candidates from uploaded records, obtain the veteran's confirmation and accurate VA claim status, then evaluate these candidates against already rated disabilities.** Today's Step 1 requires the veteran to select every diagnosis manually before uploading; subsequent matching is intentionally restricted to that preselected list. The downloaded packet is a **TXT**, not a first-class PDF with record/page-level provenance.

**Safety finding:** The existing secondary upload implementation is **browser-local**, not a server document upload. It has explicit sessionStorage bounds, guards, clearing and substantial tests. Retain that privacy-preserving architecture. Do **not** introduce central PHI storage or send unredacted uploads to a third-party model merely to implement discovery. This audit verifies source and automated tests, **not** a live production browser, production security certification, clinical evidence validity, or end-to-end retention on every user device.

## Evidence-backed status of the target workflow

| Target capability | Status in inspected code | Evidence and exact gap |
|---|---|---|
| Veteran enters VA-rated/service-connected primary disabilities | **Implemented manually** | `src/components/secondary/steps/DiagnosedStep.tsx` selects catalog diagnoses; `ServiceConnectedStep.tsx` marks each **Yes/No**; `RatingsStep.tsx` stores numerical ratings including 100% P&T. This requires *all* diagnosed conditions to be selected first. No automatic extraction/confirmation of VA-rating-decision award statuses. |
| Separate claimed/pending/denied/not-yet-claimed from already service-connected | **Not implemented in the secondary workflow** | `src/lib/secondary-workflow/browser-context.ts` and `state.ts` contain diagnosed IDs and a subset of service-connected IDs, but no per-condition claim-status enum. The **No** radio bundles unclaimed, pending, denied and unknown. |
| Private optional medical-record upload/read | **Implemented browser-locally** | `src/components/secondary/steps/UploadStep.tsx` mounts `LocalEvidenceAnalyzer`; `src/lib/evidence/document-extract.ts` supports PDF, DOCX and text; `src/components/evidence/LocalEvidenceAnalyzer.tsx` includes browser OCR, pasted-text fallback, size/page/time bounds and cancellation. No medical-file server upload is used by this secondary workflow. |
| Find new, overlooked diagnoses or possible conditions *from* records | **Major missing integration** | `src/lib/evidence/extract.ts` classifies source excerpts, including diagnosis-like lines, **relative to existing selected-condition terms**. `UploadStep.tsx` builds terms from Step 1's selected diagnoses. It does not create a distinct candidate-diagnosis list and does not flow unselected extracted conditions to the user's confirmation screen. |
| Differentiate confirmed diagnosis vs symptoms, historical problem, ruled out, suspected | **Partial excerpt classification only** | `src/lib/evidence/extract.ts` classifies cues/phrases with provenance; no longitudinal, reviewed condition-status model connecting excerpt certainty to newly added candidate conditions. Avoid auto-labeling a condition clinically diagnosed based on one mention/ICD code. |
| Match already rated A → possible secondary B | **Implemented for manually preselected B** | `src/lib/secondary-workflow/recommendation-intake.ts`, `suggestions.ts`, `src/lib/engine/recommend.ts`: only the user's selected diagnosed non-service-connected IDs are considered. `SuggestionsStep.tsx` explicitly says Step 5 *does not suggest new medical conditions*. This is the **opposite** of automatic overlooked-condition discovery. |
| Causation vs aggravation vs treatment-mediated pathway | **Implemented at authored research layer, but record-personalization incomplete** | `src/lib/evidence/pathway-mapper.ts` separates `DIRECT_CAUSATION`, `AGGRAVATION`, `ASSOCIATION_ONLY`; mechanism categories include pharmacological and treatment-related. `src/lib/engine/signals.ts` flags chronology/alternative etiologies. No systematic per-condition onset/treatment/baseline extraction from medical records nor diagnosis-status confirmation. Current context uses optional manually entered years and medication/treatment text. |
| Published citations and source traceability | **Implemented for authored mappings; DEV research distinct** | `src/lib/engine/recommend.ts`, `src/lib/engine/export.ts` carry source references, URLs, verification labels and warnings. `src/lib/client-corpus/client-corpus.ts` publishes a static corpus. PubMed candidate research and qualified-review ledgers in Tiger Cloud DEV are **research pipelines**, not a live patient-specific feed into the current browser UI. Never equate a bibliographic match with clinically confirmed support or a percentage of VA approval. |
| Evidence-file provenance and source excerpt review | **Implemented in current browser, not end-to-end packet** | `src/lib/evidence/extract.ts` captures source name, excerpt and locator; `src/lib/evidence/storage.ts` bounds tab-local retention; `src/lib/evidence/pathway-mapper.ts` compares local excerpts with matched pathways. The downloadable general consultation packet **omits raw evidence excerpts**, so exact file/page-linked evidence isn't carried into a doctor-ready report. |
| Download doctor/VSO packet | **Implemented as TXT + browser print** | `src/components/ConsultationPacketDownload.tsx` exports `secondary-condition-consultation-packet.txt`; `src/components/ConsultationSummaryDownload.tsx` exports TXT; `src/components/secondary/PrintReportButton.tsx` calls `window.print()`. No native PDF export with explicitly selected, citation-preserving excerpts and documented redaction consent. |
| Guidance for clinician and VA-accredited VSO | **Implemented** | `src/components/secondary/steps/EvidenceStep.tsx` renders clinician evidence checklist, `ActionPlan` and `AccreditedRepresentativeFinder`; disclaimers warn against clinical or claims conclusions. Preserve the separation: a physician assesses medical causation/aggravation; an accredited VSO helps with the claim. A privately purchased nexus letter is not universally required. |
| Durable cross-device patient account/medical-record vault | **Intentionally absent** | `docs/browser-local-veteran-workflow-design.md` and `docs/data-retention-policy.md` establish no central veteran file upload, tab-scoped sessionStorage and explicit completion cleanup. Browser session restoration is not secure-erasure proof. Do not implement cloud persistence without separate security/privacy/consent review. |
| VA account direct import | **Not a full production integration** | `src/app/va-account/` exists, but `docs/data-retention-policy.md` describes optional OAuth account access as **sandbox-only**. Do not promise production VA claims import or rating verification without separately validated OAuth/scopes and authorization. |

### Measured production-corpus artifact (local build, not Tiger DEV database)

Regenerated `public/kb/client-corpus.json` using `npm run build:embedded-data` and `npm run build:client-corpus` in a clean local clone. Parsed results:
- **819** catalog conditions.
- **140** published primary-mapping entries.
- **248** authored direct suggestion edges across those primary mappings.
- **5** graph nodes and **5** graph-anchor groups.

These are **what the current browser download receives**, not a claim about completeness of all research relationships in Tiger DEV or clinical correctness. Tiger DEV research-queue and mapping inventory counts are different datasets; they need a documented, clinically gated **research → public-corpus reconciliation** before assuming newly collected research appears in veteran-facing results. Do not auto-publish unreviewed candidates.

## Validation actually executed

On clean local checkout of pinned commit:

1. `npm ci --ignore-scripts --no-audit --no-fund` completed. Fresh checkout initially lacked generated `.data-bundle/embedded-data.generated`; initial `npm run typecheck` failed with TS2307 **only because build-generated data were absent**. After running the two standard data/corpus generation commands, **`npm run typecheck` passed**.
2. Evidence/privacy/workflow/packet suites: **13 test files, 85 tests passed**; includes `secondary-workflow.test.ts`, `secondary-workflow-privacy.test.ts`, `evidence-extraction.test.ts`, `evidence-storage.test.ts`, `consultation-packet.test.ts`, browser OCR and local save-refusal guards. The test runner reported jsdom canvas-not-implemented warnings; no test failed in that run.
3. Separate focused integration selection: **10 test files, 68 tests passed**; includes `e2e-workflow.test.ts`, `secondary-phase2.test.ts`, `secondary-research-aids-integration.test.ts`, `upload-contract.test.ts`, `privacy-browser-context.test.ts`, `pathway-evidence-mapper.test.ts`, `ingestion-privacy.test.ts`. Some tests overlap the first batch; **do not add these totals as unique tests**.
4. No personal veteran records, private credentials or patient documents were opened, uploaded or tested. No Production deployment or Tiger database write was performed. **No live browser visual/regression test** has been run in this audit.

## Risk-ranked next implementation sequence

### P0 — veteran-confirmed record-derived condition discovery (next code PR)

**Reuse** browser-local `LocalEvidenceAnalyzer` and the already parsed `EvidenceAnalysis` source/locator/excerpts. Add a bounded, deterministic, **review-only** `RecordConditionCandidate` with explicit evidence citation and classification:

- Candidate catalog ID + exact source phrase, source document ID/name, page/section locator, category: **confirmed-diagnosis statement / suspected-differential / historical / ruled-out / symptom-only / ambiguous**; maintain uncertainty and clinician-authored/unknown provenance separately. A word mention alone is not an actual diagnosed condition.
- Show all record-derived candidates in a **new explicit veteran confirmation screen**. Never silently add a condition as diagnosed or service-connected. Veteran can accept for *discussion*, reject, or mark uncertain; the app cannot create a new medical diagnosis. Keep all data in the same browser tab and honor source removal and cleanup.
- Add an independently chosen **claim status** for every candidate: service-connected, not yet claimed, pending, denied, unknown. Handle 0%-rated granted conditions. For pending/denied cases, show alternative discussion guidance, not a misleading list of *new claims*.
- After consent and confirmation, reconstruct normalized secondary candidate IDs and only then call the **existing** directional engine for A→B causation/aggravation/treatment pathways. Do not force the veteran to choose all possible candidates *before* uploading records.
- Add tests for negations, family history, historic-only diagnoses, symptom-only, ambiguous initials, ICD code in a rule-out section, duplicated documents, withdrawn record, unsupported catalog identities, reversed A/B direction, repeated refresh/back/clear and browser storage quota failures.
- Do not enable any server medical-record ingestion, automatic cloud upload, or clinical status promotion in this phase.

### P1 — confirm/organize existing VA award and claim status

Keep original VA-rated set distinct from the record-discovered set. Add clear option labels (rated incl. 0%, pending, denied, not filed, unsure) and a user-confirmation boundary. Optionally enable **local-only** VA rating-decision extraction with provenance, as a separate security-reviewed subphase; don't pretend to verify VA status from treatment notes. Use a versioned browser context schema/migration, not an unguarded state change.

### P1 — build a record-linked clinician discussion packet

Retain the existing TXT/print exports while adding an accessible **client-local PDF or print-to-PDF** packet. Include the user's explicitly selected/confirmed service-connected conditions, potential unclaimed conditions, direction and qualifying research citations, **user-approved/appropriately redacted** file/page excerpts (optional), chronology gaps, aggravation baseline question, medication mediation limitations, contradictory studies, and neutral questions to ask a clinician; separate VSO assistance and disclose that private nexus letters are not categorically required. No auto-drafted clinician certification.

### P1 — research provenance and breadth reconciliation

Compare the 819-condition/140-published-mapping/248-direct-suggestion browser corpus with the separate DEV condition/pathway/evidence inventories. Write a nonclinical coverage and provenance report per primary condition; reconcile missing *publication-eligible* authored research only after review. Prioritize real veteran-visible gaps over simply maximizing bibliographic candidates. Never import Tiger DEV research-only records directly into Production as clinical truth.

### P1 — browser upload privacy regression and usability

The current local parser is a **good foundation**, not a blanket security certification. Continue synthetic/malicious-document testing (PDF/DOCX bombs, OCR stalls, text from other records, prompt injection, duplicate sources, storage restoration on shared devices, cleanup failures). Ensure the app visibly explains tab-local retention and cannot accidentally export private passages without confirmation. No PHI in server/telemetry.

### P2 — calibrated research communication and optional professional review

Review wording such as `Etiological Consensus` and `Recommended Theory` in `src/lib/engine/export.ts`: clearly label that these are **authored research classification tiers** and not proven causal medical judgments. Where literature is only bibliographic or associative, say so. Keep optional qualified-human reviewer intake (PR #679) separate from everyday owner curation and from case-specific clinicians.

## Suggested first PR acceptance gate

A synthetic record containing an unselected, clearly documented diagnosis B is analyzed locally; the app surfaces B as **a candidate**, cites the document/page, asks the veteran to confirm, allows the veteran to mark it **not yet claimed**, and matches it against an explicitly confirmed already-service-connected A through the current directional corpus. A different synthetic record mentioning B only as *ruled out* does **not** become a confirmed diagnosis. The service-connected A and B never leave the browser; no unverified study is silently promoted; the result is explicitly a clinician discussion topic, not an individual medical or VA nexus determination.

**Decision:** Scope the next implementation PR to **P0 record-derived condition suggestions with user verification and fail-closed browser-only state**, preserving the existing six-step components and all non-PII research provenance. Follow with claim-status richness, doctor-ready PDF, and DEV/public coverage reconciliation.
