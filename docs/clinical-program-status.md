# Clinical Evidence Program Status

Status: **Batch 29 Wave-6 rescreen implementation is repository-controlled on its branch; exact-head/production closure remains governed by the immutable-head workflow, and external/human gates remain separate**.

## Production-validated base

Batch 29 branches from production-validated `main` SHA `c8ad197e8df420034579ba644e60f9cec0168a8d` (`Promote evidence-led Wave 5 mappings (#352)`):

- independent `main` CI #1021 passed;
- Production Runtime Readiness #380 passed on the exact SHA; and
- no Batch 29 change is considered production-closed until its own exact-head PR CI, immutable-head review, protected merge, merge-SHA `main` CI, and Production Runtime Readiness pass.

## Frozen universe

- Catalog identities: **300**.
- Knowledge-base mappings: **300**.
- Target-v2 Wave 1–7 expansion identities: **107**.
- Batch 29 does not add, delete, rename, or merge condition identities.

## Expansion program — Batch 29 candidate state

`data/expansion-dispositions.json` records:

- **31 published-evidence-led** Wave identities;
- **0 promotion-candidate** Wave identities;
- **76 safe-draft** Wave identities.

Batch 29 adds one bounded Wave-6 mapping:

- `discoid-lupus` → `scarring-alopecia`, limited to documented scalp DLE with clinically or dermatopathologically confirmed cicatricial/scarring alopecia and explicit exclusion of nonscarring alopecia, alopecia areata, and systemic-lupus phenotype substitution.

The remaining 13 Wave-6 identities stay safe-draft after screening. In particular, ET thrombotic evidence is broader than the catalog's DVT/phlebitis target, and MDS/myelofibrosis leukemic transformation evidence is AML-specific while the catalog target combines acute and chronic leukemia. Those phenotype mismatches are not widened for publication.

## Evidence-quality cleanup and citation ratchet

Batch 29 withdraws the unverified `adjustment-disorder` → `gerd` edge because PMID 35362447 evaluates psychosocial disorders primarily through anxiety/depression evidence rather than adjustment disorder as a condition-specific exposure. The relationship returns to draft rather than transferring evidence across diagnoses.

The removed source was `verified: false`, so no verified-source retirement entry is created. One new DLE clinical source replaces that one withdrawn row, keeping the expected citation position debt-neutral:

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

Automation preserves canonical URLs, check dates, locators, and source roles and generates the published review queue. Only a qualified human reviewer may set a source to `verified: true`; automated retrieval or evidence screening is not that decision. The newly authored DLE source remains `verified: false`.

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

After Batch 29 there are no `promotion-candidate` Wave identities. The remaining 76 Wave drafts are explicit safe dispositions unless later evidence justifies another bounded review.
