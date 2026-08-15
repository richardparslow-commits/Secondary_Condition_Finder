# Clinical Evidence Program Status

Status: **Batch 28 Wave-5 rescreen implementation is repository-controlled; exact-head/production closure remains governed by the immutable-head workflow, and external/human gates remain separate**.

## Production-validated base

Batch 28 branches from production-validated `main` SHA `f07b11e1df647269e6922701610dec7d18c47f77` (`Promote evidence-led Wave 4 mappings (#351)`):

- independent `main` CI #1001 passed;
- Production Runtime Readiness #360 passed on the exact SHA; and
- no Batch 28 change is considered production-closed until its own exact-head PR CI, immutable-head review, protected merge, merge-SHA `main` CI, and Production Runtime Readiness pass.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- Batch 28 does not add, delete, rename, or merge condition identities.

## Expansion program — Batch 28 candidate state

`data/expansion-dispositions.json` records:

- **31 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **76 safe-draft** Wave identities.

Batch 28 adds three bounded Wave-5 mappings:

- `rectal-prolapse` → `fecal-incontinence`, requiring documented continence dysfunction and individual assessment of sphincter, pelvic-floor, neurologic, stool-consistency, and surgical contributors;
- `anal-fistula` → `fecal-incontinence`, limited to a documented sphincter-cutting/sphincter-involving treatment complication with compatible postoperative onset or worsening; and
- `hydronephrosis` → `chronic-kidney-disease`, limited to proven urinary obstruction producing hydronephrosis plus persistent renal impairment; hydronephrosis imaging alone is insufficient.

The other unpublished Wave-5 identities remain safe-draft. A safe draft is a completed reviewed disposition, not a clinical defect.

## Evidence-quality cleanup and citation ratchet

Batch 28 returns three unverified Wave-1 depression edges to safe-draft while adding three stronger mechanism-specific Wave-5 sources:

- withdraw `gout` → `depressive-disorder` because the literature supports a modest association/incident-risk signal but not individual causation or aggravation;
- withdraw `myasthenia-gravis` → `depressive-disorder` because the attached systematic review is prevalence-focused rather than directional; and
- withdraw `multiple-sclerosis` → `depressive-disorder` because the attached meta-analysis estimates prevalence with substantial heterogeneity rather than establishing an MS-primary causal/aggravation pathway.

`seizure-disorder` → `depressive-disorder` remains published because separate meta-analytic evidence includes cohort risk estimates and is stronger than a prevalence-only signal.

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

Automation preserves canonical URLs, check dates, locators, and source roles and generates the published review queue. Only a qualified human reviewer may set a source to `verified: true`; automated retrieval or evidence screening is not that decision. Every newly authored Batch 28 clinical source remains `verified: false`.

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

After Batch 28 there are no `promotion-candidate` Wave identities. The remaining 76 Wave drafts are explicit safe dispositions unless later evidence justifies another bounded review.
