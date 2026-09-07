# Mapping Expansion ME-36 — Qualified-Human Citation Verification Ledger

**APPROVED-AND-APPLIED-LOCALLY — 6/6 VERIFIED AT ENTRY**

Qualified-human approval was captured in-session on 2026-09-06: all six ME-36 citations are approved as implemented and entered `verified: true` at implementation. Because the `ptsd` mapping is **published** (`draft: false`) and published mappings may carry only verified sources under this repository's governance, the six sources could not enter as pending; the same approval that authorized the mapping expansion authorized their citation verification. This verification changes citation state only; relationship identities, ranks, guards, CRG metadata, and pathway metadata are unchanged.

## Approved dispositions

| Primary | Target | PMID | Rank | Decision |
|---|---|---:|---:|---|
| `ptsd` | `ischemic-heart-disease` | 24176435 | 4 | `approve-as-implemented` |
| `ptsd` | `hypertension` | 27490852 | 5 | `approve-as-implemented` |
| `ptsd` | `diabetes-mellitus-type-2` | 26867081 | 6 | `approve-as-implemented` |
| `ptsd` | `depressive-disorder` | 23696449 | 7 | `approve-as-implemented` |
| `ptsd` | `insomnia` | 36163136 | 8 | `approve-as-implemented` |
| `ptsd` | `substance-use-disorder` | 11481147 | 9 | `approve-as-implemented` |

## Verification boundary

Each citation was approved only for the exact bounded proposition present in its ME-36 mapping. All six edges are `ASSOCIATION_ONLY` and `NOT_ESTABLISHED`; approval of the citation is not approval of causation or aggravation for any individual veteran. The bounded requirements (independent diagnosis, compatible chronology, preservation of competing causes, and specialty review) documented in the ME-36 implementation ledger remain mandatory.

- Ischemic heart disease: population CHD risk; objective cardiac evaluation and conventional risk-factor preservation required.
- Hypertension: incident-hypertension risk; repeated-measurement criteria and secondary-cause evaluation required.
- Type 2 diabetes: association with confounding cautioned by the meta-analysis; laboratory-supported diagnosis and metabolic risk-factor preservation required.
- Depressive disorder: MDD co-occurrence; distinct-episode separation and competing mood/bereavement/substance causes required.
- Insomnia: bidirectional cohort evidence; distinct-insomnia-disorder evaluation and sleep-disordered-breathing exclusion required.
- Substance use disorder: co-occurrence review; specific-SUD documentation and onset-sequence assessment required.

## Registry result

- Six KB references entered `verified: true`; six matching master sources entered `active` with `verified: true`.
- Each master source records `qualifiedHumanCitationReviewRequired: false`, decision `approve-as-implemented`, and review date `2026-09-06`.
- Live references advance `355 -> 361`; verified live references advance `355 -> 361`; pending live references remain `0`.
- Active source entities advance `329 -> 335`; pending source entities remain `0`.
- Published/draft mapping totals remain `139 / 674`; relationship count advances `347 -> 353`.
- No GitHub, Vercel, or other remote write was performed.
