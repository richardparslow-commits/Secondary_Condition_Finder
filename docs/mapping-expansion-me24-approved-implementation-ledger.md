# Mapping Expansion ME-24 - Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY - CITATIONS PENDING VERIFICATION**

Required baseline: `ea005e50ccbc30800dd46f3872f764f98e977c1f`
Commit subject: `map: mapping expansion ME-24 (5 relationships)`
Issue: #360 Mapping Expansion Wave (ME-15+); ME-24 continues the Wave-8 framework-only backlog over catalog 813

## Approved Scope

Five bounded relationships were approved and applied on 2026-09-02. Each was added at rank 1 to a framework-only draft primary. All five primaries remain `draft: true`, all five clinical references remain `verified:false`, and matching master sources remain `pending-verification`. Citation verification and publication are separate qualified-human gates.

## Relationships

1. `adenomyosis` -> `anemia` - PMID `36182260`; uterine-disorder and iron-deficiency-anemia review. Restrict the edge to documented adenomyosis, separately established anemia, compatible bleeding/chronology, and competing-cause review.
2. `acute-interstitial-pneumonia` -> `pulmonary-fibrosis` - PMID `11144035`; acute-interstitial-pneumonitis case series and literature review. Restrict the edge to documented acute interstitial pneumonitis, objective fibrosis, compatible chronology, and alternative interstitial-lung-disease review.
3. `avascular-necrosis` -> `osteoarthritis` - PMID `31536264`; femoral-head avascular-necrosis clinical overview. Restrict the edge to compatible-site AVN, objective osteoarthritis, imaging correlation, chronology, and competing-cause review.
4. `autoimmune-metaplastic-atrophic-gastritis` -> `stomach-cancer` - PMID `36769710`; systematic review and case reports of gastric neoplasms in autoimmune metaplastic atrophic gastritis. Restrict the edge to biopsy-confirmed gastritis, pathology-confirmed stomach cancer, compatible site/chronology, and specialist review.
5. `blind-loop-syndrome` -> `anemia` - PMID `32429454`; small-intestinal-bacterial-overgrowth review. Restrict the edge to documented blind-loop/SIBO phenotype, objective anemia and nutritional findings, compatible chronology, and competing-cause review.

All five edges use `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`, with `causalMechanism.hypothesizedOnly: true`. No causation, aggravation, publication, taxonomy, or pathway-intelligence change is asserted.

## Projected State

- Relationships: 288 -> **293**
- Registered primaries: 199 -> **204** of 813
- Remaining primaries: 614 -> **609**; target-only primaries remain **37**
- Live references: 296 -> **301**; verified remains **256**; unverified **40 -> 45**
- Master sources: 233 active / 40 pending / 282 total -> **233 active / 45 pending / 287 total**
- Explicit publication guards: 214 -> **219**; legacy boundaries remain **74**
- Draft single-suggestion primaries: 59 -> **64**

## Local Implementation Result

- 5/5 approved relationships added at rank 1.
- Read-before-write publication states preserved: all five selected primaries remain draft.
- 5/5 new source references remain `verified:false`; matching source records remain `pending-verification`.
- No citation promotion or remote write was performed.
- The next framework-only backlog continues after these five rows.
