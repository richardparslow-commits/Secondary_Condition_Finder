# Liver Cancer to Sarcopenia Citation Verification 2026 (packet row 504)

- Parent HEAD: `76e7868f193f19e5b0114534a2a802f347cfd732`
- Reviewer: **Richard, repository owner** — decision recorded 2026-10-04 ("Narrow, then verify")
- Status: **approved and implemented locally**
- Scope: **citation-verification-only** — no taxonomy change, no mapping targets or ranks changed, no `pathwayIntelligence`, and **no new relationship row added**
- Mapping: `liver-cancer → sarcopenia` (draft), relationship `rel-liver-cancer-to-sarcopenia`
- Packet: `docs/d1-citation-verification-packet-2026-09.md` row 504 (superseded by this record; the packet is generated and the next queue run drops the row)
- Sources verified: PMID **37274463**, PMID **36590214**, PMID **26266324** — all three promoted `verified:true` with `sourceCheckedOn` 2026-10-04

## Decisions

| Anchor | PMID | Decision | Basis |
| --- | --- | --- | --- |
| 504.1 | 37274463 | **VERIFY-WITH-NARROWING** | pooled prevalence 42 percent (48 studies, 8,959 patients) confirmed; the "CT-defined" description narrowed to the full text's composition |
| 504.2 | 36590214 | **VERIFY-WITH-NARROWING** | pooled prevalence 39 percent and OS HR 1.84 / PFS HR 1.33 confirmed; the "CT-defined" description narrowed to the six pooled assessment methods |
| 504.3 | 26266324 | **VERIFY-AS-WRITTEN** | 90-patient curative-intent cohort confirmed as written (CT L3-SMI, 57.8 percent, OS 33 vs 105 months, HR 3.756, no DFS difference) |

## Recorded narrowing

- **PMID 37274463** — the pooled 42 percent prevalence is **not uniformly CT-defined**. The full text states that in **43 of the 48** studies the skeletal muscle near the third lumbar vertebra was detected by CT (three of the 43 also used grip strength by hand dynamometer), in **four** studies CT detected the psoas muscle near L3, and **one** study used MRI to detect the fat-free muscle area (FFMA) near the superior mesenteric artery; each study's original definition was retained because no unanimous standard exists.
- **PMID 36590214** — the pooled 39 percent prevalence and the pooled hazard ratios are **not CT-defined**. Six assessment methods were pooled: CT-based SMI, PMI and TPV at L3; CT-based TPMT/BH and IMAC at the umbilicus; and MRI-derived FFMA. Method-specific prevalences: SMI 40 percent (33–47), PMI 31 percent (23–41), other methods 52 percent (42–62).
- The **figures themselves are unchanged**; only the assessment-method description on the proposition/note text (and its mirrors in the graph edge and the registry guard) was narrowed to match the sources.

## Review evidence (SOP)

- URL / identity: `https://pubmed.ncbi.nlm.nih.gov/37274463/`, `…/36590214/`, `…/26266324/`; DOIs and titles matched; full texts via Europe PMC (`PMC10236145`, `PMC9794869`); PubMed HTML was bot-walled on 2026-10-03, so metadata/abstracts were read through NCBI E-utilities.
- Claim reviewed: the bounded `ASSOCIATION_ONLY` proposition (population-level co-occurrence and prognostic association in established hepatocellular-carcinoma populations; no individual causation or aggravation).
- Unresolved limitations carried: definition and threshold heterogeneity across pooled studies; predominantly retrospective cohorts; no separation of sarcopenia from cancer cachexia; the cohort's survival signal runs mainly through major complications and treatment-related mortality rather than disease-free survival; no anchor separates tumor-driven loss from cirrhosis, alcohol exposure, aging, nutrition or treatment effects.

## Digest policy (disclosed, not hidden)

No `contentDigest` is recorded on any of the three promotions because PubMed record pages are dynamic per fetch (same length, different digests across fetches), and the citation-verification SOP requires a dynamic page to **omit** a digest rather than record a false-positive value (batch-92 precedent). Consequence: undigested-verified references rise by 3; `MAX_UNDIGESTED_VERIFIED_REFS` (383) in `scripts/audit-citation-decay.js` was already exceeded and is deliberately **not raised** — the decay audit flags, and the condition is recorded rather than resolved.

## Registry lockstep (verification-only)

- `data/evidence/master-relationships.json`: the already-registered row's rationale, proposition text, evidence gaps and structured guard were updated to the narrowed text; `suggestionObjectHash` recomputed to the new suggestion object.
- `data/evidence/master-sources.json`: `pmid-37274463`, `pmid-36590214` and `pmid-26266324` moved `pending-verification → active`, `verified false → true`, `sourceCheckedOnValues` → 2026-10-04, `rawReferenceHashes` recomputed, and each carries a `verificationState` block (`approve-with-narrowing`, 2026-10-04, `automaticPromotionAuthorized:false`, `mappingApprovalDoesNotEqualCitationVerification:true`).
- Hash form discipline: only the edited relationship row and the three promoted entities were recomputed; all other rows keep their prior hash form.
- CRG note: **no new relationship row and no graph adjacency change**, so no redundancy/cycle review is created; the registered window discipline (liver-cancer → cirrhosis-of-the-liver stands; a future cirrhosis → sarcopenia window still needs `audit:crg` adjudication) is unchanged.

## Citation state after implementation

- References **1,699** (unchanged) / live verified **398** (`+3`) / retired verified **6** / verified provenance **404** (`+3`) / unverified **1,301** (`−3`) / review findings **0**
- Clinical-evidence references with URLs **1,694**; clinical-evidence provenance with URLs **1,698** (unchanged)
- Source entities **1,492** total; active **360**, active clinical **359**; pending-verification **1,123**, pending clinical **1,123**
- Relationships **873** (unchanged) / explicit guards **799** / legacy boundaries **74**

## Correction annotation (2026-10-04, redundancy-window adjudication)

The CRG note above assumed a registered `liver-cancer` → `cirrhosis-of-the-liver` edge. That premise
was checked against the live corpus and found inaccurate: no such registration exists (and none ever
did; see `docs/cirrhosis-of-the-liver-sarcopenia-redundancy-adjudication-2026-disposition.md`). The
citation-verification decisions and every count above are unaffected — this annotation corrects the
window-discipline premise only. The `.json` companion retains the same premise text as the dated
machine record.

## Boundary

The three anchors are verified only for the existing bounded `liver-cancer → sarcopenia` association proposition, with the recorded narrowing applied. This establishes neither causation nor aggravation under 38 CFR 3.310 for any individual, changes no taxonomy, adds no relationship row, and authorizes no `pathwayIntelligence`. Individual claims still require a documented HCC diagnosis and treatment timeline, a reproducible muscle-mass measurement with its stated threshold, assessment of cirrhosis severity and alcohol exposure, exclusion of cachexia-dominant wasting and independent nutritional disease, and qualified clinical opinion.
