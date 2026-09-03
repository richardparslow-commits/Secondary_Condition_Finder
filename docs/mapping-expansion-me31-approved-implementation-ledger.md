# Mapping Expansion Batch ME-31 — Approved Implementation Ledger

## Scope

ME-31 adds five conservative, draft-only, association-only mappings over existing identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `amebic-liver-abscess` | `pleural-effusion` | 41068883 | Require independently documented amebic liver abscess by imaging or serology, documented pleural effusion by imaging compatible in chronology and laterality, and specialist review. |
| `amputation-of-foot` | `phantom-limb-pain` | 34583023 | Require independently documented amputation, documented phantom limb pain by validated pain assessment compatible in chronology, and specialist review. |
| `amputation-of-hand` | `phantom-limb-pain` | 34583023 | Require independently documented amputation, documented phantom limb pain by validated pain assessment compatible in chronology, and specialist review. |
| `amputation-of-leg` | `phantom-limb-pain` | 34583023 | Require independently documented amputation, documented phantom limb pain by validated pain assessment compatible in chronology, and specialist review. |
| `anismus-pelvic-floor-dyssynergia` | `fecal-incontinence` | 41713710 | Require independently documented dyssynergia by anorectal manometry and balloon-expulsion testing, documented fecal incontinence by validated assessment compatible in chronology, and specialist review. |

## Identity-scope decisions

- The nationwide amputee-survey source (PMID 34583023, introduced in ME-30 for `amputation-of-arm`) was reused across the three additional limb-level amputation identities rather than duplicated as separate source entities; the pending-verification entity now carries four live uses.
- `amputation-of-thumb-fingers-toes` was deferred: digit-level amputation is outside the limb-level scope of the survey evidence.
- `anhedonia` was deferred: it is a transdiagnostic symptom rather than a stand-alone condition, and a `-> depressive-disorder` edge would assert the wrong direction.
- `anal-fissure` and `ankle-disarticulation` were deferred to the next batch pending a credible condition-specific target and citation.
- `amebic-liver-abscess` is a master-resolution `target-only-draft` identity; the helper now carries a ME-31 special-case branch (following the ME-12/ME-13/ME-29 pattern) permitting exactly one bounded suggestion.

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with repository canonicalization.

## Aggregate ratchet

- Relationships: `323 → 328`
- Live source reference uses: `331 → 336`
- Verified live uses: `256` unchanged
- Pending live uses: `75 → 80`
- Clinical uses: `326 → 331`
- Explicit publication guards: `244 → 254`
- Source entities including lineage: `317 → 319` (two new entities: PMIDs 41068883, 41713710; one reused entity: PMID 34583023)

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
