# Knowledge Base Coverage & Clinical Evidence Tracker

This is the authoritative current-state tracker for post-v2 clinical evidence work. Detailed batch histories remain in `docs/clinical-evidence-promotion-batch-*.md` and the original 107-identity expansion scope remains defined by `docs/condition-expansion-roadmap.md`.

## Production-validated base for Batch 23

- Exact production-validated base: **clinical program completion controls**, SHA `fe2d29d1470755decffb5a3403db3fa9ec3d921d`.
- That SHA passed independent `main` CI #933 and Production Runtime Readiness #292 before this batch branched.
- Catalog / knowledge-base integrity remains **300 / 300**.
- Wave 1–7 expansion identities remain **107**.
- Roadmap-wave identities published with evidence-led mappings after Batch 23: **20**.
- Roadmap-wave identities intentionally draft after Batch 23: **87**.
- Promotion candidates remaining: **0**.
- `diabetes-mellitus-type-1` is **not** one of the 107 Wave 1–7 expansion identities.

## Citation position after Batch 23

Batch 23 exchanges two lower-value published review-debt rows for two condition-specific clinical-evidence sources, so the debt ceilings remain flat while clinical-source coverage improves:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65**;
- retired clinical-evidence references with canonical URLs: **4**;
- clinical-URL provenance: **69**.

The `62` live-unverified total and `60` published-review count intentionally differ: draft mappings can contain unverified research references, but `npm run citations:queue` skips drafts and queues only unverified references used by published mappings. A source-check record does not constitute qualified-human verification; `verified: true` remains a human decision under `docs/citation-verification-sop.md`.

## Current Wave 1–7 dispositions

The machine-readable source of truth is `data/expansion-dispositions.json` and its regression contract `tests/expansion-dispositions.test.ts`.

### Published evidence-led Wave identities (20)

- Wave 1: `gout`, `parkinsons-disease`, `multiple-sclerosis`, `myasthenia-gravis`, `seizure-disorder`.
- Wave 2: `psoriatic-arthritis`, `acl-injury`, `pcl-injury`, `cauda-equina-syndrome`.
- Wave 3: `thyroiditis`, `acromegaly`, `hyperaldosteronism`, `hypertensive-heart-disease`, `cardiomyopathy`, `pulmonary-hypertension`.
- Wave 4: none.
- Wave 5: `achalasia`, `barretts-esophagus`, `chronic-liver-disease`, `chronic-pyelonephritis`, `urethral-stricture`.
- Waves 6–7: none.

### Screened promotion candidates (0)

The two final screened candidates were resolved in Batch 23:

- `gout` → `depressive-disorder` is published as association/comorbidity research using a gout-specific systematic review/meta-analysis;
- `myasthenia-gravis` → `depressive-disorder` is published as association/comorbidity research using an MG-specific systematic review/meta-analysis.

Neither mapping contains automatic causal pathway metadata, and both new sources remain `verified: false` pending qualified-human verification.

### Intentional safe drafts (87)

All remaining Wave 1–7 draft identities are explicit `safe-draft` dispositions. That is an acceptable reviewed product state. The objective is **not** to publish all 107 identities regardless of evidence; publication requires a defensible condition-specific relationship.

`trigeminal-neuralgia` remains an intentional safe draft because the initially noted screening PMID did not match the condition/evidence proposition and no replacement source has passed the repository's promotion threshold.

## Batch 23 debt cleanup

Before adding the two new clinical references, Batch 23 removes two published unverified rows that were not adding defensible clinical support:

1. `adjustment-disorder` → `migraine-headaches` is withdrawn because its only source was rating/legal authority (`38 CFR 4.124a`) and the relationship had no attached clinical evidence.
2. The redundant unverified `38 CFR 3.310(a)-(b)` source is removed from `depressive-disorder` → `erectile-dysfunction`; the two clinical systematic reviews and the authored medication-related pathway remain unchanged.

This preserves the live-reference, unverified, and published-review ceilings while replacing two non-clinical review rows with two condition-specific clinical sources.

## Safety-remediation progress

Clinical Evidence Promotion Batches 1–23 have used one of four outcomes:

1. promote a strong draft relationship with condition-specific evidence;
2. clinically repair a published relationship whose prior evidence was too weak or too generic;
3. withdraw an unsafe published edge or whole mapping back to draft; or
4. perform bounded identity/modeling cleanup without changing the 300/300 universe.

Major later safety withdrawals include legal/rating-only respiratory mappings, generic mental-health three-edge mappings, broad neurological residual mappings, unsupported ED/CHF/stomach-cancer/abdominal-hernia GERD treatment chains, the six-edge broad skull-fracture mapping, and the unsupported adjustment-disorder→migraine edge. Detailed rationale is preserved in the individual batch documents and historical pathway-supersession ledger.

## Completion definition

The clinical evidence program is controlled when:

- every Wave 1–7 identity has an explicit disposition in `data/expansion-dispositions.json`;
- every live published relationship satisfies the repository's clinical-evidence/provenance rules;
- unsafe legacy relationships are withdrawn rather than retained for count preservation;
- remaining draft identities are explicit safe drafts rather than implicit unfinished work;
- modeling debt is explicitly dispositioned without silently changing stable IDs or the 300-condition universe;
- every live unverified published source is available to a qualified human through `npm run citations:queue`;
- external/manual gates remain clearly separated from repository automation.

## Exact-head workflow

Every future evidence promotion or repair must continue to use: bounded branch from production-validated `main` → exact-head PR CI → immutable-head review → squash merge with expected-head protection → independent `main` CI → exact Vercel deployment/canonical-alias/log proof → Production Runtime Readiness.
