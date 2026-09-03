# Mapping Expansion ME-23 - Approved Implementation Ledger

**APPROVED AND APPLIED LOCALLY - CITATIONS PENDING VERIFICATION**

Required baseline: `ea005e50ccbc30800dd46f3872f764f98e977c1f`
Commit subject: `map: mapping expansion ME-23 (5 relationships)`
Issue: #360 Mapping Expansion Wave (ME-15+); ME-23 continues the Wave-8 framework-only backlog over catalog 813

## Approved Scope

Five bounded relationships were approved and applied on 2026-09-02. Each was added at rank 1 to a framework-only draft primary. All five primaries remain `draft: true`, all five clinical references remain `verified:false`, and matching master sources remain `pending-verification`. Citation verification and publication are separate qualified-human gates.

## Relationships

1. `cholesteatoma` -> `conductive-hearing-loss` - PMID `22410730`; cholesteatoma ossicular-status study. Restrict the edge to documented cholesteatoma, objective conductive hearing loss, compatible ear/chronology, and ossicular or middle-ear review.
2. `otitis-media` -> `hearing-loss` - PMID `22558393`; systematic review and global estimates of otitis-media burden. Restrict the edge to documented otitis media, objective hearing loss, compatible ear/chronology, and competing-cause review.
3. `acoustic-neuroma` -> `hearing-loss` - PMID `37024333`; sporadic vestibular-schwannoma hearing-loss natural-history review. Restrict the edge to documented vestibular schwannoma/acoustic neuroma, objective hearing loss, compatible laterality/chronology, and tumor or treatment review.
4. `actinic-keratosis` -> `squamous-cell-carcinoma` - PMID `23647091`; actinic-keratosis natural-history systematic review. Restrict the edge to documented actinic keratosis and cutaneous SCC with compatible site/chronology and pathology review.
5. `abdominal-migraine` -> `migraine-headaches` - PMID `29459383`; abdominal-migraine clinical review. Restrict the edge to documented abdominal migraine, separate migraine-headache diagnosis, compatible chronology/phenotype, and competing-cause review.

All five edges use `ASSOCIATION_ONLY` / `NOT_ESTABLISHED` / `NOT_ASSERTED`, with `causalMechanism.hypothesizedOnly: true`. No causation, aggravation, publication, taxonomy, or pathway-intelligence change is asserted.

## Projected State

- Relationships: 283 -> **288**
- Registered primaries: 194 -> **199** of 813
- Remaining primaries: 619 -> **614**; target-only primaries remain **37**
- Live references: 291 -> **296**; verified remains **256**; unverified **35 -> 40**
- Master sources: 233 active / 35 pending / 277 total -> **233 active / 40 pending / 282 total**
- Explicit publication guards: 209 -> **214**; legacy boundaries remain **74**
- Draft single-suggestion primaries: 54 -> **59**

## Local Implementation Result

- 5/5 approved relationships added at rank 1.
- Read-before-write publication states preserved: all five selected primaries remain draft.
- 5/5 new source references remain `verified:false`; matching source records remain `pending-verification`.
- No citation promotion or remote write was performed.
- The next framework-only backlog continues after these five rows.
