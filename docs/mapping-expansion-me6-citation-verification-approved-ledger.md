# Mapping Expansion ME-6 — Qualified-Human Citation Verification Approved Ledger

- Required implementation baseline: `690163dfe606bdb515dbb6344bad99cc876044f8`
- Status: **APPROVED-AND-APPLIED-LOCALLY — 5/5 VERIFIED**
- Disposition: **4 as-implemented / 1 narrowed / 0 replacement / 0 reject**
- Citation promotion: **5 KB references + 5 master sources**
- Relationship changes: **1**
- Publication-guard changes: **1**
- Source-identity changes: **0**
- Remote writes: **NOT AUTHORIZED**

## Approved rows

### 1. `hyperaldosteronism -> cardiac-arrhythmia`
- PMID **29129575**
- DOI `10.1016/S2213-8587(17)30319-4`
- Decision: **approve-as-implemented**
- Implementation guard: Use the broad cardiac-arrhythmia target only for separately documented atrial fibrillation. Require a confirmed primary-aldosteronism phenotype with autonomous aldosterone excess and suppressed renin; do not generalize this source to unspecified hyperaldosteronism. Treat the meta-analysis as population-level excess-risk evidence, not proof that primary aldosteronism caused atrial fibrillation in an individual. Preserve age, hypertension duration and severity, structural or valvular heart disease, thyroid disease, sleep-disordered breathing, alcohol exposure, and other established atrial-fibrillation contributors.
- Final approved guard: Use the broad cardiac-arrhythmia target only for separately documented atrial fibrillation. Require a confirmed primary-aldosteronism phenotype with autonomous aldosterone excess and suppressed renin; do not generalize this source to unspecified hyperaldosteronism. Treat the meta-analysis as population-level excess-risk evidence, not proof that primary aldosteronism caused atrial fibrillation in an individual. Preserve age, hypertension duration and severity, structural or valvular heart disease, thyroid disease, sleep-disordered breathing, alcohol exposure, and other established atrial-fibrillation contributors.

### 2. `testicular-cancer -> erectile-dysfunction`
- PMID **29730199**
- DOI `10.1016/j.juro.2018.04.077`
- Decision: **approve-as-implemented**
- Implementation guard: Require documented testicular cancer, actual exposure to a treatment regimen supported by the source (including BEP chemotherapy, abdominal radiotherapy, post-chemotherapy retroperitoneal surgery, or multiple treatment lines as applicable), and separately established erectile dysfunction with compatible post-treatment chronology. Do not infer erectile dysfunction from the cancer diagnosis or unilateral orchiectomy alone. Preserve pre-treatment erectile symptoms, hypogonadism, vascular and metabolic disease, medications, neurologic disease, psychological or relationship factors, and other erectile-dysfunction causes.
- Final approved guard: Require documented testicular cancer, actual exposure to a treatment regimen supported by the source (including BEP chemotherapy, abdominal radiotherapy, post-chemotherapy retroperitoneal surgery, or multiple treatment lines as applicable), and separately established erectile dysfunction with compatible post-treatment chronology. Do not infer erectile dysfunction from the cancer diagnosis or unilateral orchiectomy alone. Preserve pre-treatment erectile symptoms, hypogonadism, vascular and metabolic disease, medications, neurologic disease, psychological or relationship factors, and other erectile-dysfunction causes.

### 3. `ovarian-cancer -> lymphedema`
- PMID **27400319**
- DOI `10.1097/IGC.0000000000000757`
- Decision: **approve-as-implemented**
- Implementation guard: Require documented ovarian cancer, documented pelvic and/or para-aortic lymph-node dissection or lymphadenectomy, and separately established lower-extremity lymphedema with compatible postoperative chronology. Do not infer lymphedema from ovarian cancer, chemotherapy, or pelvic surgery without lymphatic-node disruption alone. Preserve venous thrombosis or insufficiency, obesity, infection, cardiac or renal edema, prior pelvic surgery or radiotherapy, malignant obstruction, and other causes of lower-extremity swelling.
- Final approved guard: Require documented ovarian cancer, documented pelvic and/or para-aortic lymph-node dissection or lymphadenectomy, and separately established lower-extremity lymphedema with compatible postoperative chronology. Do not infer lymphedema from ovarian cancer, chemotherapy, or pelvic surgery without lymphatic-node disruption alone. Preserve venous thrombosis or insufficiency, obesity, infection, cardiac or renal edema, prior pelvic surgery or radiotherapy, malignant obstruction, and other causes of lower-extremity swelling.

### 4. `chronic-liver-disease -> anemia`
- PMID **31444993**
- DOI `10.1111/liv.14229`
- Decision: **approve-as-implemented**
- Implementation guard: Restrict this source proposition to documented advanced chronic liver disease with clinically established portal-hypertension or comparable advanced-disease features and require separately established anemia. Treat the source as population-level prevalence and risk-factor evidence, not proof that chronic liver disease caused anemia in an individual. Preserve gastrointestinal bleeding, iron or other nutritional deficiency, hemolysis, hypersplenism, chronic kidney disease, marrow disease, malignancy, medications or treatment effects, and other anemia etiologies.
- Final approved guard: Restrict this source proposition to documented advanced chronic liver disease with clinically established portal-hypertension or comparable advanced-disease features and require separately established anemia. Treat the source as population-level prevalence and risk-factor evidence, not proof that chronic liver disease caused anemia in an individual. Preserve gastrointestinal bleeding, iron or other nutritional deficiency, hemolysis, hypersplenism, chronic kidney disease, marrow disease, malignancy, medications or treatment effects, and other anemia etiologies.

### 5. `chronic-pyelonephritis -> hypertension`
- PMID **12411757**
- DOI `10.1159/000066639`
- Decision: **approve-with-narrowing**
- Implementation guard: Restrict this proposition to chronic pyelonephritis with objectively documented reflux-nephropathy or pyelonephritic renal scarring and require separately established hypertension. Do not generalize reflux-nephropathy evidence to a remote history of acute pyelonephritis or recurrent urinary infection without chronic renal damage. Treat the cohort as phenotype-specific risk evidence, not automatic individual causation. Preserve primary hypertension, diabetes, chronic kidney disease from other causes, renal-artery disease, endocrine causes, medications, and other contributors.
- Final approved guard: Require documented chronic pyelonephritis only in the presence of objectively established vesicoureteral reflux/reflux nephropathy with renal parenchymal scarring, and require separately established hypertension. Do not generalize this source to chronic pyelonephritis, recurrent urinary infection, or renal scarring without documented reflux nephropathy. Treat the cohort as phenotype-specific risk evidence rather than proof that reflux nephropathy caused hypertension in an individual. Preserve primary hypertension, diabetes, chronic kidney disease from other causes, renal-artery disease, endocrine causes, medications, and other contributors.

## Verification boundary

Four rows are verification-only promotions with unchanged proposition text and guards. `chronic-pyelonephritis -> hypertension` / PMID 12411757 is narrowed exactly to documented vesicoureteral reflux/reflux nephropathy with renal parenchymal scarring and separately established hypertension. No PMID/DOI/citation/URL identity, rank, prevalence, taxonomy, publication status, or pathwayIntelligence field may change. No remote writes are authorized.

## Local verification result

- 5/5 KB references promoted to `verified:true`.
- 5/5 master sources promoted to `active`.
- 4 rows preserved as implemented.
- `chronic-pyelonephritis -> hypertension` / PMID 12411757 narrowed exactly to documented vesicoureteral reflux/reflux nephropathy with renal parenchymal scarring and separately established hypertension.
- PMID, DOI, citation text, URL, rank, prevalence, taxonomy, publication status, and pathwayIntelligence identity remained unchanged.
- No remote writes.
