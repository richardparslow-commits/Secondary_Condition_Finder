# Clinical Evidence Promotion Batch 16

Batch 16 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while withdrawing an unsafe legacy medication pathway and introducing an explicit provenance mechanism for previously verified citations that are retired for applicability or safety reasons.

## Congestive heart failure → GERD

- The `congestive-heart-failure` → `gerd` suggestion is withdrawn.
- The prior rationale treated long-term NSAID exposure as a heart-failure treatment pathway. Current AHA/ACC/HFSA heart-failure guidance instead identifies NSAIDs as medications that may worsen heart failure through sodium/water retention, increased systemic vascular resistance, and blunted diuretic response.
- The previously verified NSAID systematic review remains valid for the narrower proposition that non-selective NSAIDs are associated with gastrointestinal injury and clinical events, but that does not make the source applicable to a CHF → GERD relationship.
- The relationship is therefore removed rather than preserved to protect a citation count.

## Congestive heart failure → depressive disorder

- The depression relationship remains published at rank 1.
- Its existing human-verified heart-failure/depression systematic review remains live.
- The redundant local 38 CFR 3.310 reference is removed because it adds legal framework, not medical support.
- The rationale and evidence gaps are tightened to keep the relationship comorbidity/association-focused and require diagnosis, chronology, functional burden, competing-cause review, and an individual qualified opinion before causation or aggravation is asserted.

## Verified citation retirement provenance

Batch 16 adds `data/citation-retirements.json` and updates the Citation Verification SOP and audit so CI distinguishes:

1. **Live verified citations** that currently support published relationships; and
2. **Retired verified provenance** for citations that were legitimately human-verified but later removed from a live relationship because the relationship or source applicability failed review.

A retirement entry must preserve the prior citation, URL, source-check date, locator, verification scope, former mapping/relationship, a concrete retirement reason, and source-checked withdrawal evidence. Retirement does not verify a new proposition or replacement source.

The audit also rejects a retirement entry if the same citation remains live on the same relationship.

## Citation position

After withdrawing the CHF → GERD suggestion and the redundant CHF depression legal citation, the projected live and provenance metrics are:

- live references: **119**;
- live verified: **13**;
- retired verified: **1**;
- verified provenance: **14**;
- live unverified: **106**;
- published-unverified review findings: **104**;
- live clinical-evidence references with canonical URLs: **57**;
- retired clinical-evidence references with canonical URLs: **1**;
- clinical URL provenance: **58**.

No source is automatically promoted to `verified: true`. The historical verified source is carried forward only because it was already verified in the pre-Batch-16 live mapping.

## Expansion state

Batch 16 repairs legacy published debt and governance rather than promoting another Wave 1-7 expansion identity. The controlled expansion ledger therefore remains **14 individually promoted / 93 of 107 expansion mappings still draft**. The overall catalog and knowledge-base universe remains frozen at 300/300.
