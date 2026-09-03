# Mapping Expansion ME-22 - Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY - CITATIONS PENDING VERIFICATION**

Required baseline: `ea005e50ccbc30800dd46f3872f764f98e977c1f`
Commit subject: `map: mapping expansion ME-22 (5 relationships)`
Issue: #360 Mapping Expansion Wave (ME-15+); ME-22 continues the Wave-8 framework-only backlog over catalog 813

## Approved Scope

Five bounded relationships were approved and applied on 2026-09-02. Each was added at rank 1 to a framework-only draft primary. All five primaries remain `draft: true`, all five clinical references remain `verified:false`, and matching master sources remain `pending-verification`. Citation verification and publication are separate qualified-human gates.

## Relationships

1. `transient-ischemic-attack-residuals` -> `cerebrovascular-accident-stroke-residuals` - PMID `18071162`; systematic review/meta-analysis of early stroke risk after TIA. Restrict the edge to a documented TIA, a later completed stroke with objective residuals, compatible chronology, and review of vascular alternatives.
2. `testicular-torsion` -> `testicular-atrophy` - PMID `26509312`; pediatric salvage cohort. Restrict the edge to documented torsion, later objective ipsilateral volume loss, operative/ischemia chronology, and review of congenital, infectious, and traumatic alternatives.
3. `lichen-sclerosus` -> `squamous-cell-carcinoma` - PMID `32089333`; systematic review of anogenital lichen-sclerosus SCC risk. Restrict the edge to biopsy-documented anogenital disease, separately established anogenital SCC, compatible chronology, and site/pathology review.
4. `nasal-polyps` -> `asthma` - PMID `33065369`; CRSwNP/asthma clinical review. Restrict the edge to documented chronic rhinosinusitis with nasal polyps, separately established asthma, compatible chronology, and competing respiratory-cause review.
5. `diabetic-gastroparesis` -> `gastroparesis` - PMID `31081877`; diabetic-gastroparesis clinical review. Restrict the edge to documented diabetes, objectively established gastroparesis, compatible chronology, and exclusion of obstruction, medication, neurologic, and idiopathic causes.

All five edges use `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`, with `causalMechanism.hypothesizedOnly: true`. No causation, aggravation, publication, taxonomy, or pathway-intelligence change is asserted.

## Projected State

- Relationships: 278 -> **283**
- Registered primaries: 189 -> **194** of 813
- Remaining primaries: 624 -> **619**; target-only primaries remain **37**
- Live references: 286 -> **291**; verified remains **256**; unverified **30 -> 35**
- Master sources: 233 active / 30 pending / 272 total -> **233 active / 35 pending / 277 total**
- Explicit publication guards: 204 -> **209**; legacy boundaries remain **74**
- Draft single-suggestion primaries: 49 -> **54**

## Local Implementation Result

- 5/5 approved relationships added at rank 1.
- Read-before-write publication states preserved: all five selected primaries remain draft.
- 5/5 new source references remain `verified:false`; matching source records remain `pending-verification`.
- No citation promotion or remote write was performed.
- The next framework-only backlog continues after these five rows.
