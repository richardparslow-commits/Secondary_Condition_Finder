# Mapping Expansion ME-17 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required baseline: `b3c9745fed30c66e994a92302baf2d78118802df`
Commit subject: `map: mapping expansion ME-17 (5 relationships)`
Issue: #360 Mapping Expansion Wave: Mental Disorders (ME-15+)

## Approved scope

Five bounded relationships approved by qualified-human review on 2026-09-01. All five rows enter at rank 1 on previously unregistered draft primaries; each primary's live publication state is read immediately before mutation and preserved unchanged (all five remain draft). All five new clinical source references enter as `verified:false`; matching master sources (all five new) enter as `pending-verification`. Citation verification is separately gated (approval decision pre-captured at planning: `approve-as-implemented` for all five).

## 1. `persistent-depressive-disorder` → `depressive-disorder`
- Rank: **1** — PMID: **16648329** — DOI: `10.1176/ajp.2006.163.5.872`
- Source: Klein DN, Shankman SA, Rose S. Ten-year prospective follow-up study of the naturalistic course of dysthymic disorder and double depression. Am J Psychiatry. 2006;163(5):872-880. PMID 16648329. doi:10.1176/ajp.2006.163.5.872.
- Claim boundary: population-level-temporal-risk (double depression; no individual causation)
- Guard: Require independently established persistent depressive disorder (dysthymia) and a separately documented major depressive episode superimposed upon it; the cited prospective follow-up found that most dysthymic patients developed a major depressive episode during ten years of observation; do not treat persistent depressive disorder as proof that any individual's depressive disorder was caused by it. Preserve other psychiatric illness, substance use, medical illness, medications, and shared vulnerability as competing explanations. Treat this only as population-level temporal risk, not proof that persistent depressive disorder caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 2. `somatic-symptom-disorder` → `depressive-disorder`
- Rank: **1** — PMID: **18433651** — DOI: `10.1016/j.genhosppsych.2007.10.008`
- Source: Löwe B, Spitzer RL, Williams JB, Mussell M, Schellberg D, Kroenke K. Depression, anxiety and somatization in primary care: syndrome overlap and functional impairment. Gen Hosp Psychiatry. 2008;30(3):191-199. PMID 18433651. doi:10.1016/j.genhosppsych.2007.10.008.
- Claim boundary: population-level-comorbidity-association (syndromal overlap)
- Guard: Require independently established DSM-5 somatic symptom disorder and separately established depressive disorder; the cited primary-care study reports syndromal overlap between somatization, depression, and anxiety and does not establish onset order or direction. Preserve medically explained symptoms, other psychiatric illness, substance use, medications, and shared vulnerability as competing explanations. Do not infer a depressive disorder from somatic symptoms, health concerns, or functional impairment alone, and do not treat this population-level association as proof that somatic symptom disorder caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 3. `fibromyalgia` → `depressive-disorder`
- Rank: **1** — PMID: **16908799** — DOI: `10.1001/archinte.166.15.1649`
- Source: Kato K, Sullivan PF, Evengård B, Pedersen NL. Chronic widespread pain and its comorbidities: a population-based study. Arch Intern Med. 2006;166(15):1649-1654. PMID 16908799. doi:10.1001/archinte.166.15.1649.
- Claim boundary: population-level-comorbidity-association (twin-study co-occurrence)
- Guard: Require independently established fibromyalgia or documented chronic widespread pain and a separately established depressive disorder; the cited population-based twin study found strong co-occurrence of chronic widespread pain with depressive symptoms, substantially mediated by shared genetic and family-environmental factors, and did not establish individual causation or direction. Preserve chronic fatigue, other functional somatic syndromes, musculoskeletal disorders, medications, substance use, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from pain, fatigue, or impairment alone, and do not treat this population-level association as proof that fibromyalgia caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 4. `irritable-bowel-syndrome` → `depressive-disorder`
- Rank: **1** — PMID: **11910364** — DOI: `10.1053/gast.2002.32392`
- Source: Whitehead WE, Palsson O, Jones KR. Systematic review of the comorbidity of irritable bowel syndrome with other disorders: what are the causes and implications? Gastroenterology. 2002;122(4):1140-1156. PMID 11910364. doi:10.1053/gast.2002.32392.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established irritable bowel syndrome and a separately established depressive disorder; the cited systematic review reported frequent comorbidity of irritable bowel syndrome with major depression and anxiety and does not establish onset order or direction. Preserve other functional gastrointestinal disorders, visceral hypersensitivity, infectious or inflammatory bowel disease, medications, substance use, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from gastrointestinal symptoms, distress, or impairment alone, and do not treat this population-level association as proof that irritable bowel syndrome caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 5. `tinnitus` → `depressive-disorder`
- Rank: **1** — PMID: **30909841** — DOI: `10.1177/0194599819835178`
- Source: Salazar JW, Meisel K, Smith ER, Quiggle A, McCoy DB, Amans MR. Depression in Patients with Tinnitus: A Systematic Review. Otolaryngol Head Neck Surg. 2019;161(1):28-35. PMID 30909841. doi:10.1177/0194599819835178.
- Claim boundary: population-level-comorbidity-association
- Guard: Require independently established chronic tinnitus and a separately established depressive disorder; the cited systematic review reported frequent depressive comorbidity across tinnitus patient samples and does not establish onset order or direction. Preserve hearing loss, otologic disease, noise exposure, medications, substance use, chronic pain, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from tinnitus-related distress, sleep disturbance, or impairment alone, and do not treat this population-level association as proof that tinnitus caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## Projected non-publication counts
- Relationships: 253 → **258**
- Registered primaries: 164 → **169**
- Remaining primaries: 147 → **142**
- Remaining target-only: 37 → **37**
- Remaining never-used: 110 → **105**
- References: 261 → **266**; verified remains **256**; unverified 5 → **10**
- Master sources: 233 active / 5 pending / 247 total → **233 active / 10 pending / 252 total**
- Clinical sources: 232 active / 5 pending → **232 active / 10 pending**
- Explicit publication guards: 179 → **184**
- P1/D1 counts are resolved from the read-before-write publication-state proof.

## Local implementation result
- 5/5 approved relationships added (all rank 1).
- Publication state preserved from the read-before-write proof: `{"persistent-depressive-disorder": "draft", "somatic-symptom-disorder": "draft", "fibromyalgia": "draft", "irritable-bowel-syndrome": "draft", "tinnitus": "draft"}`.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification` (five new master source records, no reuse of active verified sources).
- Registered-primary coverage is 169/311; 142 primaries remain, partitioned 37 target-only / 105 never-used.
- Citation verification remains separately gated (qualified-human decision approve-as-implemented pre-captured at planning for the verify commit).
- No GitHub/Vercel write was performed beyond the commit+push of this batch.