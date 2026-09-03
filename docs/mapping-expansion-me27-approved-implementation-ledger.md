# Mapping Expansion Batch ME-27 — Approved Implementation Ledger

## Scope

ME-27 adds five conservative, draft-only, association-only knowledge-base mappings. Each row has one pending clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| aphakia | visual-impairment | 35051625 | Documented aphakia and separately measured compatible visual impairment, with laterality/chronology and competing ocular-cause review. |
| arrhythmogenic-right-ventricular-dysplasia | congestive-heart-failure | 40202346 | Diagnostic ARVC criteria and objective heart failure are separately required; preserve competing cardiac causes. |
| al-amyloidosis | chronic-kidney-disease | 30299492 | Established AL amyloidosis and objective renal involvement/CKD are separately required. |
| brain-abscess | seizure-disorder | 36810235 | Later objective epilepsy/seizure disorder must be distinguished from acute symptomatic seizures. |
| chronic-b-cell-leukemias | anemia | 34830959 | Apply only to a source-matched CLL/B-cell leukemia phenotype with characterized anemia. |

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with repository canonicalization.

## Aggregate ratchet

- Relationships: `303 → 308`
- Live source reference uses: `311 → 316`
- Verified live uses: `256` unchanged
- Pending live uses: `55 → 60`
- Clinical uses: `306 → 311`
- Explicit publication guards: `229 → 234`
- Source entities including lineage: `297 → 302`

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
