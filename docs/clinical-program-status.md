# Clinical Evidence Program Status

Status: **Batch 24 Wave-1 rescreen implementation is repository-controlled; exact-head/production closure remains governed by the normal immutable-head workflow, and external/human gates remain separate**.

## Production-validated base

Batch 24 branches from production-validated `main` SHA `0e03af2b76d08321d3167ac37469874d8e29d542` (`Replace dormant browser telemetry with server OpenTelemetry (#347)`):

- independent `main` CI #965 passed;
- Production Runtime Readiness #324 passed on the exact SHA after verifying the exact Vercel deployment, production alias, route matrix, and runtime-readiness endpoint; and
- no Batch 24 change is considered production-closed until its own exact-head PR CI, immutable-head review, merge-SHA `main` CI, exact Vercel lineage/alias/runtime proof, and Production Runtime Readiness pass.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- The v2 identity universe remains frozen; Batch 24 does not add, delete, rename, or merge conditions.

## Expansion program — current evidence-led dispositions

The original expansion roadmap defines the 107 Wave 1–7 identities. `diabetes-mellitus-type-1` is not in those seven wave lists and is not counted in the Wave 1–7 promotion total.

After the Batch 24 Wave-1 rescreen, `data/expansion-dispositions.json` records:

- **23 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **84 safe-draft** Wave identities;
- therefore **84 of 107 Wave identities remain intentionally draft** pending any future evidence-led rescreen.

Batch 24 promotes three additional Wave-1 identities conservatively:

- `osteitis-deformans` → `osteoarthritis`: site-specific Paget-related secondary osteoarthritis research, requiring anatomic correlation with the affected Paget bone/joint;
- `syringomyelia` → `charcot-arthropathy`: neuropathic-joint pathway requiring neurologic and anatomic correlation with the syrinx; and
- `trigeminal-neuralgia` → `depressive-disorder` and `anxiety-disorder`: somatopsychic association research that preserves chronology, competing-cause review, and the distinction between population association and individual causation/aggravation.

The other 12 Wave-1 identities re-screened in Batch 24 remain safe drafts because no sufficiently specific downstream relationship was approved without phenotype overreach, reversed directionality, or a mismatch with the current catalog target model. In particular, generic `myositis` is not treated as interchangeable with idiopathic inflammatory myopathy merely to publish an ILD pathway.

A safe draft is a completed reviewed disposition, not a clinical defect; the program does not force publication when condition-specific evidence and model fit are inadequate.

## Published citation position after Batch 24

The Batch 24 citation ratchet remains at the established ceiling:

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

Batch 24 does not raise citation-review debt. Four new focused published source records are offset by six redundant/lower-value published source-record removals, including avoiding duplicate trigeminal-neuralgia references across both psychiatric targets. The cleanup also narrows existing evidence where appropriate: adjustment-disorder→GERD now relies on the psychosocial/GERD systematic review rather than a tangential NSAID source; PsA→depression uses the PsA-specific overview of systematic reviews; CES→erectile-dysfunction retains the condition-specific 2025 systematic review; and depressive-disorder→erectile-dysfunction retains the psychotropic-drug review that directly reports erectile-dysfunction outcomes. All newly authored or retained-unverified sources remain `verified: false`.

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

Only a qualified human reviewer may make the repository decision to set a source to `verified: true`. An automated source check is not that decision. After Batch 24, the prepared human queue remains **60** pending published references because the Wave-1 promotions use a citation-debt exchange rather than increasing the queue.

## External/manual gates

See `docs/external-manual-gates-status.md`.

- GitHub issue #189, credentialed VA sandbox smoke test: **OPEN / externally blocked** until issued secrets are configured outside chat and the real sandbox workflow is dispatched with objective non-sensitive success evidence.
- GitHub issue #195, Section 508 review: **OPEN / human-only** until the manual accessibility workbook is completed and signed off.
- GitHub issue #287, VA public-reference production transition: **OPEN / external-provider gate** until VA production access is granted and live production connectivity is objectively verified.
- GitHub issue #213, production workflow-session secret: **COMPLETE / closed**.

## What “complete” means

Repository automation is complete for a work item when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, and production closure proves the merge SHA. It does not fabricate human verification, credentials, accessibility observations, or external-provider success.

After Batch 24 there are no `promotion-candidate` Wave identities. The remaining 84 Wave drafts are explicit safe dispositions unless later evidence justifies another bounded review.
