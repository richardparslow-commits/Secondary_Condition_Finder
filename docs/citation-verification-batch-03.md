# Citation Verification Batch 03

Review date: **2026-08-18**

Reviewer role: **Repository owner / qualified human reviewer**

Human decision recorded in the project review workflow: **Approved Batch 3 — all 5, including removal of the unsupported COPD direct-secondary/aggravation pathway labels.**

## Scope

| Mapping | Relationship | Source | Decision |
| --- | --- | --- | --- |
| `chronic-pyelonephritis.json` | chronic pyelonephritis → chronic kidney disease | Goodship et al., *QJM* 2000, PMID 11110586 | VERIFY AS WRITTEN |
| `chronic-rhinitis.json` | documented allergic-rhinitis phenotype → obstructive sleep apnea | Ferreira et al., *Sleep Medicine* 2025, PMID 40774162 | VERIFY AS WRITTEN |
| `chronic-sinusitis.json` | chronic rhinosinusitis → obstructive sleep apnea | Zhai et al., *Sleep and Biological Rhythms* 2026, PMID 41969980 | VERIFY AS WRITTEN |
| `copd.json` | COPD → OSA overlap/coexistence | Czerwaty et al., *Biomedicines* 2023, PMID 36672523 | NARROW, THEN VERIFY |
| `cushings-syndrome.json` | Cushing's syndrome/hypercortisolism → hypertension | Fallo et al., *Journal of Hypertension* 2022, PMID 35950979 | VERIFY AS WRITTEN |

## Verification rationale and limitations

### Chronic pyelonephritis → CKD

The adult cohort supports phenotype-specific renal prognosis rather than automatic progression. The live mapping requires radiologic scarring or persistent parenchymal damage, longitudinal renal-function evidence, and review of competing renal causes. Favorable outcomes among many patients with preserved renal function are intentionally retained as contrary evidence against overgeneralization.

### Chronic rhinitis → OSA

The cited meta-analysis supports an allergic-rhinitis/OSA association. The live mapping already limits applicability to a clinically documented allergic-rhinitis phenotype because the broader chronic-rhinitis catalog identity includes nonallergic disease, and it does not convert association into individual causation or aggravation.

### Chronic rhinosinusitis → OSA

The cited systematic review/meta-analysis and Mendelian-randomization analysis support an association and directional research signal. The live mapping remains association-focused and requires diagnosis, chronology, phenotype/severity, body-habitus and airway factors, medication context, and competing OSA causes.

### COPD → OSA

The systematic review supports COPD-OSA overlap syndrome/coexistence but does not by itself justify the directional pathway labels `direct-secondary` or `aggravation`. Those labels were removed before verification. The cautious live rationale, diagnostic requirements, severity/oxygenation context, and competing OSA risk-factor review are retained. No new source was added merely to preserve a stronger pathway label.

### Cushing's syndrome → hypertension

The endocrine-hypertension consensus supports hypertension as a common manifestation of glucocorticoid excess and recognizes persistence after normalization or steroid withdrawal. The live mapping requires an established Cushing/hypercortisolism phenotype, blood-pressure chronology, and review of other hypertension causes.

## Ratchet movement

- live references: **69**
- live verified: **23** (18 → 23)
- retired verified: **6**
- verified provenance: **29** (24 → 29)
- live unverified: **46** (51 → 46)
- published-unverified review findings: **44** (49 → 44)
- hard findings: **0**

No source was added, replaced, removed, or retired. One mapping was narrowed before verification by removing unsupported pathway labels.

## Review boundary

`verified: true` records explicit qualified-human approval. Automated retrieval and analysis prepared the review materials but did not independently authorize verification.
