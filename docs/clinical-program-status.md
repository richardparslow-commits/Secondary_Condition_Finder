# Clinical Evidence Program Status

Status: **repository-controlled through Clinical Evidence Promotion Batch 22; external/human gates separated below**.

## Production baseline

Clinical Evidence Promotion Batch 22 is independently production-closed on squash SHA `51b36b39e96b3ea5c6d5bd3cf8efdcc92eb56a39`:

- exact-head PR CI passed;
- independent `main` CI #927 passed;
- the exact Vercel production deployment reached READY, served the canonical alias, matched verified GitHub lineage, and had no inspected error/fatal runtime logs; and
- Production Runtime Readiness #286 passed on the same SHA.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- The v2 identity universe remains frozen; this status does not add or delete conditions.

## Expansion program — corrected roadmap-backed accounting

The original expansion roadmap defines the 107 Wave 1–7 identities. `diabetes-mellitus-type-1` is not in those seven wave lists, so its later CKD evidence promotion must not be counted as a Wave 1–7 expansion promotion.

Current roadmap-backed dispositions are recorded in `data/expansion-dispositions.json`:

- **18 published-evidence-led** Wave identities;
- **2 promotion-candidate** Wave identities (`gout`, `myasthenia-gravis`), still draft pending their own exact-head evidence batch;
- **87 safe-draft** Wave identities, including `trigeminal-neuralgia` after its initially noted screening PMID was found not to support that condition/proposition;
- therefore **89 of 107 Wave identities are currently draft**.

A safe draft is a completed reviewed disposition, not a clinical defect. The program does not force publication when no strong condition-specific secondary relationship has been approved.

## Published citation position after Batch 22

Current audit baseline:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **63**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **67**.

The remaining `verified: false` published references are not automatically defective; they are the qualified-human verification queue. Use `npm run citations:queue` to generate the exact current list.

## Modeling debt

The remaining named v2 modeling items are explicitly dispositioned in `docs/modeling-debt-dispositions.md`:

- `contralateral-knee-condition`: quarantined laterality placeholder pending a future structural laterality model;
- `micro-tbi`: historical/non-standard compatibility identity retained as an unpublished draft relative to standardized `mild-tbi`;
- `cerebral-palsy`: recognition identity retained without implying service-connection/legal applicability; mapping remains draft.

These are controlled v2 states and do not justify an unversioned ID deletion or a 300/300 change.

## Human citation verification

Automation has completed the preparation layer:

- canonical source URLs/check dates/locators are preserved in live source records;
- unsafe previously verified citations can be retired with provenance in `data/citation-retirements.json`;
- `npm run citations:queue` generates every live published reference still requiring human review;
- reviewer workflow and outcomes are documented in `docs/qualified-human-citation-verification-queue.md`.

Only a qualified human reviewer may make the repository decision to set a source to `verified: true`. An automated source check is not that decision.

## External/manual gates

See `docs/external-manual-gates-status.md`.

- GitHub issue #189, credentialed VA sandbox smoke test: **OPEN / externally blocked** until issued secrets are configured outside chat and the real sandbox workflow is dispatched with objective non-sensitive success evidence.
- GitHub issue #195, Section 508 review: **OPEN / human-only** until the manual accessibility workbook is completed and signed off.
- GitHub issue #213, production workflow-session secret: **COMPLETE / closed**.

## What “complete” means

Repository automation is complete for a work item when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, and production closure proves the merge SHA. It does not fabricate human verification, credentials, accessibility observations, or external-provider success.

The two screened promotion candidates may be promoted only in a separate bounded evidence batch. Every other Wave identity already has an explicit safe disposition.
