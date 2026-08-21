# Mapping Expansion ME-5 — Qualified-Human Citation Verification Approved Ledger

- Required implementation baseline: `cae78395cb18b2fe7b581950d6024bba9a2b0e29`
- Status: **APPROVED-AND-APPLIED-LOCALLY — 5/5 VERIFIED**
- Disposition: **5 as-implemented / 0 narrowed / 0 replacement / 0 reject**
- Citation promotion: **5 KB references + 5 master sources**
- Relationship semantic changes: **0**
- Publication-guard changes: **0**
- Source-identity changes: **0**
- Remote writes: **NOT AUTHORIZED**

## Approved rows

### 1. `celiac-disease -> osteoporosis`
- PMID **37730081**
- DOI `10.1016/j.bone.2023.116913`
- Decision: **approve-as-implemented**
- Publication guard preserved exactly: Require documented celiac disease and separately established osteoporosis. Treat the source as population-level association/risk evidence rather than proof that celiac disease caused osteoporosis in an individual. Preserve age, sex/menopausal status, body mass, vitamin D/calcium status, glucocorticoid exposure, smoking, endocrine or renal disease, and other established osteoporosis causes or contributors.

### 2. `diabetes-mellitus-type-1 -> diabetic-retinopathy`
- PMID **31515657**
- DOI `10.1007/s10654-019-00560-z`
- Decision: **approve-as-implemented**
- Publication guard preserved exactly: Require established type 1 diabetes mellitus and separately established diabetic retinopathy by appropriate ophthalmic evaluation. Treat the source as population-level prevalence/complication evidence, not automatic individual causation or permission to infer retinopathy from diabetes alone. Preserve diabetes duration, glycemic control, hypertension, nephropathy, smoking, and other retinal or vascular contributors.

### 3. `pulmonary-fibrosis -> pulmonary-hypertension`
- PMID **33208169**
- DOI `10.1186/s12931-020-01570-2`
- Decision: **approve-as-implemented**
- Publication guard preserved exactly: Require documented pulmonary fibrosis and a separately established diagnosis of pulmonary hypertension under accepted clinical/hemodynamic criteria. Do not infer pulmonary hypertension from dyspnea, hypoxemia, reduced DLCO, or a nonspecific echocardiographic estimate alone. Preserve other pulmonary-hypertension causes and groups, including left-heart disease, chronic thromboembolic disease, sleep-disordered breathing, drugs/toxins, and other lung diseases.

### 4. `polycystic-ovary-syndrome -> depressive-disorder`
- PMID **24816764**
- DOI `10.1371/journal.pone.0097041`
- Decision: **approve-as-implemented**
- Publication guard preserved exactly: Require documented polycystic ovary syndrome and a separately established depressive disorder. Treat the study as population-level temporal association/risk evidence, not proof of direct individual causation. Preserve obesity and insulin resistance, infertility, hyperandrogenic symptoms, sleep disturbance, psychosocial factors, medication or treatment effects, and independent psychiatric risk factors as potential contributors.

### 5. `multiple-myeloma -> anemia`
- PMID **35103762**
- DOI `10.1001/jama.2022.0003`
- Decision: **approve-as-implemented**
- Publication guard preserved exactly: Require documented multiple myeloma and separately established anemia. The source supports anemia as a common myeloma manifestation but does not establish that every anemia in a patient with myeloma is attributable to the malignancy. Preserve chronic kidney disease, blood loss, nutritional deficiency, hemolysis, treatment-related marrow suppression, other marrow disorders, and other anemia etiologies as competing or contributing explanations.

## Verification boundary

Only citation verification state may change. All five relationship entities, publication guards, PMID/DOI identities, citation text, URLs, rank, prevalence, taxonomy, publication status, and pathwayIntelligence state remain unchanged. The implementation ledger remains historical and is not rewritten.

## Local verification result

- 5/5 KB references promoted to `verified:true`.
- 5/5 normalized master sources promoted to `active`.
- 5/5 decisions recorded as `approve-as-implemented`.
- Relationship semantic changes: 0.
- Publication-guard changes: 0.
- Source-identity changes: 0.
- No remote writes.
