# Clinical Evidence Program Status

Status: **Batch 27 Wave-4 rescreen implementation is repository-controlled; exact-head/production closure remains governed by the immutable-head workflow, and external/human gates remain separate**.

## Production-validated base

Batch 27 branches from production-validated `main` SHA `b260bbcb8a7a8de70178d23ab023ccdea253ad8e` (`Promote evidence-led Wave 3 mappings (#350)`):

- independent `main` CI #992 passed;
- Production Runtime Readiness #351 passed on the exact SHA; and
- no Batch 27 change is considered production-closed until its own exact-head PR CI, immutable-head review, protected merge, merge-SHA `main` CI, and Production Runtime Readiness pass.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- Batch 27 does not add, delete, rename, or merge condition identities.

## Expansion program — Batch 27 candidate state

`data/expansion-dispositions.json` now records:

- **31 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **76 safe-draft** Wave identities.

Batch 27 adds three bounded Wave-4 mappings:

- `uveitis` → `glaucoma`, requiring objectively diagnosed glaucoma and individual review of inflammatory and corticosteroid-treatment mechanisms rather than treating ocular hypertension alone as glaucoma;
- `retinal-dystrophy` → `visual-impairment`, requiring phenotype-specific retinal disease and objective concordant visual loss; and
- `ptosis` → `visual-impairment`, limited to objectively documented mechanical superior-field obstruction attributable to eyelid position.

The other 12 Wave-4 identities remain safe-draft after bounded screening. A safe draft is a completed reviewed disposition, not a clinical defect.

## Evidence-quality cleanup and citation ratchet

Batch 27 removes three unverified association/comorbidity edges while adding three stronger direct-complication/functional-loss sources:

- withdraw `anosmia` → `depressive-disorder` because the cited meta-analysis does not establish direction and calls for longitudinal/mechanistic clarification;
- withdraw `alopecia-areata` → `depressive-disorder` because the cited evidence supports increased prevalence/odds and screening, not a directional secondary-condition pathway; and
- withdraw `hypothyroidism` → `depressive-disorder` because the cited meta-analysis found only a modest, phenotype/subgroup-dependent association rather than a general directional relationship.

All three removed source rows were `verified: false`, so no verified-source retirement entry is created.

The expected citation position remains at the established ceiling pending exact-head audit:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **69**.

## Human citation verification

Automation preserves canonical URLs, check dates, locators, and source roles and generates the published review queue. Only a qualified human reviewer may set a source to `verified: true`; automated retrieval or evidence screening is not that decision. Every newly authored Batch 27 clinical source remains `verified: false`.

## Modeling debt

The named v2 modeling items remain explicitly dispositioned in `docs/modeling-debt-dispositions.md`:

- `contralateral-knee-condition`: quarantined laterality placeholder pending a future structural laterality model;
- `micro-tbi`: historical/non-standard compatibility identity retained as an unpublished draft relative to standardized `mild-tbi`;
- `cerebral-palsy`: recognition identity retained without implying service-connection/legal applicability; mapping remains draft.

These are controlled v2 states and do not justify an unversioned ID deletion or a 300/300 change.

## External/manual gates

See `docs/external-manual-gates-status.md`.

- GitHub issue #189, credentialed VA sandbox smoke test: **OPEN / externally blocked**.
- GitHub issue #195, Section 508 review: **OPEN / human-only**.
- GitHub issue #287, VA public-reference production transition: **OPEN / external-provider gate**.
- GitHub issue #213, production workflow-session secret: **COMPLETE / closed**.

## What “complete” means

Repository automation is complete for a work item when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, immutable-head review is clean, and production closure proves the merge SHA. It does not fabricate human verification, credentials, accessibility observations, or external-provider success.

After Batch 27 there are no `promotion-candidate` Wave identities. The remaining 76 Wave drafts are explicit safe dispositions unless later evidence justifies another bounded review.
