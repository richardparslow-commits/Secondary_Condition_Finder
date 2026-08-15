# Step 5 Pathway-Intelligence Backfill Ledger

This ledger records the controlled enrichment of already-published mappings after the Step 5 pathway-intelligence framework was introduced. The original Batch 1–4 entries are historical snapshots; the supersession section records later Clinical Evidence Promotion repairs and withdrawals.

## Guardrail

A pathway label is authored only when the exact primary→secondary relationship has enough clinical support to describe the pathway conservatively. Rating schedules and legal authority may explain VA framework but do not establish medical causation. Population association evidence does not automatically justify causal, aggravation, medication, or intermediate-chain metadata. An intentionally unlabeled edge is a reviewed edge, not an omitted one.

Pathway metadata is research/display guidance only. It does not change recommendation rank, prevalence, score, filtering, intake matching, eligibility, or establish an individual medical nexus.

## Original backfill snapshots

### Batch 1 — Mental Health / Neurological

Backfilled:

| Primary | Secondary | Pathway(s) |
|---|---|---|
| adjustment-disorder | sleep-apnea | direct-secondary; aggravation |
| adjustment-disorder | gerd | direct-secondary; aggravation |
| depressive-disorder | sleep-apnea | medication-related; intermediate-chain |
| depressive-disorder | erectile-dysfunction | medication-related |

PTSD→sleep-apnea, PTSD→migraine-headaches, and PTSD→erectile-dysfunction had already been enriched and served as control cases. Other published mental/neurological mappings with only legal/rating support were intentionally left pathway-unlabeled at that time.

### Batch 2 — Musculoskeletal

Backfilled:

| Primary | Secondary | Pathway(s) |
|---|---|---|
| rheumatoid-arthritis | depressive-disorder | somatopsychic |
| rheumatoid-arthritis | gerd | medication-related |

Other weak biomechanical/legal-only mappings were left unlabeled rather than having stronger medical pathways inferred.

### Batch 3 — Respiratory / ENT

Backfilled:

| Primary | Secondary | Pathway(s) |
|---|---|---|
| copd | sleep-apnea | direct-secondary; aggravation |
| copd | cardiac-arrhythmia | intermediate-chain |
| asthma | sleep-apnea | direct-secondary; aggravation |
| asthma | cardiac-arrhythmia | direct-secondary |

Other respiratory/ENT mappings with insufficient attached evidence were intentionally left unlabeled.

### Batch 4 — Systemic / Medical

Backfilled:

| Primary | Secondary | Pathway(s) |
|---|---|---|
| stomach-cancer | depressive-disorder | somatopsychic |
| abdominal-hernia | depressive-disorder | somatopsychic |

Treatment-risk/comorbidity evidence was not upgraded into stronger pathway metadata where the primary→treatment or condition-specific mechanism was unsupported.

## Subsequent Clinical Evidence Promotion supersession through Batch 22

The later evidence-promotion program deliberately changed historical states when stronger evidence or safety review justified doing so:

- **Batch 2:** `knee-injury` and `osteoarthritis` returned to draft rather than preserving weak biomechanical/legal-only publication.
- **Batch 3:** amputation→depression clinically repaired; `ageusia` returned to draft.
- **Batch 4:** anosmia→depression and alopecia-areata→depression clinically repaired; `agranulocytosis` returned to draft.
- **Batch 5:** `al-amyloidosis` returned to draft.
- **Batch 6:** `addisons-disease` returned to draft.
- **Batch 7:** `anorexia-nervosa` returned to draft.
- **Batch 8:** all four hypertension relationships clinically repaired; CKD/IHD/CHF carry bounded disease-progression metadata while hypertension→ED remains association-focused.
- **Batch 9:** ED→GERD withdrawn; ED→depression clinically repaired with bidirectional evidence and bounded somatopsychic metadata.
- **Batch 10:** `emphysema` and `chronic-bronchitis` returned to draft.
- **Batch 11:** ILD→OSA clinically repaired but left pathway-unlabeled; ILD→arrhythmia removed; `pulmonary-fibrosis` returned to draft.
- **Batch 12:** chronic-rhinitis→OSA repaired only for documented allergic-rhinitis phenotype; chronic-sinusitis→OSA repaired as CRS association research; both arrhythmia edges removed.
- **Batch 13:** cauda-equina-syndrome→ED promoted as complication/outcome research without automatic causal pathway metadata.
- **Batch 14:** sleep-apnea→hypertension/depression/anxiety clinically repaired and kept association-focused; sleep-apnea→GERD withdrawn.
- **Batch 15:** psoriatic-arthritis→depression promoted as association/comorbidity research.
- **Batch 16:** CHF→GERD withdrawn; CHF→depression retained its verified clinical source and remained bounded comorbidity research.
- **Batch 17:** stomach-cancer→GERD and abdominal-hernia→GERD withdrawn; rheumatoid-arthritis→GERD repaired with a two-link medication evidence chain.
- **Batch 18:** `agoraphobia` and `panic-disorder` returned to draft; pulmonary-hypertension→CHF promoted only as a pre-capillary/PAH→right-heart-failure progression pathway, expressly excluding group 2 PH caused by left-heart disease.
- **Batch 19:** `bipolar-disorder`, `persistent-depressive-disorder`, `social-anxiety-disorder`, and `somatic-symptom-disorder` returned to draft; autoimmune/Hashimoto-type thyroiditis→hypothyroidism promoted with bounded disease-progression metadata and transient-thyroiditis exclusions.
- **Batch 20:** `anxiety-disorder`, `schizophrenia`, and `substance-use-disorder` returned to draft; mild-TBI→headache clinically repaired with explicit post-traumatic-headache/migraine-phenotype limits; Parkinson disease→depression promoted as association/comorbidity research.
- **Batch 21:** `micro-tbi`, `subdural-hematoma`, `epidural-hematoma`, and `rem-sleep-disorder` returned to draft rather than translating broad sequelae into exact downstream diagnoses; multiple-sclerosis→depression promoted as association/comorbidity research.
- **Batch 22:** the broad six-edge `skull-fracture-non-basilar-and-basal` mapping returned to draft; post-concussion-syndrome retained only clinically sourced persistent-post-traumatic-headache/migraine-phenotype research with no automatic migraine reclassification; seizure-disorder→depression promoted as association/comorbidity research.

## Current interpretation rule

Historical entries explain why pathway metadata was or was not authored at the time. They are **not** the current publication-state source of truth.

Current truth is defined by:

- `data/knowledge-base/` for live mapping state;
- `data/expansion-dispositions.json` for the current 107 Wave 1–7 expansion program disposition;
- `docs/kb-coverage-tracker.md` and `npm run citations:audit` for current citation/debt counts; and
- `data/conditions/` for catalog identity and physical placement.

No later batch should resurrect an unsafe relationship merely to preserve a historical backfill expectation.
