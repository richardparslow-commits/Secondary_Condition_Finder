# Step 5 Pathway-Intelligence Backfill Ledger

This ledger records the controlled enrichment of already-published primary-to-secondary mappings after the Step 5 pathway-intelligence framework was introduced. The Batch 1-4 sections are historical status snapshots from that backfill program; later Clinical Evidence Promotion batches may repair or withdraw mappings that were intentionally left unlabeled at the time. The current supersession record is maintained at the end of this document.

## Guardrail

A pathway label is added only when the published edge already has enough attached clinical/legal support to frame that pathway conservatively. The pathway-development worksheets supplied for this project guide pathway organization, causal-chain formatting, and development-question structure; they are not standalone medical evidence for an individual edge.

An intentionally-unlabeled edge is a reviewed edge, not an omitted one. Lack of pathway metadata does not imply that a claim theory is invalid; it means the current published source set is not strong enough for this product to author the additional pathway explanation.

Pathway metadata remains display/research guidance only. It does not change recommendation rank, prevalence, score, filtering, intake matching, or establish an individual medical nexus.

## Batch 1 — Mental Health / Neurological (#247)

### Backfilled

| Primary | Secondary | Authored pathway(s) | Existing support used |
|---|---|---|---|
| adjustment-disorder | sleep-apnea | direct-secondary; aggravation | Psychiatric/OSA systematic-review source plus § 3.310 framework; copy explicitly preserves association-vs-individual-nexus distinction. |
| adjustment-disorder | gerd | direct-secondary; aggravation | Psychosocial-disorder/GERD systematic review plus § 3.310 framework. NSAID evidence remains a separate association and is not used to label this edge medication-related without indication evidence. |
| depressive-disorder | sleep-apnea | medication-related; intermediate-chain | Systematic-review evidence for antidepressant-associated weight gain plus meta-analytic obesity/OSA evidence and § 3.310 framework. |
| depressive-disorder | erectile-dysfunction | medication-related | Systematic-review/meta-analysis evidence for antidepressant-associated sexual dysfunction plus § 3.310 framework. |

PTSD → sleep-apnea, PTSD → migraine-headaches, and PTSD → erectile-dysfunction were already enriched in #244 and are retained as the Batch 1 control case.

### Reviewed and intentionally left unlabeled

The following published mappings were reviewed, but their current attached sources were legal/rating-framework only or otherwise insufficient to author additional medical-pathway intelligence without first strengthening the underlying evidence:

- agoraphobia
- anxiety-disorder
- bipolar-disorder
- persistent-depressive-disorder
- panic-disorder
- schizophrenia
- social-anxiety-disorder
- somatic-symptom-disorder
- substance-use-disorder
- mild-tbi
- micro-tbi
- post-concussion-syndrome
- subdural-hematoma
- epidural-hematoma
- skull-fracture-non-basilar-and-basal
- rem-sleep-disorder

Within `adjustment-disorder`, the `migraine-headaches` edge was also intentionally left unlabeled because its attached source was a rating/legal framework rather than clinical evidence of the proposed relationship.

Draft mappings were outside this backfill program; for example, `migraine-headaches` and `ocd` were draft and were not promoted or pathway-enriched by this work.

## Batch 2 — Musculoskeletal (#248)

### Backfilled

| Primary | Secondary | Authored pathway(s) | Existing support used |
|---|---|---|---|
| rheumatoid-arthritis | depressive-disorder | somatopsychic | Published pain/depression systematic review plus § 3.310 framework; copy limits the pathway to documented pain/functional impairment and individual clinical assessment. |
| rheumatoid-arthritis | gerd | medication-related | Published NSAID gastrointestinal-risk systematic review plus § 3.310 framework; medication indication, exposure, diagnosis, timing, and alternative causes remain individual-development questions. |

Knee injury → hip strain and knee injury → lumbar strain were already enriched in #244 and were retained as the biomechanical control case at the time.

### Reviewed and intentionally left unlabeled

The following published Musculoskeletal edges were left unlabeled at Batch 2 because their attached sources were legal/rating-framework only or otherwise insufficient for new medical-pathway metadata:

- ankle-strain → contralateral-knee-condition
- ankle-strain → flatfoot
- osteoarthritis → plantar-fasciitis
- amputation-or-loss-of-use → depressive-disorder
- knee-injury → ankle-strain
- knee-injury → contralateral-knee-condition

`lumbar-strain`, `cervical-strain`, `hip-strain`, `intervertebral-disc-syndrome`, and `radiculopathy` were draft and excluded from the published-mapping backfill.

## Batch 3 — Respiratory / ENT (#249)

### Backfilled

| Primary | Secondary | Authored pathway(s) | Existing support used |
|---|---|---|---|
| copd | sleep-apnea | direct-secondary; aggravation | COPD/OSA overlap-syndrome systematic review; copy explicitly separates population-level coexistence from an individual causation/aggravation opinion. |
| copd | cardiac-arrhythmia | intermediate-chain | Clinical COPD cohort evidence describing nocturnal oxygen desaturation and its potential relationship to nocturnal arrhythmias, plus § 3.310 framework. |
| asthma | sleep-apnea | direct-secondary; aggravation | Asthma/OSA systematic review and meta-analysis; copy preserves association-vs-individual-nexus distinction. |
| asthma | cardiac-arrhythmia | direct-secondary | Asthma/atrial-fibrillation systematic review and meta-analysis with explicit warning that heterogeneity/risk of bias make the association signal low-confidence. |

### Reviewed and intentionally left unlabeled

The following published Respiratory / ENT mappings were left unlabeled at Batch 3 because their attached source sets were legal/rating-framework only or otherwise insufficient for new medical-pathway metadata:

- chronic-sinusitis
- chronic-rhinitis
- emphysema
- chronic-bronchitis
- pulmonary-fibrosis
- interstitial-lung-disease
- anosmia
- ageusia
- sleep-apnea

For asthma → cardiac-arrhythmia, the existing rationale notes that medication effects may also contribute. That edge is **not** labeled medication-related because the attached clinical source supports the asthma/atrial-fibrillation association, not a medication-specific adverse-effect pathway.

`bronchiolitis`, `sarcoidosis`, `deviated-nasal-septum`, `laryngeal-stenosis`, `pneumoconiosis`, `noise-induced-hearing-loss`, and `tinnitus` were draft and excluded from the published-mapping backfill.

## Batch 4 — Systemic / Medical (#250)

### Backfilled

| Primary | Secondary | Authored pathway(s) | Existing support used |
|---|---|---|---|
| stomach-cancer | depressive-disorder | somatopsychic | Existing chronic-pain/functional-impact rationale plus published pain/depression systematic review and § 3.310 framework. The causal chain is explicitly conditional on individual documentation of pain or functional limitation. |
| abdominal-hernia | depressive-disorder | somatopsychic | Existing chronic-pain/functional-impact rationale plus published pain/depression systematic review and § 3.310 framework. The causal chain is explicitly conditional on individual documentation of pain or functional limitation. |

### Reviewed and intentionally left unlabeled

The following Systemic / Medical edges were left unlabeled at Batch 4 despite having some clinical evidence because the attached source set did not support enough of the specific primary→mechanism/treatment chain to author the stronger pathway metadata:

- stomach-cancer → gerd — NSAID gastrointestinal-risk evidence does not establish that stomach-cancer treatment produced the relevant NSAID exposure.
- abdominal-hernia → gerd — NSAID gastrointestinal-risk evidence does not establish that hernia treatment produced the relevant NSAID exposure.
- erectile-dysfunction → gerd — NSAID/GERD association evidence does not establish any erectile-dysfunction→NSAID indication link.
- congestive-heart-failure → depressive-disorder — the attached review supports depression as a heart-failure comorbidity, but not enough mechanism for a physical→mental-health pathway label under this backfill threshold.
- congestive-heart-failure → gerd — NSAID gastrointestinal-risk evidence does not establish a heart-failure→NSAID treatment link.

The following published Systemic / Medical mappings/edges were left unlabeled at Batch 4 because their attached source sets were legal/rating-framework only or otherwise insufficient:

- hypertension
- al-amyloidosis
- agranulocytosis
- alopecia-areata
- anorexia-nervosa
- addisons-disease
- erectile-dysfunction → depressive-disorder

This completed the four-category published-mapping review. Intentionally-unlabeled edges remained eligible for later enrichment only after their underlying published source sets were strengthened; the backfill program did not infer missing medical links.

## Subsequent evidence-promotion supersession through Batch 8

Later Clinical Evidence Promotion batches changed several historical Batch 2-4 statuses without weakening the original backfill threshold:

- `knee-injury` and `osteoarthritis` were returned to draft in Clinical Evidence Promotion Batch 2 rather than preserving their weak biomechanical/legal-only publication state.
- `amputation-or-loss-of-use` → `depressive-disorder` was repaired with condition-specific clinical evidence in Batch 3.
- `ageusia` was returned to draft in Batch 3.
- `anosmia` → `depressive-disorder` and `alopecia-areata` → `depressive-disorder` were repaired with condition-specific clinical evidence in Batch 4.
- `agranulocytosis` was returned to draft in Batch 4.
- `al-amyloidosis` was returned to draft in Batch 5.
- `addisons-disease` was returned to draft in Batch 6.
- `anorexia-nervosa` was returned to draft in Batch 7.
- All four published `hypertension` relationships were clinically repaired in Batch 8. The CKD, ischemic-heart-disease, and congestive-heart-failure edges now carry bounded `disease-progression` pathway intelligence. The erectile-dysfunction edge now has condition-specific association evidence but remains intentionally pathway-unlabeled because the evidence does not justify a stronger individual causal or medication-related pathway label.
- `erectile-dysfunction` → `depressive-disorder` remains published but intentionally unlabeled pending stronger condition-specific evidence.

The current publication counts and citation-debt ratchet are maintained in `docs/kb-coverage-tracker.md`; this ledger remains the historical record of why pathway metadata was or was not authored during the original backfill.
