# Clinical Evidence Program Status

Status: **Batch 25 Wave-2 rescreen implementation is repository-controlled; exact-head/production closure remains governed by the normal immutable-head workflow, and external/human gates remain separate**.

## Production-validated base

Batch 25 branches from production-validated `main` SHA `0389bfc8867dfc5daec8c6cf4b3645bfe6e871f0` (`Promote evidence-led Wave 1 mappings (#348)`):

- independent `main` CI #981 passed;
- Production Runtime Readiness #340 passed on the exact SHA after verifying exact deployment, canonical production alias, route matrix, and runtime readiness; and
- no Batch 25 change is considered production-closed until its own exact-head PR CI, immutable-head review, merge-SHA `main` CI, exact Vercel lineage/alias/runtime proof, and Production Runtime Readiness pass.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- The v2 identity universe remains frozen; Batch 25 does not add, delete, rename, or merge conditions.

## Expansion program — current evidence-led dispositions

After the Batch 25 Wave-2 rescreen, `data/expansion-dispositions.json` records:

- **24 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **83 safe-draft** Wave identities.

Batch 25 promotes one additional Wave-2 identity:

- `femoroacetabular-impingement` → `osteoarthritis`: a same-hip biomechanical/disease-progression pathway. Systematic-review evidence is strongest for cam-type morphology, particularly elevated alpha angle, and the mapping explicitly does not generalize that evidence to every pincer or mixed morphology or to individual causation without imaging chronology and competing-risk review.

The other 13 Wave-2 identities remain safe drafts after re-screen. Important non-promotions include preserving the distinction between medial Lisfranc/TMT injury evidence and the catalog's established tarsal/metatarsal malunion/nonunion phenotype; declining to convert broad named mononeuropathies into generic CRPS-II pathways; and declining treatment-confounded patellar-instability/OA evidence as a general natural-history nexus.

A safe draft is a completed reviewed disposition, not a clinical defect.

## Published citation position after Batch 25

The citation ratchet remains at the established ceiling:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65**;
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **69**.

Batch 25 does not raise review debt. The new FAI systematic-review source PMID 26524551 is offset by consolidating the rheumatoid-arthritis→GERD medication pathway: the unverified RA/NSAID treatment-use review PMID 33674957 is removed, the individual medical record must establish actual NSAID use for RA, and PMID 18671778 remains only for the NSAID/GERD association signal. The removed source was `verified: false`, so no verified-source retirement entry is created.

## Modeling debt

The named v2 modeling items remain explicitly dispositioned in `docs/modeling-debt-dispositions.md`:

- `contralateral-knee-condition`: quarantined laterality placeholder pending a future structural laterality model;
- `micro-tbi`: historical/non-standard compatibility identity retained as an unpublished draft relative to standardized `mild-tbi`;
- `cerebral-palsy`: recognition identity retained without implying service-connection/legal applicability; mapping remains draft.

These are controlled v2 states and do not justify an unversioned ID deletion or a 300/300 change.

## Human citation verification

Automation preserves canonical URLs/check dates/locators and generates the published review queue. Only a qualified human reviewer may set a source to `verified: true`; automated retrieval or source checking is not that decision. After Batch 25, the prepared human queue remains **60** pending published references because the Wave-2 promotion uses a citation-debt exchange rather than increasing the queue.

## External/manual gates

See `docs/external-manual-gates-status.md`.

- GitHub issue #189, credentialed VA sandbox smoke test: **OPEN / externally blocked**.
- GitHub issue #195, Section 508 review: **OPEN / human-only**.
- GitHub issue #287, VA public-reference production transition: **OPEN / external-provider gate**.
- GitHub issue #213, production workflow-session secret: **COMPLETE / closed**.

## What “complete” means

Repository automation is complete for a work item when the repository contains a safe explicit state, tests/audits enforce it, exact-head CI passes, and production closure proves the merge SHA. It does not fabricate human verification, credentials, accessibility observations, or external-provider success.

After Batch 25 there are no `promotion-candidate` Wave identities. The remaining 83 Wave drafts are explicit safe dispositions unless later evidence justifies another bounded review.
