# Mapping Expansion ME-18 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required baseline: `13812063f0408ea1cf3235370836a0ac867767ce`
Commit subject: `map: mapping expansion ME-18 (5 relationships)`
Issue: #360 Mapping Expansion Wave: Mental Disorders (ME-15+)

## Approved scope

Five bounded relationships approved by qualified-human review on 2026-09-01. All five rows enter at rank 1 on previously unregistered draft primaries; each primary's live publication state is read immediately before mutation and preserved unchanged (all five remain draft). All five new clinical source references enter as `verified:false`; matching master sources (all five new) enter as `pending-verification`. Citation verification is separately gated (approval decision pre-captured at planning: `approve-as-implemented` for all five).

## 1. `chronic-fatigue-syndrome` → `depressive-disorder`
- Rank: **1** — PMID: **12562565** — DOI: `10.1176/appi.ajp.160.2.221`
- Source: Afari N, Buchwald D. Chronic fatigue syndrome: a review. Am J Psychiatry. 2003;160(2):221-236. PMID 12562565. doi:10.1176/appi.ajp.160.2.221.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established chronic fatigue syndrome (CFS/ME) and a separately established depressive disorder; the cited review reported substantial comorbidity and symptom overlap between chronic fatigue syndrome and depressive and other psychiatric disorders without establishing onset order, direction, or individual causation. Preserve other medical illness, sleep disorders, substance use, medications, endocrine disease, anemia, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from fatigue, post-exertional malaise, or impairment alone, and do not treat this population-level association as proof that chronic fatigue syndrome caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 2. `illness-anxiety-disorder` → `depressive-disorder`
- Rank: **1** — PMID: **8039697** — DOI: `10.1016/0163-8343(94)90049-3`
- Source: Noyes R Jr, Kathol RG, Fisher MM, Phillips BM, Suelzer MT, Holt CS. Psychiatric comorbidity among patients with hypochondriasis. Gen Hosp Psychiatry. 1994;16(2):78-87. PMID 8039697. doi:10.1016/0163-8343(94)90049-3.
- Claim boundary: clinical-sample-comorbidity-association
- Guard: Require independently established DSM-5 illness anxiety disorder (or its hypochondriasis diagnostic predecessor) and a separately established depressive disorder; the cited psychiatric-consultation study reported major depression as the most frequent comorbid disturbance among patients with hypochondriasis without establishing individual causation or direction. Preserve other anxiety disorders, somatic symptom disorder, substance use, medical illness, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from health anxiety, illness-related distress, or impairment alone, and do not treat this clinical-sample association as proof that illness anxiety disorder caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 3. `cyclothymic-disorder` → `bipolar-disorder`
- Rank: **1** — PMID: **22459786** — DOI: `10.1016/j.cpr.2012.02.001`
- Source: Van Meter AR, Youngstrom EA, Findling RL. Cyclothymic disorder: a critical review. Clin Psychol Rev. 2012;32(4):229-243. PMID 22459786. doi:10.1016/j.cpr.2012.02.001.
- Claim boundary: population-level-spectrum-association
- Guard: Require independently established cyclothymic disorder and a separately established full bipolar disorder (type I or II) before presenting the relationship; the cited critical review characterizes cyclothymic disorder as a chronic and impairing disorder on the bipolar spectrum and does not establish that any individual will progress to full bipolar disorder. Preserve major depressive disorder, other bipolar-spectrum presentations, substance use, medications, personality factors, and other psychiatric illness as competing explanations. Do not infer bipolar disorder from hypomanic or depressive symptoms alone, and do not treat this spectrum-level association as proof that cyclothymic disorder caused an individual's bipolar disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 4. `alopecia-areata` → `depressive-disorder`
- Rank: **1** — PMID: **31163237** — DOI: `10.1016/j.jaad.2019.05.086`
- Source: Okhovat JP, Marks DH, Manatis-Lornell A, Hagigeorges D, Locascio JJ, Senna MM. Association between alopecia areata, anxiety, and depression: a systematic review and meta-analysis. J Am Acad Dermatol. 2023;88(5):1040-1050. PMID 31163237. doi:10.1016/j.jaad.2019.05.086.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established alopecia areata and a separately established depressive disorder; the cited systematic review and meta-analysis reported significantly increased odds of depression among patients with alopecia areata without establishing onset order or direction. Preserve other dermatologic disease, autoimmune disease, thyroid disease, medications, substance use, psychosocial stressors, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from hair-loss-related distress, appearance concern, or impairment alone, and do not treat this population-level association as proof that alopecia areata caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 5. `vitiligo` → `depressive-disorder`
- Rank: **1** — PMID: **27878819** — DOI: `10.1111/bjd.15199`
- Source: Lai YC, Yew YW, Kennedy C, Schwartz RA. Vitiligo and depression: a systematic review and meta-analysis of observational studies. Br J Dermatol. 2017;177(3):708-718. PMID 27878819. doi:10.1111/bjd.15199.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established vitiligo and a separately established depressive disorder; the cited systematic review and meta-analysis reported significantly increased odds of depression among patients with vitiligo without establishing onset order or direction. Preserve other dermatologic disease, autoimmune disease, thyroid disease, medications, substance use, psychosocial stressors, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from skin-pigmentation-related distress, stigmatization, or impairment alone, and do not treat this population-level association as proof that vitiligo caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## Projected non-publication counts
- Relationships: 258 → **263**
- Registered primaries: 169 → **174**
- Remaining primaries: 142 → **137**
- Remaining target-only: 37 → **37**
- Remaining never-used: 105 → **100**
- References: 266 → **271**; verified remains **256**; unverified 10 → **15**
- Master sources: 233 active / 10 pending / 252 total → **233 active / 15 pending / 257 total**
- Clinical sources: 232 active / 10 pending → **232 active / 15 pending**
- Explicit publication guards: 184 → **189**
- P1/D1 counts are resolved from the read-before-write publication-state proof.

## Local implementation result
- 5/5 approved relationships added (all rank 1).
- Publication state preserved from the read-before-write proof: `{"chronic-fatigue-syndrome": "draft", "illness-anxiety-disorder": "draft", "cyclothymic-disorder": "draft", "alopecia-areata": "draft", "vitiligo": "draft"}`.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification` (five new master source records, no reuse of active verified sources).
- Registered-primary coverage is 174/311; 137 primaries remain, partitioned 37 target-only / 100 never-used.
- Citation verification remains separately gated (qualified-human decision approve-as-implemented pre-captured at planning for the verify commit).
- No GitHub/Vercel write was performed beyond the commit+push of this batch.