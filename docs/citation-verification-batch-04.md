# Citation Verification Batch 04

Review date: **2026-08-18**

Reviewer role: **Repository owner / qualified human reviewer**

Human decision recorded in the project review workflow: **Approved Batch 4 — all 5.**

## Scope

This batch contains exactly five previously unverified live clinical-evidence references in deterministic post-Batch-3 audit order.

| Mapping | Relationship / evidentiary link | Source | Decision |
| --- | --- | --- | --- |
| `depressive-disorder.json` | antidepressant treatment → medication-associated weight gain | Alonso-Pedrero et al., PMID 31524318 | VERIFY AS WRITTEN |
| `depressive-disorder.json` | overweight/obesity → obstructive sleep apnea | Esmaeili et al., PMID 40330547 | VERIFY AS WRITTEN |
| `depressive-disorder.json` | psychotropic treatment → erectile dysfunction | systematic review, PMID 34247952 | VERIFY AS WRITTEN |
| `diabetes-mellitus-type-1.json` | type 1 diabetes → chronic kidney disease | ADA Standards of Care 2026, PMID 41358881 | VERIFY AS WRITTEN |
| `discoid-lupus.json` | scalp discoid lupus → scarring alopecia | Li et al., PMID 35817588 | VERIFY AS WRITTEN |

## Verification rationale and limitations

### Depressive disorder → medication-associated weight gain → OSA

The mapping deliberately separates the intermediate chain into two independently sourced links. PMID 31524318 supports medication-associated weight change while preserving drug-specific heterogeneity; it does not establish that every antidepressant causes weight gain. PMID 40330547 supports overweight/obesity as an important OSA risk factor but does not establish the Veteran-specific medication→weight→OSA chain. The live mapping requires the actual medication, timing, dose/duration, weight trajectory, confirmed OSA, alternative OSA risks, and link-by-link clinical review.

### Depressive-disorder treatment → erectile dysfunction

PMID 34247952 supports an association between psychotropic treatment and erectile dysfunction while showing clinically important class/agent differences. The live mapping already requires the specific medication exposure, baseline erectile function, chronology, and competing vascular, endocrine, neurologic, psychiatric, medication, substance-use, and lifestyle causes.

### Type 1 diabetes → CKD

PMID 41358881 supports CKD screening and the typical diabetic-kidney-disease phenotype in longstanding type 1 diabetes. The live mapping does not infer diabetic kidney disease merely from coexisting diabetes and CKD; it requires duration, UACR/eGFR trajectory, phenotype, chronology, and evaluation of atypical features or alternative renal causes.

### Scalp discoid lupus → scarring alopecia

PMID 35817588 supports a phenotype- and anatomy-specific scalp-DLE/scarring-alopecia relationship. The live mapping requires documented scalp DLE, cicatricial rather than nonscarring alopecia, anatomic/temporal correlation, and clinical/trichoscopic/histopathologic support as appropriate.

## Ratchet movement

- live references: **69**
- live verified: **28** (23 → 28)
- retired verified: **6**
- verified provenance: **34** (29 → 34)
- live unverified: **41** (46 → 41)
- published-unverified review findings: **39** (44 → 39)
- hard findings: **0**

No source is added, replaced, removed, retired, or proposition-narrowed in this batch.

## Review boundary

`verified: true` records explicit qualified-human approval. Automated retrieval and analysis prepared the review materials but did not independently authorize verification.
