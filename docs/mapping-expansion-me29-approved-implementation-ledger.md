# Mapping Expansion Batch ME-29 — Approved Implementation Ledger

## Scope

ME-29 adds five conservative, draft-only, association-only mappings over existing Wave-8 identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `abscesses` | `cellulitis` | 24973422 | Require independently documented abscess and cellulitis, compatible anatomic site and chronology, objective examination or imaging findings, and clinical review. |
| `achilles-tendinopathy-rupture` | `deep-vein-thrombosis` | 19238360 | Require independently documented Achilles tendon rupture and DVT, compatible laterality and chronology, objective venous imaging, and clinical review. |
| `acne-scarring` | `depressive-disorder` | 40437720 | Require independently documented acne scarring and a diagnosed depressive disorder, compatible chronology and course, objective psychiatric assessment, and mental-health review. |
| `addisons-disease` | `depressive-disorder` | 16545526 | Require independently documented Addison's disease and a diagnosed depressive disorder, compatible chronology and treatment state, objective psychiatric assessment, and mental-health review. |
| `ageusia` | `malnutrition-residuals` | 40700723 | Require independently documented ageusia or another defined taste disorder and objective nutritional impairment, compatible chronology, dietary and weight records, and specialist review. |

## Identity-scope decision

The broader `alopecia` identity was deliberately left unmapped this batch. The narrower `alopecia-areata` identity already carries a `depressive-disorder` relationship built on areata-specific meta-analytic evidence (PMID 31163237); authoring the same edge under the broader identity would duplicate a narrower identity contrary to expansion rule 11. `alopecia` remains queued for a scope-correct relationship with its own evidence.

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with repository canonicalization.

## Aggregate ratchet

- Relationships: `313 → 318`
- Live source reference uses: `321 → 326`
- Verified live uses: `256` unchanged
- Pending live uses: `65 → 70`
- Clinical uses: `316 → 321`
- Explicit publication guards: `239 → 244`
- Source entities including lineage: `307 → 312`

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
