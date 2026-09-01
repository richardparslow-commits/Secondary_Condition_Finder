# Citation Verification Batch 07

Review date: **2026-08-18**

Reviewer role: **Repository owner / qualified human reviewer**

Human decision recorded in the project review workflow: **I approve Expected Batch 7 ratchet.**

This approval applies to the five decisions immediately associated with that ratchet in the review record: four verify-as-written decisions plus the insomnia→depression narrowing before verification.

## Scope

| Mapping | Relationship / evidentiary link | Source | Decision |
| --- | --- | --- | --- |
| `hypertensive-heart-disease.json` | hypertensive heart disease → congestive heart failure | Díez & Butler, PMID 36082670 | VERIFY AS WRITTEN |
| `hypogonadism.json` | confirmed male hypogonadism → osteoporosis | EAA bone-health guideline, PMID 29499097 | VERIFY AS WRITTEN |
| `hypoparathyroidism.json` | chronic hypoparathyroidism ↔ kidney-stone/nephrocalcinosis association | Yao et al., PMID 36375810 | VERIFY AS WRITTEN |
| `implantable-cardiac-pacemaker.json` | transvenous lead → tricuspid valve disorder | systematic review/meta-analysis, PMID 34389210 | VERIFY AS WRITTEN |
| `insomnia.json` | insomnia symptoms preceding incident depressive disorder | Solelhac et al., PMID 38833937 | NARROW, THEN VERIFY |

## Decision boundaries

### Hypertensive heart disease → heart failure

The mapping remains limited to documented hypertensive cardiac remodeling/dysfunction rather than hypertension alone. Objective cardiac findings, chronology, and competing ischemic, valvular, cardiomyopathic, rhythm-related, renal, and pulmonary causes remain required.

### Hypogonadism → osteoporosis

The mapping remains limited to confirmed clinical/biochemical hypogonadism. It preserves DXA/fracture-risk evaluation, alternative osteoporosis causes, and the explicit limitation that testosterone replacement has not been established to prevent fractures.

### Chronic hypoparathyroidism → kidney stones

The mapping remains association-focused and retains calcium/phosphate physiology, conventional calcium/active-vitamin-D treatment context, 24-hour urine calcium/metabolic stone evaluation, renal imaging, chronology, and alternative stone-cause review. No directional pathway metadata is added.

### Pacemaker → heart-valve disorder

The mapping remains limited to a transvenous lead crossing the tricuspid valve with objective post-implant worsening and individualized lead-valve evidence. It is not generalized to every pacemaker and is not generalized to leadless or epicardial systems.

### Insomnia → depressive disorder

PMID 38833937 supports a prospective temporal association between insomnia symptoms and incident major depressive disorder but does not establish individual causation. Batch 07 therefore removes the entire directional `pathwayIntelligence` object and changes the live rationale from “focused direct-secondary research” to “focused temporal-association research.” The existing chronology, independent-diagnosis, competing psychiatric/sleep/medical contributors, and qualified-clinician evidence gaps remain.

## Ratchet movement

- live references: **69**
- live verified: **43** (38 → 43)
- retired verified: **6**
- verified provenance: **49** (44 → 49)
- live unverified: **26** (31 → 26)
- published-unverified review findings: **24** (29 → 24)
- hard findings: **0**
- live clinical-evidence references with canonical URLs: **64**
- retired clinical-evidence references with canonical URLs: **4**
- combined clinical-URL provenance observation: **68**

No source is automatically verified; `verified: true` records the qualified-human decision.
