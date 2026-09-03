# Mapping Expansion Batch ME-30 — Approved Implementation Ledger

## Scope

ME-30 adds five conservative, draft-only, association-only mappings over existing identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `alice-in-wonderland-syndrome` | `migraine-headaches` | 42065956 | Require independently documented AIWS episodes with characteristic visual distortions, documented migraine headache meeting ICHD criteria compatible in chronology, and specialist neurologic review. |
| `agranulocytosis` | `cellulitis` | 28823525 | Require independently documented agranulocytosis with absolute neutrophil counts in the agranulocytosis range, microbiologically or clinically documented cellulitis compatible in chronology, and specialist review. |
| `als` | `dysphagia` | 41744126 | Require independently documented ALS with bulbar or generalized involvement, objectively documented dysphagia by validated instrumental or non-instrumental assessment compatible in chronology, and specialist review. |
| `alzheimer-s-disease` | `insomnia` | 41985272 | Require independently documented Alzheimer disease, objectively documented insomnia disorder by validated sleep assessment compatible in chronology, and specialist review. |
| `amputation-of-arm` | `phantom-limb-pain` | 34583023 | Require independently documented upper-limb amputation, documented phantom limb pain by validated pain assessment compatible in chronology, and specialist review. |

## Identity-scope decisions

- `adjustment-disorder` was deliberately left unmapped: it carries a `FINAL-CLOSE-DIRECTION` master resolution after its earlier GERD suggestion was withdrawn for non-condition-specific psychosocial evidence, and the defensible review evidence for a depression progression edge is of that same broad category. The closure remains in force pending genuinely adjustment-disorder-specific evidence.
- `adjustment-disorders` (plural synonym identity) stays empty to avoid duplicating the singular identity.
- `acquired-syndactyly` and `acrocyanosis` were deferred: no defensible condition-specific target exists among current identities (benign/localized processes without a credible secondary-condition edge).
- `amputation-of-arm → phantom-limb-pain` passed the rule-11 duplicate check: no existing identity carries a `phantom-limb-pain` suggestion.

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with repository canonicalization.

## Aggregate ratchet

- Relationships: `318 → 323`
- Live source reference uses: `326 → 331`
- Verified live uses: `256` unchanged
- Pending live uses: `70 → 75`
- Clinical uses: `321 → 326`
- Explicit publication guards: `244 → 249`
- Source entities including lineage: `312 → 317`

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
