# Mapping Expansion ME-38 — Qualified-Human Citation Verification Ledger

**APPROVED-AND-APPLIED-LOCALLY — 3/3 VERIFIED AT ENTRY**

Qualified-human approval was captured in-session on 2026-09-06: all three ME-38 source entities are approved as implemented and entered `verified: true` at implementation across their three citation uses on the single published PTSD → REM sleep behavior disorder relationship. Because the `ptsd` mapping is **published** (`draft: false`) and published mappings may carry only verified sources, the same approval that authorized the mapping expansion authorized citation verification. This verification changes citation state only; relationship identity, rank, guard, and proposition text are unchanged.

## Approved sources

| PMID | Anchor | Live uses | Decision |
|---|---:|---:|---|
| 31587047 | Elliott 2020 vPSG veteran cohort (Sleep) | 1 (rem-sleep-disorder) | `approve-as-implemented` |
| 41616415 | Baldini 2026 PTSD–RBD systematic review (Sleep Med Rev) | 1 (rem-sleep-disorder) | `approve-as-implemented` |
| 32804070 | Barone 2020 PTSD/RBD/TASD clinical review (J Clin Sleep Med) | 1 (rem-sleep-disorder) | `approve-as-implemented` |

## Verification boundary

Each citation was approved only for the exact bounded proposition in its ME-38 mapping: PTSD is associated with increased odds and prevalence of confirmed or probable REM sleep behavior disorder among veterans, while neither causation nor aggravation is established for an individual. Approval of the citations is not approval of causation or aggravation for any individual veteran. The diagnostic-boundary guard (dream enactment alone does not establish RBD; PSG REM sleep without atonia required; TASD/OSA/PLMD/TBI/medications/alcohol-substance use and neurodegenerative risk preserved) remains mandatory. Non-peer-reviewed evidence (Shahkhali 2025 preprint) and the superseded small 2001 case series (Husain) were not entered as verified sources.

## Registry result

- Three KB references entered `verified: true`; three matching master sources entered `active` with `verified: true`.
- Each master source records `qualifiedHumanCitationReviewRequired: false`, decision `approve-as-implemented`, and review date `2026-09-06`.
- Live references advance `376 -> 379`; verified live references advance `376 -> 379`; pending live references remain `0`.
- Active source entities advance `343 -> 346`; pending source entities remain `0`.
- Published/draft mapping totals remain `139 / 674`; relationship count advances `362 -> 363`.
- No GitHub, Vercel, or other remote write was performed.
