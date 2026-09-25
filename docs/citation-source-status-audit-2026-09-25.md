# Master Source Registry — Retraction & Publication-Type Audit (2026-09-25)

Status: audit complete — **PASS, zero blocking findings**. A short human-review list is recorded below.

## Scope

Every source entity in the master registry (`data/evidence/master-sources.json`) was audited:

| | count |
|---|---|
| Registry entities (`sources` list) | 982 |
| Entities with a unique PubMed ID (checked live) | 980 |
| Non-PubMed entities (skipped — no PubMed record exists) | 2 |
| Blocking flags found (retraction / withdrawal / expression of concern) | **0** |
| Non-blocking notes found | 38 (on 27 distinct PMIDs) |

The 2 skipped entities are `doi-10.1210/clinem/dgaf284` (Endocrine Society guideline, DOI-only) and `legal-38-cfr-3.310` (legal authority). Neither can carry a PubMed retraction status.

## Method

1. **Automated status sweep** — `node scripts/preflight-source-status.js --registry --json` (tool landed in PR #477; `--registry` mode added with this audit). For each PMID the tool pulls esummary bibliographic data and efetch XML, then classifies:
   - **Blocking (exit 1):** publication types `Retracted Publication`, `Retraction of Publication`, `Retracted and Republished Article`, `Withdrawn Publication`, `Expression of Concern`, or linked notices `RetractionIn` / `RetractionOf` / `RetractedAndRepublishedIn`; plus unresolvable PMIDs (`UNRESOLVED`).
   - **Non-blocking notes:** erratum linkage (`ErratumIn` on the cited record, `ErratumFor` on an erratum notice) and `Published Erratum` publication type.
2. **Independent publication-type sweep** — esummary `pubtype` fields for all 980 PMIDs were collected and screened for non-primary or anomalous classes (Editorial, Comment, Letter, Clinical Conference, etc.) beyond what the retraction guard covers.
3. **Usage cross-reference** — every flagged/annotated source was traced through `data/evidence/master-relationships.json` (`sourceIds`) to the KB relationships that cite it, so review effort can be prioritized by exposure.

## Headline result

**No source in the master registry is retracted, withdrawn, subject to an expression of concern, or retracted-and-republished.** The registry's citation base is clean on the retraction axis. This also retrospectively confirms the batch-57 exclusion: PMID 17895057 (retracted post-stroke osteopenia study) was caught pre-authoring and never entered the registry.

## Finding 1 — Erratum-linked records (36 notes, benign)

36 notes mark cited originals that have a published erratum (`ErratumIn`). Errata are corrections, not retractions: the cited work stands, and in every case the registry entry remains the corrected, current version of record. 13 of these entities are `active`, 13 are `pending-verification`.

Most erratum-linked sources are major society guidelines, which routinely accumulate correction notices:

| PMID | Source (abbrev.) | Errata | Registry status | Cited by (relationship) |
|---|---|---|---|---|
| 33332150 | Otto 2020 ACC/AHA valvular heart disease guideline | 4 | pending-verification | heart-valve-disorders→congestive-heart-failure |
| 26373316 | Baddour 2015 AHA infective endocarditis guideline | 3 | pending-verification | heart-valve-disorders→cardiac-inflammatory-disease |
| 37622656 | Delgado 2023 ESC endocarditis guideline | 3 | pending-verification | heart-valve-disorders→cardiac-inflammatory-disease |
| 40811497 | Jones 2025 AHA/ACC hypertension guideline | 3 | active | hypertension→CKD / CHF / erectile-dysfunction / ischemic-heart-disease |
| 37622657 | Arbelo 2023 ESC cardiomyopathies guideline (erratum 2026-08) | 1 | active | cardiomyopathy→cardiac-arrhythmia / congestive-heart-failure |
| 36017548 | Humbert 2022 ESC/ERS pulmonary hypertension guideline | 1 | active | pulmonary-hypertension→congestive-heart-failure |
| 34453165 | Vahanian 2021 ESC/EACTS valvular heart disease guideline | 1 | pending-verification | heart-valve-disorders→congestive-heart-failure |
| 30586772 | Kusumoto 2018 ACC/AHA/HRS bradycardia guideline | 1 | pending-verification | heart-block→cardiomyopathy |
| 24893135 | Lenders 2014 Endocrine Society pheochromocytoma guideline | 1 | active | pheochromocytoma→hypertension |
| 24973422 | Stevens 2014 IDSA soft-tissue infection guideline | 1 | active | abscesses→cellulitis |
| 16815322 | Hudson 2007 eating-disorder prevalence (NCS-R) | 1 | active | binge-eating-disorder→depressive-disorder |
| 17485606 | Merikangas 2007 bipolar prevalence (NCS-R) | 1 | active | bipolar-disorder→anxiety-disorder |
| 28222820 | Wardenaar 2017 specific phobia prevalence (WMHS) | 1 | active | specific-phobia→depressive-disorder |
| 26540080 | Zhao 2016 neuropsychiatric symptoms in dementia | 1 | pending-verification | dementia→anxiety-disorder |
| 29222544 | Loughrey 2018 hearing loss & cognition meta-analysis | 1 | pending-verification | hearing-loss→cognitive-disorder |
| 33403599 | Cheng 2021 OSA in ILD meta-analysis | 1 | active | interstitial-lung-disease→sleep-apnea |
| 32680820 | prostate-cancer nationwide cohort (incontinence/ED) | 1 | active | prostate-cancer→urinary-incontinence / erectile-dysfunction |
| 32419072 | Pelsma 2020 NFPA visual outcomes | 1 | active | pituitary-neoplasm→visual-impairment |
| 36810235 | Bodilsen 2023 epilepsy after brain abscess | 1 | active | brain-abscess→seizure-disorder |
| 40576825 | Scheffel 2025 glioblastoma-associated epilepsy | 1 | pending-verification | brain-cancer→seizure-disorder |
| 36115370 | Meyer 2022 circadian rhythms review (Lancet) | 1 | pending-verification | circadian-rhythm-sleep-wake-phase-disorders→depressive-disorder |
| 33414529 | Ting 2021 infectious keratitis review | 1 | pending-verification | corneal-scarring→visual-impairment |
| 35762992 | Currie 2022 common hand conditions review (JAMA) | 1 | pending-verification | de-quervain-s-tenosynovitis→carpal-tunnel-syndrome |
| 33599244 | Oldroyd 2021 cancer screening in idiopathic inflammatory myopathies | 1 | pending-verification | dermatomyositis→interstitial-lung-disease / dysphagia |
| 37941415 | Santilli 2023 femoral neuropathy review | 1 | pending-verification | femoral-neuropathy→unexplained-chronic-pain |
| 40772230 | GERD–pulmonary disease incidence cohort | 1 | active | gerd→ 7 pulmonary edges |

**Review item (low priority):** skim the errata for the multi-correction guideline sources cited above — especially 33332150 (4 errata), 26373316, 37622656, and 40811497 (3 each) — to confirm none of the corrections touches the specific claim each edge relies on. Guideline errata are typically typographic or class-label fixes, but the volume warrants one human pass.

## Finding 2 — Erratum-as-source lineage record (2 notes, already dispositioned)

Both `erratum publication type` notes fall on a **single** entity: `pmid-33755913` (flagged once by the esummary publication type and once by the efetch `PublicationType` element). This entity *is* a Published Erratum notice (Sleep Breath 2021, correcting PMID 33403599). It is held as `status: bibliographic-correction-only`, `kind: bibliographic-lineage`, is cited by **no** relationship, and exists only to document the bibliographic correction chain for 33403599. No action needed.

## Finding 3 — Publication-type anomalies (independent sweep)

The type distribution across the 980 checked records is appropriate for an evidence registry: Journal Article (956), Review (288), Systematic Review (142), Meta-Analysis (109), Case Reports (95), Practice Guideline (14), Consensus Statement (8), Randomized Controlled Trial (7). No record anywhere carries `Retracted Publication`, `Retraction of Publication`, `Retracted and Republished Article`, `Withdrawn Publication`, `Expression of Concern`, `Duplicate Publication`, or `Corrected and Republished Article`.

The following non-primary classes surfaced and are the report's **primary human-review list**, because these edges rest on sources weaker than the registry's usual evidence base:

| PMID | Type | Source (abbrev.) | Cited by (relationship) | Note |
|---|---|---|---|---|
| 22110274 | Editorial | Chiarioni 2008 chronic proctalgia commentary | levator-ani-syndrome→unexplained-chronic-pain | opinion piece |
| 28628573 | Editorial + Comment | Royster 2017 postoperative atrial fibrillation | coronary-bypass-residuals→cardiac-arrhythmia | commentary |
| 28823525 | Letter | Andrès 2017 febrile neutropenia outcome | agranulocytosis→cellulitis | letter (registry status **active**) |
| 29516093 | Letter | Saceda-Corralo 2019 HRQoL in frontal fibrosing alopecia | frontal-fibrosizing-alopecia→depressive-disorder | letter |
| 30557132 | Letter | Ogawa-Momohara 2019 prognosis of dysphagia in dermatomyositis | dermatomyositis→dysphagia | letter |
| 38839197 | Letter | Slichter 2024 rater agreement, PTOA of DIP joints | mallet-finger→post-traumatic-osteoarthritis | letter |
| 40886835 | Letter | Doche 2024 eyebrow alopecia in FFA | frontal-fibrosizing-alopecia→loss-of-eyebrow | letter |
| 26448354 | Clinical Conference | Morgan 2015 spontaneous hemothorax | hemothorax→anemia | case-conference report |
| 28722973, 31536264, 31613509, 31971747, 32809652, 33085286, 33085409, 39163445, 42777106 | Study Guide (StatPearls chapter) | 9 StatPearls entries (bladder stones, AVN, eosinophilic gastroenteritis, pressure injury, exploding head syndrome, coccyx pain, vesicoureteral reflux, genitofemoral neuralgia, lupus panniculitis) | 10 relationship citations across cystitis/neurogenic bladder, avascular-necrosis, eosinophilic-gastroenteritis, decubitus-ulcers, exploding-head-syndrome, coccydynia, genitofemoral-nerve-neuralgia, lupus-profundus | tertiary references — acceptable as background support, weaker than primary studies |

Letters in peer-reviewed journals frequently carry original data (research letters), and none of these are retracted or flagged; the exposure is evidentiary weight, not validity. Three registry entities of this class are **not** cited by any relationship and need no review: `pmid-33755913` (erratum lineage), `pmid-37230817` and `pmid-40420581` (both `superseded-unverified` lineage letters).

Remaining types observed and judged non-anomalous: Historical Article (3 narrative reviews), Twin Study (1 primary epidemiology study), Clinical Trial classes (15), English Abstract (16).

## Conclusions

1. **Retraction axis: clean.** No registry source has been retracted, withdrawn, or questioned. Nothing must be pulled from the knowledge base.
2. **Errata: benign but worth one skim.** 26 cited originals carry correction notices; recommend a single human pass over the multi-erratum guideline corrections (33332150, 26373316, 37622656, 40811497) to confirm no cited claim changed.
3. **Evidence-weight review list:** 8 non-primary sources (2 editorial/comment, 5 letter, 1 clinical conference) plus 9 StatPearls chapters support 18 relationship citations. Each edge should eventually be rested on, or supplemented with, primary evidence where available — a standing improvement item, not a defect.
4. **Ongoing monitoring:** re-run `npm run citations:preflight -- --registry` on every batch landing (it is already wired into the authoring workflow's pre-verification step for new PMIDs) and treat this report as the baseline for citation-decay monitoring.

## Reproduction

```bash
node scripts/preflight-source-status.js --registry --json > /tmp/registry-audit.json
# expected: ok=true, refsConsidered=982, pmidsChecked=980, skipped=2, flags=0
```

Audit date: 2026-09-25. Registry snapshot: 982 sources / 634 relationships at audit time.
