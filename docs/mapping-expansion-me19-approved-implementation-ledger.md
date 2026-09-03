# Mapping Expansion ME-19 — Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY — CITATIONS PENDING VERIFICATION**

Required baseline: `f4537b5014297c8e1c783a1b38291367636c418a`
Commit subject: `map: mapping expansion ME-19 (5 relationships)`
Issue: #360 Mapping Expansion Wave (ME-15+); first batch over the 2026-09 Wave-8 master-list catalog expansion (311 -> 813 conditions)

## Approved scope

Five bounded relationships approved by qualified-human review on 2026-09-02 (rows from `docs/mapping-expansion-me19-plan.md`). All five rows enter at rank 1 on previously unregistered, framework-only draft primaries (`draft: true`, empty suggestions) introduced by the Wave-8 catalog expansion; each primary's live publication state is read immediately before mutation and preserved unchanged (all five remain draft). All five new clinical source references enter as `verified:false`; matching master sources (all five new) enter as `pending-verification`. Citation verification is separately gated and remains out of scope for this implementation batch.

## 1. `traumatic-brain-injury-residuals` → `depressive-disorder`
- Rank: **1** — PMID: **25038422** — DOI: `10.1016/j.neubiorev.2014.07.007`
- Source: Osborn AJ, Mathias JL, Fairweather-Schmidt AK. Depression following adult, non-penetrating traumatic brain injury: a meta-analysis examining methodological variables and sample characteristics. Neurosci Biobehav Rev. 2014;47:1-15. PMID 25038422. doi:10.1016/j.neubiorev.2014.07.007.
- Claim boundary: population-level-comorbidity-association
- Guard: Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual's depressive disorder.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 2. `allergic-rhinitis` → `asthma`
- Rank: **1** — PMID: **31660100** — DOI: `10.1016/j.waojou.2019.100069`
- Source: Tohidinik HR, Mallah N, Takkouche B. History of allergic rhinitis and risk of asthma; a systematic review and meta-analysis. World Allergy Organ J. 2019;12(10):100069. PMID 31660100. doi:10.1016/j.waojou.2019.100069.
- Claim boundary: population-level-association
- Guard: Require documented allergic rhinitis and separately established asthma before presenting the relationship; the cited systematic review and meta-analysis reported that a history of allergic rhinitis is strongly associated with increased risk of asthma, consistent with the united-airway/allergic-march concept, without establishing that allergic rhinitis caused an individual's asthma. Preserve other asthma triggers (viral infection, occupational exposures, exercise, irritants, gastroesophageal reflux) and other rhinitis phenotypes (non-allergic, vasomotor, mixed) as competing explanations. Do not infer asthma from rhinitis symptoms, spirometry in isolation, or self-reported wheeze alone.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 3. `diabetic-nephropathy` → `chronic-kidney-disease`
- Rank: **1** — PMID: **36272764** — DOI: `10.1016/j.kint.2022.06.008`
- Source: Kidney Disease: Improving Global Outcomes (KDIGO) Diabetes Work Group. KDIGO 2022 Clinical Practice Guideline for Diabetes Management in Chronic Kidney Disease. Kidney Int. 2022;102(5S):S1-S127. PMID 36272764. doi:10.1016/j.kint.2022.06.008.
- Claim boundary: guideline-recognized-association
- Guard: Require established diabetic nephropathy (documented albuminuria and/or persistent eGFR decline in a person with diabetes with a compatible phenotype) and separately documented chronic kidney disease; the cited KDIGO clinical practice guideline addresses diabetes management in chronic kidney disease and recognizes diabetic kidney disease as a leading cause of chronic kidney disease, without establishing that any individual's chronic kidney disease is diabetic in origin. Preserve hypertensive, ischemic/renovascular, obstructive, primary glomerular, interstitial, and other chronic kidney disease etiologies as competing explanations. Do not infer diabetic nephropathy from isolated creatinine elevation or from diabetes alone, and do not treat this guideline-framed association as proof that diabetic nephropathy caused an individual's chronic kidney disease.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 4. `menstrual-disorders` → `anemia`
- Rank: **1** — PMID: **37538011** — DOI: `10.1002/ijgo.14943`
- Source: Munro MG. Heavy menstrual bleeding, iron deficiency, and iron deficiency anemia: Framing the issue. Int J Gynaecol Obstet. 2023;162(Suppl 2):7-13. PMID 37538011. doi:10.1002/ijgo.14943.
- Claim boundary: population-level-clinical-framing-association
- Guard: Require documented abnormal uterine bleeding/heavy menstrual bleeding and objective iron-deficiency anemia (hemoglobin and/or ferritin compatible with iron deficiency) with compatible chronology; the cited review frames heavy menstrual bleeding as the most common cause of iron deficiency and iron deficiency anemia among reproductive-age women without establishing that an individual's anemia is menstrual in origin. Preserve gastrointestinal blood loss, malabsorption, dietary iron deficiency, chronic disease or inflammatory anemia, hemolysis, renal disease, and other gynecologic causes as competing explanations. Do not infer anemia from bleeding history alone, and do not treat this population-level association as proof that menstrual bleeding caused an individual's anemia.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## 5. `oral-lichen-planus-lichenoid-lesions` → `oral-cancer`
- Rank: **1** — PMID: **28438300** — DOI: `10.1016/j.oraloncology.2017.03.012`
- Source: Aghbari SMH, Abushouk AI, Attia A, Elmaraezy A, Menshawy A, Ahmed MS, Elsaadany BA, Ahmed EM. Malignant transformation of oral lichen planus and oral lichenoid lesions: A meta-analysis of 20095 patient data. Oral Oncol. 2017;68:92-102. PMID 28438300. doi:10.1016/j.oraloncology.2017.03.012.
- Claim boundary: population-level-malignant-transformation-association
- Guard: Require biopsy-documented oral lichen planus or oral lichenoid lesion and separately established oral squamous cell carcinoma with compatible chronology; the cited meta-analysis of 20,095 patients reported a low but nonzero rate of malignant transformation of oral lichen planus and oral lichenoid lesions without establishing that any individual's cancer arose from the lichenoid lesion. Preserve tobacco use, alcohol use, other premalignant lesions (leukoplakia, erythroplakia), HPV infection, immunocompromise, and other oral-cancer risk factors as competing explanations. Do not infer cancer from clinical appearance or from dysplasia alone, and do not treat this population-level association as proof that oral lichen planus caused an individual's oral cancer.
- Publication: **preserve live state; no draft/published change**
- Source state after mapping implementation: `verified:false` / `pending-verification`

## Projected non-publication counts
- Relationships: 263 → **268**
- Registered primaries: 174 → **179** (of 813 after the Wave-8 catalog expansion)
- Remaining primaries: 637 → **634**
- Remaining target-only: 37 → **37**
- References: 271 → **276**; verified remains **256**; unverified 15 → **20**
- Master sources: 233 active / 15 pending / 257 total → **233 active / 20 pending / 262 total**
- Clinical sources: 232 active / 15 pending → **232 active / 20 pending**
- Explicit publication guards: 189 → **194**
- P1/D1 counts are resolved from the read-before-write publication-state proof.

## Local implementation result
- 5/5 approved relationships added (all rank 1) as the first ME batch over the Wave-8 framework-only identities.
- Publication state preserved from the read-before-write proof: `{"traumatic-brain-injury-residuals": "draft", "allergic-rhinitis": "draft", "diabetic-nephropathy": "draft", "menstrual-disorders": "draft", "oral-lichen-planus-lichenoid-lesions": "draft"}`.
- 5/5 new source references remain `verified:false`; matching master sources are `pending-verification` (five new master source records, no reuse of active verified sources).
- Registered-primary coverage is 179/813; 634 primaries remain, with 37 target-only primaries unchanged.
- Citation verification remains separately gated (qualified-human decision required before any of the five references may become `verified:true`).
- No GitHub/Vercel write was performed beyond the commit+push of this batch.