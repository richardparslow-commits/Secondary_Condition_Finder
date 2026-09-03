# Mapping Expansion Batch ME-26 — Approved Implementation Ledger

## Scope

ME-26 adds five conservative, draft-only, association-only knowledge-base mappings. Each row has one pending clinical reference, an explicit publication guard, a hypothesized mechanism, and no pathway intelligence.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| acute-stress-reaction | ptsd | 21208593 | Acute-stress-disorder phenotype and qualifying trauma are required; later PTSD and chronology must be separately established. |
| atopic-dermatitis-eczema | asthma | 34384834 | Atopic phenotype and objective asthma diagnosis are required; eczema or atopy alone is insufficient. |
| coarctation-of-the-aorta | hypertension | 37443581 | Anatomy/repair, objective hypertension, residual physiology, and chronology are required. |
| chronic-bronchitis | copd | 23204254 | Chronic-bronchitis phenotype and post-bronchodilator spirometric COPD are distinct requirements. |
| cataracts | visual-impairment | 40227658 | Objective cataract and separately measured compatible visual impairment are required. |

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before any citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with the repository canonicalization routine.

## Aggregate ratchet

- Relationships: `298 → 303`
- Live source reference uses: `306 → 311`
- Verified live uses: `256` unchanged
- Pending live uses: `50 → 55`
- Clinical uses: `301 → 306`
- Explicit publication guards: `224 → 229`
- Source entities including lineage: `292 → 297`

## Safety boundary

The records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. The pending citation state is intentionally fail-closed.
