# Citation Verification Batch 06

Review date: **2026-08-18**

Reviewer role: **Repository owner / qualified human reviewer**

Human decision recorded in the project review workflow: **I approve the Recommended approval scope.**

## Scope

This batch contains exactly five previously unverified live clinical-evidence references in deterministic post-Batch-5 audit order.

| Mapping | Relationship / evidentiary link | Source | Decision |
| --- | --- | --- | --- |
| `hyperpituitarism.json` | prolactin-secreting pituitary dysfunction → hypogonadism | Rudman & Shimon, PMID 40812946 | VERIFY AS WRITTEN |
| `hypertension.json` | hypertension → chronic kidney disease | 2025 multisociety hypertension guideline, PMID 40811497 | VERIFY AS WRITTEN |
| `hypertension.json` | hypertension → ischemic heart disease | 2025 multisociety hypertension guideline, PMID 40811497 | VERIFY AS WRITTEN |
| `hypertension.json` | hypertension → congestive heart failure | 2025 multisociety hypertension guideline, PMID 40811497 | VERIFY AS WRITTEN |
| `hypertension.json` | hypertension ↔ erectile dysfunction association | replace PMID 27491642 with current corrected 2025 multisociety guideline, PMID 40811497 | REPLACE SOURCE ONE-FOR-ONE, THEN VERIFY |

## Verification rationale and limitations

### Prolactin-secreting pituitary dysfunction → hypogonadism

PMID 40812946 supports the existing prolactinoma-specific endocrine pathway. The review describes prolactin-mediated suppression of the hypothalamic-pituitary-gonadal axis and tumor mass effect as mechanisms of hypogonadism in men with prolactinoma. The live mapping already requires objective prolactin/pituitary and gonadal-axis evidence, compatible chronology, and alternative-cause review and explicitly does not generalize the proposition to unrelated forms of hyperpituitarism.

### Hypertension → chronic kidney disease

PMID 40811497 is verified as written for the bounded target-organ/disease-progression proposition. The live mapping requires longitudinal blood-pressure burden, renal chronology and phenotype, and review of competing diabetic, glomerular, obstructive, hereditary, medication/toxin and other renal etiologies. Verification does not convert the population/guideline relationship into automatic individual causation.

### Hypertension → ischemic heart disease

PMID 40811497 is verified as written. The mapping remains a disease-progression/risk pathway requiring objective coronary disease, hypertension chronology, and explicit review of dyslipidemia, tobacco exposure, diabetes, age/family history and other atherosclerotic contributors.

### Hypertension → congestive heart failure

PMID 40811497 is verified as written. The mapping retains its cumulative-pressure-load/disease-progression framing and requires cardiac phenotype, objective imaging, chronology and competing ischemic, valvular, myocardial, rhythm, renal and toxic etiologies.

### Hypertension ↔ erectile dysfunction association

The older Ning/Yang meta-analysis (PMID 27491642) is replaced one-for-one with the current corrected 2025 multisociety hypertension guideline (PMID 40811497). The current guideline's sexual-dysfunction section describes sexual dysfunction as frequent in hypertension and discusses shared vascular/atherosclerotic mechanisms and common risk factors, while separately addressing antihypertensive medication effects. The live rationale therefore remains association-focused, removes the obsolete 40-study/121,641-participant statement, does not add directional `pathwayIntelligence`, and requires individual review of vascular, metabolic, endocrine, neurologic, psychogenic and medication contributors.

The verification record points to the current corrected Circulation rendering, which lists corrections dated 2025-11-10, 2026-04-13 and 2026-05-26.

## Ratchet movement

- live references: **69**
- live verified: **38** (33 → 38)
- retired verified: **6**
- verified provenance: **44** (39 → 44)
- live unverified: **31** (36 → 31)
- published-unverified review findings: **29** (34 → 29)
- hard findings: **0**

The hypertension→ED source is replaced one-for-one, so the live-reference denominator and clinical-URL denominator do not change.

## Review boundary

`verified: true` records explicit qualified-human approval. Automated retrieval and analysis prepared the review materials but did not independently authorize verification.
