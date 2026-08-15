# Clinical Evidence Program Status

Status: **Batch 30 Wave-7 rescreen is implemented on its bounded branch and awaits exact-head validation, Vercel Agent immutable-head review, protected merge, and production closure. External/human gates remain separate.**

## Production-validated base

Batch 30 branches from production-validated `main` SHA `b7624571d31de6ce3fa2c7efae5e5e1c18ba194f` (`Promote evidence-led Wave 6 mapping (#353)`). That SHA passed independent `main` CI #1031 and Production Runtime Readiness #390 before Wave 7 began.

The current workflow is: exact-head PR CI → genuine Vercel Agent immutable-head code review → expected-head protected squash merge → independent merge-SHA `main` CI → Production Runtime Readiness. A Vercel preview/deployment `Ready` status is not the review gate, and any head change requires fresh exact-head CI and Vercel Agent review.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- Batch 30 does not add, delete, rename, or merge condition identities.

## Expansion program — Batch 30 candidate state

`data/expansion-dispositions.json` records:

- **32 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **75 safe-draft** Wave identities.

Batch 30 publishes four bounded Wave-7 relationships:

- `histoplasmosis` → `addisons-disease`, limited to documented adrenal/disseminated histoplasmosis with adrenal involvement and confirmed primary adrenal insufficiency;
- `ovarian-cancer` → `peripheral-neuropathy`, limited to a compatible neuropathy after documented paclitaxel-containing treatment;
- `testicular-cancer` → `hypogonadism`, limited to clinically and biochemically confirmed hypogonadism after a supported treatment exposure;
- `laryngeal-cancer` → `aphonia`, limited to documented total laryngectomy and loss of natural laryngeal phonation.

The other six Wave-7 identities remain safe-draft because target fit, direction, grouping heterogeneity, or distinct downstream-diagnosis evidence is insufficient.

## Evidence-quality cleanup and citation ratchet

Batch 30 withdraws three association-only published depression edges—Parkinson disease, seizure disorder, and psoriatic arthritis—and removes the weaker trigeminal-neuralgia→anxiety suggestion. Those four source rows are replaced one-for-one by the four stronger Wave-7 clinical sources. All removed and added source rows are `verified: false`, so no verified-source retirement record is created.

Expected citation position remains debt-neutral:

- live references: **69**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **61**;
- published-unverified review findings: **59**;
- live clinical-evidence references with canonical URLs: **64**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **68**.

## Human citation verification

Automation may retrieve sources, record canonical URLs/check dates/locators, and prepare the review queue. It may not set a source to `verified: true`. The four new Batch-30 sources—PMIDs 30656706, 24582486, 27009402, and 29086803—remain `verified: false` until qualified-human review.

## Modeling debt

The named v2 modeling items remain explicitly dispositioned in `docs/modeling-debt-dispositions.md`:

- `contralateral-knee-condition`: quarantined laterality placeholder pending a future structural laterality model;
- `micro-tbi`: historical/non-standard compatibility identity retained as an unpublished draft relative to standardized `mild-tbi`;
- `cerebral-palsy`: recognition identity retained without implying service-connection/legal applicability; mapping remains draft.

These controlled states do not justify an unversioned ID deletion or a 300/300 change.

## External/manual gates

See `docs/external-manual-gates-status.md`.

- GitHub issue #189, credentialed VA sandbox smoke test: **OPEN / externally blocked**.
- GitHub issue #195, Section 508 review: **OPEN / human-only**.
- GitHub issue #287, VA public-reference production transition: **OPEN / external-provider gate**.
- GitHub issue #213, production workflow-session secret: **COMPLETE / closed**.

## What “complete” means

Repository automation is complete for a work item when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, the Vercel Agent immutable-head review is clean, and production closure proves the merge SHA. It does not fabricate human verification, credentials, accessibility observations, or external-provider success.

After Batch 30 there are no `promotion-candidate` Wave identities. The remaining 75 Wave drafts are explicit safe dispositions unless later evidence justifies another bounded review.
