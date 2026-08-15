# Clinical Evidence Promotion Batch 20

Batch 20 preserves the exact **300 catalog / 300 knowledge-base** contract while removing three more legal/rating-only published mappings, clinically repairing one mild-TBI headache relationship, and promoting one Wave-1 Parkinson disease association mapping.

## Safety withdrawals

`anxiety-disorder`, `schizophrenia`, and `substance-use-disorder` are returned to draft. Their live suggestions were supported only by legal/rating authorities rather than condition-specific clinical evidence for the medical propositions. Future publication requires diagnosis-specific evidence and directionality appropriate to the exact relationship.

## Mild TBI → migraine-headaches repair

- The old legal-only mTBI→depression edge is removed.
- The headache edge is retained only after replacement with clinical evidence describing post-traumatic headache attributed to mild TBI and its frequent migraine-like phenotype.
- Because the catalog target is `migraine-headaches`, not the broader post-traumatic-headache diagnosis, the mapping requires a clinician to diagnose migraine or persistent post-traumatic headache with a migraine phenotype and to document the temporal relationship.
- No pathway metadata is authored because the source does not justify relabeling every post-traumatic headache as migraine.

## Parkinson disease → depressive disorder

- `parkinsons-disease` → `depressive-disorder` is promoted as association/comorbidity research only.
- A systematic review/meta-analysis of depression-detection studies found pooled major-depression prevalence of 22.9% among adult outpatients with Parkinson disease.
- The mapping expressly does not establish causal direction; depression can occur at different points in the Parkinson disease course and individual medication, sleep, cognition, pain, disability, psychosocial, and psychiatric contributors require review.
- The source remains `verified: false` pending qualified-human verification.

## Citation position

Batch 20 tightens the provenance-aware ratchet to:

- live references: **89**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **81**;
- published-unverified review findings: **79**;
- live clinical-evidence references with canonical URLs: **60**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **64**.

## Expansion state

Parkinson disease is a Wave-1 identity. Batch 20 moves the controlled expansion ledger to **17 individually promoted / 90 of 107 expansion mappings still draft**. Draft remains an acceptable reviewed outcome when evidence is insufficient for safe publication.
