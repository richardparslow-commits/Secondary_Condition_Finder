# Clinical Evidence Promotion Batch 3

Batch 3 preserves the exact **300 catalog / 300 knowledge-base** integrity contract and continues relationship-level evidence promotion rather than bulk publication.

## New promotion

### `chronic-liver-disease` → `cirrhosis-of-the-liver`

Published only as a documented **fibrosis-progression** pathway. The source is the 2020 evidence-based hepatic-fibrosis consensus (PMID 32108989), which describes fibrosis as a key developmental step across chronic liver diseases leading to cirrhosis. The mapping explicitly requires an etiology-specific liver diagnosis, objective fibrosis evidence, chronology, and review of competing liver injuries. The umbrella catalog identity is not treated as one etiology and the source remains `verified: false` pending qualified-human verification.

## Legacy evidence repair

### `amputation-or-loss-of-use` → `depressive-disorder`

The previous legal-only 38 CFR 3.310 source is removed. The relationship is retained only after adding the systematic review of anxiety and depression following traumatic limb amputation (PMID 25294119), with a `somatopsychic` pathway and case-specific chronology/alternative-contributor safeguards. Population-level post-amputation depression prevalence is not treated as an automatic individual nexus.

## Safety withdrawal

### `ageusia`

Returned to draft. Its depression and GERD suggestions were supported only by 38 CFR 3.310. That regulation supplies legal framework and does not establish either an ageusia-specific mood relationship or a treatment-to-GI medical pathway.

## Catalog-quality debt

`insomnia` is physically relocated from `data/conditions/carried-over.json` into `data/conditions/mental-disorders.json`. Stable ID, aliases, body system, 38 CFR 4.130 framework, and `verified: false` state are preserved. No identity is added or removed.

## Citation-debt ratchet

Starting from Batch 2's 141 references / 127 unverified / 125 review findings / 29 clinical-evidence URLs:

- one new clinical reference is added for chronic-liver-disease;
- the amputation legal-only reference is replaced one-for-one with a clinical reference;
- two ageusia legal-only references are retired.

Expected Batch 3 state:

- 140 total references;
- 14 verified;
- 126 unverified;
- 124 published-unverified review findings;
- at least 31 clinical-evidence references with canonical URLs;
- zero citation hard findings.

The automated ratchet is tightened to those values. No source is automatically marked verified.

## Expected post-batch catalog state

- 300 catalog conditions;
- 300 KB mappings;
- 33 catalog files;
- **102 of 107 Wave 1-7 expansion mappings remain draft** after the fifth individually reviewed expansion mapping (`chronic-liver-disease`) is promoted.

Before merge, the exact branch head must pass citation audit, KB validation, lint, typecheck, critical-module composition, the full unit suite, production build, both real-browser journeys, diagnostics, and aggregate fail-safe. The exact squash SHA must then pass main CI and Production Runtime Readiness.
