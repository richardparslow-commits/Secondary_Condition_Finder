# Mapping Expansion ME-4 — Approved Implementation Ledger

- Required baseline: `20485862319f6a79ecdfce73778c84a3300e5bc0`
- Status: **APPROVED-AND-IMPLEMENTED-LOCALLY — CITATIONS PENDING VERIFICATION**
- Relationships: **5**
- New clinical sources: **5**
- Initial source state: `verified:false` / master `pending-verification`
- Remote writes: **NOT AUTHORIZED**
- Citation promotion: **NOT AUTHORIZED**

## Approved rows

### 1. `chronic-kidney-disease -> congestive-heart-failure`
- Current P1 edge: `chronic-kidney-disease -> anemia`
- PMID **28515118**
- DOI `10.1161/JAHA.116.005336`
- Citation: He J, Shlipak M, Anderson A, et al. Risk Factors for Heart Failure in Patients With Chronic Kidney Disease: The CRIC (Chronic Renal Insufficiency Cohort) Study. J Am Heart Assoc. 2017;6(5):e005336. PMID 28515118. doi:10.1161/JAHA.116.005336.
- Evidence type: prospective cohort / incident-heart-failure analysis
- Publication guard: Require documented chronic kidney disease and a separately established diagnosis of heart failure/congestive heart failure. Treat the source as population-level incident-risk evidence, not proof that chronic kidney disease caused heart failure in an individual. Preserve competing cardiac causes and contributors, including ischemic heart disease, hypertension, valvular disease, cardiomyopathy, arrhythmia, and volume-status factors.

### 2. `cerebral-palsy -> epilepsy`
- Current P1 edge: `cerebral-palsy -> scoliosis`
- PMID **32059945**
- DOI `10.1016/j.apmr.2020.01.009`
- Citation: van Gorp M, Hilberink SR, Noten S, et al. Epidemiology of Cerebral Palsy in Adulthood: A Systematic Review and Meta-analysis of the Most Frequently Studied Outcomes. Arch Phys Med Rehabil. 2020;101(6):1041-1052. PMID 32059945. doi:10.1016/j.apmr.2020.01.009.
- Evidence type: systematic review and meta-analysis in adults
- Publication guard: Require documented cerebral palsy and separately established epilepsy under accepted diagnostic criteria. The source supports epilepsy as a prevalent adult cerebral-palsy comorbidity, not automatic individual causation and not inference from a remote seizure history, abnormal EEG, or cerebral palsy severity alone.

### 3. `uveitis -> cataracts`
- Current P1 edge: `uveitis -> glaucoma`
- PMID **37414328**
- DOI `10.1016/j.ajo.2023.06.021`
- Citation: Papaliodis GN, Rosner BA, Dreger KA, et al. Incidence of and Risk Factors for Cataract in Anterior Uveitis. Am J Ophthalmol. 2023;254:221-232. PMID 37414328. doi:10.1016/j.ajo.2023.06.021.
- Evidence type: multicenter cohort
- Publication guard: Restrict this evidence proposition to noninfectious anterior uveitis or a clinically comparable anterior-inflammatory phenotype and require separately established cataract in the affected eye. Do not infer cataract from uveitis alone. Preserve age, inflammation severity, corticosteroid exposure, prior ocular surgery, glaucoma treatment, and other cataract contributors.

### 4. `pulmonary-hypertension -> cardiac-arrhythmia`
- Current P1 edge: `pulmonary-hypertension -> congestive-heart-failure`
- PMID **38453002**
- DOI `10.1016/j.chest.2024.03.002`
- Citation: O'Meara K, Stone G, Buch E, et al. Atrial Arrhythmias in Patients With Pulmonary Hypertension. Chest. 2024;166(1):201-211. PMID 38453002. doi:10.1016/j.chest.2024.03.002.
- Evidence type: clinical review
- Publication guard: Use the broad cardiac-arrhythmia target only for separately documented atrial-arrhythmia phenotypes supported by the source, especially atrial fibrillation or atrial flutter. Do not extend this source to ventricular arrhythmias, isolated sinus tachycardia, palpitations, or unspecified abnormal rhythm. Preserve structural heart disease and other arrhythmia risk factors.

### 5. `endometriosis -> depressive-disorder`
- Current P1 edge: `endometriosis -> ovarian-cancer`
- PMID **41308609**
- DOI `10.1016/j.comppsych.2025.152649`
- Citation: Shih YH, Wang SJ, Fan CT, et al. Long-term risk of psychiatric disorders in women with endometriosis: A retrospective cohort study. Compr Psychiatry. 2026;144:152649. PMID 41308609. doi:10.1016/j.comppsych.2025.152649.
- Evidence type: matched retrospective cohort
- Publication guard: Require documented endometriosis and a separately established depressive disorder. Treat this source as population-level association/risk evidence, not proof of direct individual causation. Preserve chronic pain, sleep disturbance, infertility, psychosocial burden, other medical conditions, and independent psychiatric risk factors as potential contributors.

## Approved source refinement

`endometriosis -> depressive-disorder`: discovery PMID **34077695** is replaced for implementation by PMID **41308609**.

## Implementation boundary

Exactly five rank-2 `sometimes-explored` relationships are authorized. No new taxonomy identity, diagnostic/rating code, publication-status change, or `pathwayIntelligence` change is authorized. Each new source must remain `verified:false` and `pending-verification` until a separate qualified-human citation-verification approval and runner.

## Local implementation result

- 5/5 relationships installed at rank 2.
- 5/5 new clinical sources remain `verified:false`.
- 5/5 normalized master sources are `pending-verification`.
- Endometriosis source refinement implemented with PMID 41308609; PMID 34077695 was not added.
- No citation promotion, remote write, taxonomy change, publication-status change, or pathwayIntelligence change.
