# Clinical Evidence Program Status

Status: **Targeted Clinical Mapping Batch 31 is implemented on a production-validated base and awaits exact-head CI, Vercel Agent immutable-head review, protected merge, and production closure. External/human gates remain separate.**

## Production-validated base

Batch 31 branches from production-validated `main` SHA `a15dd22ccc2f080343814e25c445a6f61282c5af` (`Promote evidence-led Wave 7 mappings (#354)`). That SHA passed independent `main` CI #1043 and Production Runtime Readiness #402 after Batch 30 merged.

The workflow remains: exact-head PR CI → genuine Vercel Agent immutable-head code review → expected-head protected squash merge → independent merge-SHA `main` CI → Production Runtime Readiness. A Vercel preview/deployment `Ready` status is not the review gate, and any head change requires fresh exact-head CI and Vercel Agent review.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- Batch 31 does not add, delete, rename, or merge condition identities.

## Wave program state

`data/expansion-dispositions.json` remains:

- **30 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **77 safe-draft** Wave identities.

Batch 31 is a targeted rescreen across 14 existing catalog identities and does not change that Wave ledger.

## Batch 31 targeted mapping state

Two new relationships are published in the branch candidate:

- `insomnia` → `depressive-disorder`, bounded to an independently established insomnia diagnosis preceding a separately diagnosed depressive disorder and supported by prospective incident-depression evidence (PMID 38833937);
- `migraine-headaches` → `depressive-disorder`, modeled as a bounded somatopsychic pathway using prospective incident-depression evidence (PMID 23588795).

`mild-tbi` keeps its existing published `mild-tbi` → `migraine-headaches` relationship (PMID 38568491).

The remaining targeted identities stay safe draft after exact-target review: `carpal-tunnel-syndrome`, `chronic-fatigue-syndrome`, `hypothyroidism`, `illness-anxiety-disorder`, `median-neuropathy`, `micro-tbi`, `narcolepsy`, `peripheral-neuropathy`, `radial-neuropathy`, `rem-sleep-disorder`, and `social-anxiety-disorder`.

Key negative-modeling protections include rejecting CTS/median-neuropathy taxonomy overlap as a secondary condition, preserving the nonstandardized micro-TBI boundary, and treating REM sleep behavior disorder as a prodromal synucleinopathy marker rather than a cause of Parkinson disease.

## Citation position

After qualified-human Citation Verification Batches 01 through 12, the current local position is:

- live references: **69**;
- live verified: **47**;
- retired verified: **6**;
- verified provenance: **53**;
- live unverified: **22**;
- published-unverified review findings: **20**;
- live clinical-evidence references with canonical URLs: **64**;
- retired clinical-evidence URLs: **4**;
- combined clinical-URL provenance observation: **68**.

Batch 08 lowers the debt ratchet from 26/24 to 22/20 while preserving 69 total live references and zero hard findings. Three relationships were verified as written; migraine→depressive disorder was narrowed to temporal-association-only evidence before verification; and mild-TBI→`migraine-headaches` was narrowed but deliberately held unverified because the cited review establishes post-traumatic headache with migraine-like phenotype rather than the current migraine target itself.

## Human citation verification

Automation may retrieve sources, record canonical URLs/check dates/locators, and prepare the review queue. It may not independently authorize `verified: true`. Citation Verification Batches 01 through 12 record explicit qualified-human approval resulting in thirty-nine newly verified live sources across the verification series; the remaining 22 live unverified references remain `verified: false` until separately reviewed. Batch 08 demonstrates that human review may intentionally retain `verified: false` when source-to-target taxonomy is insufficient.

## External/manual gates

See `docs/external-manual-gates-status.md`. Repository automation does not fabricate human verification, credentials, accessibility observations, or external-provider success.

## What “complete” means

Repository automation is complete for Batch 31 only when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, the Vercel Agent immutable-head review is clean on the same SHA, and production closure proves the merge SHA.

<!-- citation-verification-master-current:start -->
## Current citation-verification position

Master-approved implementation is complete through **Batch 12**.
- Live verified references: **67**
- Retired verified references: **6**
- Verified provenance: **73**
- Live unverified references: **2**
- Published unverified review findings: **1**
- Hard findings: **0**
- Live clinical source URL coverage: **64/64**

Current unresolved published queue:
- `mild-tbi.json` → `migraine-headaches`: Schwedt TJ. Posttraumatic Headache. Continuum (Minneap Minn). 2024;30(2):411-424. PMID 38568491
<!-- citation-verification-master-current:end -->
