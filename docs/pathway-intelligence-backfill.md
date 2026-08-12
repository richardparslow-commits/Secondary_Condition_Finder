# Step 5 Pathway-Intelligence Backfill Ledger

This ledger records the controlled enrichment of already-published primary-to-secondary mappings after the Step 5 pathway-intelligence framework was introduced.

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

The following published mappings were reviewed, but their current attached sources are legal/rating-framework only or otherwise insufficient to author additional medical-pathway intelligence without first strengthening the underlying evidence:

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

Within `adjustment-disorder`, the `migraine-headaches` edge is also intentionally left unlabeled because its attached source is a rating/legal framework rather than clinical evidence of the proposed relationship.

Draft mappings are outside this backfill program; for example, `migraine-headaches` and `ocd` remain draft and are not promoted or pathway-enriched by this work.

## Batch 2 — Musculoskeletal (#248)

Pending Batch 1 production verification.

## Batch 3 — Respiratory / ENT (#249)

Pending Batch 2 production verification.

## Batch 4 — Systemic / Medical (#250)

Pending Batch 3 production verification.
