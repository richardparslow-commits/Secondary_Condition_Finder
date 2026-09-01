# Mapping Expansion ME-5 — Approved Local Implementation Ledger

- Required baseline: `16dbdc93bd4f2650829d46f64d567845f50c81d5`
- Status: **APPROVED-AND-IMPLEMENTED-LOCALLY — CITATIONS PENDING VERIFICATION**
- Scope: **5 relationships / rank 2 / sometimes-explored**
- New citations: **5 clinical sources, all `verified:false` / `pending-verification`**
- Citation promotion: **NOT AUTHORIZED**
- Remote writes: **NOT AUTHORIZED**

## Approved rows

### 1. `celiac-disease -> osteoporosis`
- Existing P1 target required before implementation: `schizophrenia`
- PMID **37730081**
- DOI `10.1016/j.bone.2023.116913`
- Citation: Hansen S, Schwarz P, Rumessen J, Linneberg A, Kårhus LL. Osteoporosis and bone fractures in patients with celiac disease: A nationwide cohort study. Bone. 2023;177:116913. PMID 37730081. doi:10.1016/j.bone.2023.116913.
- Evidence type: nationwide registry-based cohort
- Approved publication guard: Require documented celiac disease and separately established osteoporosis. Treat the source as population-level association/risk evidence rather than proof that celiac disease caused osteoporosis in an individual. Preserve age, sex/menopausal status, body mass, vitamin D/calcium status, glucocorticoid exposure, smoking, endocrine or renal disease, and other established osteoporosis causes or contributors.

### 2. `diabetes-mellitus-type-1 -> diabetic-retinopathy`
- Existing P1 target required before implementation: `chronic-kidney-disease`
- PMID **31515657**
- DOI `10.1007/s10654-019-00560-z`
- Citation: Li JQ, Welchowski T, Schmid M, et al. Prevalence, incidence and future projection of diabetic eye disease in Europe: a systematic review and meta-analysis. Eur J Epidemiol. 2020;35(1):11-23. PMID 31515657. doi:10.1007/s10654-019-00560-z.
- Evidence type: systematic review and meta-analysis
- Approved publication guard: Require established type 1 diabetes mellitus and separately established diabetic retinopathy by appropriate ophthalmic evaluation. Treat the source as population-level prevalence/complication evidence, not automatic individual causation or permission to infer retinopathy from diabetes alone. Preserve diabetes duration, glycemic control, hypertension, nephropathy, smoking, and other retinal or vascular contributors.

### 3. `pulmonary-fibrosis -> pulmonary-hypertension`
- Existing P1 target required before implementation: `respiratory-cancer`
- PMID **33208169**
- DOI `10.1186/s12931-020-01570-2`
- Citation: Ruffenach G, Hong J, Vaillancourt M, Medzikovic L, Eghbali M. Pulmonary hypertension secondary to pulmonary fibrosis: clinical data, histopathology and molecular insights. Respir Res. 2020;21(1):303. PMID 33208169. doi:10.1186/s12931-020-01570-2.
- Evidence type: clinical/translational review
- Approved publication guard: Require documented pulmonary fibrosis and a separately established diagnosis of pulmonary hypertension under accepted clinical/hemodynamic criteria. Do not infer pulmonary hypertension from dyspnea, hypoxemia, reduced DLCO, or a nonspecific echocardiographic estimate alone. Preserve other pulmonary-hypertension causes and groups, including left-heart disease, chronic thromboembolic disease, sleep-disordered breathing, drugs/toxins, and other lung diseases.

### 4. `polycystic-ovary-syndrome -> depressive-disorder`
- Existing P1 target required before implementation: `endometrial-cancer`
- PMID **24816764**
- DOI `10.1371/journal.pone.0097041`
- Citation: Hung JH, Hu LY, Tsai SJ, et al. Risk of psychiatric disorders following polycystic ovary syndrome: a nationwide population-based cohort study. PLoS One. 2014;9(5):e97041. PMID 24816764. doi:10.1371/journal.pone.0097041.
- Evidence type: nationwide population-based cohort
- Approved publication guard: Require documented polycystic ovary syndrome and a separately established depressive disorder. Treat the study as population-level temporal association/risk evidence, not proof of direct individual causation. Preserve obesity and insulin resistance, infertility, hyperandrogenic symptoms, sleep disturbance, psychosocial factors, medication or treatment effects, and independent psychiatric risk factors as potential contributors.

### 5. `multiple-myeloma -> anemia`
- Existing P1 target required before implementation: `chronic-kidney-disease`
- PMID **35103762**
- DOI `10.1001/jama.2022.0003`
- Citation: Cowan AJ, Green DJ, Kwok M, et al. Diagnosis and Management of Multiple Myeloma: A Review. JAMA. 2022;327(5):464-477. PMID 35103762. doi:10.1001/jama.2022.0003.
- Evidence type: JAMA clinical review
- Approved publication guard: Require documented multiple myeloma and separately established anemia. The source supports anemia as a common myeloma manifestation but does not establish that every anemia in a patient with myeloma is attributable to the malignancy. Preserve chronic kidney disease, blood loss, nutritional deficiency, hemolysis, treatment-related marrow suppression, other marrow disorders, and other anemia etiologies as competing or contributing explanations.

## Implementation boundary

No taxonomy identity, publication status, diagnostic/rating code, rank-1 relationship, pathwayIntelligence field, citation verification promotion, GitHub write, or Vercel action is authorized. Mapping approval is separate from later qualified-human citation verification.

## Local implementation result

- 5/5 relationships installed at rank 2.
- 5/5 new clinical sources remain `verified:false`.
- 5/5 normalized master sources are `pending-verification`.
- No citation promotion, remote write, taxonomy change, publication-status change, rating-code change, or pathwayIntelligence change.
