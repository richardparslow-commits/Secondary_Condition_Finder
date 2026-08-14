# Clinical Evidence Promotion Batch 2

Clinical Evidence Promotion Batch 2 continues the post-v2 relationship-level evidence work while preserving the exact **300 catalog / 300 knowledge-base** integrity contract.

## Promoted relationships

### `hypertensive-heart-disease` → `congestive-heart-failure`

- Promoted as a `disease-progression` pathway.
- Clinical support: Díez and Butler, *Growing Heart Failure Burden of Hypertensive Heart Disease: A Call to Action*, Hypertension. 2023;80:13-21. PMID 36082670.
- The published rationale requires objective hypertensive cardiac remodeling or dysfunction rather than hypertension alone.
- Development questions require chronology, ventricular-function/congestion evidence, and review of ischemic, valvular, cardiomyopathic, rhythm-related, renal, and pulmonary competing causes.
- The source is source-checked with a canonical PubMed URL and remains `verified: false` pending qualified-human verification under `docs/citation-verification-sop.md`.

### `chronic-pyelonephritis` → `chronic-kidney-disease`

- Promoted as a cautious `disease-progression` pathway.
- Clinical support: Goodship et al., *Long-term follow-up of patients presenting to adult nephrologists with chronic pyelonephritis and 'normal' renal function*, QJM. 2000;93:799-803. PMID 11110586.
- The rationale explicitly preserves the cohort finding that many adults with preserved renal function remain stable and limits the relationship to records with objective scarring/persistent renal damage or longitudinal renal-function loss.
- Development questions require bilateral-disease/scarring context, renal-function trend, proteinuria/hypertension review, and competing CKD etiologies.
- The source is source-checked with a canonical PubMed URL and remains `verified: false` pending qualified-human verification.

## Safety withdrawals

### `knee-injury`

Returned to draft. The prior four hip/ankle/lumbar/contralateral-knee biomechanical suggestions relied on musculoskeletal rating authority and 38 CFR 3.310 rather than condition-specific clinical evidence. Those authorities can describe rating or legal framework but do not establish the medical propositions.

### `osteoarthritis`

Returned to draft. The prior plantar-fasciitis suggestion used only 38 CFR 4.71a to support a biomechanical relationship. The rating schedule cannot establish that osteoarthritis caused or aggravated plantar fasciitis.

The withdrawn relationships may be reconsidered only as individual edges after condition-specific clinical evidence and case-specific nexus safeguards are available.

## Catalog-quality debt

`diabetic-retinopathy` is physically relocated from the historical `data/conditions/carried-over.json` bucket into `data/conditions/ophthalmologic-expansion-wave-4.json`.

The relocation does not change:

- stable ID or aliases;
- body-system value;
- 38 CFR 4.79 / DC 6040 rating identity;
- citation verification state; or
- the 300/300 one-to-one integrity contract.

## Citation-debt ratchet

Batch 2 retires nine unsafe unverified legacy references and adds two condition-specific clinical-evidence references. The automated non-regression baseline is tightened to:

- 141 total references;
- 14 verified;
- 127 unverified;
- 125 published-unverified review findings; and
- at least 29 clinical-evidence references with canonical URLs.

The batch does **not** claim qualified-human verification for the two new sources.

## Expected post-batch state

- catalog conditions: **300**;
- KB mappings: **300**;
- physical catalog files: **33**;
- Wave 1-7 expansion mappings still draft: **103 of 107**;
- newly promoted relationships: **2**;
- newly safety-withdrawn legacy mappings: **2**.

## Gate

Before merge, the exact PR head must pass citation audit, KB validation, lint, typecheck, critical-module composition, the full unit suite, production build, both real-browser journeys, and aggregate fail-safe. Main CI and Production Runtime Readiness must then validate the exact squash merge SHA before this batch is considered complete in production.
