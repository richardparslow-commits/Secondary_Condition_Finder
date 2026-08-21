# Mapping Expansion ME-6 — Approved Local Implementation Ledger

- Required baseline: `3e47fae71adf4ab80e7804076c36e2c839790e17`
- Status: **APPROVED-AND-IMPLEMENTED-LOCALLY — CITATIONS PENDING VERIFICATION**
- Scope: **5 relationships / rank 2 / sometimes-explored**
- New citations: **5 clinical sources, all `verified:false` / `pending-verification`**
- Semantic broadening: **NOT AUTHORIZED**
- Citation promotion: **NOT AUTHORIZED**
- Remote writes: **NOT AUTHORIZED**

## Approved rows

### 1. `hyperaldosteronism -> cardiac-arrhythmia`
- Existing P1 target required before implementation: `hypertension`
- Phenotype restriction: **atrial fibrillation only**
- PMID **29129575**
- DOI `10.1016/S2213-8587(17)30319-4`
- Citation: Monticone S, D'Ascenzo F, Moretti C, et al. Cardiovascular events and target organ damage in primary aldosteronism compared with essential hypertension: a systematic review and meta-analysis. Lancet Diabetes Endocrinol. 2018;6(1):41-50. PMID 29129575. doi:10.1016/S2213-8587(17)30319-4.
- Evidence type: systematic review and meta-analysis
- Approved publication guard: Use the broad cardiac-arrhythmia target only for separately documented atrial fibrillation. Require a confirmed primary-aldosteronism phenotype with autonomous aldosterone excess and suppressed renin; do not generalize this source to unspecified hyperaldosteronism. Treat the meta-analysis as population-level excess-risk evidence, not proof that primary aldosteronism caused atrial fibrillation in an individual. Preserve age, hypertension duration and severity, structural or valvular heart disease, thyroid disease, sleep-disordered breathing, alcohol exposure, and other established atrial-fibrillation contributors.

### 2. `testicular-cancer -> erectile-dysfunction`
- Existing P1 target required before implementation: `hypogonadism`
- Phenotype restriction: **treatment-related erectile dysfunction**
- PMID **29730199**
- DOI `10.1016/j.juro.2018.04.077`
- Citation: Bandak M, Lauritsen J, Johansen C, et al. Sexual Function in a Nationwide Cohort of 2,260 Survivors of Testicular Cancer after 17 Years of Followup. J Urol. 2018;200(4):794-800. PMID 29730199. doi:10.1016/j.juro.2018.04.077.
- Evidence type: nationwide long-term survivor cohort
- Approved publication guard: Require documented testicular cancer, actual exposure to a treatment regimen supported by the source (including BEP chemotherapy, abdominal radiotherapy, post-chemotherapy retroperitoneal surgery, or multiple treatment lines as applicable), and separately established erectile dysfunction with compatible post-treatment chronology. Do not infer erectile dysfunction from the cancer diagnosis or unilateral orchiectomy alone. Preserve pre-treatment erectile symptoms, hypogonadism, vascular and metabolic disease, medications, neurologic disease, psychological or relationship factors, and other erectile-dysfunction causes.

### 3. `ovarian-cancer -> lymphedema`
- Existing P1 target required before implementation: `peripheral-neuropathy`
- Phenotype restriction: **lower-extremity lymphedema after lymph-node dissection**
- PMID **27400319**
- DOI `10.1097/IGC.0000000000000757`
- Citation: Ki EY, Park JS, Lee KH, Hur SY. Incidence and Risk Factors of Lower Extremity Lymphedema After Gynecologic Surgery in Ovarian Cancer. Int J Gynecol Cancer. 2016;26(7):1327-1332. PMID 27400319. doi:10.1097/IGC.0000000000000757.
- Evidence type: ovarian-cancer surgical cohort
- Approved publication guard: Require documented ovarian cancer, documented pelvic and/or para-aortic lymph-node dissection or lymphadenectomy, and separately established lower-extremity lymphedema with compatible postoperative chronology. Do not infer lymphedema from ovarian cancer, chemotherapy, or pelvic surgery without lymphatic-node disruption alone. Preserve venous thrombosis or insufficiency, obesity, infection, cardiac or renal edema, prior pelvic surgery or radiotherapy, malignant obstruction, and other causes of lower-extremity swelling.

### 4. `chronic-liver-disease -> anemia`
- Existing P1 target required before implementation: `cirrhosis-of-the-liver`
- Phenotype restriction: **advanced chronic liver disease with portal hypertension**
- PMID **31444993**
- DOI `10.1111/liv.14229`
- Citation: Scheiner B, Semmler G, Maurer F, et al. Prevalence of and risk factors for anaemia in patients with advanced chronic liver disease. Liver Int. 2020;40(1):194-204. PMID 31444993. doi:10.1111/liv.14229.
- Evidence type: advanced-chronic-liver-disease cohort
- Approved publication guard: Restrict this source proposition to documented advanced chronic liver disease with clinically established portal-hypertension or comparable advanced-disease features and require separately established anemia. Treat the source as population-level prevalence and risk-factor evidence, not proof that chronic liver disease caused anemia in an individual. Preserve gastrointestinal bleeding, iron or other nutritional deficiency, hemolysis, hypersplenism, chronic kidney disease, marrow disease, malignancy, medications or treatment effects, and other anemia etiologies.

### 5. `chronic-pyelonephritis -> hypertension`
- Existing P1 target required before implementation: `chronic-kidney-disease`
- Phenotype restriction: **reflux-nephropathy / pyelonephritic renal-scarring phenotype**
- PMID **12411757**
- DOI `10.1159/000066639`
- Citation: Köhler JR, Tencer J, Thysell H, et al. Long-term effects of reflux nephropathy on blood pressure and renal function in adults. Nephron Clin Pract. 2003;93(1):C35-C46. PMID 12411757. doi:10.1159/000066639.
- Evidence type: long-term adult reflux-nephropathy cohort
- Approved publication guard: Restrict this proposition to chronic pyelonephritis with objectively documented reflux-nephropathy or pyelonephritic renal scarring and require separately established hypertension. Do not generalize reflux-nephropathy evidence to a remote history of acute pyelonephritis or recurrent urinary infection without chronic renal damage. Treat the cohort as phenotype-specific risk evidence, not automatic individual causation. Preserve primary hypertension, diabetes, chronic kidney disease from other causes, renal-artery disease, endocrine causes, medications, and other contributors.

## Implementation boundary

No taxonomy identity, publication status, diagnostic/rating code, rank-1 relationship, pathwayIntelligence field, citation verification promotion, semantic broadening, GitHub write, or Vercel action is authorized. Mapping approval remains separate from later qualified-human citation verification.

## Local implementation result

- 5/5 relationships installed at rank 2.
- 5/5 new clinical sources remain `verified:false`.
- 5/5 normalized master sources are `pending-verification`.
- Semantic broadening: 0.
- No citation promotion, remote write, taxonomy change, publication-status change, rating-code change, or pathwayIntelligence change.
