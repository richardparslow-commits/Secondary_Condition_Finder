# Clinical Evidence Promotion Batch 15

Batch 15 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while promoting one previously draft Wave-2 mapping and reducing redundant legal-reference debt from a clinically supported published mapping.

## Psoriatic arthritis → depressive disorder

- `psoriatic-arthritis` is promoted from draft with one `depressive-disorder` relationship.
- A systematic review/meta-analysis of incident depression in psoriatic disease found greater depression risk and included PsA-specific subgroup analysis; the authors also noted probable bidirectional effects and substantial heterogeneity.
- A 2024 overview of systematic reviews found depression among the commonly reported psychological comorbidities of PsA, with pooled depression prevalence across included reviews of approximately 11.9% to 20%.
- The repository deliberately does **not** add causal pathway metadata. The relationship remains association/comorbidity-focused and requires individual diagnosis, chronology, disease-burden documentation, competing-cause review, and a qualified medical opinion before causation or aggravation is asserted.

## PTSD citation-debt exchange

- The three existing PTSD relationships—sleep apnea, migraine headaches, and erectile dysfunction—retain their existing clinical sources, ranks, rationales, pathway-development safeguards, and evidence gaps.
- The local 38 CFR 3.310(a)-(b) references are removed from those three suggestions because each medical proposition already has its own condition-specific clinical evidence and the legal references do not add medical support.
- No PTSD relationship is added, removed, reranked, or automatically verified.

## Citation position

Batch 15 adds two condition-specific PsA clinical references and retires three redundant unverified legal-framework references.

The projected citation ratchet is:

- total references: **122**;
- verified: **14**;
- unverified: **108**;
- published-unverified review findings: **106**;
- clinical-evidence references with canonical URLs: **at least 58**.

No source is automatically promoted to `verified: true`.

## Expansion state

`psoriatic-arthritis` is a Wave-2 expansion identity, so Batch 15 moves the controlled expansion ledger to **14 Wave 1-7 mappings individually promoted / 93 of 107 expansion mappings still draft**. The overall catalog and knowledge-base universe remains frozen at 300/300.

## Deferred verified-source cleanup

The Batch-15 audit also identified a separate legacy problem in `congestive-heart-failure`: its GERD suggestion treats long-term NSAID treatment as a heart-failure medication pathway. Current AHA/ACC/HFSA heart-failure guidance instead identifies NSAIDs as drugs that may worsen heart failure through sodium/water retention, increased vascular resistance, and blunting of diuretic response. That edge therefore requires withdrawal or redesign.

The GERD edge currently contains a human-verified NSAID/GI source, and similar verified references are reused in several legacy mappings. This cleanup is intentionally separated from Batch 15 so an unsafe medical relationship is not preserved merely to protect a numeric verified-reference floor, and so any governance change for retiring previously verified but no-longer-applicable references is explicit rather than hidden inside an expansion batch.
