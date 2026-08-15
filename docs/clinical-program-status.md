# Clinical Evidence Program Status

Status: **Batch 30 Wave-7 rescreen has been narrowed after review and awaits fresh exact-head CI, fresh Vercel Agent immutable-head review, protected merge, and production closure. External/human gates remain separate.**

## Production-validated base

Batch 30 branches from production-validated `main` SHA `b7624571d31de6ce3fa2c7efae5e5e1c18ba194f` (`Promote evidence-led Wave 6 mapping (#353)`). That SHA passed independent `main` CI #1031 and Production Runtime Readiness #390 before Wave 7 began.

The workflow remains: exact-head PR CI → genuine Vercel Agent immutable-head code review → expected-head protected squash merge → independent merge-SHA `main` CI → Production Runtime Readiness. A Vercel preview/deployment `Ready` status is not the review gate, and any head change requires fresh exact-head CI and Vercel Agent review.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- Batch 30 does not add, delete, rename, or merge condition identities.

## Expansion program — corrected Batch 30 candidate state

`data/expansion-dispositions.json` records:

- **30 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **77 safe-draft** Wave identities.

Batch 30 publishes two bounded Wave-7 relationships:

- `ovarian-cancer` → `peripheral-neuropathy`, limited to compatible neuropathy after documented paclitaxel-containing treatment;
- `testicular-cancer` → `hypogonadism`, limited to clinically and biochemically confirmed hypogonadism after a supported treatment exposure.

Review returned two initially screened candidates to safe draft:

- `histoplasmosis`: the catalog identity is Histoplasmosis of Lung, while the supporting Addison-disease evidence is adrenal histoplasmosis and the intake lacks a disease-site control capable of enforcing that distinction;
- `laryngeal-cancer`: post-total-laryngectomy loss of the natural laryngeal voice source and rehabilitated alaryngeal speech do not by themselves establish the distinct diagnosis of aphonia.

The other six Wave-7 identities also remain safe draft because target fit, direction, grouping heterogeneity, or distinct downstream-diagnosis evidence is insufficient.

## Evidence-quality cleanup and citation ratchet

Batch 30 withdraws three association-only depression edges—Parkinson disease, seizure disorder, and psoriatic arthritis—and removes the weaker trigeminal-neuralgia→anxiety suggestion. Only the two surviving Wave-7 sources are added. All affected source rows are `verified: false`, so no verified-source retirement record is created.

Expected citation position improves to:

- live references: **67**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **59**;
- published-unverified review findings: **57**;
- live clinical-evidence references with canonical URLs: **62**;
- retired clinical-evidence URLs: **4**;
- combined clinical-URL provenance observation: **66**.

## Human citation verification

Automation may retrieve sources, record canonical URLs/check dates/locators, and prepare the review queue. It may not set a source to `verified: true`. The two new live Batch-30 sources—PMIDs 24582486 and 27009402—remain `verified: false` until qualified-human review.

## External/manual gates

See `docs/external-manual-gates-status.md`. Repository automation does not fabricate human verification, credentials, accessibility observations, or external-provider success.

## What “complete” means

Repository automation is complete for a work item when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, the Vercel Agent immutable-head review is clean, and production closure proves the merge SHA.

After Batch 30 there are no `promotion-candidate` Wave identities. The remaining 77 Wave drafts are explicit safe dispositions unless later evidence justifies another bounded review.
