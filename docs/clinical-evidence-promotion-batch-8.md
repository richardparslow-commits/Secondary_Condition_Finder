# Clinical Evidence Promotion Batch 8

Batch 8 preserves the exact **300 catalog / 300 knowledge-base** integrity contract and replaces a large block of unsafe legacy provenance with condition-specific clinical evidence.

## Legacy clinical repair: hypertension

The published `hypertension` mapping previously contained four medical relationships supported only by rating/legal references. Batch 8 replaces all eight of those references rather than preserving the unsafe provenance.

- `hypertension` → `chronic-kidney-disease`: repaired as a bounded `disease-progression` / target-organ-damage research pathway using the 2025 AHA/ACC high-blood-pressure guideline. The mapping requires eGFR/albuminuria chronology, kidney-disease etiology, cumulative BP burden, and competing renal causes because hypertension and CKD are bidirectional and CKD is heterogeneous.
- `hypertension` → `ischemic-heart-disease`: repaired using the same current guideline's coronary-risk and chronic-coronary-disease sections. Hypertension is treated as an established modifiable coronary risk factor, not an automatic individual cause; dyslipidemia, tobacco exposure, diabetes, age/family history, and other atherosclerotic contributors remain explicit development issues.
- `hypertension` → `congestive-heart-failure`: repaired as a bounded `disease-progression` pathway. The guideline describes antecedent hypertension, a dose-dependent BP-heart-failure association, and heart-failure-risk reduction with long-term BP treatment. The mapping still requires cardiac phenotype, remodeling chronology, and competing ischemic/valvular/myocardial/rhythm/renal causes.
- `hypertension` → `erectile-dysfunction`: repaired with a 40-study meta-analysis (121,641 participants) supporting a population-level hypertension/ED association. No medication-specific causal claim is inferred from that source; medication chronology remains a separate individual question.

## Legacy draft promotion

- `cushings-syndrome` → `hypertension`: published as a `direct-secondary` research pathway using the European Society of Hypertension endocrine-hypertension consensus (PMID 35950979). The consensus identifies hypertension as common in endogenous/exogenous Cushing's syndrome and notes that it can persist after normalization of hormone excess or discontinuation of glucocorticoids. The mapping requires an established Cushing/hypercortisolism phenotype, BP chronology, treatment response, and competing-cause review.

## Bounded identity/modeling cleanup

- `diabetes-mellitus-type-1`: physically moved from the historical `neurological.json` file into `endocrine.json`, with display name normalized to **Diabetes Mellitus Type 1**, aliases `Type 1 Diabetes` and `DM1`, and the current 38 CFR 4.119 / DC 7913 diabetes-mellitus framework recorded. The stable ID is unchanged, its knowledge-base mapping remains draft, and the rating reference remains `verified: false`.

## Citation position

Batch 8 tightens the ratchet substantially:

- total references: **135**;
- verified: **14**;
- unverified: **121**;
- published-unverified review findings: **119**;
- clinical-evidence references with canonical URLs: **at least 44**.

Eight hypertension legal/rating references are retired and replaced by four clinical references; one additional clinical reference is added for Cushing's syndrome. None of the new sources is automatically marked verified.

## Expansion state

Batch 8 repairs legacy mappings rather than publishing another Wave 1-7 expansion identity, so the expansion count remains **11 individually promoted / 96 of 107 still draft**. The overall catalog and knowledge-base universe remains frozen at 300/300.
