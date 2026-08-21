# Mapping Expansion ME-4 — Qualified-Human Citation Verification Approved Ledger

- Required implementation baseline: `196b37b92d76827e4030da1afb25fd4165066cdb`
- Status: **APPROVED-AND-APPLIED-LOCALLY — 5/5 VERIFIED**
- Disposition: **4 as-implemented / 1 narrowed / 0 replacement / 0 reject**
- Citation promotion: **5 KB references + 5 master sources**
- Remote writes: **NOT AUTHORIZED**

## Approved rows

### 1. `chronic-kidney-disease -> congestive-heart-failure`
- PMID **28515118**
- DOI `10.1161/JAHA.116.005336`
- Decision: **approve-as-implemented**
- Verified publication guard: Require documented chronic kidney disease and a separately established diagnosis of heart failure/congestive heart failure. Treat the source as population-level incident-risk evidence, not proof that chronic kidney disease caused heart failure in an individual. Preserve competing cardiac causes and contributors, including ischemic heart disease, hypertension, valvular disease, cardiomyopathy, arrhythmia, and volume-status factors.

### 2. `cerebral-palsy -> epilepsy`
- PMID **32059945**
- DOI `10.1016/j.apmr.2020.01.009`
- Decision: **approve-as-implemented**
- Verified publication guard: Require documented cerebral palsy and separately established epilepsy under accepted diagnostic criteria. The source supports epilepsy as a prevalent adult cerebral-palsy comorbidity, not automatic individual causation and not inference from a remote seizure history, abnormal EEG, or cerebral palsy severity alone.

### 3. `uveitis -> cataracts`
- PMID **37414328**
- DOI `10.1016/j.ajo.2023.06.021`
- Decision: **approve-with-narrowing**
- Verified publication guard: Require documented noninfectious anterior uveitis and separately established cataract in the affected eye. Do not infer cataract from uveitis alone. Preserve age, inflammation severity, corticosteroid exposure, prior ocular surgery, glaucoma treatment, and other cataract contributors.
- Removed text: `or a clinically comparable anterior-inflammatory phenotype`
- Reason: PMID 37414328 directly studies noninfectious anterior uveitis; verification scope is narrowed to the studied phenotype.

### 4. `pulmonary-hypertension -> cardiac-arrhythmia`
- PMID **38453002**
- DOI `10.1016/j.chest.2024.03.002`
- Decision: **approve-as-implemented**
- Verified publication guard: Use the broad cardiac-arrhythmia target only for separately documented atrial-arrhythmia phenotypes supported by the source, especially atrial fibrillation or atrial flutter. Do not extend this source to ventricular arrhythmias, isolated sinus tachycardia, palpitations, or unspecified abnormal rhythm. Preserve structural heart disease and other arrhythmia risk factors.

### 5. `endometriosis -> depressive-disorder`
- PMID **41308609**
- DOI `10.1016/j.comppsych.2025.152649`
- Decision: **approve-as-implemented**
- Verified publication guard: Require documented endometriosis and a separately established depressive disorder. Treat this source as population-level association/risk evidence, not proof of direct individual causation. Preserve chronic pain, sleep disturbance, infertility, psychosocial burden, other medical conditions, and independent psychiatric risk factors as potential contributors.

## Verification boundary

All five source identities remain unchanged. The uveitis row is the only relationship/guard semantic change. The implementation ledger remains historical and is not rewritten. Promotion must atomically update the live KB source state and the normalized master-source state.

## Local verification result

- 5/5 KB references promoted to `verified:true`.
- 5/5 master sources promoted to `active`.
- 4 rows preserved as implemented.
- `uveitis -> cataracts` narrowed exactly to documented noninfectious anterior uveitis with separately established cataract.
- PMID, DOI, citation text, URL, rank, prevalence, taxonomy, publication status, and pathwayIntelligence identity remained unchanged.
- No remote writes.
