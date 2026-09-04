# Mapping Expansion Batch ME-35 — Approved Implementation Ledger

## Scope

ME-35 adds five conservative, draft-only, association-only mappings over existing catalog identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `brown-s-quard-syndrome` | `urinary-incontinence` | 11746547 | Require documented Brown-Séquard lesion/neurologic phenotype, objective urinary dysfunction, compatible chronology, and neurologic/urologic review; preserve retention, infection, prostate/pelvic, medication, and other bladder causes. |
| `brain-tumors` | `seizure-disorder` | 26332282 | Require documented tumor location/pathology/treatment, separately established seizure disorder, compatible chronology, and distinction between acute symptomatic and later unprovoked seizures; preserve tumor and non-tumor seizure causes. |
| `brugada-syndrome` | `cardiac-arrhythmia` | 27378596 | Require specialist-confirmed Brugada/type-1 ECG phenotype and separately documented ventricular arrhythmia or qualifying event; do not generalize to benign ectopy or unexplained syncope. |
| `bell-s-palsy` | `keratitis` | 28319442 | Require facial palsy with documented exposure/incomplete closure and separately documented exposure keratopathy or compatible keratitis phenotype; exclude infectious and other corneal causes. |
| `bowen-s-disease` | `squamous-cell-carcinoma` | 7804989 | Require biopsy-confirmed in-situ disease and separately established invasive cutaneous SCC at a compatible site and chronology; preserve field cancerization and other skin-cancer risks. |

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, and `NOT_ASSERTED`.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- Registry hashes were generated from the final suggestion/reference objects using repository canonicalization.

## Aggregate ratchet

- Relationships: `342 -> 347`
- Live source reference uses: `350 -> 355`
- Verified live uses: `256` unchanged
- Pending live uses: `94 -> 99`
- Clinical uses: `345 -> 350`
- Explicit publication guards: `268 -> 273`
- Source entities including lineage: `333 -> 338`
- Published/draft mapping counts: `139 / 674` unchanged

## Deferred and rejected candidates

The screening exclusions remain documented in the ME-35 proposed research ledger. No excluded candidate was added by this implementation.

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
