# Clinical Evidence Program Status

Status: **Batch 23 implementation state is repository-controlled; exact-head/production closure remains governed by the normal immutable-head workflow, and external/human gates remain separate**.

## Production-validated base

Batch 23 branches from production-validated `main` SHA `fe2d29d1470755decffb5a3403db3fa9ec3d921d` (`Add clinical program completion controls (#333)`):

- independent `main` CI #933 passed;
- Production Runtime Readiness #292 passed on the exact SHA after verifying the exact Vercel deployment, production alias, route matrix, and runtime-readiness endpoint; and
- no Batch 23 change is considered production-closed until its own exact-head PR CI, merge SHA `main` CI, Vercel lineage/alias/log proof, and Production Runtime Readiness pass.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- The v2 identity universe remains frozen; Batch 23 does not add or delete conditions.

## Expansion program — completed candidate queue

The original expansion roadmap defines the 107 Wave 1–7 identities. `diabetes-mellitus-type-1` is not in those seven wave lists and is not counted in the Wave 1–7 promotion total.

After Batch 23, `data/expansion-dispositions.json` records:

- **20 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **87 safe-draft** Wave identities;
- therefore **87 of 107 Wave identities remain intentionally draft**.

Batch 23 resolves the final two screened promotion candidates conservatively:

- `gout` → `depressive-disorder`: association/comorbidity research using a gout-specific systematic review/meta-analysis;
- `myasthenia-gravis` → `depressive-disorder`: association/comorbidity research using an MG-specific systematic review/meta-analysis.

Neither promotion carries automatic causal pathway metadata. A safe draft remains a completed reviewed disposition, not a clinical defect; the program does not force publication when no strong condition-specific secondary relationship has been approved.

## Published citation position after Batch 23

Current Batch 23 audit position:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **69**.

The difference between 62 live-unverified references and 60 published review findings is intentional: draft mappings can contain unverified research references, while the qualified-human queue includes only references used by published mappings.

Batch 23 keeps the debt ceilings flat by removing two lower-value published review rows before adding the two new clinical sources: the unsupported adjustment-disorder→migraine legal/rating-only edge is withdrawn, and a redundant unverified §3.310 source is removed from the already clinically supported depressive-disorder→erectile-dysfunction edge.

## Modeling debt

The named v2 modeling items remain explicitly dispositioned in `docs/modeling-debt-dispositions.md`:

- `contralateral-knee-condition`: quarantined laterality placeholder pending a future structural laterality model;
- `micro-tbi`: historical/non-standard compatibility identity retained as an unpublished draft relative to standardized `mild-tbi`;
- `cerebral-palsy`: recognition identity retained without implying service-connection/legal applicability; mapping remains draft.

These are controlled v2 states and do not justify an unversioned ID deletion or a 300/300 change.

## Human citation verification

Automation has completed the preparation layer:

- canonical source URLs/check dates/locators are preserved in live source records;
- unsafe previously verified citations can be retired with provenance in `data/citation-retirements.json`;
- `npm run citations:queue` generates every live **published** reference still requiring human review;
- reviewer workflow and outcomes are documented in `docs/qualified-human-citation-verification-queue.md`.

Only a qualified human reviewer may make the repository decision to set a source to `verified: true`. An automated source check is not that decision. After Batch 23, the prepared human queue contains **60** pending published references.

## External/manual gates

See `docs/external-manual-gates-status.md`.

- GitHub issue #189, credentialed VA sandbox smoke test: **OPEN / externally blocked** until issued secrets are configured outside chat and the real sandbox workflow is dispatched with objective non-sensitive success evidence.
- GitHub issue #195, Section 508 review: **OPEN / human-only** until the manual accessibility workbook is completed and signed off.
- GitHub issue #213, production workflow-session secret: **COMPLETE / closed**.

## What “complete” means

Repository automation is complete for a work item when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, and production closure proves the merge SHA. It does not fabricate human verification, credentials, accessibility observations, or external-provider success.

After Batch 23 there are no remaining `promotion-candidate` Wave identities. The remaining 87 Wave drafts are explicit safe dispositions unless new evidence justifies a future bounded review.
