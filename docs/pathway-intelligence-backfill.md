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

PTSD→sleep-apnea, PTSD→migraine-headaches, and PTSD→erectile-dysfunction had already been enriched and served as control cases.

At that time, the following published mappings were reviewed but left pathway-unlabeled because their attached sources were legal/rating-only or otherwise insufficient: agoraphobia, anxiety-disorder, bipolar-disorder, persistent-depressive-disorder, panic-disorder, schizophrenia, social-anxiety-disorder, somatic-symptom-disorder, substance-use-disorder, mild-tbi, micro-tbi, post-concussion-syndrome, subdural-hematoma, epidural-hematoma, skull-fracture-non-basilar-and-basal, and rem-sleep-disorder. Adjustment-disorder→migraine-headaches was also left unlabeled.

### Batch 2 — Musculoskeletal

Backfilled:

| Primary | Secondary | Pathway(s) |
|---|---|---|
| rheumatoid-arthritis | depressive-disorder | somatopsychic |
| rheumatoid-arthritis | gerd | medication-related |

At that time ankle-strain, osteoarthritis, amputation-or-loss-of-use, and knee-injury edges with legal/rating-only support were intentionally left unlabeled rather than having stronger medical pathways inferred.

### Batch 3 — Respiratory / ENT

Backfilled:

| Primary | Secondary | Pathway(s) |
|---|---|---|
| copd | sleep-apnea | direct-secondary; aggravation |
| copd | cardiac-arrhythmia | intermediate-chain |
| asthma | sleep-apnea | direct-secondary; aggravation |
| asthma | cardiac-arrhythmia | direct-secondary |

Chronic-sinusitis, chronic-rhinitis, emphysema, chronic-bronchitis, pulmonary-fibrosis, interstitial-lung-disease, anosmia, ageusia, and sleep-apnea were originally left pathway-unlabeled where the attached sources did not support stronger metadata.

### Batch 4 — Systemic / Medical

Backfilled:

| Primary | Secondary | Pathway(s) |
|---|---|---|
| stomach-cancer | depressive-disorder | somatopsychic |
| abdominal-hernia | depressive-disorder | somatopsychic |

Treatment-risk/comorbidity evidence was not upgraded into stronger pathway metadata for stomach-cancer→GERD, abdominal-hernia→GERD, ED→GERD, CHF→depression, or CHF→GERD. Hypertension, AL amyloidosis, agranulocytosis, alopecia areata, anorexia nervosa, Addison's disease, and ED→depression were also left unlabeled where the attached sources were insufficient.

## Subsequent Clinical Evidence Promotion supersession through Batch 18

The later evidence-promotion program deliberately changed historical states when stronger evidence or safety review justified doing so:

- **Batch 2:** `knee-injury` and `osteoarthritis` were returned to draft rather than preserving weak biomechanical/legal-only publication.
- **Batch 3:** amputation→depression was clinically repaired; `ageusia` was returned to draft.
- **Batch 4:** anosmia→depression and alopecia-areata→depression were clinically repaired; `agranulocytosis` was returned to draft.
- **Batch 5:** `al-amyloidosis` was returned to draft.
- **Batch 6:** `addisons-disease` was returned to draft.
- **Batch 7:** `anorexia-nervosa` was returned to draft.
- **Batch 8:** all four hypertension relationships were clinically repaired. CKD, ischemic-heart-disease, and CHF edges carry bounded disease-progression metadata; hypertension→ED remains association-focused and pathway-unlabeled.
- **Batch 9:** ED→GERD was withdrawn; ED→depression was clinically repaired with a bidirectional evidence synthesis and bounded somatopsychic metadata that preserves causal-direction uncertainty.
- **Batch 10:** `emphysema` and `chronic-bronchitis` were returned to draft because their OSA/arrhythmia propositions were legal/rating-only.
- **Batch 11:** ILD→OSA was clinically repaired but remains association-focused/pathway-unlabeled; ILD→arrhythmia was removed. `pulmonary-fibrosis` was returned to draft rather than generalizing IPF-specific evidence.
- **Batch 12:** chronic-rhinitis→OSA was repaired only for a documented allergic-rhinitis phenotype; chronic-sinusitis→OSA was repaired as association-focused CRS research. Their arrhythmia edges were removed.
- **Batch 13:** cauda-equina-syndrome→ED was promoted as complication/outcome research without automatic causal pathway metadata.
- **Batch 14:** sleep-apnea→hypertension, depression, and anxiety were clinically repaired and remain association-focused. Sleep-apnea→GERD was withdrawn because the reviewed evidence did not support a safe directional relationship.
- **Batch 15:** psoriatic-arthritis→depression was promoted as association/comorbidity research without automatic causal metadata.
- **Batch 16:** CHF→GERD was withdrawn. CHF→depression retained its verified clinical source and remains a bounded comorbidity relationship rather than being upgraded to stronger causal pathway metadata.
- **Batch 17:** stomach-cancer→GERD and abdominal-hernia→GERD were withdrawn. Rheumatoid-arthritis→GERD was clinically repaired with a two-link medication pathway: documented NSAID treatment for RA plus NSAID/GERD association evidence; individual exposure, diagnosis, chronology, and competing causes remain required.
- **Batch 18:** `agoraphobia` and `panic-disorder`, originally listed as published-but-unlabeled legal-only mappings in Batch 1, are returned to draft rather than preserving unsupported OSA/GERD/migraine propositions. `pulmonary-hypertension`→`congestive-heart-failure` is promoted with bounded `disease-progression` metadata only for a documented pre-capillary/pulmonary-arterial-hypertension phenotype progressing to right-ventricular/right-sided heart failure; group 2 PH caused by left-heart disease is expressly excluded from that direction of inference.

## Current interpretation rule

Historical entries above explain why pathway metadata was or was not authored at the time. They are **not** the current publication-state source of truth. Current mapping state is defined by `data/knowledge-base/`, current citation/debt counts by `docs/kb-coverage-tracker.md` and `npm run citations:audit`, and current catalog placement by `data/conditions/`.

Later evidence-promotion batches may continue to repair, withdraw, or leave historical mappings unlabeled. No later batch should resurrect an unsafe relationship merely to preserve a historical backfill expectation.
