# Mapping Expansion ME-37 — Qualified-Human Citation Verification Ledger

**APPROVED-AND-APPLIED-LOCALLY — 8/8 VERIFIED AT ENTRY (15 CITATION USES)**

Qualified-human approval was captured in-session on 2026-09-06: all eight ME-37 source entities are approved as implemented and entered `verified: true` at implementation across their 15 citation uses. Because the `ptsd` mapping is **published** (`draft: false`) and published mappings may carry only verified sources, the same approval that authorized the mapping expansion authorized citation verification. This verification changes citation state only; relationship identities, ranks, guards, CRG metadata, and pathway metadata are unchanged.

## Approved sources

| PMID | Anchor | Live uses (PTSD edges) | Decision |
|---|---:|---:|---|
| 23758060 | Bartoli 2013 MetS SR/MA | 1 (metabolic-syndrome) | `approve-as-implemented` |
| 25982700 | Rosenbaum 2015 MetS SR/MA | 1 (metabolic-syndrome) | `approve-as-implemented` |
| 40051767 | Mandagere 2025 autoimmune SR/MA | 5 (SLE, RA, IBD, MS, thyroiditis) | `approve-as-implemented` |
| 37322294 | Hsu 2024 Taiwan autoimmune cohort | 4 (SLE, RA, IBD, thyroiditis) | `approve-as-implemented` |
| 30144372 | Ng 2019 IBS SR/MA | 1 (irritable-bowel-syndrome) | `approve-as-implemented` |
| 36942766 | Malhotra 2023 GWI veterans GI | 1 (gerd) | `approve-as-implemented` |
| 41350112 | Bourassa 2025 incident chronic disease | 1 (copd) | `approve-as-implemented` |
| 40402632 | Vyas 2025 veterans-with-HIV | 1 (copd) | `approve-as-implemented` |

## Verification boundary

Each citation was approved only for the exact bounded proposition in its ME-37 mapping. All nine edges are `ASSOCIATION_ONLY` and `NOT_ESTABLISHED`; approval of the citation is not approval of causation or aggravation for any individual veteran. The bounded requirements documented in the ME-37 implementation ledger remain mandatory, including the narrower GERD bound and the smoking/exposure-dominated COPD guard.

## Registry result

- Fifteen KB references entered `verified: true`; eight matching master sources entered `active` with `verified: true`.
- Each master source records `qualifiedHumanCitationReviewRequired: false`, decision `approve-as-implemented`, and review date `2026-09-06`.
- Live references advance `361 -> 376`; verified live references advance `361 -> 376`; pending live references remain `0`.
- Active source entities advance `335 -> 343`; pending source entities remain `0`.
- Published/draft mapping totals remain `139 / 674`; relationship count advances `353 -> 362`.
- No GitHub, Vercel, or other remote write was performed.
